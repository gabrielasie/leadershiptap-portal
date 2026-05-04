import { TABLES, FIELDS } from '@/lib/airtable/constants'

const API_BASE = 'https://api.airtable.com/v0'
const TABLE = encodeURIComponent(TABLES.COACH_PERSON_CONTEXT)

function getCredentials() {
  const apiKey = process.env.AIRTABLE_API_KEY
  const baseId = process.env.AIRTABLE_BASE_ID
  if (!apiKey || !baseId) throw new Error('Missing Airtable credentials')
  return { apiKey, baseId }
}

export interface CoachPersonContext {
  id: string
  quickNotes: string | null
  familyDetails: string | null
  flags: string[]
  lastUpdated: string | null
}

function mapRecord(r: { id: string; fields: Record<string, unknown> }): CoachPersonContext {
  const flags = r.fields[FIELDS.COACH_PERSON_CONTEXT.RELATIONSHIP_FLAGS]
  return {
    id: r.id,
    quickNotes: (r.fields[FIELDS.COACH_PERSON_CONTEXT.QUICK_NOTES] as string | undefined) ?? null,
    familyDetails: (r.fields[FIELDS.COACH_PERSON_CONTEXT.FAMILY_DETAILS] as string | undefined) ?? null,
    flags: Array.isArray(flags) ? (flags as string[]) : [],
    lastUpdated: (r.fields[FIELDS.COACH_PERSON_CONTEXT.LAST_UPDATED] as string | undefined) ?? null,
  }
}

/**
 * Returns the Coach-Person Context record for this coach↔person pair, or null
 * if none exists yet.
 *
 * Airtable formulas cannot filter linked records by ID directly, so we fetch
 * the full table and match in JavaScript. The table is expected to stay small
 * (one row per coach–client pair).
 */
export async function getCoachPersonContext(
  coachAirtableId: string,
  personAirtableId: string,
): Promise<CoachPersonContext | null> {
  try {
    const { apiKey, baseId } = getCredentials()
    const res = await fetch(
      `${API_BASE}/${baseId}/${TABLE}?maxRecords=2000`,
      { headers: { Authorization: `Bearer ${apiKey}` }, cache: 'no-store' },
    )
    if (!res.ok) {
      console.warn('[getCoachPersonContext] Airtable GET failed:', res.status, await res.text())
      return null
    }
    const data = await res.json()
    const record = (data.records ?? []).find(
      (r: { id: string; fields: Record<string, unknown> }) => {
        const coaches = Array.isArray(r.fields[FIELDS.COACH_PERSON_CONTEXT.COACH]) ? (r.fields[FIELDS.COACH_PERSON_CONTEXT.COACH] as string[]) : []
        const persons = Array.isArray(r.fields[FIELDS.COACH_PERSON_CONTEXT.PERSON]) ? (r.fields[FIELDS.COACH_PERSON_CONTEXT.PERSON] as string[]) : []
        return coaches.includes(coachAirtableId) && persons.includes(personAirtableId)
      },
    )
    return record ? mapRecord(record) : null
  } catch (e) {
    console.error('[getCoachPersonContext] error:', e)
    return null
  }
}

/**
 * Creates or updates the Coach-Person Context record for this pair.
 * Always stamps 'Last Updated' with today's date.
 */
export async function upsertCoachPersonContext(
  coachAirtableId: string,
  personAirtableId: string,
  fields: {
    quickNotes?: string
    familyDetails?: string
    flags?: string[]
  },
): Promise<void> {
  const { apiKey, baseId } = getCredentials()

  // Build the fields object — omit empty strings, include only changed/provided values
  const writeFields: Record<string, unknown> = {
    [FIELDS.COACH_PERSON_CONTEXT.LAST_UPDATED]: new Date().toISOString().split('T')[0],
  }
  if (fields.quickNotes !== undefined) writeFields[FIELDS.COACH_PERSON_CONTEXT.QUICK_NOTES] = fields.quickNotes
  if (fields.familyDetails !== undefined) writeFields[FIELDS.COACH_PERSON_CONTEXT.FAMILY_DETAILS] = fields.familyDetails
  if (fields.flags !== undefined) writeFields[FIELDS.COACH_PERSON_CONTEXT.RELATIONSHIP_FLAGS] = fields.flags

  // Check if a record already exists for this pair
  const existing = await getCoachPersonContext(coachAirtableId, personAirtableId)

  if (existing) {
    // PATCH the existing record
    const res = await fetch(
      `${API_BASE}/${baseId}/${TABLE}/${existing.id}`,
      {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: writeFields }),
      },
    )
    if (!res.ok) {
      const data = await res.json()
      throw new Error(`Coach-Person Context PATCH failed: ${JSON.stringify(data)}`)
    }
    console.log('[upsertCoachPersonContext] PATCHed record:', existing.id)
  } else {
    // POST a new record — include the linked Coach and Person fields
    const res = await fetch(
      `${API_BASE}/${baseId}/${TABLE}`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fields: {
            ...writeFields,
            [FIELDS.COACH_PERSON_CONTEXT.COACH]: [coachAirtableId],
            [FIELDS.COACH_PERSON_CONTEXT.PERSON]: [personAirtableId],
          },
        }),
      },
    )
    if (!res.ok) {
      const data = await res.json()
      throw new Error(`Coach-Person Context POST failed: ${JSON.stringify(data)}`)
    }
    console.log('[upsertCoachPersonContext] Created new record')
  }
}
