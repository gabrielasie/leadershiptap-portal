import { TABLES, FIELDS } from '@/lib/airtable/constants'

const API_BASE = 'https://api.airtable.com/v0'
const TABLE = encodeURIComponent(TABLES.RELATIONSHIP_CONTEXTS)

function getCredentials() {
  const apiKey = process.env.AIRTABLE_API_KEY
  const baseId = process.env.AIRTABLE_BASE_ID
  if (!apiKey || !baseId) throw new Error('Missing Airtable credentials')
  return { apiKey, baseId }
}

export interface RelationshipContext {
  id: string
  personId: string        // the coachee / direct report (Person field)
  personName: string
  leadId: string          // the coach / manager (Lead field)
  leadName: string
  relationshipType: 'coaching' | 'reports_to'
  status: string
  organizationId?: string
  startDate?: string
  endDate?: string
}

export interface OnboardingData {
  newPersonId: string
  coaches?: string[]
  reportsTo?: string[]
  directReports?: string[]
}

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Fetches a name map for all Users (ID → display name).
 * Used to populate personName / leadName without per-record lookups.
 */
async function buildNameMap(apiKey: string, baseId: string): Promise<Map<string, string>> {
  const res = await fetch(
    `${API_BASE}/${baseId}/${TABLES.PEOPLE}` +
      `?fields[]=Full%20Name&fields[]=First%20Name&fields[]=Last%20Name&maxRecords=5000`,
    { headers: { Authorization: `Bearer ${apiKey}` }, cache: 'no-store' },
  )
  const map = new Map<string, string>()
  if (!res.ok) return map
  const data = await res.json()
  for (const r of data.records ?? []) {
    const f = r.fields as Record<string, unknown>
    const full = (f['Full Name'] as string | undefined)?.trim()
    const first = (f['First Name'] as string | undefined)?.trim()
    const last = (f['Last Name'] as string | undefined)?.trim()
    const name = full || [first, last].filter(Boolean).join(' ') || (r.id as string)
    map.set(r.id as string, name)
  }
  return map
}

function mapRecord(
  r: { id: string; fields: Record<string, unknown> },
  nameMap: Map<string, string>,
): RelationshipContext | null {
  const personIds = Array.isArray(r.fields[FIELDS.RELATIONSHIP_CONTEXTS.PERSON])
    ? (r.fields[FIELDS.RELATIONSHIP_CONTEXTS.PERSON] as string[])
    : []
  const leadIds = Array.isArray(r.fields[FIELDS.RELATIONSHIP_CONTEXTS.LEAD])
    ? (r.fields[FIELDS.RELATIONSHIP_CONTEXTS.LEAD] as string[])
    : []
  if (personIds.length === 0 || leadIds.length === 0) return null

  const personId = personIds[0]
  const leadId = leadIds[0]
  return {
    id: r.id,
    personId,
    personName: nameMap.get(personId) ?? personId,
    leadId,
    leadName: nameMap.get(leadId) ?? leadId,
    relationshipType:
      (r.fields[FIELDS.RELATIONSHIP_CONTEXTS.TYPE] as 'coaching' | 'reports_to') ?? 'coaching',
    status: (r.fields[FIELDS.RELATIONSHIP_CONTEXTS.STATUS] as string) ?? '',
    organizationId: undefined,
    startDate: (r.fields[FIELDS.RELATIONSHIP_CONTEXTS.START_DATE] as string) ?? undefined,
    endDate: undefined,
  }
}

// ── Read functions ────────────────────────────────────────────────────────────

/**
 * Returns all active Relationship Context records where Lead = leadAirtableId.
 * This is the dashboard query: "show me everyone this person coaches / manages".
 *
 * Airtable formulas cannot filter linked record fields by ID, so we fetch all
 * Active records and match in JavaScript.
 */
