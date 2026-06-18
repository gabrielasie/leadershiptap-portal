/**
 * One-time migration: convert the singleLineText `Meeting` field on Notes
 * to a linked-record field pointing at the Meetings table.
 *
 * Manual prereq (do this in Airtable UI first):
 *   1. Open the Notes table.
 *   2. Add a new field:
 *        Name: Meeting Link
 *        Type: Link to another record
 *        Linked table: Meetings
 *        Allow linking to multiple records: OFF
 *   3. Save.
 *
 * Then run:  npx tsx scripts/migrate-notes-meeting-to-linked.ts
 *
 * For each Note where the legacy text Meeting field contains a Meeting record
 * ID (recXXX format), this script writes that ID as a linked record to the
 * new Meeting Link field.
 *
 * Idempotent. Safe to re-run — skips Notes that already have Meeting Link set.
 *
 * After verifying:
 *   1. Update lib/airtable/notes.ts to read/write Meeting Link instead of Meeting
 *   2. Delete the old singleLineText Meeting field in Airtable
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
const NOTES_TABLE = encodeURIComponent('Notes')

const LEGACY_TEXT_FIELD = 'Meeting'
const NEW_LINKED_FIELD = 'Meeting Link'

const headers = { Authorization: `Bearer ${apiKey}` }
const jsonHeaders = { ...headers, 'Content-Type': 'application/json' }

interface NoteRow {
  id: string
  legacyMeetingText: string | null
  alreadyLinked: boolean
}

function looksLikeRecordId(s: string): boolean {
  return /^rec[A-Za-z0-9]{14}$/.test(s.trim())
}

async function fetchAllNotes(): Promise<NoteRow[]> {
  const rows: NoteRow[] = []
  let offset: string | undefined
  do {
    const url = `${API}/${baseId}/${NOTES_TABLE}?maxRecords=10000${offset ? `&offset=${offset}` : ''}`
    const res = await fetch(url, { headers })
    if (!res.ok) throw new Error(`Fetch failed: ${res.status} ${await res.text()}`)
    const data = await res.json()
    for (const r of data.records ?? []) {
      const f = r.fields as Record<string, unknown>
      const legacy = f[LEGACY_TEXT_FIELD]
      const newField = f[NEW_LINKED_FIELD]
      rows.push({
        id: r.id,
        legacyMeetingText: typeof legacy === 'string' ? legacy : null,
        alreadyLinked: Array.isArray(newField) && newField.length > 0,
      })
    }
    offset = data.offset as string | undefined
  } while (offset)
  return rows
}

async function main() {
  console.log('Fetching all Notes...')
  const notes = await fetchAllNotes()
  console.log(`Total notes: ${notes.length}`)

  const candidates = notes.filter(
    (n) => n.legacyMeetingText && looksLikeRecordId(n.legacyMeetingText) && !n.alreadyLinked,
  )
  const alreadyDone = notes.filter((n) => n.alreadyLinked).length
  const noMeeting = notes.filter((n) => !n.legacyMeetingText).length
  const invalidId = notes.filter(
    (n) => n.legacyMeetingText && !looksLikeRecordId(n.legacyMeetingText),
  )

  console.log(`  ${alreadyDone} already linked`)
  console.log(`  ${noMeeting} have no Meeting reference`)
  console.log(`  ${invalidId.length} have non-record-ID Meeting strings (skipped)`)
  console.log(`  ${candidates.length} will be migrated\n`)

  if (invalidId.length > 0) {
    console.log('Invalid Meeting strings (manual review needed):')
    for (const n of invalidId.slice(0, 20)) {
      console.log(`  ${n.id}: "${n.legacyMeetingText}"`)
    }
    console.log()
  }

  if (candidates.length === 0) {
    console.log('Nothing to do.')
    return
  }

  let success = 0
  let failed = 0
  for (const n of candidates) {
    const res = await fetch(`${API}/${baseId}/${NOTES_TABLE}/${n.id}`, {
      method: 'PATCH',
      headers: jsonHeaders,
      body: JSON.stringify({
        fields: { [NEW_LINKED_FIELD]: [n.legacyMeetingText!] },
      }),
    })
    if (res.ok) {
      console.log(`  ✓ ${n.id} → ${n.legacyMeetingText}`)
      success++
    } else {
      console.error(`  ✗ ${n.id}: ${res.status} ${await res.text()}`)
      failed++
    }
  }

  console.log(`\nDone. ${success} migrated, ${failed} failed.`)
  console.log('\nNext: update lib/airtable/notes.ts to read/write Meeting Link.')
  console.log('Then delete the old Meeting (singleLineText) field in Airtable.')
}

main().catch((e) => { console.error(e); process.exit(1) })
