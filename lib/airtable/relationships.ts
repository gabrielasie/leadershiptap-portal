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
