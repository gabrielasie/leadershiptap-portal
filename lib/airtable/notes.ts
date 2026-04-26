import type { Note } from '@/lib/types'
import type { SessionUser } from '@/lib/auth/getSessionUser'
import { canAccessUser } from '@/lib/auth/isAuthorized'

const API_BASE = 'https://api.airtable.com/v0'

function getCredentials() {
  const apiKey = process.env.AIRTABLE_API_KEY
  const baseId = process.env.AIRTABLE_BASE_ID
  if (!apiKey || !baseId) throw new Error('Missing Airtable credentials')
  return { apiKey, baseId }
}

function mapRecord(record: { id: string; fields: Record<string, unknown> }): Note {
  const clientIds = record.fields['Client']
  return {
    id: record.id,
    content: (record.fields['Content'] as string) ?? '',
    date: (record.fields['Date'] as string) ?? '',
    userId: Array.isArray(clientIds) ? (clientIds[0] as string) ?? '' : '',
  }
}

export interface RecentNote {
  id: string
  content: string
  date: string
  userId: string | null
}

/**
 * Fetch all notes across all clients (up to `limit`), sorted descending by date.
 * Used by the dashboard to build a per-client notes map.
 */
export async function getAllRecentNotes(limit = 100): Promise<RecentNote[]> {
  const { apiKey, baseId } = getCredentials()
  const url =
    `${API_BASE}/${baseId}/Notes` +
    `?sort%5B0%5D%5Bfield%5D=Date&sort%5B0%5D%5Bdirection%5D=desc` +
    `&maxRecords=${limit}`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}` },
    cache: 'no-store',
  })
  if (!res.ok) return []
  const data = await res.json()
  return (data.records ?? []).map(
    (r: { id: string; fields: Record<string, unknown> }): RecentNote => {
      const clientIds = r.fields['Client']
      return {
        id: r.id,
        content: (r.fields['Content'] as string) ?? '',
        date: (r.fields['Date'] as string) ?? '',
        userId: Array.isArray(clientIds) ? ((clientIds[0] as string) ?? null) : null,
      }
    },
  )
}

/**
 * Fetch the N most recently dated notes across all clients.
 * Sorted descending by Date on the Airtable side for efficiency.
 */
export async function getRecentNotes(limit = 4): Promise<RecentNote[]> {
  const { apiKey, baseId } = getCredentials()
  const url =
    `${API_BASE}/${baseId}/Notes` +
    `?sort%5B0%5D%5Bfield%5D=Date&sort%5B0%5D%5Bdirection%5D=desc` +
    `&maxRecords=${limit}`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}` },
    cache: 'no-store',
  })
  if (!res.ok) return []
  const data = await res.json()
  return (data.records ?? []).map(
    (r: { id: string; fields: Record<string, unknown> }): RecentNote => {
      const clientIds = r.fields['Client']
      return {
        id: r.id,
        content: (r.fields['Content'] as string) ?? '',
        date: (r.fields['Date'] as string) ?? '',
        userId: Array.isArray(clientIds) ? ((clientIds[0] as string) ?? null) : null,
      }
    },
  )
}

/**
 * Write a note for a client.
 * Throws 'NOT_AUTHORIZED' if the sessionUser is not allowed to write for this userId.
 * If sessionUser is absent the write proceeds (open-access dev mode).
 */
export async function createNote(
  userId: string,
  content: string,
  date: string,           // YYYY-MM-DD
  sessionUser?: SessionUser | null,
): Promise<Note> {
  if (sessionUser) {
    const allowed = await canAccessUser(userId, sessionUser)
    if (!allowed) throw new Error('NOT_AUTHORIZED')
  }

  const { apiKey, baseId } = getCredentials()
  const body = {
    fields: {
      Content: content,
      Date: date,
      Client: [userId],
    },
  }
  const res = await fetch(`${API_BASE}/${baseId}/Notes`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok) {
    throw new Error(`Airtable POST failed: ${JSON.stringify(data)}`)
  }
  return mapRecord(data)
}

