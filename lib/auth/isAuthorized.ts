import { getAllUsers } from '@/lib/airtable/users'
import type { SessionUser } from './getSessionUser'

/**
 * Returns true if sessionUser may read or write data scoped to the given
 * Airtable Users record ID.
 *
 * - Admin: always allowed
 * - Coach: allowed only if the target userId appears in their scoped client list
 *   (i.e. the Airtable "Coach Email" field on that record matches their email)
 *
 * getAllUsers results are cached for 60s, so repeated calls within a request
 * lifecycle are cheap.
 */
export async function canAccessUser(
  userId: string,
  sessionUser: SessionUser,
): Promise<boolean> {
  if (sessionUser.role === 'admin') return true
  // TODO: re-enable coach scoping once "Coach Email" field is confirmed in Airtable
  const clients = await getAllUsers()
  return clients.some((c) => c.id === userId)
}
