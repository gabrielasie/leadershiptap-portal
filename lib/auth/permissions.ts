import { getRelationshipContexts } from '@/lib/airtable/relationships'

export type PermissionLevel = 'internal_admin' | 'coach_owner' | 'read_only'

/**
 * Returns the permission level for the current user relative to a specific client.
 *
 * - internal_admin: Clerk role === 'admin'
 * - coach_owner: the user has an active Relationship Context with this client
 *   where relationship_type === 'coach'
 * - read_only: everyone else (managers, sponsors, unrelated users)
 */
export async function getPermissionLevel(
  coachAirtableId: string | null,
  clerkRole: string,
  targetClientAirtableId: string,
): Promise<PermissionLevel> {
  if (clerkRole === 'admin') return 'internal_admin'
  if (!coachAirtableId) return 'read_only'

  const contexts = await getRelationshipContexts(coachAirtableId)
  const match = contexts.find(
    (c) =>
      c.personId === targetClientAirtableId &&
      c.relationshipType === 'coaching',
  )
  return match ? 'coach_owner' : 'read_only'
}

export function canWrite(level: PermissionLevel): boolean {
  return level === 'internal_admin' || level === 'coach_owner'
}
