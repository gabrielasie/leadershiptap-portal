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

export type NoteType = 'general_context' | 'meeting_note' | 'follow_up' | 'private_observation'

export interface Note {
  id: string
  content: string
  date: string
  clientId?: string
  coachName?: string
  authorPersonId?: string
  subjectPersonId?: string
  meetingId?: string
  relationshipContextId?: string
  noteType?: NoteType
  visibility: 'private_to_author'
}

function firstLinkedId(val: unknown): string | undefined {
  return Array.isArray(val) && val.length > 0 ? (val[0] as string) : undefined
}

function mapRecord(r: AirtableRecord): Note {
  return {
    id: r.id,
    content: (r.fields[FIELDS.NOTES.BODY] as string) ?? '',
    date: (r.fields[FIELDS.NOTES.DATE] as string) ?? '',
    clientId: firstLinkedId(r.fields[FIELDS.NOTES.CLIENT]),
    coachName: (r.fields[FIELDS.NOTES.COACH_NAME] as string) || undefined,
    authorPersonId: firstLinkedId(r.fields[FIELDS.NOTES.AUTHOR_PERSON]),
    subjectPersonId: firstLinkedId(r.fields[FIELDS.NOTES.SUBJECT_PERSON]),
    meetingId: firstLinkedId(r.fields[FIELDS.NOTES.MEETING]),
    relationshipContextId: firstLinkedId(r.fields[FIELDS.NOTES.RELATIONSHIP_CONTEXT]),
    noteType: (r.fields[FIELDS.NOTES.NOTE_TYPE] as NoteType) || undefined,
    visibility: 'private_to_author',
  }
}

const SORT_DATE_DESC =
  `sort%5B0%5D%5Bfield%5D=${encodeURIComponent(FIELDS.NOTES.DATE)}&sort%5B0%5D%5Bdirection%5D=desc`

// ── Read functions ────────────────────────────────────────────────────────────

/**
 * Fetch all notes sorted by Date desc.
 * Used by the dashboard and users list to build per-client note counts.
 */
export async function getAllRecentNotes(limit = 100): Promise<Note[]> {
  const { apiKey, baseId } = getCredentials()
  const url = `${API_BASE}/${baseId}/${TABLE}?${SORT_DATE_DESC}&maxRecords=${limit}`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}` },
    cache: 'no-store',
  })
  if (!res.ok) {
    console.error('[getAllRecentNotes] failed:', res.status, await res.text())
    return []
  }
  const data = await res.json()
  return (data.records ?? []).map(mapRecord)
}

/**
 * Fetch notes where Subject Person (or Client) = clientAirtableId.
 * JS-filtered because linked record fields can't be filtered by ID in Airtable formulas.
 */
export async function getNotesByClient(clientAirtableId: string): Promise<Note[]> {
  const { apiKey, baseId } = getCredentials()
  const url = `${API_BASE}/${baseId}/${TABLE}?${SORT_DATE_DESC}&maxRecords=500`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}` },
    cache: 'no-store',
  })
  if (!res.ok) return []
  const data = await res.json()
  return (data.records ?? [])
    .map(mapRecord)
    .filter(
      (n: Note) =>
        n.subjectPersonId === clientAirtableId || n.clientId === clientAirtableId,
    )
}

/**
 * Fetch notes authored by a specific person.
 * Uses Author Person linked field (JS-filtered), falling back to all notes
 * if the field isn't populated yet.
 */
export async function getNotesByAuthor(authorAirtableId: string): Promise<Note[]> {
  const { apiKey, baseId } = getCredentials()
  const url = `${API_BASE}/${baseId}/${TABLE}?${SORT_DATE_DESC}&maxRecords=500`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}` },
    cache: 'no-store',
  })
  if (!res.ok) return []
  const data = await res.json()
  const all = (data.records ?? []).map(mapRecord) as Note[]
  // Filter by Author Person linked field
  const byAuthor = all.filter((n) => n.authorPersonId === authorAirtableId)
  // If Author Person isn't populated on any records yet, return all (backward compat)
  return byAuthor.length > 0 ? byAuthor : all
}

/**
 * Fetch notes attached to a specific Meeting.
 * JS-filtered because Meeting is a linked field.
 */
export async function getNotesByMeetingId(meetingId: string): Promise<Note[]> {
  const { apiKey, baseId } = getCredentials()
  const url = `${API_BASE}/${baseId}/${TABLE}?${SORT_DATE_DESC}&maxRecords=500`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}` },
    cache: 'no-store',
  })
  if (!res.ok) return []
  const data = await res.json()
  return (data.records ?? [])
    .map(mapRecord)
    .filter((n: Note) => n.meetingId === meetingId)
}

/**
 * Fetch notes linked to a specific Relationship Context, authored by a specific person.
 * JS-filtered on both linked fields.
 */
export async function getNotesByRelationshipContext(
  rcId: string,
  authorPersonId: string,
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
    .map(mapRecord)
    .filter(
      (n: Note) =>
        n.relationshipContextId === rcId && n.authorPersonId === authorPersonId,
    )
}

// Alias for backward compatibility — callers that used getNotesByUser
export const getNotesByUser = getNotesByClient

// ── Write functions ───────────────────────────────────────────────────────────

export interface CreateNoteData {
  content: string
  date?: string
  clientId?: string
  authorPersonId?: string
  subjectPersonId?: string
  meetingId?: string
  relationshipContextId?: string
  coachName?: string
  noteType?: NoteType
}

export async function createNote(data: CreateNoteData): Promise<Note> {
  const { apiKey, baseId } = getCredentials()
  const fields: Record<string, unknown> = {
    [FIELDS.NOTES.BODY]: data.content,
    [FIELDS.NOTES.DATE]: data.date ?? new Date().toISOString().split('T')[0],
    [FIELDS.NOTES.VISIBILITY]: 'private_to_author',
    [FIELDS.NOTES.NOTE_TYPE]: data.noteType ?? 'general_context',
  }
  if (data.clientId) fields[FIELDS.NOTES.CLIENT] = [data.clientId]
  if (data.authorPersonId) fields[FIELDS.NOTES.AUTHOR_PERSON] = [data.authorPersonId]
  if (data.subjectPersonId) fields[FIELDS.NOTES.SUBJECT_PERSON] = [data.subjectPersonId]
  if (data.meetingId) fields[FIELDS.NOTES.MEETING] = [data.meetingId]
  if (data.relationshipContextId) fields[FIELDS.NOTES.RELATIONSHIP_CONTEXT] = [data.relationshipContextId]
  if (data.coachName) fields[FIELDS.NOTES.COACH_NAME] = data.coachName

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
  content: string,
): Promise<{ success: true } | { error: string }> {
  const { apiKey, baseId } = getCredentials()
  const res = await fetch(`${API_BASE}/${baseId}/${TABLE}/${noteId}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: { [FIELDS.NOTES.BODY]: content } }),
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
