import Link from 'next/link'
import { Calendar, Users, ChevronRight, MessageSquare } from 'lucide-react'
import { getUsers } from '@/lib/services/usersService'
import { getSessionUser } from '@/lib/auth/getSessionUser'
import { getAllMeetings } from '@/lib/airtable/meetings'
import { buildEmailToUserMap, findClientForMeeting, groupMeetingsByUser } from '@/lib/services/meetingsService'
import { fetchAllMessages } from '@/lib/airtable/messages'
import PageHeader from '@/components/layout/PageHeader'
import type { User, Meeting, Message } from '@/lib/types'

// ── helpers ───────────────────────────────────────────────────────────────────

function getDisplayName(user: User): string {
  if (user.fullName) return user.fullName
  if (user.firstName || user.lastName)
    return [user.firstName, user.lastName].filter(Boolean).join(' ')
  return user.preferredName ?? user.email
}

function getInitials(user: User): string {
  const first = user.firstName ?? user.fullName?.split(' ')[0] ?? ''
  const last = user.lastName ?? user.fullName?.split(' ').slice(-1)[0] ?? ''
  return `${first[0] ?? ''}${last[0] ?? ''}`.toUpperCase() || user.email[0].toUpperCase()
}

const AVATAR_COLORS = [
  'bg-blue-100 text-blue-700',
  'bg-violet-100 text-violet-700',
  'bg-emerald-100 text-emerald-700',
  'bg-amber-100 text-amber-700',
  'bg-rose-100 text-rose-700',
  'bg-cyan-100 text-cyan-700',
]

function avatarColor(id: string): string {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]
}

function formatTimeRange(startIso: string, endIso?: string): string {
  const fmt = (iso: string) =>
    new Date(iso).toLocaleString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  return endIso ? `${fmt(startIso)} – ${fmt(endIso)}` : fmt(startIso)
}

