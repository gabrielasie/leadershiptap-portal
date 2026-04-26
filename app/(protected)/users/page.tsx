import { getUsers } from '@/lib/services/usersService'
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

export default async function UsersPage() {
  const [sessionUser, userRecord] = await Promise.all([
    getSessionUser(),
    getCurrentUserRecord(),
  ])

  const isAdmin = userRecord.role === 'admin'
  const filterByCoachId = isAdmin ? undefined : (userRecord.airtableId ?? undefined)

  const [users, allRecentNotes, openTasks, allUsersForOptions] = await Promise.all([
    getUsers(sessionUser, filterByCoachId),
    getAllRecentNotes(300),
    getAllOpenTasks(),
    getAllUsers(),
  ])

  const profileOptions = await fetchProfileOptions(allUsersForOptions)

  // ── Notes count per user ─────────────────────────────────────────────────
  const noteCountByUser = new Map<string, number>()
  for (const note of allRecentNotes) {
    if (!note.userId) continue
    noteCountByUser.set(note.userId, (noteCountByUser.get(note.userId) ?? 0) + 1)
  }

  // ── Open tasks count per user ────────────────────────────────────────────
  const openTaskCountByUser = new Map<string, number>()
  for (const task of openTasks) {
    if (!task.userId) continue
    openTaskCountByUser.set(task.userId, (openTaskCountByUser.get(task.userId) ?? 0) + 1)
  }

  // ── Enrich users — session count from linked "Associated Meetings" field ──
  // No email matching. Airtable already tracks which meetings belong to each user.
  const enrichedUsers: EnrichedUser[] = users.map((user) => {
    const meetingCount = user.associatedMeetingIds?.length ?? 0
    return {
      user,
      noteCount: noteCountByUser.get(user.id) ?? 0,
      openTaskCount: openTaskCountByUser.get(user.id) ?? 0,
      meetingCount,
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
