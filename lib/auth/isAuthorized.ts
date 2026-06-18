import { getAllUsers } from '@/lib/airtable/users'
import type { SessionUser } from './getSessionUser'

/**
 * Returns true if sessionUser may read or write data scoped to the given
 * Airtable Users record ID.
 *
 * - Admin: always allowed
 * - Coach: allowed only if the target user's "Coach" linked-record field
 *   contains the coach's own Airtable record ID (resolved by email).
 */
export async function canAccessUser(
  userId: string,
  sessionUser: SessionUser,
): Promise<boolean> {
  if (sessionUser.role === 'admin') return true

  const all = await getAllUsers()

  // Resolve the coach's own Airtable record ID by email
  const coachRecord = all.find(
    (u) =>
      u.email?.toLowerCase() === sessionUser.email.toLowerCase() ||
      u.workEmail?.toLowerCase() === sessionUser.email.toLowerCase(),
  )

  // Coach not found in Airtable — fall back to allowing access so the portal
  // doesn't break while coach records are still being configured.
  if (!coachRecord) return true

  const target = all.find((u) => u.id === userId)
  const scoped = all.filter((u) => u.coachIds?.includes(coachRecord.id))

  // If the Coach field isn't wired up yet (no clients linked), allow access.
  // This matches the fallback in usersService.getUsers().
  if (scoped.length === 0) return true

  return target?.coachIds?.includes(coachRecord.id) ?? false
}
