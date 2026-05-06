/**
 * Read-only audit of the Relationship Contexts table for *duplicate rows*.
 *
 * Defines a duplicate as two or more rows that share the same
 *   (Person record ID, Lead record ID, Relationship Type)
 * tuple. The dedup logic in generateRelationshipRows is supposed to prevent
 * these from ever being created, so any matches likely came from the seed
 * script (scripts/seed-relationship-contexts.mjs) or manual entry.
 *
 * Output: groups of duplicate rows with their record IDs, sorted oldest first
 * (so the first ID in each group is your "keeper" candidate).
 *
 * Usage:  npx tsx scripts/audit-rc-duplicates.ts
 * No mutations performed.
 */

import { config } from 'dotenv'
config({ path: '.env.local' })
config()

const apiKey = process.env.AIRTABLE_API_KEY
const baseId = process.env.AIRTABLE_BASE_ID
if (!apiKey || !baseId) {
  console.error('Missing AIRTABLE_API_KEY or AIRTABLE_BASE_ID')
  process.exit(1)
}

const API = 'https://api.airtable.com/v0'
const TABLE = encodeURIComponent('Relationship Contexts')

interface Row {
  id: string
  createdTime: string
  personId: string | null
  leadId: string | null
  type: string
}

async function fetchAll(): Promise<Row[]> {
  const rows: Row[] = []
  let offset: string | undefined
  do {
    const url = `${API}/${baseId}/${TABLE}?maxRecords=10000${offset ? `&offset=${offset}` : ''}`
    const res = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}` } })
    if (!res.ok) throw new Error(`Airtable fetch failed: ${res.status} ${await res.text()}`)
    const data = await res.json()
    for (const r of data.records ?? []) {
      const f = r.fields as Record<string, unknown>
      const persons = Array.isArray(f.Person) ? (f.Person as string[]) : []
      const leads = Array.isArray(f.Lead) ? (f.Lead as string[]) : []
      rows.push({
        id: r.id as string,
        createdTime: r.createdTime as string,
        personId: persons[0] ?? null,
        leadId: leads[0] ?? null,
        type: (f['Relationship Type'] as string) ?? '',
      })
    }
    offset = data.offset as string | undefined
  } while (offset)
  return rows
}

async function fetchUserNames(userIds: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  if (userIds.length === 0) return map
  const orClauses = userIds.map((id) => `RECORD_ID()="${id}"`).join(',')
  const formula = encodeURIComponent(`OR(${orClauses})`)
  const url = `${API}/${baseId}/Users?filterByFormula=${formula}&fields[]=Full%20Name&fields[]=First%20Name&fields[]=Last%20Name&maxRecords=200`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}` } })
  if (!res.ok) return map
  const data = await res.json()
  for (const r of data.records ?? []) {
    const f = r.fields as Record<string, unknown>
    const fullName = (f['Full Name'] as string | undefined)?.trim()
    const first = (f['First Name'] as string | undefined)?.trim()
    const last = (f['Last Name'] as string | undefined)?.trim()
    const name = fullName || [first, last].filter(Boolean).join(' ') || (r.id as string)
    map.set(r.id as string, name)
  }
  return map
}

async function main() {
  console.log('Fetching all Relationship Context rows...\n')
  const rows = await fetchAll()
  console.log(`Total RC rows: ${rows.length}\n`)

  const validRows = rows.filter((r) => r.personId && r.leadId)

  const groups = new Map<string, Row[]>()
  for (const r of validRows) {
    const key = `${r.personId}|${r.leadId}|${r.type}`
    const list = groups.get(key) ?? []
    list.push(r)
    groups.set(key, list)
  }

  const dupeGroups = [...groups.entries()].filter(([, list]) => list.length > 1)

  if (dupeGroups.length === 0) {
    console.log('No Person+Lead+Type duplicates found.')
    return
  }

  // Resolve names for nicer output
  const allUserIds = new Set<string>()
  for (const [, list] of dupeGroups) {
    for (const r of list) {
      if (r.personId) allUserIds.add(r.personId)
      if (r.leadId) allUserIds.add(r.leadId)
    }
  }
  const nameMap = await fetchUserNames([...allUserIds])

  console.log(`=== Duplicate RC groups (${dupeGroups.length}) ===\n`)
  let totalDeletable = 0
  for (const [, list] of dupeGroups) {
    const sorted = list.slice().sort((a, b) => a.createdTime.localeCompare(b.createdTime))
    const personName = nameMap.get(sorted[0].personId!) ?? sorted[0].personId
    const leadName = nameMap.get(sorted[0].leadId!) ?? sorted[0].leadId
    console.log(`${personName} → ${leadName} (${sorted[0].type})`)
    sorted.forEach((r, i) => {
      const tag = i === 0 ? 'KEEP   ' : 'DELETE '
      console.log(`  ${tag} ${r.id}  created ${r.createdTime}`)
      if (i > 0) totalDeletable++
    })
    console.log()
  }

  console.log(`Total rows safe to delete: ${totalDeletable}`)
  console.log('Recommendation: keep the oldest record in each group, delete the rest.')
}

main().catch((e) => { console.error(e); process.exit(1) })