export async function getRelationshipContexts(
  leadAirtableId: string,
): Promise<RelationshipContext[]> {
  const { apiKey, baseId } = getCredentials()
  const formula = encodeURIComponent(
    `LOWER({${FIELDS.RELATIONSHIP_CONTEXTS.STATUS}}) = "active"`,
  )

  const [res, nameMap] = await Promise.all([
    fetch(
      `${API_BASE}/${baseId}/${TABLE}?filterByFormula=${formula}&maxRecords=1000`,
      { headers: { Authorization: `Bearer ${apiKey}` }, cache: 'no-store' },
    ),
    buildNameMap(apiKey, baseId),
  ])

  if (!res.ok) {
    console.warn('[getRelationshipContexts] fetch failed:', res.status, await res.text())
    return []
  }

  const data = await res.json()
  const results = (data.records ?? [])
    .map((r: { id: string; fields: Record<string, unknown> }) => mapRecord(r, nameMap))
    .filter(
      (r: RelationshipContext | null): r is RelationshipContext =>
        r !== null && r.leadId === leadAirtableId,
    )
  console.log(`[RC] found ${results.length} active contexts for lead ${leadAirtableId}`)
  return results
}

/**
 * Returns the single Relationship Context for a specific lead–person pair, or null.
 */
export async function getRelationshipContext(
  leadId: string,
  personId: string,
): Promise<RelationshipContext | null> {
  const contexts = await getRelationshipContexts(leadId)
  return contexts.find((c) => c.personId === personId) ?? null
}

/**
 * Returns all active Relationship Contexts where Person = personAirtableId.
 * Used to show who coaches / manages this individual ("upstream" relationships).
 */
export async function getUpstreamContexts(
  personAirtableId: string,
): Promise<RelationshipContext[]> {
  const { apiKey, baseId } = getCredentials()
  const formula = encodeURIComponent(
    `LOWER({${FIELDS.RELATIONSHIP_CONTEXTS.STATUS}}) = "active"`,
  )

  const [res, nameMap] = await Promise.all([
    fetch(
      `${API_BASE}/${baseId}/${TABLE}?filterByFormula=${formula}&maxRecords=1000`,
      { headers: { Authorization: `Bearer ${apiKey}` }, cache: 'no-store' },
    ),
    buildNameMap(apiKey, baseId),
  ])

  if (!res.ok) {
    console.warn('[getUpstreamContexts] fetch failed:', res.status, await res.text())
    return []
  }

  const data = await res.json()
  return (data.records ?? [])
    .map((r: { id: string; fields: Record<string, unknown> }) => mapRecord(r, nameMap))
    .filter(
      (r: RelationshipContext | null): r is RelationshipContext =>
        r !== null && r.personId === personAirtableId,
    )
}

/**
 * Returns ALL Relationship Context records regardless of status.
 * Intended for the admin overview page only.
 */
export async function getAllRelationshipContexts(): Promise<RelationshipContext[]> {
  const { apiKey, baseId } = getCredentials()

  const [res, nameMap] = await Promise.all([
    fetch(
      `${API_BASE}/${baseId}/${TABLE}?maxRecords=5000` +
        `&sort%5B0%5D%5Bfield%5D=${encodeURIComponent(FIELDS.RELATIONSHIP_CONTEXTS.STATUS)}&sort%5B0%5D%5Bdirection%5D=asc`,
      { headers: { Authorization: `Bearer ${apiKey}` }, cache: 'no-store' },
    ),
    buildNameMap(apiKey, baseId),
  ])

  if (!res.ok) {
    console.warn('[getAllRelationshipContexts] fetch failed:', res.status, await res.text())
    return []
  }

  const data = await res.json()
  return (data.records ?? [])
    .map((r: { id: string; fields: Record<string, unknown> }) => mapRecord(r, nameMap))
    .filter((r: RelationshipContext | null): r is RelationshipContext => r !== null)
}

// ── Permission Profile cache ──────────────────────────────────────────────────

// Module-level cache — the 'standard' profile ID never changes between deploys.
let _standardProfileId: string | null | undefined = undefined

