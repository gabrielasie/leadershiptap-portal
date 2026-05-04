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
  const subjectIds = r.fields[FIELDS.NOTES.SUBJECT]
  const authorIds = r.fields[FIELDS.NOTES.AUTHOR]
  const ctxIds = r.fields[FIELDS.NOTES.REL_CONTEXT]
  const meetingIds = r.fields[FIELDS.NOTES.MEETING]
  return {
    id: r.id,
    body: (r.fields[FIELDS.NOTES.BODY] as string) ?? '',
    createdAt: (r.fields['Created At'] as string) ?? '',
    subjectPersonId: Array.isArray(subjectIds) ? (subjectIds[0] as string) ?? '' : '',
    authorPersonId: Array.isArray(authorIds) ? (authorIds[0] as string) : undefined,
    relationshipContextId: Array.isArray(ctxIds) ? (ctxIds[0] as string) : undefined,
    meetingId: Array.isArray(meetingIds) ? (meetingIds[0] as string) : undefined,
    noteType: (r.fields[FIELDS.NOTES.NOTE_TYPE] as string) ?? undefined,
    visibility: (r.fields[FIELDS.NOTES.VISIBILITY] as string) ?? undefined,
  }
}

const SORT_CREATED_DESC =
  `sort%5B0%5D%5Bfield%5D=${encodeURIComponent('Created At')}&sort%5B0%5D%5Bdirection%5D=desc`

/**
 * Fetch all notes sorted by Created At desc.
 * Used by the dashboard (admin) and users list to build per-client note counts.
 */
export async function getAllRecentNotes(limit = 100): Promise<Note[]> {
  const { apiKey, baseId } = getCredentials()
  const url = `${API_BASE}/${baseId}/${TABLE}?${SORT_CREATED_DESC}&maxRecords=${limit}`
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
 * Used by the dashboard to build the "has note" badge set for meeting cards.
 * JS-filtered because Author Person is a linked field.
 */
export async function getNotesByAuthor(authorPersonId: string): Promise<Note[]> {
  const { apiKey, baseId } = getCredentials()
  const url = `${API_BASE}/${baseId}/${TABLE}?${SORT_CREATED_DESC}&maxRecords=500`
  console.log('[debug] getNotesByAuthor table:', TABLES.NOTES)
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}` },
    cache: 'no-store',
  })
  if (!res.ok) return []
  const data = await res.json()
  return (data.records ?? [])
    .filter((r: AirtableRecord) => {
      const ids = r.fields[FIELDS.NOTES.AUTHOR]
      return Array.isArray(ids) && (ids as string[]).includes(authorPersonId)
    })
    .map(mapRecord)
}

/**
 * Fetch notes for a subject person (client) — for the user profile page.
 * JS-filtered because Subject Person is a linked field.
 */
export async function getNotesByUser(personId: string): Promise<Note[]> {
  const { apiKey, baseId } = getCredentials()
  const url = `${API_BASE}/${baseId}/${TABLE}?${SORT_CREATED_DESC}&maxRecords=500`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}` },
    cache: 'no-store',
  })
  if (!res.ok) return []
  const data = await res.json()
  return (data.records ?? [])
    .filter((r: AirtableRecord) => {
      const ids = r.fields[FIELDS.NOTES.SUBJECT]
      return Array.isArray(ids) && (ids as string[]).includes(personId)
    })
    .map(mapRecord)
}

/**
 * Fetch notes attached to a specific Meeting record.
 * JS-filtered because Meeting is a linked field.
 */
export async function getNotesByMeetingId(meetingId: string): Promise<Note[]> {
  const { apiKey, baseId } = getCredentials()
  const url = `${API_BASE}/${baseId}/${TABLE}?${SORT_CREATED_DESC}&maxRecords=500`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}` },
    cache: 'no-store',
  })
  if (!res.ok) return []
  const data = await res.json()
  return (data.records ?? [])
    .filter((r: AirtableRecord) => {
      const ids = r.fields[FIELDS.NOTES.MEETING]
      return Array.isArray(ids) && (ids as string[]).includes(meetingId)
    })
    .map(mapRecord)
}

/**
 * Fetch notes by author + relationship context, sorted by Created At DESC.
 * JS-filtered because both fields are linked fields.
 */
export async function getNotes(
  authorPersonId: string,
  relationshipContextId: string,
): Promise<Note[]> {
  const { apiKey, baseId } = getCredentials()
  const url = `${API_BASE}/${baseId}/${TABLE}?${SORT_CREATED_DESC}&maxRecords=500`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}` },
    cache: 'no-store',
  })
  if (!res.ok) return []
  const data = await res.json()
  return (data.records ?? [])
    .filter((r: AirtableRecord) => {
      const authorIds = r.fields[FIELDS.NOTES.AUTHOR]
      const ctxIds = r.fields[FIELDS.NOTES.REL_CONTEXT]
      return (
        Array.isArray(authorIds) &&
        (authorIds as string[]).includes(authorPersonId) &&
        Array.isArray(ctxIds) &&
        (ctxIds as string[]).includes(relationshipContextId)
      )
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
    [FIELDS.NOTES.VISIBILITY]: 'private_to_author',
    [FIELDS.NOTES.AUTHOR]: [data.authorPersonId],
    [FIELDS.NOTES.NOTE_TYPE]: data.noteType ?? 'general_context',
  }
  if (data.subjectPersonId) fields[FIELDS.NOTES.SUBJECT] = [data.subjectPersonId]
  if (data.relationshipContextId) fields[FIELDS.NOTES.REL_CONTEXT] = [data.relationshipContextId]
  if (data.meetingId) fields[FIELDS.NOTES.MEETING] = [data.meetingId]

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
