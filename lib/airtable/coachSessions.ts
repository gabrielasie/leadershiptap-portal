const API_BASE = 'https://api.airtable.com/v0'
const TABLE = 'Coach Session'

function getCredentials() {
  const apiKey = process.env.AIRTABLE_API_KEY
  const baseId = process.env.AIRTABLE_BASE_ID
  if (!apiKey || !baseId) throw new Error('Missing Airtable credentials')
  return { apiKey, baseId }
}

export interface CoachSession {
  id: string
  coachIds: string[]
  calendarEventIds: string[]
  focalPersonIds: string[]
  sessionNotes: string | null
  actionItems: string | null
  lastUpdated: string | null
}

function mapRecord(r: { id: string; fields: Record<string, unknown> }): CoachSession {
  return {
    id: r.id,
    coachIds: Array.isArray(r.fields['Coach']) ? (r.fields['Coach'] as string[]) : [],
    calendarEventIds: Array.isArray(r.fields['Calendar Event'])
      ? (r.fields['Calendar Event'] as string[])
      : [],
    focalPersonIds: Array.isArray(r.fields['Focal Person'])
      ? (r.fields['Focal Person'] as string[])
      : [],
    sessionNotes: (r.fields['Session Notes'] as string | undefined) ?? null,
    actionItems: (r.fields['Action Items'] as string | undefined) ?? null,
    lastUpdated: (r.fields['Last Updated'] as string | undefined) ?? null,
  }
}

async function fetchAll(): Promise<CoachSession[]> {
  const { apiKey, baseId } = getCredentials()
  const res = await fetch(
    `${API_BASE}/${baseId}/${encodeURIComponent(TABLE)}?maxRecords=5000`,
    { headers: { Authorization: `Bearer ${apiKey}` }, cache: 'no-store' },
  )
  if (!res.ok) {
    console.warn('[coachSessions] GET failed:', res.status, await res.text())
    return []
  }
  const data = await res.json()
  return (data.records ?? []).map(mapRecord)
}

/**
 * Returns the Coach Session record for this coach + calendar event, or null.
 *
 * Airtable formulas cannot filter linked records by ID, so we fetch all
 * records and match in JavaScript. The table stays small (one row per
 * coach–session pair).
 */
export async function getCoachSession(
  coachAirtableId: string,
  calendarEventId: string,
): Promise<CoachSession | null> {
  try {
    const all = await fetchAll()
    return (
      all.find(
        (r) =>
          r.coachIds.includes(coachAirtableId) &&
          r.calendarEventIds.includes(calendarEventId),
      ) ?? null
    )
  } catch (e) {
    console.error('[getCoachSession] error:', e)
    return null
  }
}

/**
 * Returns the most recent N Coach Session records where Coach = coachAirtableId
 * AND Focal Person = personAirtableId, sorted by lastUpdated descending.
 */
export async function getRecentCoachSessionsForPerson(
  coachAirtableId: string,
  personAirtableId: string,
  limit = 10,
): Promise<CoachSession[]> {
  try {
    const all = await fetchAll()
    return all
      .filter(
        (r) =>
          r.coachIds.includes(coachAirtableId) &&
          r.focalPersonIds.includes(personAirtableId),
      )
      .sort((a, b) => {
        if (!a.lastUpdated && !b.lastUpdated) return 0
        if (!a.lastUpdated) return 1
        if (!b.lastUpdated) return -1
        return b.lastUpdated.localeCompare(a.lastUpdated)
      })
      .slice(0, limit)
  } catch (e) {
    console.error('[getRecentCoachSessionsForPerson] error:', e)
    return []
  }
}

/**
 * Creates or updates the Coach Session record for this coach + event pair.
 * Always stamps Last Updated with today's date.
 */
export async function upsertCoachSession(
  coachAirtableId: string,
  calendarEventId: string,
  focalPersonId: string,
  fields: { sessionNotes?: string; actionItems?: string },
): Promise<void> {
  const { apiKey, baseId } = getCredentials()

  const writeFields: Record<string, unknown> = {
    'Last Updated': new Date().toISOString().split('T')[0],
  }
  if (fields.sessionNotes !== undefined) writeFields['Session Notes'] = fields.sessionNotes
  if (fields.actionItems !== undefined) writeFields['Action Items'] = fields.actionItems

  const existing = await getCoachSession(coachAirtableId, calendarEventId)

  if (existing) {
    const res = await fetch(
      `${API_BASE}/${baseId}/${encodeURIComponent(TABLE)}/${existing.id}`,
      {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: writeFields }),
      },
    )
    if (!res.ok) {
      const data = await res.json()
      throw new Error(`Coach Session PATCH failed: ${JSON.stringify(data)}`)
    }
    console.log('[upsertCoachSession] PATCHed record:', existing.id)
  } else {
    const res = await fetch(
      `${API_BASE}/${baseId}/${encodeURIComponent(TABLE)}`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fields: {
            ...writeFields,
            Coach: [coachAirtableId],
            'Calendar Event': [calendarEventId],
            'Focal Person': [focalPersonId],
          },
        }),
      },
    )
    if (!res.ok) {
      const data = await res.json()
      throw new Error(`Coach Session POST failed: ${JSON.stringify(data)}`)
    }
    console.log('[upsertCoachSession] Created new record')
  }
}
