import Link from 'next/link'
import { Users } from 'lucide-react'
import { getUsers, getClientsByRelationship } from '@/lib/services/usersService'
import { getRelationshipContexts } from '@/lib/airtable/relationships'
import { getSessionUser } from '@/lib/auth/getSessionUser'
import { getAllMeetings } from '@/lib/airtable/meetings'
import { buildEmailToUserMap, groupMeetingsByUser } from '@/lib/services/meetingsService'
import { fetchAllMessages } from '@/lib/airtable/messages'
import { getAllRecentNotes } from '@/lib/airtable/notes'
import ClientRowWithNotes from '../ClientRowWithNotes'
import type { CurrentUserRecord } from '@/lib/auth/getCurrentUserRecord'
import type { User, Meeting, Message } from '@/lib/types'

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
  const weekday = new Date(iso).toLocaleString('en-US', { timeZone: 'America/New_York', weekday: 'short' })
  const month = new Date(iso).toLocaleString('en-US', { timeZone: 'America/New_York', month: 'short' })
  const day = new Date(iso).toLocaleString('en-US', { timeZone: 'America/New_York', day: 'numeric' })
  const time = new Date(iso).toLocaleString('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit', hour12: true })
  return `${weekday} ${month} ${day} · ${time} ET`
}

interface Props {
  userRecord: CurrentUserRecord
}

export default async function YourClientsRegion({ userRecord }: Props) {
  const isAdmin = userRecord.role === 'admin'
  const sessionUser = await getSessionUser()
  const ownerEmail = userRecord.email || undefined

  const [users, allMeetings, allMessages, allRecentNotes, coachContexts] = await Promise.all([
    isAdmin || !userRecord.airtableId
      ? getUsers(sessionUser)
      : getClientsByRelationship(userRecord.airtableId),
    getAllMeetings(ownerEmail),
    fetchAllMessages(),
    getAllRecentNotes(100),
    !isAdmin && userRecord.airtableId
      ? getRelationshipContexts(userRecord.airtableId)
      : Promise.resolve([]),
  ])

  const now = new Date()

  const contextByPersonId = new Map(coachContexts.map((c) => [c.personId, c]))
  const hasReportingRelationships = coachContexts.some((c) => c.relationshipType === 'reports_to')
  const hasCoachingRelationships = coachContexts.some((c) => c.relationshipType === 'coaching')
  const showRelationshipGroups = hasReportingRelationships && hasCoachingRelationships

  const notesByClient = new Map<string, Array<{ id: string; body: string; createdAt: string }>>()
  for (const note of allRecentNotes) {
    const personId = note.subjectPersonId ?? note.clientId
    if (!personId) continue
    if (!notesByClient.has(personId)) notesByClient.set(personId, [])
    notesByClient.get(personId)!.push({ id: note.id, body: note.content, createdAt: note.date })
  }

  const meetingsByUser = groupMeetingsByUser(allMeetings, users)

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
    const lastMeeting =
      userMeetings
        .filter((m) => m.startTime && new Date(m.startTime) < now)
        .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())[0] ??
      null
    const nextMeeting =
      userMeetings
        .filter((m) => m.startTime && new Date(m.startTime) >= now)
        .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())[0] ??
      null
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

  clientActivity.sort((a, b) => {
    if (!a.lastActivityDate && !b.lastActivityDate) return 0
    if (!a.lastActivityDate) return 1
    if (!b.lastActivityDate) return -1
    return b.lastActivityDate.getTime() - a.lastActivityDate.getTime()
  })
  const recentClients = clientActivity.slice(0, 5)

  const idToUser = new Map(users.map((u) => [u.id, u]))

  function renderClientRow({ user, lastMeeting, nextMeeting }: typeof recentClients[0]) {
    const ctx = contextByPersonId.get(user.id)
    const relationshipLabel = showRelationshipGroups
      ? null
      : ctx?.relationshipType === 'reports_to'
        ? 'Reports to you'
        : null
    const subtitle = [user.title ?? user.jobTitle, user.companyName].filter(Boolean).join(' · ') || null
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
        relationshipLabel={relationshipLabel}
      />
    )
  }

  const coachingClients = showRelationshipGroups
    ? recentClients.filter(({ user }) => contextByPersonId.get(user.id)?.relationshipType !== 'reports_to')
    : recentClients
  const reportingClients = showRelationshipGroups
    ? recentClients.filter(({ user }) => contextByPersonId.get(user.id)?.relationshipType === 'reports_to')
    : []

  return (
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
          {showRelationshipGroups && coachingClients.length > 0 && (
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 px-1 mb-2">
              Coaching
            </p>
          )}
          {coachingClients.map(renderClientRow)}
          {showRelationshipGroups && reportingClients.length > 0 && (
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 px-1 mt-4 mb-2">
              Reports to you
            </p>
          )}
          {reportingClients.map(renderClientRow)}
        </div>
      )}

      {/* ── Admin: All Recent Activity ─────────────────────────────────────── */}
      {isAdmin && allRecentNotes.length > 0 && (
        <div className="mt-6 pt-6 border-t border-slate-100">
          <h2 className="text-sm font-semibold text-slate-900 mb-3">All Recent Activity</h2>
          <div className="space-y-2">
            {allRecentNotes.slice(0, 20).map((note) => {
              const client = (note.subjectPersonId ?? note.clientId) ? (idToUser.get(note.subjectPersonId ?? note.clientId ?? '') ?? null) : null
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
                        {new Date(note.date).toLocaleDateString('en-US', {
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
