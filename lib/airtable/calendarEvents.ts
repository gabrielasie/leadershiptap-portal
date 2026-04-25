const API_BASE = 'https://api.airtable.com/v0'
const TABLE = 'Portal Calendar Events'

function getCredentials() {
  const apiKey = process.env.AIRTABLE_API_KEY
  const baseId = process.env.AIRTABLE_BASE_ID
  if (!apiKey || !baseId) throw new Error('Missing Airtable credentials')
  return { apiKey, baseId }
}

export interface CalendarEventUpsertFields {
  providerEventId: string
  subject: string
  start: string
  end: string
}

// Find an existing Portal Calendar Events record by Provider Event ID.
async function findByProviderEventId(
  apiKey: string,
  baseId: string,
  providerEventId: string,
): Promise<string | null> {
  const safe = providerEventId.replace(/"/g, '\\"')
  const formula = encodeURIComponent(`({Provider Event ID}="${safe}")`)
  const res = await fetch(
    `${API_BASE}/${baseId}/${encodeURIComponent(TABLE)}?filterByFormula=${formula}&maxRecords=1&fields[]=Provider%20Event%20ID`,
    { headers: { Authorization: `Bearer ${apiKey}` }, cache: 'no-store' },
  )
  if (!res.ok) return null
  const data = await res.json()
  return (data.records?.[0]?.id as string) ?? null
}

export async function upsertCalendarEvent(
  fields: CalendarEventUpsertFields,
): Promise<void> {
  const { apiKey, baseId } = getCredentials()

  // Exactly the 4 fields that exist in Portal Calendar Events.
  const writeFields = {
    'Subject': fields.subject,
    'Start': fields.start,
    'End': fields.end,
    'Provider Event ID': fields.providerEventId,
  }

  const existingId = await findByProviderEventId(apiKey, baseId, fields.providerEventId)

  if (existingId) {
    const res = await fetch(
      `${API_BASE}/${baseId}/${encodeURIComponent(TABLE)}/${existingId}`,
      {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: writeFields }),
      },
    )
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Airtable PATCH failed for ${fields.providerEventId}: ${text}`)
    }
  } else {
    const res = await fetch(
      `${API_BASE}/${baseId}/${encodeURIComponent(TABLE)}`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: writeFields }),
      },
    )
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Airtable POST failed for ${fields.providerEventId}: ${text}`)
    }
  }
}
