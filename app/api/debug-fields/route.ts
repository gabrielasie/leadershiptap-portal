// TEMPORARY DEBUG ROUTE — delete after confirming field names
import { NextResponse } from 'next/server'

async function fetchTableFields(apiKey: string, baseId: string, table: string) {
  const res = await fetch(
    `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(table)}?maxRecords=3`,
    { headers: { Authorization: `Bearer ${apiKey}` }, cache: 'no-store' }
  )
  if (!res.ok) {
    const text = await res.text()
    return { error: text }
  }
  const data = await res.json()
  const records: { id: string; fields: Record<string, unknown> }[] = data.records ?? []
  if (records.length === 0) return { error: 'no records' }

  // Pick record with the most fields
  const best = records.reduce((a, b) =>
    Object.keys(b.fields).length > Object.keys(a.fields).length ? b : a
  )

  return {
    recordId: best.id,
    fieldNames: Object.keys(best.fields).sort(),
    sampleValues: best.fields,
  }
}

export async function GET() {
  const apiKey = process.env.AIRTABLE_API_KEY
  const baseId = process.env.AIRTABLE_BASE_ID

  if (!apiKey || !baseId) {
    return NextResponse.json({ error: 'Missing Airtable credentials' }, { status: 500 })
  }

  const [users, meetings, meetingsLegacy, notes, tasks, relationshipContexts] = await Promise.all([
    fetchTableFields(apiKey, baseId, 'Users'),
    fetchTableFields(apiKey, baseId, 'Meetings'),
    fetchTableFields(apiKey, baseId, 'Portal Calendar Events'),
    fetchTableFields(apiKey, baseId, 'Notes'),
    fetchTableFields(apiKey, baseId, 'Tasks'),
    fetchTableFields(apiKey, baseId, 'Relationship Contexts'),
  ])

  return NextResponse.json({
    users,
    meetings_table_named_Meetings: meetings,
    meetings_table_named_Portal_Calendar_Events: meetingsLegacy,
    notes,
    tasks,
    relationshipContexts,
  })
}