function formatDateShort(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

// ── page ──────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const sessionUser = await getSessionUser()

  const [users, allMeetings, allMessages] = await Promise.all([
    getUsers(),
    getAllMeetings(),
    fetchAllMessages(),
  ])

  // Build email → user lookup (matches both email and workEmail, normalised)
  const emailToUser = buildEmailToUserMap(users)

  // ── Upcoming meetings: now → +7 days ──────────────────────────────────────
  const now = new Date()
  const sevenDaysOut = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

  const upcomingMeetings = allMeetings
    .filter((m) => {
      if (!m.startTime) return false
      const t = new Date(m.startTime)
      return t >= now && t <= sevenDaysOut
    })
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())

  // Attach matched client to each upcoming meeting
  interface MeetingWithClient { meeting: Meeting; client: User | null }
  const upcomingWithClients: MeetingWithClient[] = upcomingMeetings.map((meeting) => ({
    meeting,
    client: findClientForMeeting(meeting, emailToUser),
  }))

  // ── Client activity ────────────────────────────────────────────────────────

  // Group meetings by user.id (via normalised email match, service layer)
  const meetingsByUser = groupMeetingsByUser(allMeetings, users)

  // Group messages by user.id (via linked record IDs)
  const messagesByUser = new Map<string, Message[]>()
  for (const msg of allMessages) {
    for (const uid of msg.userIds ?? []) {
      if (!messagesByUser.has(uid)) messagesByUser.set(uid, [])
      messagesByUser.get(uid)!.push(msg)
    }
  }

  interface ClientActivity {
    user: User
    lastMeeting: Meeting | null
    lastMessage: Message | null
    lastActivityDate: Date | null
  }

  const clientActivity: ClientActivity[] = users.map((user) => {
    // Most recent past meeting
    const lastMeeting =
      (meetingsByUser.get(user.id) ?? [])
        .filter((m) => m.startTime && new Date(m.startTime) < now)
        .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())[0] ??
      null

    // Most recent message (by Created date)
    const lastMessage =
      [...(messagesByUser.get(user.id) ?? [])].sort((a, b) => {
        if (!a.created && !b.created) return 0
        if (!a.created) return 1
        if (!b.created) return -1
        return new Date(b.created).getTime() - new Date(a.created).getTime()
      })[0] ?? null

    const activityDates = [
      lastMeeting?.startTime ? new Date(lastMeeting.startTime) : null,
      lastMessage?.created ? new Date(lastMessage.created) : null,
    ].filter((d): d is Date => d !== null)

    const lastActivityDate =
      activityDates.length > 0 ? activityDates.reduce((a, b) => (a > b ? a : b)) : null

    return { user, lastMeeting, lastMessage, lastActivityDate }
  })

  // Sort by most recent activity, nulls last
  clientActivity.sort((a, b) => {
    if (!a.lastActivityDate && !b.lastActivityDate) return 0
    if (!a.lastActivityDate) return 1
    if (!b.lastActivityDate) return -1
    return b.lastActivityDate.getTime() - a.lastActivityDate.getTime()
  })

  // ── render ─────────────────────────────────────────────────────────────────

  return (
    <>
      <PageHeader title="Dashboard" description="Your coaching prep overview" />

      <div className="p-4 md:p-6 lg:p-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 items-start">

          {/* ── LEFT: Upcoming This Week ────────────────────────────────────── */}
          <div className="bg-white rounded-xl shadow-sm p-4 md:p-6">
            <div className="flex items-center gap-2 mb-5">
              <Calendar className="h-5 w-5 text-slate-400" />
              <h2 className="text-lg font-semibold text-slate-900">Upcoming This Week</h2>
              {upcomingWithClients.length > 0 && (
                <span className="ml-auto text-xs text-slate-400 font-medium">
                  {upcomingWithClients.length}{' '}
                  {upcomingWithClients.length === 1 ? 'meeting' : 'meetings'}
                </span>
              )}
            </div>

            {upcomingWithClients.length === 0 ? (
              <p className="text-sm text-slate-400">No meetings scheduled in the next 7 days.</p>
            ) : (
              <div className="space-y-3">
                {upcomingWithClients.map(({ meeting, client }) => {
                  const d = new Date(meeting.startTime)
                  return (
                    <div
                      key={meeting.id}
                      className="flex items-start gap-4 p-4 rounded-lg border border-slate-100 hover:border-slate-200 hover:bg-slate-50 transition-colors"
                    >
                      {/* Date block */}
                      <div className="flex-shrink-0 w-11 text-center">
                        <p className="text-[11px] font-bold uppercase tracking-wide text-[hsl(213,70%,30%)]">
                          {d.toLocaleString('en-US', { weekday: 'short' })}
                        </p>
                        <p className="text-2xl font-bold text-slate-900 leading-none mt-0.5">
                          {d.getDate()}
                        </p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          {d.toLocaleString('en-US', { month: 'short' })}
                        </p>
                      </div>

                      {/* Meeting info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">
                          {meeting.title || 'Untitled Meeting'}
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {formatTimeRange(meeting.startTime, meeting.endTime)}
                        </p>
                        {client ? (
                          <Link
                            href={`/users/${client.id}`}
                            className="inline-flex items-center gap-0.5 mt-1.5 text-xs font-medium text-[hsl(213,70%,30%)] hover:underline"
                          >
                            {getDisplayName(client)}
                            <ChevronRight className="h-3 w-3" />
                          </Link>
                        ) : (
                          <p className="text-xs text-slate-400 mt-1.5">
                            {meeting.participantEmails[0] ?? '—'}
                          </p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* ── RIGHT: Client Activity ──────────────────────────────────────── */}
          <div className="bg-white rounded-xl shadow-sm p-4 md:p-6">
            <div className="flex items-center gap-2 mb-5">
              <Users className="h-5 w-5 text-slate-400" />
              <h2 className="text-lg font-semibold text-slate-900">Client Activity</h2>
              <span className="ml-auto text-xs text-slate-400 font-medium">
                {users.length} {users.length === 1 ? 'client' : 'clients'}
              </span>
            </div>

            {clientActivity.length === 0 ? (
              <p className="text-sm text-slate-400">No clients yet.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {clientActivity.map(({ user, lastMeeting, lastMessage }) => (
                  <Link
                    key={user.id}
                    href={`/users/${user.id}`}
                    className="flex items-center gap-3 py-3 first:pt-0 last:pb-0 -mx-2 px-2 rounded-lg hover:bg-slate-50 transition-colors group"
                  >
                    {/* Avatar */}
                    {user.avatarUrl ? (
                      <img
                        src={user.avatarUrl}
                        alt={getDisplayName(user)}
                        className="w-9 h-9 rounded-full object-cover flex-shrink-0"
                      />
                    ) : (
                      <div
                        className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 ${avatarColor(user.id)}`}
                      >
                        {getInitials(user)}
                      </div>
                    )}

                    {/* Name + last activity */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">
                        {getDisplayName(user)}
                      </p>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
                        {lastMeeting ? (
                          <span className="flex items-center gap-1 text-xs text-slate-400">
                            <Calendar className="h-3 w-3 flex-shrink-0" />
                            {formatDateShort(lastMeeting.startTime)}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-300">No meetings yet</span>
                        )}
                        {lastMessage?.created && (
                          <span className="flex items-center gap-1 text-xs text-slate-400">
                            <MessageSquare className="h-3 w-3 flex-shrink-0" />
                            {formatDateShort(lastMessage.created)}
                          </span>
                        )}
                      </div>
                    </div>

                    <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-slate-500 flex-shrink-0 transition-colors" />
                  </Link>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>
    </>
  )
}
