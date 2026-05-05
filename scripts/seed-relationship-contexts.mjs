/**
 * Bulk-create Relationship Context records for all of Josh's coaching clients.
 *
 * Usage:
 *   DRY_RUN=true node scripts/seed-relationship-contexts.mjs   # preview only
 *   node scripts/seed-relationship-contexts.mjs                 # create records
 *
 * Requires AIRTABLE_API_KEY and AIRTABLE_BASE_ID from .env.local.
 */

import { readFileSync } from 'fs'
import { resolve } from 'path'

// ── Load .env.local ──────────────────────────────────────────────────────────

const envPath = resolve(process.cwd(), '.env.local')
for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith('#')) continue
  const eqIdx = trimmed.indexOf('=')
  if (eqIdx < 0) continue
  const key = trimmed.slice(0, eqIdx).trim()
  let val = trimmed.slice(eqIdx + 1).trim()
  // Strip surrounding quotes
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
    val = val.slice(1, -1)
  }
  if (!process.env[key]) process.env[key] = val
}

const API_KEY = process.env.AIRTABLE_API_KEY
const BASE_ID = process.env.AIRTABLE_BASE_ID
const DRY_RUN = process.env.DRY_RUN === 'true'

if (!API_KEY || !BASE_ID) {
  console.error('Missing AIRTABLE_API_KEY or AIRTABLE_BASE_ID')
  process.exit(1)
}

const API_BASE = `https://api.airtable.com/v0/${BASE_ID}`
const headers = { Authorization: `Bearer ${API_KEY}`, 'Content-Type': 'application/json' }

// ── Airtable field names (mirrors lib/airtable/constants.ts) ─────────────────

const USERS_TABLE = 'Users'
const RC_TABLE = 'Relationship Contexts'
const PP_TABLE = 'Permission Profiles'

const RC_FIELDS = {
  PERSON: 'Person',
  LEAD: 'Lead',
  TYPE: 'Relationship Type',
  PERMISSION_LEVEL: 'Permission Level',
  STATUS: 'Status',
  START_DATE: 'Start Date',
}

// ── Helpers ──────────────────────────────────────────────────────────────────

