/**
 * One-time migration: backfill Relationship Context.Start Date from each RC's
 * earliest associated Meeting (excluding Cancelled).
 *
 * Reads:
 *   - Relationship Contexts where Start Date is empty.
 *   - Meetings where Relationship Context links to that RC.
 *
 * Writes:
 *   - PATCHes RC.Start Date to the earliest Meeting.Start Time (yyyy-mm-dd).
 *
 * Skips:
 *   - RCs that already have Start Date populated.
 *   - RCs with no associated meetings.
 *
 * Usage: npx tsx scripts/backfill-rc-start-dates.ts
 */

import 'dotenv/config'

const apiKey = process.env.AIRTABLE_API_KEY
const baseId = process.env.AIRTABLE_BASE_ID
if (!apiKey || !baseId) {
  console.error('Missing AIRTABLE_API_KEY or AIRTABLE_BASE_ID')
  process.exit(1)
}

const API = 'https://api.airtable.com/v0'
const RC_TABLE = encodeURIComponent('Relationship Contexts')
const MEETINGS_TABLE = encodeURIComponent('Meetings')

const headers = { Authorization: `Bearer ${apiKey}` }
const jsonHeaders = { ...headers, 'Content-Type': 'application/json' }

interface RCRow {
  id: string
  hasStartDate: boolean
}

interface MeetingRow {
  rcId: string | null
  startTime: string
  status: string
}

function firstLinkedId(val: unknown): string | null {
  return Array.isArray(val) && val.length > 0 ? (val[0] as string) : null
}

async function fetchAll<T>(
  table: string,
  mapFn: (r: { id: string; fields: Record<string, unknown> }) => T | null,
): Promise<T[]> {
  const rows: T[] = []
  let offset: string | undefined
  do {
    const url = `${API}/${baseId}/${table}?maxRecords=10000${offset ? `&offset=${offset}` : ''}`
    const res = await fetch(url, { headers })
    if (!res.ok) throw new Error(`Fetch ${table} failed: ${res.status}`)
    const data = await res.json()
    for (const r of data.records ?? []) {
      const mapped = mapFn(r)
      if (mapped !== null) rows.push(mapped)
    }
    offset = data.offset as string | undefined
  } while (offset)
  return rows
}

async function main() {
  console.log('Fetching RCs and Meetings...')

  const [rcs, meetings] = await Promise.all([
    fetchAll<RCRow>(RC_TABLE, (r) => ({
      id: r.id,
      hasStartDate: !!(r.fields['Start Date'] as string | undefined),
    })),
    fetchAll<MeetingRow>(MEETINGS_TABLE, (r) => {
      const rcId = firstLinkedId(r.fields['Relationship Context'])
      const startTime = (r.fields['Start Time'] as string) ?? ''
      const status = (r.fields['Meeting Status'] as string) ?? ''
      if (!startTime) return null
      return { rcId, startTime, status }
    }),
  ])

  console.log(`Found ${rcs.length} RCs (${rcs.filter((r) => !r.hasStartDate).length} missing Start Date)`)
  console.log(`Found ${meetings.length} Meetings`)

  // Build RC → earliest non-cancelled meeting start time
  const earliest = new Map<string, string>()
  for (const m of meetings) {
    if (!m.rcId) continue
    if (m.status === 'Cancelled') continue
    const cur = earliest.get(m.rcId)
    if (!cur || m.startTime < cur) earliest.set(m.rcId, m.startTime)
  }

  const targets = rcs.filter((r) => !r.hasStartDate && earliest.has(r.id))
  console.log(`\n${targets.length} RCs will be updated.`)

  if (targets.length === 0) {
    console.log('Nothing to do.')
    return
  }

  let success = 0
  let failed = 0
  for (const rc of targets) {
    const startTime = earliest.get(rc.id)!
    const startDate = startTime.slice(0, 10) // yyyy-mm-dd

    const res = await fetch(`${API}/${baseId}/${RC_TABLE}/${rc.id}`, {
      method: 'PATCH',
      headers: jsonHeaders,
      body: JSON.stringify({ fields: { 'Start Date': startDate } }),
    })

    if (res.ok) {
      console.log(`  ✓ ${rc.id} → ${startDate}`)
      success++
    } else {
      console.error(`  ✗ ${rc.id}: ${res.status} ${await res.text()}`)
      failed++
    }
  }

  console.log(`\nDone. ${success} updated, ${failed} failed.`)
  console.log(
    `${rcs.filter((r) => !r.hasStartDate && !earliest.has(r.id)).length} RCs ` +
    'still have no Start Date — they have no associated meetings yet.',
  )
}

main().catch((e) => { console.error(e); process.exit(1) })
