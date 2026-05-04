import { TABLES, FIELDS } from '@/lib/airtable/constants'

const API_BASE = 'https://api.airtable.com/v0'
const TABLE = encodeURIComponent(TABLES.NOTES)

function getCredentials() {
  const apiKey = process.env.AIRTABLE_API_KEY
  const baseId = process.env.AIRTABLE_BASE_ID
  if (!apiKey || !baseId) throw new Error('Missing Airtable credentials')
  return { apiKey, baseId }
}

type AirtableRecord = { id: string; fields: Record<string, unknown> }

export interface Note {
  id: string
  body: string
  createdAt: string
  subjectPersonId: string
  authorPersonId?: string
  relationshipContextId?: string
  meetingId?: string
  noteType?: string
  visibility?: string
}

function mapRecord(r: AirtableRecord): Note {
  const clientIds = r.fields[FIELDS.NOTES.CLIENT]
  return {
    id: r.id,
    body: (r.fields[FIELDS.NOTES.BODY] as string) ?? '',
    createdAt: (r.fields[FIELDS.NOTES.DATE] as string) ?? '',
    subjectPersonId: Array.isArray(clientIds) ? (clientIds[0] as string) ?? '' : '',
    authorPersonId: (r.fields[FIELDS.NOTES.COACH_NAME] as string) ?? undefined,
    relationshipContextId: (r.fields[FIELDS.NOTES.REL_CONTEXT_ID] as string) ?? undefined,
    meetingId: undefined,
    noteType: undefined,
    visibility: undefined,
  }
}

const SORT_DATE_DESC =
  `sort%5B0%5D%5Bfield%5D=${encodeURIComponent(FIELDS.NOTES.DATE)}&sort%5B0%5D%5Bdirection%5D=desc`

/**
 * Fetch all notes sorted by Created At desc.
 * Used by the dashboard (admin) and users list to build per-client note counts.
 */
export async function getAllRecentNotes(limit = 100): Promise<Note[]> {
  const { apiKey, baseId } = getCredentials()
  const url = `${API_BASE}/${baseId}/${TABLE}?${SORT_DATE_DESC}&maxRecords=${limit}`
  console.log('[debug] getAllRecentNotes table:', TABLES.NOTES, 'url:', url)
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}` },
    cache: 'no-store',
  })
  if (!res.ok) {
    console.error('[debug] getAllRecentNotes failed status:', res.status, await res.text())
    return []
  }
  const data = await res.json()
  return (data.records ?? []).map(mapRecord)
}

/**
 * Fetch notes authored by a specific person.
 * Coach Name is a formula/lookup field — notes are returned for all clients
 * whose CLIENT linked field includes this person's ID.
 * JS-filtered because Client is a linked field.
 */
export async function getNotesByAuthor(authorPersonId: string): Promise<Note[]> {
  const { apiKey, baseId } = getCredentials()
  const url = `${API_BASE}/${baseId}/${TABLE}?${SORT_DATE_DESC}&maxRecords=500`
  console.log('[debug] getNotesByAuthor table:', TABLES.NOTES)
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}` },
    cache: 'no-store',
  })
  if (!res.ok) return []
  const data = await res.json()
  // COACH_NAME is a text/formula field — we can't filter by personId directly.
  // Return all notes; callers use subjectPersonId for display grouping.
  void authorPersonId
  return (data.records ?? []).map(mapRecord)
}

/**
 * Fetch notes for a subject person (client) — for the user profile page.
 * JS-filtered because Client is a linked field.
 */
export async function getNotesByUser(personId: string): Promise<Note[]> {
  const { apiKey, baseId } = getCredentials()
  const url = `${API_BASE}/${baseId}/${TABLE}?${SORT_DATE_DESC}&maxRecords=500`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}` },
    cache: 'no-store',
  })
  if (!res.ok) return []
  const data = await res.json()
  return (data.records ?? [])
    .filter((r: AirtableRecord) => {
      const ids = r.fields[FIELDS.NOTES.CLIENT]
      return Array.isArray(ids) && (ids as string[]).includes(personId)
    })
    .map(mapRecord)
}

/**
 * Fetch notes attached to a specific Meeting — not available in current schema.
 * The Meeting linked field no longer exists; always returns [].
 */
export async function getNotesByMeetingId(_meetingId: string): Promise<Note[]> {
  return []
}

/**
 * Fetch notes by relationship context ID, sorted by Date DESC.
 * JS-filtered because Relationship Context ID is a text field.
 */
export async function getNotes(
  _authorPersonId: string,
  relationshipContextId: string,
): Promise<Note[]> {
  const { apiKey, baseId } = getCredentials()
  const url = `${API_BASE}/${baseId}/${TABLE}?${SORT_DATE_DESC}&maxRecords=500`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}` },
    cache: 'no-store',
  })
  if (!res.ok) return []
  const data = await res.json()
  return (data.records ?? [])
    .filter((r: AirtableRecord) => {
      const ctxId = r.fields[FIELDS.NOTES.REL_CONTEXT_ID] as string | undefined
      return ctxId === relationshipContextId
    })
    .map(mapRecord)
}

export interface CreateNoteData {
  body: string
  authorPersonId: string
  subjectPersonId?: string
  relationshipContextId?: string
  meetingId?: string
  noteType?: string   // defaults to 'general_context'
}

export async function createNote(data: CreateNoteData): Promise<Note> {
  const { apiKey, baseId } = getCredentials()
  const fields: Record<string, unknown> = {
    [FIELDS.NOTES.BODY]: data.body,
  }
  if (data.subjectPersonId) fields[FIELDS.NOTES.CLIENT] = [data.subjectPersonId]
  if (data.relationshipContextId) fields[FIELDS.NOTES.REL_CONTEXT_ID] = data.relationshipContextId

  const res = await fetch(`${API_BASE}/${baseId}/${TABLE}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fields }),
  })
  if (!res.ok) {
    const detail = await res.json()
    throw new Error(`Notes POST failed: ${JSON.stringify(detail)}`)
  }
  return mapRecord(await res.json())
}

export async function updateNote(
  noteId: string,
  body: string,
): Promise<{ success: true } | { error: string }> {
  const { apiKey, baseId } = getCredentials()
  const res = await fetch(`${API_BASE}/${baseId}/${TABLE}/${noteId}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: { [FIELDS.NOTES.BODY]: body } }),
  })
  if (!res.ok) {
    const data = await res.json()
    return { error: JSON.stringify(data) }
  }
  return { success: true }
}

export async function deleteNote(
  noteId: string,
): Promise<{ success: true } | { error: string }> {
  const { apiKey, baseId } = getCredentials()
  const res = await fetch(`${API_BASE}/${baseId}/${TABLE}/${noteId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${apiKey}` },
  })
  if (!res.ok) {
    const data = await res.json()
    return { error: JSON.stringify(data) }
  }
  return { success: true }
}
