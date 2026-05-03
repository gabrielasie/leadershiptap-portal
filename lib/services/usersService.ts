import { getAllUsers, getUserById as fetchUserById } from "@/lib/airtable/users";
import { getRelationshipContexts } from "@/lib/airtable/relationships";
import type { User } from "@/lib/types";
import type { SessionUser } from "@/lib/auth/getSessionUser";

// TODO: duplicate user records in Airtable should be merged manually
function dataScore(user: User): number {
  let score = 0
  if (user.profilePhoto || user.avatarUrl) score += 2
  if (user.coachIds?.length) score += user.coachIds.length
  if (user.strengths?.length) score += user.strengths.length
  if (user.quickNotes) score++
  if (user.enneagramType) score++
  if (user.mbtiType) score++
  if (user.title ?? user.jobTitle) score++
  if (user.companyName) score++
  if (user.teamMemberIds?.length) score += user.teamMemberIds.length
  return score
}

function deduplicateUsers(users: User[]): User[] {
  // TODO: duplicate user records in Airtable should be merged manually
  const seen = new Map<string, User>()
  const unkeyed: User[] = []

  for (const user of users) {
    const name = (user.fullName ?? '').toLowerCase().trim()
    const email = (user.workEmail ?? user.email ?? '').toLowerCase().trim()

    if (!name || !email) {
      unkeyed.push(user)
      continue
    }

    const key = `${name}|${email}`
    const existing = seen.get(key)
    if (!existing || dataScore(user) > dataScore(existing)) {
      seen.set(key, user)
    }
  }

  return [...seen.values(), ...unkeyed]
}

/**
 * Returns the list of users visible to the caller, with duplicates removed.
 *
 * - Admin (or no sessionUser): all users
 * - Coach: only users whose "Coach" linked-record field contains the coach's
 *   Airtable record ID. The coach's own record is resolved by matching their
 *   Clerk email against the Users table.
 *
 * Pass `filterByCoachId` to override the role-based logic with an explicit
 * Airtable record ID filter (used by the Coach View / Admin View toggle).
 */
export async function getUsers(
  sessionUser?: SessionUser | null,
  filterByCoachId?: string,
): Promise<User[]> {
  const all = await getAllUsers();
  const deduped = deduplicateUsers(all)

  // Explicit coach-id filter (view mode override takes precedence over role).
  // No fallback — the explicit filter must be respected so Coach/Admin views differ.
  if (filterByCoachId) {
    return deduped.filter((u) => u.coachIds?.includes(filterByCoachId))
  }

  if (!sessionUser || sessionUser.role === 'admin') return deduped;

  // Resolve the coach's own Airtable record ID by email
  const coachRecord = deduped.find(
    (u) =>
      u.email?.toLowerCase() === sessionUser.email.toLowerCase() ||
      u.workEmail?.toLowerCase() === sessionUser.email.toLowerCase(),
  );

  // Coach record not found in Airtable — fall back to all users so the
  // portal doesn't go blank while the Coach field is still being set up.
  if (!coachRecord) return deduped;

  const scoped = deduped.filter((u) => u.coachIds?.includes(coachRecord.id));

  // If the Coach field isn't wired up yet, fall back to all users rather
  // than showing an empty portal.
  return scoped.length > 0 ? scoped : deduped;
}

export async function getUserById(id: string): Promise<User | null> {
  return fetchUserById(id);
}

/**
 * Returns the clients a coach has an active Relationship Context with.
 *
 * Falls back to filtering by the legacy Coach linked field on Users if no
 * Relationship Context records exist yet (migration period safety net).
 */
export async function getClientsByRelationship(coachAirtableId: string): Promise<User[]> {
  const [contexts, all] = await Promise.all([
    getRelationshipContexts(coachAirtableId),
    getAllUsers(),
  ])
  const deduped = deduplicateUsers(all)

  if (contexts.length === 0) {
    // No relationship contexts configured yet — fall back to Coach-field filtering.
    const scoped = deduped.filter((u) => u.coachIds?.includes(coachAirtableId))
    return scoped
  }

  const clientIds = new Set(contexts.map((c) => c.personId))
  return deduped.filter((u) => clientIds.has(u.id))
}

/**
 * Returns all portal users with a @leadershiptap.com work email (i.e. coaches),
 * optionally excluding a specific coach by Airtable record ID.
 */
export async function getPortalCoaches(excludeId?: string): Promise<User[]> {
  const all = await getAllUsers()
  const deduped = deduplicateUsers(all)
  return deduped.filter((u) => {
    const email = (u.workEmail ?? '').toLowerCase()
    return email.includes('@leadershiptap.com') && (!excludeId || u.id !== excludeId)
  })
}