/**
 * Fetch notes for a client.
 * Returns [] (silent empty) if the sessionUser is not allowed to read for this userId.
 * If sessionUser is absent the fetch proceeds (open-access dev mode).
 */
export async function getNotesByUser(
  userId: string,
  sessionUser?: SessionUser | null,
): Promise<Note[]> {
  if (sessionUser) {
    const allowed = await canAccessUser(userId, sessionUser)
    if (!allowed) return []
  }

  const { apiKey, baseId } = getCredentials()

  // Fetch all notes then filter client-side — avoids ARRAYJOIN formula issues
  // with linked-record fields that store Airtable record IDs.
  const res = await fetch(`${API_BASE}/${baseId}/Notes`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    cache: 'no-store',
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Airtable GET failed: ${text}`)
  }
  const data = await res.json()

  const matching = (data.records ?? []).filter((r: { id: string; fields: Record<string, unknown> }) => {
    const clients = (r.fields['Client'] ?? r.fields['Clients'] ?? []) as string[]
    return Array.isArray(clients) && clients.includes(userId)
  })

  // Sort descending by date
  matching.sort((a: { fields: Record<string, unknown> }, b: { fields: Record<string, unknown> }) => {
    const da = (a.fields['Date'] as string) ?? ''
    const db = (b.fields['Date'] as string) ?? ''
    return db.localeCompare(da)
  })

  return matching.map(mapRecord)
}

// ── Session notes (new schema: Body, Visibility, Created Date, Coach, Meeting) ─

export interface SessionNote {
  id: string
  body: string
  visibility: string   // 'private_to_author' | 'shared_with_client' | 'internal_only'
  createdDate: string  // YYYY-MM-DD
  coachIds: string[]
  clientIds: string[]
}

/**
 * Fetch notes attached to a specific Portal Calendar Events record.
 * Linked-record fields can't be filtered by ID in Airtable formulas, so we
 * fetch all notes and filter in JavaScript — same pattern as coachSessions.ts.
 */
export async function getNotesByMeetingId(eventId: string): Promise<SessionNote[]> {
  const { apiKey, baseId } = getCredentials()
  const res = await fetch(
    `${API_BASE}/${baseId}/Notes` +
      `?sort%5B0%5D%5Bfield%5D=Created%20Date&sort%5B0%5D%5Bdirection%5D=desc&maxRecords=500`,
    { headers: { Authorization: `Bearer ${apiKey}` }, cache: 'no-store' },
  )
  if (!res.ok) return []
  const data = await res.json()
  return (data.records ?? [])
    .filter((r: { id: string; fields: Record<string, unknown> }) => {
      const ids = r.fields['Meeting']
      return Array.isArray(ids) && ids.includes(eventId)
    })
    .map(
      (r: { id: string; fields: Record<string, unknown> }): SessionNote => ({
        id: r.id,
        body: (r.fields['Body'] as string) ?? '',
        visibility: (r.fields['Visibility'] as string) ?? 'private_to_author',
        createdDate: (r.fields['Created Date'] as string) ?? '',
        coachIds: Array.isArray(r.fields['Coach']) ? (r.fields['Coach'] as string[]) : [],
        clientIds: Array.isArray(r.fields['Client']) ? (r.fields['Client'] as string[]) : [],
      }),
    )
}

export async function updateNote(
  noteId: string,
  content: string,
  date: string,
): Promise<{ success: true } | { error: string }> {
  const { apiKey, baseId } = getCredentials()
  const res = await fetch(`${API_BASE}/${baseId}/Notes/${noteId}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: { Content: content, Date: date } }),
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
  const res = await fetch(`${API_BASE}/${baseId}/Notes/${noteId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${apiKey}` },
  })
  if (!res.ok) {
    const data = await res.json()
    return { error: JSON.stringify(data) }
  }
  return { success: true }
}
