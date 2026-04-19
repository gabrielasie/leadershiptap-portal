import Link from 'next/link'
import { Calendar, Users, ChevronRight, Clock, CheckSquare } from 'lucide-react'
import { getUsers } from '@/lib/services/usersService'
import { getSessionUser } from '@/lib/auth/getSessionUser'
import { getAllMeetings, getAllUpcomingMeetings } from '@/lib/airtable/meetings'
import { buildEmailToUserMap, findClientForMeeting, groupMeetingsByUser } from '@/lib/services/meetingsService'
import { fetchAllMessages } from '@/lib/airtable/messages'
import { getAllOpenTasks } from '@/lib/airtable/tasks'
import { getAllRecentNotes } from '@/lib/airtable/notes'
import { getCurrentUserRecord } from '@/lib/auth/getCurrentUserRecord'
import DashboardQuickActions from './DashboardQuickActions'
import UpcomingSessionsCard, { type UpcomingItem } from './UpcomingSessionsCard'
import DashboardTaskItem, { type DashboardTask } from './DashboardTaskItem'
import AddTaskDashboardDialog from './AddTaskDashboardDialog'
import ClientRowWithNotes from './ClientRowWithNotes'
import type { User, Meeting, Message } from '@/lib/types'

// ── helpers ───────────────────────────────────────────────────────────────────

function getTimeOfDay(): string {
  const h = new Date().getHours()
  if (h < 12) return 'morning'
  if (h < 17) return 'afternoon'
  return 'evening'
}

function formatTimeUntil(iso: string, now: Date): string {
  const diffMs = new Date(iso).getTime() - now.getTime()
  if (diffMs <= 0) return 'starting now'
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 60) return `in ${diffMin} minute${diffMin === 1 ? '' : 's'}`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `in ${diffHr} hour${diffHr === 1 ? '' : 's'}`
  const diffDay = Math.floor(diffHr / 24)
  return `in ${diffDay} day${diffDay === 1 ? '' : 's'}`
}

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

function formatSessionLabel(iso: string): string {
  const d = new Date(iso)
  const weekday = d.toLocaleString('en-US', { weekday: 'short' })
  const month = d.toLocaleString('en-US', { month: 'short' })
  const day = d.getDate()
  const time = d.toLocaleString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  return `${weekday} ${month} ${day} · ${time}`
}

