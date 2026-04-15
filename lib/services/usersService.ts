import { getAllUsers, getUserById as fetchUserById } from "@/lib/airtable/users";
import type { User } from "@/lib/types";
import type { SessionUser } from "@/lib/auth/getSessionUser";

/**
 * Returns the list of users visible to the caller.
 *
 * - Admin (or no sessionUser): all users
 * - Coach: only users whose "Coach" linked-record field contains the coach's
 *   Airtable record ID. The coach's own record is resolved by matching their
 *   Clerk email against the Users table.
 */
export async function getUsers(sessionUser?: SessionUser | null): Promise<User[]> {
  const all = await getAllUsers();

  if (!sessionUser || sessionUser.role === 'admin') return all;

  // Resolve the coach's own Airtable record ID by email
  const coachRecord = all.find(
    (u) =>
      u.email?.toLowerCase() === sessionUser.email.toLowerCase() ||
      u.workEmail?.toLowerCase() === sessionUser.email.toLowerCase(),
  );

  if (!coachRecord) return []; // coach not found in Airtable — show nothing

  return all.filter((u) => u.coachIds?.includes(coachRecord.id));
}

export async function getUserById(id: string): Promise<User | null> {
  return fetchUserById(id);
}
