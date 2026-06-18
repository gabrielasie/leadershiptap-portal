/**
 * Pulls the entire base schema from Airtable's Meta API and prints a
 * TypeScript-ready block mapping every table and field to its stable ID,
 * with the human-readable name preserved as a comment.
 *
 * Use this output to migrate lib/airtable/constants.ts from name-based to
 * ID-based references. Field IDs never change when you rename a column,
 * which means admins can rename fields in Airtable without breaking the
 * portal.
 *
 * Usage: npx tsx scripts/dump-airtable-schema.ts
 *
 * Required token scope: schema.bases:read
 * If your current AIRTABLE_API_KEY is a "data.records" PAT, this will 401.
 * Create a new PAT at https://airtable.com/create/tokens with the
 * schema.bases:read scope plus access to this specific base, and set it
 * as AIRTABLE_META_API_KEY (or replace AIRTABLE_API_KEY temporarily).
 */

import { config } from 'dotenv'
config({ path: '.env.local' })
config()

const apiKey = process.env.AIRTABLE_META_API_KEY ?? process.env.AIRTABLE_API_KEY
const baseId = process.env.AIRTABLE_BASE_ID
if (!apiKey || !baseId) {
  console.error('Missing AIRTABLE_API_KEY (or AIRTABLE_META_API_KEY) or AIRTABLE_BASE_ID')
  process.exit(1)
}

interface AirtableField {
  id: string
  name: string
  type: string
  options?: { choices?: Array<{ name: string }> }
}

interface AirtableTable {
  id: string
  name: string
  fields: AirtableField[]
}

async function fetchSchema(): Promise<AirtableTable[]> {
  const res = await fetch(`https://api.airtable.com/v0/meta/bases/${baseId}/tables`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  })
  if (!res.ok) {
    const body = await res.text()
    if (res.status === 401 || res.status === 403) {
      throw new Error(
        `Meta API returned ${res.status}. Your token needs the schema.bases:read scope. ` +
        `Create a new PAT at https://airtable.com/create/tokens with that scope and set it as ` +
        `AIRTABLE_META_API_KEY in .env.local.\n\nResponse body: ${body}`,
      )
    }
    throw new Error(`Meta API failed (${res.status}): ${body}`)
  }
  const data = await res.json()
  return data.tables as AirtableTable[]
}

function safeIdentifier(name: string): string {
  // Convert "Relationship Context" → "RELATIONSHIP_CONTEXT", etc.
  // Prefix with underscore if it would otherwise start with a digit, since
  // TypeScript object keys that are bare identifiers can't start with one.
  let s = name
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
  if (/^[0-9]/.test(s)) s = '_' + s
  return s
}

async function main() {
  const tables = await fetchSchema()
  console.log(`// Auto-generated from Airtable schema. ${new Date().toISOString().slice(0, 10)}`)
  console.log(`// Run scripts/dump-airtable-schema.ts to regenerate after schema changes.\n`)
  console.log(`// ── TABLES ─────────────────────────────────────────────────────────────────`)
  console.log(`export const TABLE_IDS = {`)
  for (const table of tables) {
    const key = safeIdentifier(table.name)
    console.log(`  ${key}: '${table.id}',  // "${table.name}"`)
  }
  console.log(`} as const\n`)

  console.log(`// ── FIELDS ─────────────────────────────────────────────────────────────────`)
  console.log(`// Each table's fields, keyed by an upper-snake-case version of the field name.`)
  console.log(`// IDs are stable; names are shown as comments for review.\n`)
  console.log(`export const FIELD_IDS = {`)
  for (const table of tables) {
    const tableKey = safeIdentifier(table.name)
    console.log(`  // ── ${table.name} ──`)
    console.log(`  ${tableKey}: {`)
    for (const field of table.fields) {
      const fieldKey = safeIdentifier(field.name)
      const typeNote = field.type === 'singleSelect' && field.options?.choices
        ? `  // single-select: ${field.options.choices.map((c) => c.name).join(' | ')}`
        : `  // ${field.type}`
      console.log(`    ${fieldKey}: '${field.id}',  // "${field.name}"  ${typeNote}`)
    }
    console.log(`  },`)
  }
  console.log(`} as const`)

  // Also print a small summary for sanity
  console.log(`\n// Summary: ${tables.length} tables, ${tables.reduce((sum, t) => sum + t.fields.length, 0)} fields total.`)
}

main().catch((e) => { console.error(e); process.exit(1) })
