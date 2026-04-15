import Link from 'next/link'
import { Calendar, Users, ChevronRight, MessageSquare } from 'lucide-react'
// ChevronRight used in Recent Clients rows below
import { getUsers } from '@/lib/services/usersService'
import { getSessionUser } from '@/lib/auth/getSessionUser'
import { getAllMeetings, getAllUpcomingMeetings } from '@/lib/airtable/meetings'
import { buildEmailToUserMap, findClientForMeeting, groupMeetingsByUser } from '@/lib/services/meetingsService'
import { fetchAllMessages } from '@/lib/airtable/messages'
import PageHeader from '@/components/layout/PageHeader'
import DashboardQuickActions from './DashboardQuickActions'
import UpcomingSessionsCard, { type UpcomingItem } from './UpcomingSessionsCard'
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

  const [users, upcomingMeetings, allMeetings, allMessages] = await Promise.all([
    getUsers(sessionUser),
    getAllUpcomingMeetings(7),   // Airtable-filtered: StartTime in next 7 days, sorted asc
    getAllMeetings(),            // All-time: for client activity section
    fetchAllMessages(),
  ])

  // Build email → user lookup (matches both email and workEmail, normalised)
  const emailToUser = buildEmailToUserMap(users)
  const now = new Date()

  // Dedup upcoming meetings by title + startTime
  const seenKeys = new Set<string>()
  const dedupedUpcoming = upcomingMeetings.filter((m) => {
    const key = `${m.title ?? ''}|${m.startTime ?? ''}`
    if (seenKeys.has(key)) return false
    seenKeys.add(key)
    return true
  })

  // Build serializable items for the UpcomingSessionsCard client component
  const coachEmail = sessionUser?.email?.toLowerCase() ?? ''
  const upcomingItems: UpcomingItem[] = dedupedUpcoming.map((meeting) => {
    const client = findClientForMeeting(meeting, emailToUser)
    const d = new Date(meeting.startTime)
    const timeRange =
      meeting.endTime
        ? `${d.toLocaleString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })} – ${new Date(meeting.endTime).toLocaleString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`
        : d.toLocaleString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })

    // For the unmatched label: pick the first non-internal, non-coach participant
    const externalEmails = meeting.participantEmails.filter(
      (e) => e && !e.toLowerCase().includes('leadershiptap.com') && e.toLowerCase() !== coachEmail,
    )
    const displayLabel = client
      ? null
      : externalEmails.length > 0
        ? externalEmails[0].split('@')[1] ?? externalEmails[0]  // show domain only
        : null

    return {
      meetingId: meeting.id,
      title: meeting.title,
      startTime: meeting.startTime,
      endTime: meeting.endTime,
      weekday: d.toLocaleString('en-US', { weekday: 'short' }),
      day: d.getDate(),
      month: d.toLocaleString('en-US', { month: 'short' }),
      timeRange,
      clientId: client?.id ?? null,
      clientName: client ? getDisplayName(client) : null,
      displayLabel,
      participantEmails: externalEmails,
      notes: meeting.notes,
    }
  })

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

  // Sort by most recent activity, nulls last — show top 5
  clientActivity.sort((a, b) => {
    if (!a.lastActivityDate && !b.lastActivityDate) return 0
    if (!a.lastActivityDate) return 1
    if (!b.lastActivityDate) return -1
    return b.lastActivityDate.getTime() - a.lastActivityDate.getTime()
  })
  const recentClients = clientActivity.slice(0, 5)

  // Client list for quick-action dialogs (id + display name)
  const clientsForActions = users.map((u) => ({ id: u.id, name: getDisplayName(u) }))

  // ── render ─────────────────────────────────────────────────────────────────

  return (
    <>
      <PageHeader title="Dashboard" description="Your coaching prep overview" />

      <div className="p-4 md:p-6 lg:p-8">
        <DashboardQuickActions clients={clientsForActions} />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 items-start">

          {/* ── LEFT: Upcoming This Week ────────────────────────────────────── */}
          <div className="bg-white rounded-xl shadow-sm p-4 md:p-6">
            <div className="flex items-center gap-2 mb-5">
              <Calendar className="h-5 w-5 text-slate-400" />
              <h2 className="text-lg font-semibold text-slate-900">Upcoming This Week</h2>
              {upcomingItems.length > 0 && (
                <span className="ml-auto text-xs text-slate-400 font-medium">
                  {upcomingItems.length}{' '}
                  {upcomingItems.length === 1 ? 'meeting' : 'meetings'}
                </span>
              )}
            </div>
            <UpcomingSessionsCard items={upcomingItems} />
          </div>

          {/* ── RIGHT: Client Activity ──────────────────────────────────────── */}
          <div className="bg-white rounded-xl shadow-sm p-4 md:p-6">
            <div className="flex items-center gap-2 mb-5">
              <Users className="h-5 w-5 text-slate-400" />
              <h2 className="text-lg font-semibold text-slate-900">Recent Clients</h2>
              <Link
                href="/users"
                className="ml-auto text-xs text-[hsl(213,70%,30%)] hover:underline font-medium"
              >
                View all {users.length}
              </Link>
            </div>

            {recentClients.length === 0 ? (
              <p className="text-sm text-slate-400">No clients yet.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {recentClients.map(({ user, lastMeeting, lastMessage }) => (
                  <Link
                    key={user.id}
                    href={`/users/${user.id}`}
                    className="flex items-center gap-3 py-3 first:pt-0 last:pb-0 -mx-2 px-2 rounded-lg hover:bg-slate-50 transition-colors group"
                  >
                    {/* Avatar */}
                    {(user.profilePhoto ?? user.avatarUrl) ? (
                      <img
                        src={(user.profilePhoto ?? user.avatarUrl)!}
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
