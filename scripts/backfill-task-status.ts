/**
 * One-time migration: update Task status values to spec casing.
 *
 * Old values → New values:
 *   'not started' → 'Not Started'
 *   'in progress' → 'In Progress'
 *   'completed'   → 'Complete'
 *   'cancelled'   → 'Cancelled'
 *
 * Usage:  npx tsx scripts/backfill-task-status.ts
 * Requires AIRTABLE_API_KEY and AIRTABLE_BASE_ID in .env.local (or env).
 */

import 'dotenv/config'

const API_BASE = 'https://api.airtable.com/v0'
const TABLE = 'Tasks'
const STATUS_FIELD = 'Status'

function env(key: string): string {
  const val = process.env[key]
  if (!val) throw new Error(`Missing env var: ${key}`)
  return val
}

const apiKey = env('AIRTABLE_API_KEY')
const baseId = env('AIRTABLE_BASE_ID')
const headers = { Authorization: `Bearer ${apiKey}` }
const jsonHeaders = { ...headers, 'Content-Type': 'application/json' }

const STATUS_MAP: Record<string, string> = {
  'not started': 'Not Started',
  'in progress': 'In Progress',
  'completed': 'Complete',
  'cancelled': 'Cancelled',
}

interface AirtableRecord {
  id: string
  fields: Record<string, unknown>
}

async function fetchAll(): Promise<AirtableRecord[]> {
  const records: AirtableRecord[] = []
  let offset: string | undefined
  const encodedTable = encodeURIComponent(TABLE)

  do {
    const params = new URLSearchParams()
    if (offset) params.set('offset', offset)
    params.set('maxRecords', '10000')
    params.set('fields[]', STATUS_FIELD)

    const res = await fetch(
      `${API_BASE}/${baseId}/${encodedTable}?${params}`,
      { headers, cache: 'no-store' },
    )
    if (!res.ok) throw new Error(`Fetch failed: ${res.status} ${await res.text()}`)
    const data = await res.json()
    records.push(...(data.records ?? []))
    offset = data.offset
  } while (offset)

  return records
}

async function main() {
  console.log('Fetching all Tasks...')
  const records = await fetchAll()
  console.log(`  ${records.length} total tasks`)

  let updated = 0
  let skipped = 0
  let errors = 0

  for (const r of records) {
    const current = ((r.fields[STATUS_FIELD] as string) ?? '').trim()
    const normalized = current.toLowerCase()
    const newStatus = STATUS_MAP[normalized]

    if (!newStatus || newStatus === current) {
      skipped++
      continue
    }

    const res = await fetch(
      `${API_BASE}/${baseId}/${encodeURIComponent(TABLE)}/${r.id}`,
      {
        method: 'PATCH',
        headers: jsonHeaders,
        body: JSON.stringify({ fields: { [STATUS_FIELD]: newStatus } }),
      },
    )
    if (res.ok) {
      updated++
    } else {
      console.log(`  ERROR patching ${r.id}: ${await res.text()}`)
      errors++
    }
  }

  console.log('\n--- Summary ---')
  console.log(`Total tasks:  ${records.length}`)
  console.log(`Updated:      ${updated}`)
  console.log(`Skipped:      ${skipped}`)
  console.log(`Errors:       ${errors}`)
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
