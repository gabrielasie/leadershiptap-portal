import { getRelationshipContexts, getDownstreamPeople } from '@/lib/airtable/relationships'

export type PermissionLevel = 'internal_admin' | 'coach_owner' | 'downstream_viewer' | 'read_only'

/**
 * Resolves what the logged-in user can do with respect to a specific target person.
 *
 * Levels (most → least privileged):
 *
 *  - internal_admin: Clerk role === 'admin'. Full access everywhere.
 *  - coach_owner: direct coaching relationship. Can view AND edit the target.
 *  - downstream_viewer: target is reachable via this user's org tree (e.g.
 *    coach's coachee's direct report). Can view AND author notes about them
 *    (notes anchor to the coach's upstream RC), but CANNOT edit their profile
 *    or their direct relationships.
 *  - read_only: no active relationship reaches the target.
 *
 * The cascading visibility implements Decision 6 of the v2 spec: downstream
 * visibility is computed by traversal, not stored as explicit RC rows.
 */
export async function getPermissionLevel(
  coachAirtableId: string | null,
  clerkRole: string,
  targetClientAirtableId: string,
): Promise<PermissionLevel> {
  if (clerkRole === 'admin') return 'internal_admin'
  if (!coachAirtableId) return 'read_only'

  // Direct coaching relationship (highest non-admin level).
  const directContexts = await getRelationshipContexts(coachAirtableId)
  const directCoaching = directContexts.find(
    (c) => c.personId === targetClientAirtableId && c.relationshipType === 'coaching',
  )
  if (directCoaching) return 'coach_owner'

  // Cascading: walk the org tree from the coach. If target is reachable,
  // grant view-only downstream access. Capped at 3 hops to prevent runaway.
  try {
    const downstream = await getDownstreamPeople(coachAirtableId, 3)
    if (downstream.some((u) => u.id === targetClientAirtableId)) {
      return 'downstream_viewer'
    }
  } catch {
    // Defensive — never break the page on a permission probe.
  }

  return 'read_only'
}

/** Can the user EDIT this profile and the relationships attached to it? */
export function canWrite(level: PermissionLevel): boolean {
  return level === 'internal_admin' || level === 'coach_owner'
}

/** Can the user VIEW this profile at all? */
export function canView(level: PermissionLevel): boolean {
  return level !== 'read_only'
}

/** Can the user author notes about this person? */
export function canAuthorNotes(level: PermissionLevel): boolean {
  // Both direct coaches and downstream viewers can author notes. Downstream
  // notes anchor to the coach's upstream RC (see resolveContextForSubject).
  return level === 'internal_admin' || level === 'coach_owner' || level === 'downstream_viewer'
}