async function fetchAll(table, params = '') {
  const records = []
  let offset = ''
  do {
    const sep = params ? '&' : '?'
    const url = `${API_BASE}/${encodeURIComponent(table)}${params}${offset ? `${sep}offset=${offset}` : ''}`
    const res = await fetch(url, { headers })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Airtable fetch ${table} failed (${res.status}): ${text}`)
    }
    const data = await res.json()
    records.push(...(data.records ?? []))
    offset = data.offset ?? ''
  } while (offset)
  return records
}

function nameOf(fields) {
  const full = fields['Full Name']?.trim()
  const first = fields['First Name']?.trim()
  const last = fields['Last Name']?.trim()
  return full || [first, last].filter(Boolean).join(' ') || '(unnamed)'
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(DRY_RUN ? '\n=== DRY RUN — no records will be created ===\n' : '\n=== LIVE RUN ===\n')

  // 1. Fetch all Users
  console.log('Fetching Users...')
  const allUsers = await fetchAll(USERS_TABLE, '?fields[]=Full%20Name&fields[]=First%20Name&fields[]=Last%20Name&fields[]=Role&fields[]=Coach')
  console.log(`  Found ${allUsers.length} total user records`)

  // 2. Find Josh (coach)
  const joshRecord = allUsers.find((r) => {
    const f = r.fields
    const name = nameOf(f).toLowerCase()
    const role = (f['Role'] ?? '').toLowerCase()
    return name.includes('josh') && (role === 'coach' || role === 'admin')
  })

  if (!joshRecord) {
    console.error('Could not find Josh in Users table (looking for coach/admin named Josh)')
    process.exit(1)
  }

  const joshId = joshRecord.id
  const joshName = nameOf(joshRecord.fields)
  console.log(`  Josh: ${joshName} (${joshId})`)

  // 3. Find Josh's clients — users whose Coach linked field includes Josh's record ID
  const joshClients = allUsers.filter((r) => {
    const coachIds = Array.isArray(r.fields['Coach']) ? r.fields['Coach'] : []
    return coachIds.includes(joshId)
  })

  console.log(`  Josh's clients: ${joshClients.length}`)
  for (const c of joshClients) {
    console.log(`    - ${nameOf(c.fields)} (${c.id})`)
  }

  if (joshClients.length === 0) {
    console.log('\nNo clients found — nothing to do.')
    return
  }

  // 4. Fetch existing Relationship Context records to avoid duplicates
  console.log('\nFetching existing Relationship Contexts (all pages)...')
  const existingRCs = await fetchAll(RC_TABLE, '?maxRecords=5000')
  console.log(`  Found ${existingRCs.length} existing RC records`)

  const existingKeys = new Set()
  for (const r of existingRCs) {
    const f = r.fields
    const personIds = Array.isArray(f[RC_FIELDS.PERSON]) ? f[RC_FIELDS.PERSON] : []
    const leadIds = Array.isArray(f[RC_FIELDS.LEAD]) ? f[RC_FIELDS.LEAD] : []
    const type = (f[RC_FIELDS.TYPE] ?? '').toLowerCase()
    if (personIds[0] && leadIds[0]) {
      existingKeys.add(`${personIds[0]}|${leadIds[0]}|${type}`)
    }
  }

  // 5. Fetch the 'standard' Permission Profile ID
  console.log('Fetching Permission Profiles...')
  const ppRecords = await fetchAll(PP_TABLE, `?filterByFormula=${encodeURIComponent('{Profile Name}="standard"')}&maxRecords=1`)
  const standardProfileId = ppRecords[0]?.id ?? null
  console.log(`  Standard profile: ${standardProfileId ?? '(not found)'}`)

  // 6. Determine which rows to create
  const toCreate = []
  const skipped = []

  for (const client of joshClients) {
    // Check against lowercase key — existing records may be "Executive Coaching", "coaching", etc.
    const key = `${client.id}|${joshId}|executive coaching`
    if (existingKeys.has(key)) {
      skipped.push({ name: nameOf(client.fields), id: client.id, reason: 'already exists' })
    } else {
      toCreate.push({ personId: client.id, personName: nameOf(client.fields) })
    }
  }

  console.log(`\nRows to create: ${toCreate.length}`)
  for (const r of toCreate) {
    console.log(`  + ${r.personName} (${r.personId}) coached by ${joshName}`)
  }

  if (skipped.length > 0) {
    console.log(`\nSkipped (duplicate): ${skipped.length}`)
    for (const s of skipped) {
      console.log(`  ~ ${s.name} (${s.id}) — ${s.reason}`)
    }
  }

  if (toCreate.length === 0) {
    console.log('\nAll relationships already exist — nothing to do.')
    return
  }

  if (DRY_RUN) {
    console.log(`\n[DRY RUN] Would create ${toCreate.length} Relationship Context record(s). Re-run without DRY_RUN=true to apply.`)
    return
  }

  // 7. Create records (one at a time to get clear error reporting)
  console.log(`\nCreating ${toCreate.length} Relationship Context record(s)...`)
  let created = 0
  let failed = 0

  for (const row of toCreate) {
    const fields = {
      [RC_FIELDS.PERSON]: [row.personId],
      [RC_FIELDS.LEAD]: [joshId],
      [RC_FIELDS.TYPE]: 'Executive Coaching',
      [RC_FIELDS.STATUS]: 'Active',
      [RC_FIELDS.START_DATE]: new Date().toISOString().slice(0, 10),
    }
    if (standardProfileId) {
      fields[RC_FIELDS.PERMISSION_LEVEL] = [standardProfileId]
    }

    const res = await fetch(`${API_BASE}/${encodeURIComponent(RC_TABLE)}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ fields }),
    })

    if (res.ok) {
      const data = await res.json()
      console.log(`  Created: ${row.personName} → ${data.id}`)
      created++
    } else {
      const text = await res.text()
      console.error(`  FAILED: ${row.personName} — ${res.status}: ${text}`)
      failed++
    }
  }

  console.log(`\nDone. Created: ${created}, Failed: ${failed}, Skipped: ${skipped.length}`)
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
