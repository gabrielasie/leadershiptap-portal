/**
 * Read-only audit: find duplicate Users records.
 *
 * A "duplicate" is two or more records that match on:
 *   - Work Email (case-insensitive), OR
 *   - First Name + Last Name (case-insensitive, both populated)
 *
 * No mutations performed. Output is for human review — open each pair in
 * Airtable, decide which is canonical, re-link any meetings/notes/tasks
 * pointing to the duplicate, then delete the duplicate.
 *
 * Usage: npx tsx scripts/audit-users-duplicates.ts
 */

import { config } from 'dotenv'
// Next.js convention: real credentials live in .env.local. Fall back to .env.
config({ path: '.env.local' })
config()

const apiKey = process.env.AIRTABLE_API_KEY
const baseId = process.env.AIRTABLE_BASE_ID
if (!apiKey || !baseId) {
  console.error('Missing AIRTABLE_API_KEY or AIRTABLE_BASE_ID')
  process.exit(1)
}

const API = 'https://api.airtable.com/v0'
const TABLE = encodeURIComponent('Users')

interface Row {
  id: string
  firstName: string
  lastName: string
  workEmail: string
  email: string
  fullName: string
  hasPhoto: boolean
  hasJobTitle: boolean
  meetingCount: number
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
      rows.push({
        id: r.id as string,
        firstName: ((f['First Name'] as string) ?? '').trim(),
        lastName: ((f['Last Name'] as string) ?? '').trim(),
        workEmail: ((f['Work Email'] as string) ?? '').trim().toLowerCase(),
        email: ((f['Email'] as string) ?? '').trim().toLowerCase(),
        fullName: ((f['Full Name'] as string) ?? '').trim(),
        hasPhoto: Array.isArray(f['Profile Photo']) && (f['Profile Photo'] as unknown[]).length > 0,
        hasJobTitle: typeof f['Job Title'] === 'string' && (f['Job Title'] as string).trim().length > 0,
        meetingCount: Array.isArray(f['Associated Meetings'])
          ? (f['Associated Meetings'] as unknown[]).length
          : 0,
      })
    }
    offset = data.offset as string | undefined
  } while (offset)
  return rows
}

function score(r: Row): number {
  // Higher score = more "real" / canonical-looking record
  let s = 0
  if (r.workEmail) s += 3
  if (r.email && r.email !== r.workEmail) s += 1
  if (r.hasPhoto) s += 2
  if (r.hasJobTitle) s += 1
  s += Math.min(r.meetingCount, 10)
  return s
}

function describe(r: Row): string {
  const name = r.fullName || [r.firstName, r.lastName].filter(Boolean).join(' ') || '(no name)'
  const email = r.workEmail || r.email || '(no email)'
  const flags = [
    r.hasPhoto ? 'photo' : null,
    r.hasJobTitle ? 'title' : null,
    r.meetingCount > 0 ? `${r.meetingCount} meetings` : null,
  ].filter(Boolean).join(', ') || 'no data'
  return `${r.id}  ${name.padEnd(28)}  ${email.padEnd(35)}  [${flags}]  score=${score(r)}`
}

async function main() {
  console.log('Fetching all Users records...\n')
  const rows = await fetchAll()
  console.log(`Total Users: ${rows.length}\n`)

  // Group by work email
  const byEmail = new Map<string, Row[]>()
  for (const r of rows) {
    if (!r.workEmail) continue
    const list = byEmail.get(r.workEmail) ?? []
    list.push(r)
    byEmail.set(r.workEmail, list)
  }

  // Group by lowercased First+Last
  const byName = new Map<string, Row[]>()
  for (const r of rows) {
    if (!r.firstName || !r.lastName) continue
    const key = `${r.firstName.toLowerCase()}|${r.lastName.toLowerCase()}`
    const list = byName.get(key) ?? []
    list.push(r)
    byName.set(key, list)
  }

  const emailDupes = [...byEmail.entries()].filter(([, list]) => list.length > 1)
  const nameDupes = [...byName.entries()].filter(([, list]) => list.length > 1)

  if (emailDupes.length === 0 && nameDupes.length === 0) {
    console.log('No duplicates found.')
    return
  }

  if (emailDupes.length) {
    console.log(`=== Duplicate Work Email (${emailDupes.length} groups) ===\n`)
    for (const [email, list] of emailDupes) {
      const sorted = list.slice().sort((a, b) => score(b) - score(a))
      console.log(`Email: ${email}`)
      for (const r of sorted) console.log(`  ${describe(r)}`)
      console.log(`  → keep first listed (highest score), delete the rest after re-linking.\n`)
    }
  }

  if (nameDupes.length) {
    console.log(`=== Duplicate First+Last Name (${nameDupes.length} groups) ===\n`)
    for (const [key, list] of nameDupes) {
      // Skip groups already covered by email dupes
      if (list.every((r) => emailDupes.some(([, el]) => el.includes(r)))) continue
      const sorted = list.slice().sort((a, b) => score(b) - score(a))
      console.log(`Name: ${key.replace('|', ' ')}`)
      for (const r of sorted) console.log(`  ${describe(r)}`)
      console.log(`  → review manually. Same name may be different people.\n`)
    }
  }

  console.log(
    'Done. No mutations. For each group, open the records in Airtable, ' +
    're-link any meetings/notes/tasks pointing to the lower-score records ' +
    'over to the highest-score one, then delete the duplicates.',
  )
}

main().catch((e) => { console.error(e); process.exit(1) })