async function getStandardPermissionProfileId(
  apiKey: string,
  baseId: string,
): Promise<string | null> {
  if (_standardProfileId !== undefined) return _standardProfileId
  const res = await fetch(
    `${API_BASE}/${baseId}/${encodeURIComponent(TABLES.PERMISSION_PROFILES)}` +
      `?filterByFormula=${encodeURIComponent('{Profile Name}="standard"')}&maxRecords=1`,
    { headers: { Authorization: `Bearer ${apiKey}` }, cache: 'no-store' },
  )
  if (!res.ok) {
    _standardProfileId = null
    return null
  }
  const data = await res.json()
  _standardProfileId = (data.records?.[0]?.id as string) ?? null
  return _standardProfileId
}

// ── Downstream traversal ──────────────────────────────────────────────────────

export interface DirectReport {
  personId: string
  name: string
  title?: string
  email?: string
  photoUrl?: string
}

/**
 * Returns people who report to `personAirtableId` via reports_to Relationship Contexts.
 * Fetches the Person's Users record for display fields. Capped at 20.
 */
export async function getDirectReports(
  personAirtableId: string,
): Promise<DirectReport[]> {
  const { apiKey, baseId } = getCredentials()
  const formula = encodeURIComponent(
    `LOWER({${FIELDS.RELATIONSHIP_CONTEXTS.STATUS}}) = "active"`,
  )

  const res = await fetch(
    `${API_BASE}/${baseId}/${TABLE}?filterByFormula=${formula}&maxRecords=1000`,
    { headers: { Authorization: `Bearer ${apiKey}` }, cache: 'no-store' },
  )
  if (!res.ok) {
    console.warn('[getDirectReports] fetch failed:', res.status)
    return []
  }

  const data = await res.json()

  // Filter to reports_to contexts where Lead = personAirtableId
  const personIds: string[] = []
  for (const r of data.records ?? []) {
    const f = r.fields as Record<string, unknown>
    const type = (f[FIELDS.RELATIONSHIP_CONTEXTS.TYPE] as string) ?? ''
    if (type !== 'reports_to') continue
    const leadIds = Array.isArray(f[FIELDS.RELATIONSHIP_CONTEXTS.LEAD])
      ? (f[FIELDS.RELATIONSHIP_CONTEXTS.LEAD] as string[])
      : []
    if (!leadIds.includes(personAirtableId)) continue
    const pIds = Array.isArray(f[FIELDS.RELATIONSHIP_CONTEXTS.PERSON])
      ? (f[FIELDS.RELATIONSHIP_CONTEXTS.PERSON] as string[])
      : []
    if (pIds[0]) personIds.push(pIds[0])
  }

  if (personIds.length === 0) return []

  // Cap at 20
  const capped = [...new Set(personIds)].slice(0, 20)

  // Batch-fetch Users records for these person IDs
  const orClauses = capped.map((id) => `RECORD_ID()="${id}"`).join(',')
  const userFormula = encodeURIComponent(`OR(${orClauses})`)
  const userRes = await fetch(
    `${API_BASE}/${baseId}/${TABLES.PEOPLE}` +
      `?filterByFormula=${userFormula}` +
      `&fields[]=${encodeURIComponent('Full Name')}` +
      `&fields[]=${encodeURIComponent('First Name')}` +
      `&fields[]=${encodeURIComponent('Last Name')}` +
      `&fields[]=${encodeURIComponent('Title')}` +
      `&fields[]=${encodeURIComponent('Job Title')}` +
      `&fields[]=${encodeURIComponent('Work Email')}` +
      `&fields[]=${encodeURIComponent('Profile Photo')}` +
      `&fields[]=${encodeURIComponent('Avatar URL')}`,
    { headers: { Authorization: `Bearer ${apiKey}` }, cache: 'no-store' },
  )
  if (!userRes.ok) {
    console.warn('[getDirectReports] user fetch failed:', userRes.status)
    return []
  }

  const userData = await userRes.json()
  const results: DirectReport[] = []
  for (const r of userData.records ?? []) {
    const f = r.fields as Record<string, unknown>
    const fullName = (f['Full Name'] as string | undefined)?.trim()
    const first = (f['First Name'] as string | undefined)?.trim()
    const last = (f['Last Name'] as string | undefined)?.trim()
    const name = fullName || [first, last].filter(Boolean).join(' ') || r.id

    const photoArr = f['Profile Photo'] as Array<{ url: string }> | undefined
    const photoUrl = photoArr?.[0]?.url ?? (f['Avatar URL'] as string | undefined) ?? undefined

    results.push({
      personId: r.id as string,
      name,
      title: (f['Title'] as string | undefined)?.trim() ||
        (f['Job Title'] as string | undefined)?.trim() || undefined,
      email: (f['Work Email'] as string | undefined)?.trim() || undefined,
      photoUrl,
    })
  }

  return results
}

