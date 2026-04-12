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
  const res = await fetch(`${API_BASE}/${baseId}/Notes`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      fields: {
        Content: content,
        Date: date,
        Client: [userId],
      },
    }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Airtable POST failed: ${text}`)
  }
  const data = await res.json()
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
  console.log('[notes] userId received:', userId)
  const formula = encodeURIComponent(`FIND("${userId}", ARRAYJOIN({Client}))`)
  console.log('[notes] formula used:', `FIND("${userId}", ARRAYJOIN({Client}))`)
  const sort = 'sort%5B0%5D%5Bfield%5D=Date&sort%5B0%5D%5Bdirection%5D=desc'
  const res = await fetch(
    `${API_BASE}/${baseId}/Notes?filterByFormula=${formula}&${sort}`,
    {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: 'no-store',
    }
  )
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Airtable GET failed: ${text}`)
  }
  const data = await res.json()
  console.log('[notes] raw response count:', data.records?.length ?? 0)
  return (data.records ?? []).map(mapRecord)
}
