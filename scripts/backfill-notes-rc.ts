/**
 * One-time migration: backfill Relationship Context on existing Notes.
 *
 * For each note that has Author Person + Subject Person but no Relationship Context,
 * resolve the RC via the same logic the app uses and PATCH it onto the record.
 *
 * Usage:  npx tsx scripts/backfill-notes-rc.ts
 * Requires AIRTABLE_API_KEY and AIRTABLE_BASE_ID in .env.local (or env).
 */

import { config } from 'dotenv'
config({ path: '.env.local' })
config()

const API_BASE = 'https://api.airtable.com/v0'
const NOTES_TABLE = 'Notes'
const RC_TABLE = 'Relationship Contexts'

const F = {
  AUTHOR_PERSON: 'Author Person',
  SUBJECT_PERSON: 'Subject Person',
  RELATIONSHIP_CONTEXT: 'Relationship Context',
  RC_LEAD: 'Lead',
  RC_PERSON: 'Person',
  RC_STATUS: 'Status',
} as const

function env(key: string): string {
  const val = process.env[key]
  if (!val) throw new Error(`Missing env var: ${key}`)
  return val
}

const apiKey = env('AIRTABLE_API_KEY')
const baseId = env('AIRTABLE_BASE_ID')

const headers = { Authorization: `Bearer ${apiKey}` }
const jsonHeaders = { ...headers, 'Content-Type': 'application/json' }

function firstLinkedId(val: unknown): string | undefined {
  return Array.isArray(val) && val.length > 0 ? (val[0] as string) : undefined
}

// ── Fetch all records with pagination ────────────────────────────────────────

interface AirtableRecord {
  id: string
  fields: Record<string, unknown>
}

async function fetchAll(table: string, formula?: string): Promise<AirtableRecord[]> {
  const records: AirtableRecord[] = []
  let offset: string | undefined
  const encodedTable = encodeURIComponent(table)

  do {
    const params = new URLSearchParams()
    if (formula) params.set('filterByFormula', formula)
    if (offset) params.set('offset', offset)
    params.set('maxRecords', '10000')

    const res = await fetch(
      `${API_BASE}/${baseId}/${encodedTable}?${params}`,
      { headers, cache: 'no-store' },
    )
    if (!res.ok) throw new Error(`Fetch ${table} failed: ${res.status} ${await res.text()}`)
    const data = await res.json()
    records.push(...(data.records ?? []))
    offset = data.offset
  } while (offset)

  return records
}

// ── Build RC lookup ──────────────────────────────────────────────────────────

interface RCEntry {
  id: string
  leadId: string
  personId: string
}

async function loadActiveContexts(): Promise<RCEntry[]> {
  const records = await fetchAll(RC_TABLE, `{${F.RC_STATUS}}="Active"`)
  const entries: RCEntry[] = []
  for (const r of records) {
    const leadId = firstLinkedId(r.fields[F.RC_LEAD])
    const personId = firstLinkedId(r.fields[F.RC_PERSON])
    if (leadId && personId) entries.push({ id: r.id, leadId, personId })
  }
  return entries
}

function buildResolver(contexts: RCEntry[]) {
  // Index by leadId for fast lookup
  const byLead = new Map<string, RCEntry[]>()
  for (const c of contexts) {
    const list = byLead.get(c.leadId) ?? []
    list.push(c)
    byLead.set(c.leadId, list)
  }

  return function resolveContextForSubject(
    authorId: string,
    subjectId: string,
  ): string | null {
    const authorContexts = byLead.get(authorId) ?? []

    // 1. Direct match
    const direct = authorContexts.find((c) => c.personId === subjectId)
    if (direct) return direct.id

    // 2. One-hop downstream
    for (const rc of authorContexts) {
      const downstream = byLead.get(rc.personId) ?? []
      if (downstream.some((d) => d.personId === subjectId)) {
        return rc.id // coach's upstream RC
      }
    }

    return null
  }
}

// ── PATCH a single note ──────────────────────────────────────────────────────

async function patchNoteRC(noteId: string, rcId: string): Promise<boolean> {
  const res = await fetch(
    `${API_BASE}/${baseId}/${encodeURIComponent(NOTES_TABLE)}/${noteId}`,
    {
      method: 'PATCH',
      headers: jsonHeaders,
      body: JSON.stringify({
        fields: { [F.RELATIONSHIP_CONTEXT]: [rcId] },
      }),
    },
  )
  return res.ok
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('Loading active Relationship Contexts...')
  const contexts = await loadActiveContexts()
  console.log(`  ${contexts.length} active contexts`)

  const resolve = buildResolver(contexts)

  console.log('Loading all Notes...')
  const notes = await fetchAll(NOTES_TABLE)
  console.log(`  ${notes.length} total notes`)

  let alreadyHasRC = 0
  let missingFields = 0
  let backfilled = 0
  let skipped = 0
  let errors = 0

  for (const note of notes) {
    const existingRC = firstLinkedId(note.fields[F.RELATIONSHIP_CONTEXT])
    if (existingRC) {
      alreadyHasRC++
      continue
    }

    const authorId = firstLinkedId(note.fields[F.AUTHOR_PERSON])
    const subjectId = firstLinkedId(note.fields[F.SUBJECT_PERSON])
    if (!authorId || !subjectId) {
      missingFields++
      continue
    }

    const rcId = resolve(authorId, subjectId)
    if (!rcId) {
      console.log(`  SKIP ${note.id} — no RC found (author=${authorId}, subject=${subjectId})`)
      skipped++
      continue
    }

    const ok = await patchNoteRC(note.id, rcId)
    if (ok) {
      backfilled++
    } else {
      console.log(`  ERROR patching ${note.id}`)
      errors++
    }
  }

  console.log('\n--- Summary ---')
  console.log(`Total notes:        ${notes.length}`)
  console.log(`Already had RC:     ${alreadyHasRC}`)
  console.log(`Missing author/subj: ${missingFields}`)
  console.log(`Backfilled:         ${backfilled}`)
  console.log(`Skipped (no match): ${skipped}`)
  console.log(`Errors:             ${errors}`)
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
