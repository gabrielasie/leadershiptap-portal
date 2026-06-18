/**
 * One-time migration: collapse the Coach-Person Context table into Notes.
 *
 * Each Coach-Person Context row carries:
 *   - Coach   → Author Person on the new Note
 *   - Person  → Subject Person on the new Note
 *   - Quick Notes        → emitted as one Note  (note_type = general_context)
 *   - Family Details     → emitted as one Note  (note_type = general_context,
 *                          prefixed "Family Details:" in the body)
 *   - Relationship Flags → appended to the Quick Notes note as a "Flags:" line
 *                          (multi-select values, joined with ", ")
 *   - Last Updated       → Date on the new Notes
 *
 * One Coach-Person Context row may produce up to TWO Notes (Quick Notes and
 * Family Details are conceptually different — splitting keeps them filterable
 * by note_type in the future). Empty fields are skipped, not written.
 *
 * Idempotency:
 *   Every migrated Note ends with a sentinel line:
 *       [migrated from Coach-Person Context recXXXXXXXXXXXXXX#quick_notes]
 *       [migrated from Coach-Person Context recXXXXXXXXXXXXXX#family_details]
 *   The script indexes those sentinels from existing Notes and skips any
 *   source-row/kind pair that's already been written. Safe to re-run.
 *
 * Run:
 *   cd ~/clerk-nextjs/leadershiptap-portal
 *   npx tsx scripts/migrate-coach-person-context-to-notes.ts
 *
 * After verifying:
 *   1. Update the code paths that still read from Coach-Person Context
 *      (see "Item 11 — code-side changes" in the migration plan).
 *   2. Once nothing reads from the table, delete the Coach-Person Context table.
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
// Use stable table IDs, not display names. Names can be renamed and the dash
// in "Coach-Person Context" has tripped the Airtable URL parser in the past
// (returns 403 INVALID_PERMISSIONS_OR_MODEL_NOT_FOUND).
const CPC_TABLE = 'tbly1SOW603Qhd2nJ'      // "Coach-Person Context"
const NOTES_TABLE = 'tblSTELdCWLYk5dq4'    // "Notes"

const headers = { Authorization: `Bearer ${apiKey}` }
const jsonHeaders = { ...headers, 'Content-Type': 'application/json' }

type Kind = 'quick_notes' | 'family_details'
const SENTINEL_RE =
  /\[migrated from Coach-Person Context (rec[A-Za-z0-9]{14})#(quick_notes|family_details)\]/

interface CPCRow {
  id: string
  coachId: string | null
  personId: string | null
  quickNotes: string | null
  familyDetails: string | null
  flags: string[]
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

async function alreadyMigrated(): Promise<Set<string>> {
  const notes = await fetchAll(NOTES_TABLE)
  const keys = new Set<string>()
  for (const n of notes) {
    const body = n.fields['Content']
    if (typeof body !== 'string') continue
    const m = body.match(SENTINEL_RE)
    if (m) keys.add(`${m[1]}#${m[2]}`)
  }
  return keys
}

function buildBody(row: CPCRow, kind: Kind): string {
  const parts: string[] = []
  if (kind === 'quick_notes') {
    if (row.quickNotes) parts.push(row.quickNotes.trim())
    if (row.flags.length > 0) {
      parts.push('')
      parts.push(`Flags: ${row.flags.join(', ')}`)
    }
  } else {
    parts.push('Family Details:')
    if (row.familyDetails) parts.push(row.familyDetails.trim())
  }
  parts.push('')
  parts.push(`[migrated from Coach-Person Context ${row.id}#${kind}]`)
  return parts.join('\n')
}

async function postNote(row: CPCRow, kind: Kind): Promise<boolean> {
  const fields: Record<string, unknown> = {
    Content: buildBody(row, kind),
    Date: row.lastUpdated ?? new Date().toISOString().split('T')[0],
    'Note Type': 'general_context',
    Visibility: 'private_to_author',
  }
  if (row.coachId) fields['Author Person'] = [row.coachId]
  if (row.personId) {
    fields['Subject Person'] = [row.personId]
    fields['Client'] = [row.personId]
  }

  const res = await fetch(`${API}/${baseId}/${NOTES_TABLE}`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({ fields }),
  })
  if (res.ok) {
    const data = await res.json()
    console.log(`  ✓ ${row.id}#${kind} → Note ${data.id}`)
    return true
  }
  console.error(`  ✗ ${row.id}#${kind}: ${res.status} ${await res.text()}`)
  return false
}

async function main() {
  console.log('Fetching Coach-Person Context records...')
  const cpcs = await fetchAll(CPC_TABLE)
  console.log(`  ${cpcs.length} found`)

  console.log('Indexing already-migrated Notes...')
  const done = await alreadyMigrated()
  console.log(`  ${done.size} (source_id#kind) pairs already migrated`)

  const rows: CPCRow[] = cpcs.map((c) => ({
    id: c.id,
    coachId: firstLinked(c.fields['Coach']),
    personId: firstLinked(c.fields['Person']),
    quickNotes: (c.fields['Quick Notes'] as string) ?? null,
    familyDetails: (c.fields['Family Details'] as string) ?? null,
    flags: Array.isArray(c.fields['Relationship Flags'])
      ? (c.fields['Relationship Flags'] as string[])
      : [],
    lastUpdated: (c.fields['Last Updated'] as string) ?? null,
  }))

  let plannedQuick = 0
  let plannedFamily = 0
  let skipped = 0
  for (const r of rows) {
    const hasQuick =
      (r.quickNotes && r.quickNotes.trim().length > 0) || r.flags.length > 0
    const hasFamily = r.familyDetails && r.familyDetails.trim().length > 0
    if (hasQuick) {
      if (done.has(`${r.id}#quick_notes`)) skipped++
      else plannedQuick++
    }
    if (hasFamily) {
      if (done.has(`${r.id}#family_details`)) skipped++
      else plannedFamily++
    }
  }

  console.log(`\nPlan:`)
  console.log(`  ${skipped} already migrated (skip)`)
  console.log(`  ${plannedQuick} Quick Notes → Notes`)
  console.log(`  ${plannedFamily} Family Details → Notes\n`)

  if (plannedQuick + plannedFamily === 0) {
    console.log('Nothing to do.')
    return
  }

  let success = 0
  let failed = 0
  for (const r of rows) {
    const hasQuick =
      (r.quickNotes && r.quickNotes.trim().length > 0) || r.flags.length > 0
    if (hasQuick && !done.has(`${r.id}#quick_notes`)) {
      const ok = await postNote(r, 'quick_notes')
      ok ? success++ : failed++
    }
    const hasFamily = r.familyDetails && r.familyDetails.trim().length > 0
    if (hasFamily && !done.has(`${r.id}#family_details`)) {
      const ok = await postNote(r, 'family_details')
      ok ? success++ : failed++
    }
  }

  console.log(`\nDone. ${success} created, ${failed} failed.`)
}

main().catch((e) => { console.error(e); process.exit(1) })
