/**
 * One-time migration: collapse the Coach Session table into Notes.
 *
 * Each Coach Session row carries:
 *   - Coach        → Author Person on the new Note
 *   - Focal Person → Subject Person on the new Note
 *   - Calendar Event → Meeting on the new Note  (singleLineText today; will
 *                                                 become a linked field once
 *                                                 migrate-notes-meeting-to-linked
 *                                                 is run and the code reads
 *                                                 the new Meeting Link field)
 *   - Session Notes  → primary Note body
 *   - Action Items   → appended to body under an "Action Items:" heading
 *                      (these can be promoted to real Tasks rows later if
 *                      desired — keeping it as text avoids losing data)
 *   - Last Updated   → Date on the new Note
 *
 * Resulting Note has note_type = 'meeting_note', visibility = 'private_to_author'.
 *
 * Idempotency:
 *   Every migrated Note ends with a sentinel line:
 *       [migrated from Coach Session recXXXXXXXXXXXXXX]
 *   The script fetches all Notes once, indexes the source record IDs from
 *   that sentinel, and skips any Coach Session whose ID already appears.
 *   Safe to re-run.
 *
 * Run:
 *   cd ~/clerk-nextjs/leadershiptap-portal
 *   npx tsx scripts/migrate-coach-sessions-to-notes.ts
 *
 * After verifying the new Notes look right in Airtable:
 *   1. Update the code paths that still read from Coach Session
 *      (see "Item 11 — code-side changes" in the migration plan).
 *   2. Once nothing reads from the table, delete the Coach Session table.
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
// Use stable table IDs, not display names. Names can change and special chars
// in display names can trip Airtable's URL parser (the dash in "Coach-Person
// Context" has returned 403 INVALID_PERMISSIONS_OR_MODEL_NOT_FOUND before).
const COACH_SESSION_TABLE = 'tblPFj41wHQXZVzzZ'  // "Coach Session"
const NOTES_TABLE = 'tblSTELdCWLYk5dq4'          // "Notes"

const headers = { Authorization: `Bearer ${apiKey}` }
const jsonHeaders = { ...headers, 'Content-Type': 'application/json' }

const SENTINEL_RE = /\[migrated from Coach Session (rec[A-Za-z0-9]{14})\]/

interface CoachSessionRow {
  id: string
  coachId: string | null
  focalPersonId: string | null
  calendarEventId: string | null
  sessionNotes: string | null
  actionItems: string | null
  lastUpdated: string | null
}

async function fetchAll(table: string): Promise<Array<{ id: string; fields: Record<string, unknown> }>> {
  const out: Array<{ id: string; fields: Record<string, unknown> }> = []
  let offset: string | undefined
  do {
    const url = `${API}/${baseId}/${table}?maxRecords=10000${offset ? `&offset=${offset}` : ''}`
    const res = await fetch(url, { headers })
    if (!res.ok) throw new Error(`Fetch ${table} failed: ${res.status} ${await res.text()}`)
    const data = await res.json()
    out.push(...(data.records ?? []))
    offset = data.offset as string | undefined
  } while (offset)
  return out
}

function firstLinked(val: unknown): string | null {
  return Array.isArray(val) && val.length > 0 ? (val[0] as string) : null
}

async function alreadyMigratedIds(): Promise<Set<string>> {
  const notes = await fetchAll(NOTES_TABLE)
  const ids = new Set<string>()
  for (const n of notes) {
    const body = n.fields['Content']
    if (typeof body !== 'string') continue
    const m = body.match(SENTINEL_RE)
    if (m) ids.add(m[1])
  }
  return ids
}

function buildNoteBody(row: CoachSessionRow): string {
  const parts: string[] = []
  if (row.sessionNotes && row.sessionNotes.trim()) {
    parts.push(row.sessionNotes.trim())
  }
  if (row.actionItems && row.actionItems.trim()) {
    parts.push('')
    parts.push('Action Items:')
    parts.push(row.actionItems.trim())
  }
  parts.push('')
  parts.push(`[migrated from Coach Session ${row.id}]`)
  return parts.join('\n')
}

async function main() {
  console.log('Fetching Coach Session records...')
  const sessions = await fetchAll(COACH_SESSION_TABLE)
  console.log(`  ${sessions.length} found`)

  console.log('Indexing already-migrated Notes...')
  const done = await alreadyMigratedIds()
  console.log(`  ${done.size} already migrated`)

  const rows: CoachSessionRow[] = sessions.map((s) => ({
    id: s.id,
    coachId: firstLinked(s.fields['Coach']),
    focalPersonId: firstLinked(s.fields['Focal Person']),
    calendarEventId: firstLinked(s.fields['Calendar Event']),
    sessionNotes: (s.fields['Session Notes'] as string) ?? null,
    actionItems: (s.fields['Action Items'] as string) ?? null,
    lastUpdated: (s.fields['Last Updated'] as string) ?? null,
  }))

  const skipped: CoachSessionRow[] = []
  const empty: CoachSessionRow[] = []
  const toMigrate: CoachSessionRow[] = []

  for (const r of rows) {
    if (done.has(r.id)) {
      skipped.push(r)
      continue
    }
    const hasContent =
      (r.sessionNotes && r.sessionNotes.trim()) ||
      (r.actionItems && r.actionItems.trim())
    if (!hasContent) {
      empty.push(r)
      continue
    }
    toMigrate.push(r)
  }

  console.log(`\nPlan:`)
  console.log(`  ${skipped.length} already migrated (skip)`)
  console.log(`  ${empty.length} empty (skip; nothing to write)`)
  console.log(`  ${toMigrate.length} to migrate\n`)

  if (toMigrate.length === 0) {
    console.log('Nothing to do.')
    return
  }

  let success = 0
  let failed = 0
  for (const r of toMigrate) {
    const fields: Record<string, unknown> = {
      Content: buildNoteBody(r),
      Date: r.lastUpdated ?? new Date().toISOString().split('T')[0],
      'Note Type': 'meeting_note',
      Visibility: 'private_to_author',
    }
    if (r.coachId) fields['Author Person'] = [r.coachId]
    if (r.focalPersonId) {
      fields['Subject Person'] = [r.focalPersonId]
      fields['Client'] = [r.focalPersonId]
    }
    // Meeting field is singleLineText today. After running
    // migrate-notes-meeting-to-linked.ts, the linked Meeting Link field will
    // get backfilled from this value automatically.
    if (r.calendarEventId) fields['Meeting'] = r.calendarEventId

    const res = await fetch(`${API}/${baseId}/${NOTES_TABLE}`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ fields }),
    })
    if (res.ok) {
      success++
      const data = await res.json()
      console.log(`  ✓ ${r.id} → Note ${data.id}`)
    } else {
      failed++
      console.error(`  ✗ ${r.id}: ${res.status} ${await res.text()}`)
    }
  }

  console.log(`\nDone. ${success} migrated, ${failed} failed.`)
  console.log('Run migrate-notes-meeting-to-linked.ts afterwards to convert')
  console.log('the singleLineText Meeting field into a proper linked record.')
}

main().catch((e) => { console.error(e); process.exit(1) })
