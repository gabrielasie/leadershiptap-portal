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

  if (!coachRecord) return false

  const target = all.find((u) => u.id === userId)
  return target?.coachIds?.includes(coachRecord.id) ?? false
}
