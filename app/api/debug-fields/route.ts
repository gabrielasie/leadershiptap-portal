// TEMPORARY DEBUG ROUTE — delete after confirming field names
import { NextResponse } from 'next/server'

export async function GET() {
  const apiKey = process.env.AIRTABLE_API_KEY
  const baseId = process.env.AIRTABLE_BASE_ID

  if (!apiKey || !baseId) {
    return NextResponse.json({ error: 'Missing Airtable credentials' }, { status: 500 })
  }

  // Fetch up to 5 records and return fields from the one with the most keys
  const res = await fetch(
    `https://api.airtable.com/v0/${baseId}/Calendar%20Events?maxRecords=5`,
    { headers: { Authorization: `Bearer ${apiKey}` } }
  )

  if (!res.ok) {
    const text = await res.text()
    return NextResponse.json({ error: text }, { status: res.status })
  }

  const data = await res.json()
  const records: { id: string; fields: Record<string, unknown> }[] = data.records ?? []

  if (records.length === 0) {
    return NextResponse.json({ error: 'No records found in Calendar Events' })
  }

  // Pick the record with the most fields to maximise visible field names
  const best = records.reduce((a, b) =>
    Object.keys(b.fields).length > Object.keys(a.fields).length ? b : a
  )

  return NextResponse.json({
    recordId: best.id,
    fieldNames: Object.keys(best.fields).sort(),
    sampleValues: best.fields,
  })
}
