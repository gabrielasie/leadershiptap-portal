// TEMPORARY DEBUG ROUTE — delete after confirming linked field names
import { NextResponse } from 'next/server'

const API_BASE = 'https://api.airtable.com/v0'

async function getFirstNonEmptyRecord(tableName: string, apiKey: string, baseId: string) {
  const encoded = encodeURIComponent(tableName)
  const res = await fetch(`${API_BASE}/${baseId}/${encoded}?maxRecords=5`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  })
  if (!res.ok) return `ERROR: ${await res.text()}`
  const data = await res.json()
  const records: { id: string; fields: Record<string, unknown> }[] = data.records ?? []
  if (records.length === 0) return '(no records found)'
  // Return fields from first record that has more than just the primary field
  const best = records.find((r) => Object.keys(r.fields).length > 1) ?? records[0]
  return { recordId: best.id, fields: Object.keys(best.fields), values: best.fields }
}

export async function GET() {
  const apiKey = process.env.AIRTABLE_API_KEY ?? ''
  const baseId = process.env.AIRTABLE_BASE_ID ?? ''

  const [calendarEvents, messages] = await Promise.all([
    getFirstNonEmptyRecord('Calendar Events', apiKey, baseId),
    getFirstNonEmptyRecord('Messages', apiKey, baseId),
  ])

  return NextResponse.json({ 'Calendar Events': calendarEvents, Messages: messages }, { status: 200 })
}
