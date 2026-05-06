/**
 * Read-only audit of the Relationship Contexts table.
 * Reports type/status distributions and flags anything that doesn't match spec.
 *
 * Usage:  npx tsx scripts/audit-rc-types.ts
 * No mutations performed — output is for human review.
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

const VALID_TYPES = new Set(['coaching', 'reports_to'])
const VALID_STATUS = new Set(['Active', 'Inactive', 'Paused', 'Ended'])

interface Row {
  id: string
  type: string
  status: string
  personId: string | null
  leadId: string | null
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
        type: (f['Relationship Type'] as string) ?? '',
        status: (f.Status as string) ?? '',
        personId: persons[0] ?? null,
        leadId: leads[0] ?? null,
      })
    }

    offset = data.offset as string | undefined
  } while (offset)

  return rows
}

function printDistribution(label: string, m: Map<string, number>) {
  console.log(`\n=== ${label} ===`)
  for (const [k, v] of [...m.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${v.toString().padStart(4)}  "${k}"`)
  }
}

async function main() {
  console.log('Fetching all Relationship Context rows...')
  const rows = await fetchAll()
  console.log(`Total rows: ${rows.length}`)

  const typeDist = new Map<string, number>()
  const statusDist = new Map<string, number>()
  const invalidType: Row[] = []
  const invalidStatus: Row[] = []
  const missingLinks: Row[] = []

  for (const r of rows) {
    typeDist.set(r.type || '(empty)', (typeDist.get(r.type || '(empty)') ?? 0) + 1)
    statusDist.set(r.status || '(empty)', (statusDist.get(r.status || '(empty)') ?? 0) + 1)

    if (!VALID_TYPES.has(r.type)) invalidType.push(r)
    if (!VALID_STATUS.has(r.status)) invalidStatus.push(r)
    if (!r.personId || !r.leadId) missingLinks.push(r)
  }

  printDistribution('Relationship Type distribution', typeDist)
  printDistribution('Status distribution', statusDist)

  if (invalidType.length) {
    console.log(`\n=== Rows with non-spec Relationship Type (${invalidType.length}) ===`)
    for (const r of invalidType.slice(0, 50)) {
      console.log(`  ${r.id}  type="${r.type}"  status="${r.status}"`)
    }
    if (invalidType.length > 50) console.log(`  ... and ${invalidType.length - 50} more`)
  }

  if (invalidStatus.length) {
    console.log(`\n=== Rows with non-spec Status (${invalidStatus.length}) ===`)
    for (const r of invalidStatus.slice(0, 50)) {
      console.log(`  ${r.id}  status="${r.status}"  type="${r.type}"`)
    }
  }

  if (missingLinks.length) {
    console.log(`\n=== Rows missing Person or Lead links (${missingLinks.length}) ===`)
    for (const r of missingLinks.slice(0, 50)) {
      console.log(`  ${r.id}  person=${r.personId ?? 'NONE'}  lead=${r.leadId ?? 'NONE'}`)
    }
  }

  console.log('\nDone. No mutations performed. Review and clean up via Airtable UI as needed.')
}

main().catch((e) => { console.error(e); process.exit(1) })
