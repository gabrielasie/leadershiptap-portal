import { TABLES, FIELDS } from '@/lib/airtable/constants'
import { getUsers } from '@/lib/services/usersService'
import { formatEastern } from '@/lib/utils/dateFormat'
import { getSessionUser } from '@/lib/auth/getSessionUser'
import { getCurrentUserRecord } from '@/lib/auth/getCurrentUserRecord'
import { getAllRecentNotes } from '@/lib/airtable/notes'
import { getAllOpenTasks } from '@/lib/airtable/tasks'
import { fetchProfileOptions, getAllUsers } from '@/lib/airtable/users'
import PageHeader from '@/components/layout/PageHeader'
import ClientsGrid, { type EnrichedUser } from './ClientsGrid'
import type { User } from '@/lib/types'

function getDisplayName(user: User): string {
  if (user.fullName) return user.fullName
  if (user.firstName || user.lastName)
    return [user.firstName, user.lastName].filter(Boolean).join(' ')
  return user.preferredName ?? user.email
}

function formatSessionDate(iso: string): string {
  return formatEastern(iso, { month: 'short', day: 'numeric' })
}

// Fetch all Meetings for one coach — only the fields needed
// for last/next session computation. One call, filtered server-side.
interface CoachSession {
  clientName: string
  startTime: string
  endTime: string
}

