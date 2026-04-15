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

  // Coach record not found in Airtable — fall back to all users so the
  // portal doesn't go blank while the Coach field is still being set up.
  if (!coachRecord) return all;

  const scoped = all.filter((u) => u.coachIds?.includes(coachRecord.id));

  // If the Coach field isn't wired up yet, fall back to all users rather
  // than showing an empty portal.
  return scoped.length > 0 ? scoped : all;
}

export async function getUserById(id: string): Promise<User | null> {
  return fetchUserById(id);
}