// ── page ──────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const sessionUser = await getSessionUser()

  const [users, upcomingMeetings, allMeetings, allMessages, rawOpenTasks, allRecentNotes, userRecord] = await Promise.all([
    getUsers(sessionUser),
    getAllUpcomingMeetings(7),   // Airtable-filtered: StartTime in next 7 days, sorted asc
    getAllMeetings(),            // All-time: for client activity section
    fetchAllMessages(),
    getAllOpenTasks(),
    getAllRecentNotes(100),      // Fetch enough to cover all clients
    getCurrentUserRecord(),
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
    // Check participantEmails first, then fall back to senderEmail
    const client =
      findClientForMeeting(meeting, emailToUser) ??
      (meeting.senderEmail
        ? (emailToUser.get(meeting.senderEmail.toLowerCase().trim()) ?? null)
        : null)
    const d = new Date(meeting.startTime)
    const timeRange =
      meeting.endTime
        ? `${d.toLocaleString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })} – ${new Date(meeting.endTime).toLocaleString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`
        : d.toLocaleString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })

    // External (non-internal, non-coach) participants — used only in the unmatched modal
    const externalEmails = meeting.participantEmails.filter(
      (e) => e && !e.toLowerCase().includes('leadershiptap.com') && e.toLowerCase() !== coachEmail,
    )

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
      displayLabel: client ? null : (() => {
        const allEmails = [meeting.senderEmail, ...meeting.participantEmails]
          .filter(Boolean)
          .map((e) => e!.trim().toLowerCase())
          .filter((e) => e && !e.includes('leadershiptap') && e !== coachEmail)
        const domains = [...new Set(
          allEmails
            .map((e) => e.split('@')[1]?.replace(/\.(com|net|org|io)$/, '') ?? '')
            .filter(Boolean),
        )]
        return domains.slice(0, 2).join(', ') || null
      })(),
      participantEmails: externalEmails,
      notes: meeting.notes,
    }
  })

  // ── Today section ──────────────────────────────────────────────────────────

  const todayStr = now.toISOString().slice(0, 10)
  const todayItems = upcomingItems.filter(
    (item) => new Date(item.startTime).toISOString().slice(0, 10) === todayStr,
  )
  // Next upcoming meeting (soonest after now, across all 7 days)
  const nextItem = upcomingItems.find((item) => new Date(item.startTime) > now) ?? null
  // Additional today sessions beyond the "Coming Up Next" one
  const otherTodayItems = todayItems.filter((item) => item !== nextItem)

  // Coach first name for greeting
  const coachUser = users.find(
    (u) =>
      u.email?.toLowerCase() === sessionUser?.email?.toLowerCase() ||
      u.workEmail?.toLowerCase() === sessionUser?.email?.toLowerCase(),
  )
  const firstName =
    coachUser?.preferredName ??
    coachUser?.firstName ??
    coachUser?.fullName?.split(' ')[0] ??
    (userRecord.name.split(' ')[0] || null) ??  // Clerk first name via getCurrentUserRecord
    sessionUser?.email?.split('@')[0] ??
    'Coach'

  // Client user record for Coming Up Next avatar
  const nextClient = nextItem?.clientId
    ? (users.find((u) => u.id === nextItem.clientId) ?? null)
    : null

  // ── Open tasks ─────────────────────────────────────────────────────────────

  const idToUser = new Map(users.map((u) => [u.id, u]))
  const openTasks: DashboardTask[] = rawOpenTasks.map((task) => {
    const client = task.userId ? (idToUser.get(task.userId) ?? null) : null
    return {
      id: task.id,
      name: task.name,
      status: (task.status ?? 'pending') as DashboardTask['status'],
      dueDate: task.dueDate ?? null,
      notes: task.notes ?? null,
      clientId: client?.id ?? null,
      clientName: client ? getDisplayName(client) : null,
    }
  })

  // ── Notes grouped by client ────────────────────────────────────────────────

  const notesByClient = new Map<string, Array<{ id: string; content: string; date: string }>>()
  for (const note of allRecentNotes) {
    if (!note.userId) continue
    if (!notesByClient.has(note.userId)) notesByClient.set(note.userId, [])
    notesByClient.get(note.userId)!.push({ id: note.id, content: note.content, date: note.date })
  }

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
    nextMeeting: Meeting | null
    lastMessage: Message | null
    lastActivityDate: Date | null
  }

  const clientActivity: ClientActivity[] = users.map((user) => {
    const userMeetings = meetingsByUser.get(user.id) ?? []

    // Most recent past meeting
    const lastMeeting =
      userMeetings
        .filter((m) => m.startTime && new Date(m.startTime) < now)
        .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())[0] ??
      null

    // Next upcoming meeting
    const nextMeeting =
      userMeetings
        .filter((m) => m.startTime && new Date(m.startTime) >= now)
        .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())[0] ??
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

    return { user, lastMeeting, nextMeeting, lastMessage, lastActivityDate }
  })

  // Diagnostic: log meeting match counts per client
  clientActivity.forEach(({ user, lastMeeting }) => {
    const email = user.workEmail ?? user.email ?? '(no email)'
    const count = meetingsByUser.get(user.id)?.length ?? 0
    console.log(`[dashboard] ${getDisplayName(user)} | email: ${email} | meetings matched: ${count}${lastMeeting ? ` | last: ${lastMeeting.startTime.slice(0,10)}` : ''}`)
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
    <div className="p-4 md:p-6 lg:p-8">

      {/* ── Greeting ─────────────────────────────────────────────────────────── */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">
          Good {getTimeOfDay()}, {firstName} 👋
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          {todayItems.length > 0
            ? `You have ${todayItems.length} session${todayItems.length === 1 ? '' : 's'} today`
            : 'No sessions scheduled for today'}
        </p>
      </div>

      {/* ── Coming Up Next ───────────────────────────────────────────────────── */}
      {nextItem && (
        <div className="bg-[hsl(213,60%,97%)] border border-[hsl(213,50%,88%)] rounded-xl p-5 mb-4 md:mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="h-4 w-4 text-[hsl(213,70%,45%)]" />
            <span className="text-xs font-semibold uppercase tracking-wide text-[hsl(213,70%,45%)]">
              Coming Up Next
            </span>
            <span className="ml-auto text-xs font-semibold text-[hsl(213,70%,45%)]">
              {formatTimeUntil(nextItem.startTime, now)}
            </span>
          </div>

          <div className="flex items-start gap-4">
            {/* Client avatar */}
            {nextClient && (nextClient.profilePhoto ?? nextClient.avatarUrl) ? (
              <img
                src={(nextClient.profilePhoto ?? nextClient.avatarUrl)!}
                alt={nextItem.clientName ?? ''}
                className="w-12 h-12 rounded-full object-cover flex-shrink-0"
              />
            ) : nextClient ? (
              <div
                className={`w-12 h-12 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0 ${avatarColor(nextClient.id)}`}
              >
                {getInitials(nextClient)}
              </div>
            ) : null}

            <div className="flex-1 min-w-0">
              {nextItem.clientName && (
                <p className="text-sm font-semibold text-[hsl(213,70%,30%)] mb-0.5">
                  {nextItem.clientName}
                </p>
              )}
              <p className="text-base font-bold text-slate-900 leading-snug">
                {nextItem.title || 'Untitled Meeting'}
              </p>
              <p className="text-sm text-slate-500 mt-0.5">{nextItem.timeRange}</p>
            </div>
          </div>

          {nextItem.clientId && (
            <div className="mt-4">
              <Link
                href={`/users/${nextItem.clientId}`}
                className="inline-flex items-center justify-center gap-1.5 h-12 px-6 w-full md:w-auto rounded-lg bg-[hsl(213,70%,30%)] text-white text-base font-medium hover:bg-[hsl(213,70%,25%)] transition-colors"
              >
                Open Client Profile
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          )}
        </div>
      )}

      {/* ── Other today sessions — chip row ──────────────────────────────────── */}
      {otherTodayItems.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1 mb-4 md:mb-6 scrollbar-none">
          {otherTodayItems.map((item) => {
            const inner = (
              <span className="inline-flex items-center gap-2 whitespace-nowrap px-3 py-1.5 rounded-full bg-white border border-slate-200 text-sm hover:border-[hsl(213,60%,70%)] hover:text-[hsl(213,70%,30%)] transition-colors">
                <span className="text-slate-400 text-xs font-medium">{item.timeRange}</span>
                <span className="text-slate-700 font-medium">
                  {item.clientName ?? item.title}
                </span>
              </span>
            )
            return item.clientId ? (
              <Link key={item.meetingId} href={`/users/${item.clientId}`}>
                {inner}
              </Link>
            ) : (
              <div key={item.meetingId}>{inner}</div>
            )
          })}
        </div>
      )}

      {/* ── Quick Actions ─────────────────────────────────────────────────────── */}
      <DashboardQuickActions clients={clientsForActions} />

      {/* ── Open Tasks ───────────────────────────────────────────────────────── */}
      <div className="mb-4 md:mb-6 bg-white rounded-xl shadow-sm p-4 md:p-6">
        <div className="flex items-center gap-2 mb-4">
          <CheckSquare className="h-5 w-5 text-slate-400" />
          <h2 className="text-lg font-semibold text-slate-900">Open Tasks</h2>
          {openTasks.length > 0 && (
            <span className="ml-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-semibold">
              {openTasks.length}
            </span>
          )}
          <div className="ml-auto">
            <AddTaskDashboardDialog clients={clientsForActions} />
          </div>
        </div>
        {openTasks.length === 0 ? (
          <p className="text-sm text-slate-400">No open tasks. Use the button above to add one.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {openTasks.map((task) => (
              <DashboardTaskItem key={task.id} task={task} />
            ))}
          </div>
        )}
      </div>

      {/* ── Main grid ─────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 items-start">

        {/* LEFT: Upcoming This Week */}
        <div id="upcoming" className="bg-white rounded-xl shadow-sm p-4 md:p-6">
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

        {/* RIGHT: Recent Clients with inline notes */}
        <div className="bg-white rounded-xl shadow-sm p-4 md:p-6">
          <div className="flex items-center gap-2 mb-4">
            <Users className="h-5 w-5 text-slate-400" />
            <h2 className="text-lg font-semibold text-slate-900">Your Clients</h2>
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
            <div>
              {recentClients.map(({ user, lastMeeting, nextMeeting }) => {
                const subtitle = [user.title ?? user.jobTitle, user.companyName]
                  .filter(Boolean)
                  .join(' · ') || null
                const clientNotes = notesByClient.get(user.id) ?? []
                return (
                  <ClientRowWithNotes
                    key={user.id}
                    clientId={user.id}
                    clientName={getDisplayName(user)}
                    subtitle={subtitle}
                    initials={getInitials(user)}
                    avatarColorClass={avatarColor(user.id)}
                    profilePhoto={user.profilePhoto ?? user.avatarUrl ?? null}
                    notes={clientNotes}
                    totalNoteCount={clientNotes.length}
                    nextSessionLabel={nextMeeting ? formatSessionLabel(nextMeeting.startTime) : null}
                    lastSessionLabel={lastMeeting ? formatSessionLabel(lastMeeting.startTime) : null}
                  />
                )
              })}
            </div>
          )}
        </div>

      </div>

      {/* ── Admin: All Recent Activity ─────────────────────────────────────── */}
      {sessionUser?.role === 'admin' && allRecentNotes.length > 0 && (
        <div className="mt-4 md:mt-6 bg-white rounded-xl shadow-sm p-4 md:p-6">
          <h2 className="text-sm font-semibold text-slate-900 mb-3">All Recent Activity</h2>
          <div className="space-y-2">
            {allRecentNotes.slice(0, 20).map((note) => {
              const client = note.userId ? (idToUser.get(note.userId) ?? null) : null
              return (
                <div
                  key={note.id}
                  className="rounded-lg border border-slate-100 p-3"
                >
                  <p className="text-xs text-slate-400 mb-1">
                    {client ? (
                      <Link
                        href={`/users/${client.id}`}
                        className="text-[hsl(213,70%,30%)] hover:underline font-medium"
                      >
                        {getDisplayName(client)}
                      </Link>
                    ) : (
                      <span>Unknown client</span>
                    )}
                    {note.date && (
                      <>
                        {' · '}
                        {new Date(note.date + 'T12:00:00').toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </>
                    )}
                  </p>
                  <p className="text-sm text-slate-700 line-clamp-2 leading-relaxed">
                    {note.content}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      )}

    </div>
  )
}