async function getCoachCalendarSessions(ownerEmail: string): Promise<CoachSession[]> {
  const apiKey = process.env.AIRTABLE_API_KEY
  const baseId = process.env.AIRTABLE_BASE_ID
  if (!apiKey || !baseId) return []
  const safeEmail = ownerEmail.toLowerCase().replace(/"/g, '\\"')
  const formula = encodeURIComponent(`AND(LOWER({${FIELDS.MEETINGS.CALENDAR_OWNER}})="${safeEmail}",{${FIELDS.MEETINGS.CLIENT_NAME}}!="")`)
  const res = await fetch(
    `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(TABLES.MEETINGS)}` +
      `?filterByFormula=${formula}` +
      `&fields[]=${encodeURIComponent(FIELDS.MEETINGS.CLIENT_NAME)}&fields[]=${encodeURIComponent(FIELDS.MEETINGS.START)}&fields[]=${encodeURIComponent(FIELDS.MEETINGS.END)}` +
      `&sort%5B0%5D%5Bfield%5D=${encodeURIComponent(FIELDS.MEETINGS.START)}&sort%5B0%5D%5Bdirection%5D=desc` +
      `&maxRecords=2000`,
    { headers: { Authorization: `Bearer ${apiKey}` }, cache: 'no-store' },
  )
  if (!res.ok) return []
  const data = await res.json()
  return (data.records ?? []).map((r: { fields: Record<string, unknown> }) => ({
    clientName: (r.fields[FIELDS.MEETINGS.CLIENT_NAME] as string) ?? '',
    startTime: (r.fields[FIELDS.MEETINGS.START] as string) ?? '',
    endTime: (r.fields[FIELDS.MEETINGS.END] as string) ?? '',
  }))
}

export default async function UsersPage() {
  const [sessionUser, userRecord] = await Promise.all([
    getSessionUser(),
    getCurrentUserRecord(),
  ])

  const isAdmin = userRecord.role === 'admin'
  const filterByCoachId = isAdmin ? undefined : (userRecord.airtableId ?? undefined)

  const [users, allRecentNotes, openTasks, allUsersForOptions, coachSessions] = await Promise.all([
    getUsers(sessionUser, filterByCoachId),
    getAllRecentNotes(300),
    getAllOpenTasks(),
    getAllUsers(),
    userRecord.email ? getCoachCalendarSessions(userRecord.email) : Promise.resolve([]),
  ])

  const profileOptions = await fetchProfileOptions(allUsersForOptions)

  // ── Notes count per user ─────────────────────────────────────────────────
  const noteCountByUser = new Map<string, number>()
  for (const note of allRecentNotes) {
    if (!note.subjectPersonId) continue
    noteCountByUser.set(note.subjectPersonId, (noteCountByUser.get(note.subjectPersonId) ?? 0) + 1)
  }

  // ── Open tasks count per user ────────────────────────────────────────────
  const openTaskCountByUser = new Map<string, number>()
  for (const task of openTasks) {
    if (!task.assignedToPersonId) continue
    openTaskCountByUser.set(task.assignedToPersonId, (openTaskCountByUser.get(task.assignedToPersonId) ?? 0) + 1)
  }

  // ── Last & next session per client name ──────────────────────────────────
  // coachSessions is sorted Start DESC: future events first, then past.
  // For nextSession (nearest upcoming): overwrite on each future event → ends on nearest.
  // For lastSession (most recent past): only set once on first past event encountered.
  const now = new Date()
  const lastSessionByName = new Map<string, string>() // name → formatted date
  const nextSessionByName = new Map<string, string>()

  for (const session of coachSessions) {
    if (!session.startTime) continue
    const start = new Date(session.startTime)
    const end = session.endTime ? new Date(session.endTime) : start
    // Split comma-separated client names (set during sync for multi-client events)
    const names = session.clientName.split(',').map((n) => n.trim().toLowerCase()).filter(Boolean)

    for (const name of names) {
      if (end < now) {
        // Past event — first one encountered (DESC order) is most recent
        if (!lastSessionByName.has(name)) {
          lastSessionByName.set(name, formatSessionDate(session.startTime))
        }
      } else if (start > now) {
        // Future event — overwrite to keep nearest (we walk from far future → near future)
        nextSessionByName.set(name, formatSessionDate(session.startTime))
      }
    }
  }

  // ── Enrich users — session count from linked "Associated Meetings" field ──
  const enrichedUsers: EnrichedUser[] = users.map((user) => {
    const meetingCount = user.associatedMeetingIds?.length ?? 0
    const displayNameLower = getDisplayName(user).toLowerCase()
    return {
      user,
      noteCount: noteCountByUser.get(user.id) ?? 0,
      openTaskCount: openTaskCountByUser.get(user.id) ?? 0,
      meetingCount,
      lastSession: lastSessionByName.get(displayNameLower) ?? null,
      nextSession: nextSessionByName.get(displayNameLower) ?? null,
    }
  })

  console.log('[ClientsPage] Users with session counts:',
    users.map((u) => ({
      name: getDisplayName(u),
      sessionCount: u.associatedMeetingIds?.length ?? 0,
      associatedMeetings: u.associatedMeetingIds,
    }))
  )

  // ── Header stats (Part G) ────────────────────────────────────────────────
  const coachCount = users.filter((u) => u.role?.toLowerCase() === 'coach').length
  const clientsWithOpenTasks = users.filter((u) => (openTaskCountByUser.get(u.id) ?? 0) > 0).length

  const statParts = [
    `${users.length} client${users.length !== 1 ? 's' : ''}`,
    coachCount > 0 ? `${coachCount} coach${coachCount !== 1 ? 'es' : ''}` : null,
    clientsWithOpenTasks > 0 ? `${clientsWithOpenTasks} with open tasks` : null,
  ].filter(Boolean)

  const description =
    process.env.NODE_ENV === 'development'
      ? `${userRecord.role} view  ·  ${statParts.join('  ·  ')}`
      : statParts.join('  ·  ')

  // ── Coaches for filter dropdown and Add Client dialog ────────────────────
  const coaches = users
    .filter((u) => u.role?.toLowerCase() === 'coach')
    .map((u) => ({ id: u.id, name: getDisplayName(u) }))

  console.log('[ClientsPage] role:', userRecord.role, '— airtableId:', userRecord.airtableId, '— showing:', users.length, 'clients')

  return (
    <>
      <PageHeader
        title="Clients"
        description={description}
      />
      <ClientsGrid
        users={enrichedUsers}
        coaches={coaches}
        companies={profileOptions.companies}
        currentCoachId={userRecord.airtableId ?? undefined}
      />
    </>
  )
}
