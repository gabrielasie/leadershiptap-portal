const API_BASE = 'https://api.airtable.com/v0'
const TABLE = 'Relationship%20Contexts'

function getCredentials() {
  const apiKey = process.env.AIRTABLE_API_KEY
  const baseId = process.env.AIRTABLE_BASE_ID
  if (!apiKey || !baseId) throw new Error('Missing Airtable credentials')
  return { apiKey, baseId }
}

export interface RelationshipContext {
  id: string
  coachIds: string[]
  clientAirtableId: string
  relationshipType: 'coach' | 'manager' | 'sponsor' | 'peer' | string
  permissionLevel: 'coach_owner' | 'manager_limited' | 'read_only' | string
  status: 'active' | 'inactive' | string
  startDate?: string  // YYYY-MM-DD
}

function mapRecord(
  r: { id: string; fields: Record<string, unknown> },
): RelationshipContext | null {
  const clientIds = Array.isArray(r.fields['Client'])
    ? (r.fields['Client'] as string[])
    : []
  if (clientIds.length === 0) return null
  return {
    id: r.id,
    coachIds: Array.isArray(r.fields['Coach'])
      ? (r.fields['Coach'] as string[])
      : [],
    clientAirtableId: clientIds[0],
    relationshipType: (r.fields['Relationship Type'] as string) ?? '',
    permissionLevel: (r.fields['Permission Level'] as string) ?? '',
    status: (r.fields['Status'] as string) ?? '',
    startDate: (r.fields['Start Date'] as string) ?? undefined,
  }
}

/**
 * Returns all active Relationship Context records where Coach includes
 * coachAirtableId.
 *
 * Airtable formulas cannot filter linked record fields by ID, so we fetch all
 * active records and match in JavaScript — the same pattern used by
 * coachSessions.ts and coachPersonContext.ts.
 */
export async function getRelationshipContexts(
  coachAirtableId: string,
): Promise<RelationshipContext[]> {
  const { apiKey, baseId } = getCredentials()
  const formula = encodeURIComponent('{Status} = "active"')
  const res = await fetch(
    `${API_BASE}/${baseId}/${TABLE}?filterByFormula=${formula}&maxRecords=1000`,
    { headers: { Authorization: `Bearer ${apiKey}` }, cache: 'no-store' },
  )
  if (!res.ok) {
    console.warn('[getRelationshipContexts] fetch failed:', res.status, await res.text())
    return []
  }
  const data = await res.json()
  return (data.records ?? [])
    .map(mapRecord)
    .filter(
      (r: RelationshipContext | null): r is RelationshipContext =>
        r !== null && r.coachIds.includes(coachAirtableId),
    )
}

/**
 * Returns the Airtable record ID (e.g. "recXXXXXXXX") of the active Relationship
 * Context for a specific coach–client pair, or null if none exists.
 * Used at note-creation time to link the note to its context.
 */
export async function getRelationshipContextId(
  coachAirtableId: string,
  clientAirtableId: string,
): Promise<string | null> {
  const contexts = await getRelationshipContexts(coachAirtableId)
  const match = contexts.find((c) => c.clientAirtableId === clientAirtableId)
  return match?.id ?? null
}

/**
 * Returns the single Relationship Context record for a specific coach–client pair,
 * or null if none exists. Reuses getRelationshipContexts so the fetch is cached
 * per-request when called alongside other context lookups on the same page.
 */
export async function getRelationshipContext(
  coachAirtableId: string,
  clientAirtableId: string,
): Promise<RelationshipContext | null> {
  // Fetch all active contexts for this coach (includes all statuses matching coach),
  // then find the one for this specific client.
  const contexts = await getRelationshipContexts(coachAirtableId)
  return contexts.find((c) => c.clientAirtableId === clientAirtableId) ?? null
}

/**
 * Returns ALL Relationship Context records regardless of coach or status.
 * Intended for the admin relationships overview page only.
 */
export async function getAllRelationshipContexts(): Promise<RelationshipContext[]> {
  const { apiKey, baseId } = getCredentials()
  const res = await fetch(
    `${API_BASE}/${baseId}/${TABLE}?maxRecords=5000` +
      `&sort%5B0%5D%5Bfield%5D=Status&sort%5B0%5D%5Bdirection%5D=asc`,
    { headers: { Authorization: `Bearer ${apiKey}` }, cache: 'no-store' },
  )
  if (!res.ok) {
    console.warn('[getAllRelationshipContexts] fetch failed:', res.status, await res.text())
    return []
  }
  const data = await res.json()
  return (data.records ?? [])
    .map(mapRecord)
    .filter((r: RelationshipContext | null): r is RelationshipContext => r !== null)
}