/**
 * Returns all people who report to (or are coached by) `personAirtableId`,
 * resolved to full User records so callers can render name, title, avatar, etc.
 *
 * depth = 1  → direct reports only (default, used on profile pages)
 * depth = 2+ → recurse through the org tree; capped at 3 to prevent runaway queries
 *
 * Dynamic import of getAllUsers avoids a circular module dependency.
 */
export async function getDownstreamPeople(
  personAirtableId: string,
  depth: number = 1,
): Promise<import('@/lib/types').User[]> {
  const safeDepth = Math.min(Math.max(Math.round(depth), 1), 3)

  const contexts = await getRelationshipContexts(personAirtableId)
  if (contexts.length === 0) return []

  // Lazy-load to avoid circular deps (users.ts ↔ relationships.ts)
  const { getAllUsers } = await import('@/lib/airtable/users')
  const allUsers = await getAllUsers()
  const byId = new Map(allUsers.map((u) => [u.id, u]))

  const direct = contexts
    .map((c) => byId.get(c.personId))
    .filter((u): u is import('@/lib/types').User => u != null)

  if (safeDepth <= 1) return direct

  // Recurse one level deeper, deduplicating by ID
  const seen = new Set([personAirtableId, ...direct.map((u) => u.id)])
  const nested = await Promise.all(direct.map((u) => getDownstreamPeople(u.id, safeDepth - 1)))
  for (const group of nested) {
    for (const u of group) {
      if (!seen.has(u.id)) {
        seen.add(u.id)
        direct.push(u)
      }
    }
  }

  return direct
}

// ── RC resolver for notes ─────────────────────────────────────────────────────

/**
 * Resolves the Relationship Context that connects a coach to a subject person.
 *
 * 1. Direct match: coach is Lead, subject is Person → return that RC.
 * 2. One-hop downstream: for each direct RC (Lead = coach), check if that
 *    person leads the subject via their own RCs. Return the *coach's* RC
 *    (the upstream coaching context), not the downstream row.
 * 3. No match → return null.
 */
export async function resolveContextForSubject(
  coachId: string,
  subjectPersonId: string,
): Promise<RelationshipContext | null> {
  // 1. Direct
  const direct = await getRelationshipContext(coachId, subjectPersonId)
  if (direct) return direct

  // 2. One-hop: coach → intermediate person → subject
  const coachContexts = await getRelationshipContexts(coachId)
  for (const rc of coachContexts) {
    const downstream = await getRelationshipContexts(rc.personId)
    if (downstream.some((d) => d.personId === subjectPersonId)) {
      return rc // the coach's upstream RC
    }
  }

  return null
}

// ── Write: onboarding row generation ─────────────────────────────────────────

/**
 * Fetches all Relationship Context rows where Person = personId and returns
 * a compact list of {leadId, type} for duplicate detection.
 */
