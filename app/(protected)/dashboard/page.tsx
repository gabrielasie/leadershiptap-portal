import { Suspense } from 'react'
import { getUsers, getClientsByRelationship } from '@/lib/services/usersService'
import { getSessionUser } from '@/lib/auth/getSessionUser'
import { getCurrentUserRecord } from '@/lib/auth/getCurrentUserRecord'
import { getHourInTimezone } from '@/lib/utils/dateFormat'
import ComingUpNextRegion from './regions/ComingUpNextRegion'
import OpenTasksRegion from './regions/OpenTasksRegion'
import YourClientsRegion from './regions/YourClientsRegion'
import { ComingUpNextSkeleton, TasksSkeleton, ClientsSkeleton } from './regions/Skeletons'
import type { User } from '@/lib/types'

function getTimeOfDay(): string {
  const h = getHourInTimezone()
  if (h < 12) return 'morning'
  if (h < 17) return 'afternoon'
  return 'evening'
}

function getDisplayName(user: User): string {
  if (user.fullName) return user.fullName
  if (user.firstName || user.lastName)
    return [user.firstName, user.lastName].filter(Boolean).join(' ')
  return user.preferredName ?? user.email
}

export default async function DashboardPage() {
  const sessionUser = await getSessionUser()
  const userRecord = await getCurrentUserRecord()

  const isAdmin = userRecord.role === 'admin'

  // Fetch just users for greeting — lightweight, fast
  const users = await (isAdmin || !userRecord.airtableId
    ? getUsers(sessionUser)
    : getClientsByRelationship(userRecord.airtableId))

  const coachUser = users.find(
    (u) =>
      u.email?.toLowerCase() === sessionUser?.email?.toLowerCase() ||
      u.workEmail?.toLowerCase() === sessionUser?.email?.toLowerCase(),
  )
  const firstName =
    coachUser?.preferredName ??
    coachUser?.firstName ??
    coachUser?.fullName?.split(' ')[0] ??
    (userRecord.name.split(' ')[0] || null) ??
    sessionUser?.email?.split('@')[0] ??
    'Coach'

  return (
    <div className="p-4 md:p-6 lg:p-8">

      {/* ── Greeting ─────────────────────────────────────────────────────────── */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">
          Good {getTimeOfDay()}, {firstName} 👋
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Here&apos;s your coaching dashboard
        </p>
      </div>

      {/* ── Coming Up Next + Today + Quick Actions + Upcoming This Week ────── */}
      <Suspense fallback={<ComingUpNextSkeleton />}>
        <ComingUpNextRegion userRecord={userRecord} />
      </Suspense>

      {/* ── Open Tasks ─────────────────────────────────────────────────────── */}
      <Suspense fallback={<TasksSkeleton />}>
        <OpenTasksRegion userRecord={userRecord} />
      </Suspense>

      {/* ── Your Clients + Admin Activity ──────────────────────────────────── */}
      <Suspense fallback={<ClientsSkeleton />}>
        <YourClientsRegion userRecord={userRecord} />
      </Suspense>

    </div>
  )
}
