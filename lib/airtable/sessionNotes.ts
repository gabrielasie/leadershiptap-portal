import { getRelationshipContextId } from '@/lib/airtable/relationships'

const API_BASE = 'https://api.airtable.com/v0'
const TABLE = encodeURIComponent('Session Notes')

function getCredentials() {
  const apiKey = process.env.AIRTABLE_API_KEY
  const baseId = process.env.AIRTABLE_BASE_ID
  if (!apiKey || !baseId) throw new Error('Missing Airtable credentials')
  return { apiKey, baseId }
}

export interface SessionNote {
  id: string
  title: string
  content: string
  coachAirtableId: string
  clientAirtableId: string
  eventProviderId: string
  sessionDate: string   // YYYY-MM-DD
  visibility: 'coach_only' | 'shared_with_client' | 'admin_visible'
  createdAt: string
}

function mapRecord(r: { id: string; fields: Record<string, unknown> }): SessionNote {
  return {
    id: r.id,
    title: (r.fields['Title'] as string) ?? '',
    content: (r.fields['Content'] as string) ?? '',
    coachAirtableId: (r.fields['Coach Airtable ID'] as string) ?? '',
    clientAirtableId: (r.fields['Client Airtable ID'] as string) ?? '',
    eventProviderId: (r.fields['Event Provider ID'] as string) ?? '',
    sessionDate: (r.fields['Session Date'] as string) ?? '',
    visibility: ((r.fields['Visibility'] as string) ?? 'coach_only') as SessionNote['visibility'],
    createdAt: (r.fields['Created At'] as string) ?? '',
  }
}

/**
 * Fetch all session notes written by a specific coach, sorted by Session Date desc.
 * Uses a formula filter on the plain-text Coach Airtable ID field (not a linked field),
 * so Airtable can filter server-side efficiently.
 */
export async function getSessionNotes(coachAirtableId: string): Promise<SessionNote[]> {
  const { apiKey, baseId } = getCredentials()
  const safe = coachAirtableId.replace(/"/g, '\\"')
  const formula = encodeURIComponent(`{Coach Airtable ID}="${safe}"`)
  const res = await fetch(
    `${API_BASE}/${baseId}/${TABLE}` +
      `?filterByFormula=${formula}` +
      `&sort%5B0%5D%5Bfield%5D=Session%20Date&sort%5B0%5D%5Bdirection%5D=desc` +
      `&maxRecords=500`,
    { headers: { Authorization: `Bearer ${apiKey}` }, cache: 'no-store' },
  )
  if (!res.ok) return []
  const data = await res.json()
  return (data.records ?? []).map(mapRecord)
}

/**
 * Fetch the session note for a specific calendar event, scoped to a coach.
 * Returns null if no note exists yet.
 */
export async function getSessionNoteByEventId(
  eventProviderId: string,
  coachAirtableId: string,
): Promise<SessionNote | null> {
  const { apiKey, baseId } = getCredentials()
  const safeEvent = eventProviderId.replace(/"/g, '\\"')
  const safeCoach = coachAirtableId.replace(/"/g, '\\"')
  const formula = encodeURIComponent(
    `AND({Event Provider ID}="${safeEvent}",{Coach Airtable ID}="${safeCoach}")`,
  )
  const res = await fetch(
    `${API_BASE}/${baseId}/${TABLE}?filterByFormula=${formula}&maxRecords=1`,
    { headers: { Authorization: `Bearer ${apiKey}` }, cache: 'no-store' },
  )
  if (!res.ok) return null
  const data = await res.json()
  const record = data.records?.[0]
  return record ? mapRecord(record) : null
}

export interface CreateSessionNoteData {
  title: string
  content: string
  coachAirtableId: string
  clientAirtableId?: string
  eventProviderId?: string
  sessionDate: string
  visibility: string
}

export async function createSessionNote(data: CreateSessionNoteData): Promise<SessionNote> {
  const { apiKey, baseId } = getCredentials()
  const fields: Record<string, unknown> = {
    'Title': data.title,
    'Content': data.content,
    'Coach Airtable ID': data.coachAirtableId,
    'Session Date': data.sessionDate,
    'Visibility': data.visibility,
  }
  if (data.clientAirtableId) fields['Client Airtable ID'] = data.clientAirtableId
  if (data.eventProviderId) fields['Event Provider ID'] = data.eventProviderId

  // Link to the Relationship Context record if a coach–client pair is known
  if (data.coachAirtableId && data.clientAirtableId) {
    const contextId = await getRelationshipContextId(data.coachAirtableId, data.clientAirtableId)
    if (contextId) {
      fields['Relationship Context ID'] = contextId
    } else {
      console.warn(
        '[createSessionNote] No relationship context found for coach/client pair — note created without context link',
        { coachAirtableId: data.coachAirtableId, clientAirtableId: data.clientAirtableId },
      )
    }
  }

  const res = await fetch(`${API_BASE}/${baseId}/${TABLE}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields }),
  })
  if (!res.ok) {
    const detail = await res.json()
    throw new Error(`Session Notes POST failed: ${JSON.stringify(detail)}`)
  }
  return mapRecord(await res.json())
}

export interface UpdateSessionNoteData {
  title?: string
  content?: string
  sessionDate?: string
  visibility?: string
}

export async function updateSessionNote(
  recordId: string,
  data: UpdateSessionNoteData,
): Promise<SessionNote> {
  const { apiKey, baseId } = getCredentials()
  const fields: Record<string, unknown> = {}
  if (data.title !== undefined) fields['Title'] = data.title
  if (data.content !== undefined) fields['Content'] = data.content
  if (data.sessionDate !== undefined) fields['Session Date'] = data.sessionDate
  if (data.visibility !== undefined) fields['Visibility'] = data.visibility

  const res = await fetch(`${API_BASE}/${baseId}/${TABLE}/${recordId}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields }),
  })
  if (!res.ok) {
    const detail = await res.json()
    throw new Error(`Session Notes PATCH failed: ${JSON.stringify(detail)}`)
  }
  return mapRecord(await res.json())
}