async function fetchExistingPairs(
  apiKey: string,
  baseId: string,
  personId: string,
): Promise<Array<{ leadId: string; type: string }>> {
  const res = await fetch(
    `${API_BASE}/${baseId}/${TABLE}?maxRecords=500`,
    { headers: { Authorization: `Bearer ${apiKey}` }, cache: 'no-store' },
  )
  if (!res.ok) return []
  const data = await res.json()
  return (data.records ?? [])
    .filter((r: { id: string; fields: Record<string, unknown> }) => {
      const persons = Array.isArray(r.fields[FIELDS.RELATIONSHIP_CONTEXTS.PERSON])
        ? (r.fields[FIELDS.RELATIONSHIP_CONTEXTS.PERSON] as string[])
        : []
      return persons.includes(personId)
    })
    .map((r: { id: string; fields: Record<string, unknown> }) => ({
      leadId: (
        Array.isArray(r.fields[FIELDS.RELATIONSHIP_CONTEXTS.LEAD])
          ? (r.fields[FIELDS.RELATIONSHIP_CONTEXTS.LEAD] as string[])[0]
          : ''
      ) ?? '',
      type: (r.fields[FIELDS.RELATIONSHIP_CONTEXTS.TYPE] as string) ?? '',
    }))
}

/**
 * Creates Relationship Context rows for a newly onboarded person.
 *
 * Row logic:
 *   coaches[]       → Person=newPersonId,   Lead=coachId,      Type=coaching,    PermissionProfile=standard
 *   reportsTo[]     → Person=newPersonId,   Lead=managerId,    Type=reports_to
 *   directReports[] → Person=directReportId, Lead=newPersonId, Type=reports_to
 *
 * Duplicate rows (same Person+Lead+Type) are silently skipped.
 */
export async function generateRelationshipRows(data: OnboardingData): Promise<void> {
  const { apiKey, baseId } = getCredentials()
  const { newPersonId, coaches = [], reportsTo = [], directReports = [] } = data

  type RowSpec = {
    person: string
    lead: string
    type: 'coaching' | 'reports_to'
    useStandardProfile: boolean
  }

  const rows: RowSpec[] = [
    ...coaches.map((leadId) => ({
      person: newPersonId,
      lead: leadId,
      type: 'coaching' as const,
      useStandardProfile: true,
    })),
    ...reportsTo.map((leadId) => ({
      person: newPersonId,
      lead: leadId,
      type: 'reports_to' as const,
      useStandardProfile: false,
    })),
    ...directReports.map((personId) => ({
      person: personId,
      lead: newPersonId,
      type: 'reports_to' as const,
      useStandardProfile: false,
    })),
  ]

  if (rows.length === 0) return

  // Determine all unique person IDs we need to check for existing rows
  const personIds = [...new Set(rows.map((r) => r.person))]

  const [existingByPerson, standardProfileId] = await Promise.all([
    Promise.all(
      personIds.map((pid) =>
        fetchExistingPairs(apiKey, baseId, pid).then((pairs) => ({ pid, pairs })),
      ),
    ),
    getStandardPermissionProfileId(apiKey, baseId),
  ])

  // Build a Set of "personId|leadId|type" keys that already exist
  const existingKeys = new Set<string>()
  for (const { pid, pairs } of existingByPerson) {
    for (const p of pairs) {
      existingKeys.add(`${pid}|${p.leadId}|${p.type}`)
    }
  }

  for (const row of rows) {
    const key = `${row.person}|${row.lead}|${row.type}`
    if (existingKeys.has(key)) {
      console.log(`[generateRelationshipRows] Skipping duplicate: ${key}`)
      continue
    }

    const fields: Record<string, unknown> = {
      [FIELDS.RELATIONSHIP_CONTEXTS.PERSON]: [row.person],
      [FIELDS.RELATIONSHIP_CONTEXTS.LEAD]: [row.lead],
      [FIELDS.RELATIONSHIP_CONTEXTS.TYPE]: row.type,
      [FIELDS.RELATIONSHIP_CONTEXTS.STATUS]: 'Active',
    }
    if (row.useStandardProfile && standardProfileId) {
      fields[FIELDS.RELATIONSHIP_CONTEXTS.PERMISSION_LEVEL] = [standardProfileId]
    }

    const res = await fetch(`${API_BASE}/${baseId}/${TABLE}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields }),
    })
    if (!res.ok) {
      const detail = await res.json()
      console.error(`[generateRelationshipRows] POST failed for ${key}:`, detail)
    } else {
      console.log(`[generateRelationshipRows] Created: ${key}`)
    }
  }
}
