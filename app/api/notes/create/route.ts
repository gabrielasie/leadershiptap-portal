import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getCurrentUserRecord } from '@/lib/auth/getCurrentUserRecord'

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { body, visibility, eventId, clientAirtableId } = await req.json() as {
    body: string
    visibility: string
    eventId?: string
    clientAirtableId?: string
  }

  if (!body?.trim()) {
    return NextResponse.json({ error: 'Note body is required' }, { status: 400 })
  }

  const userRecord = await getCurrentUserRecord()
  if (!userRecord.airtableId) {
    return NextResponse.json({ error: 'Coach record not found in Airtable' }, { status: 400 })
  }

  const apiKey = process.env.AIRTABLE_API_KEY
  const baseId = process.env.AIRTABLE_BASE_ID
  if (!apiKey || !baseId) {
    return NextResponse.json({ error: 'Missing Airtable credentials' }, { status: 500 })
  }

  const fields: Record<string, unknown> = {
    Body: body.trim(),
    Visibility: visibility ?? 'private_to_author',
    Coach: [userRecord.airtableId],
    'Created Date': new Date().toISOString().slice(0, 10),
  }
  if (clientAirtableId) fields['Client'] = [clientAirtableId]
  if (eventId) fields['Meeting'] = [eventId]

  const res = await fetch(`https://api.airtable.com/v0/${baseId}/Notes`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fields }),
  })

  if (!res.ok) {
    const detail = await res.json()
    console.error('[notes/create] Airtable error:', detail)
    return NextResponse.json({ error: 'Failed to create note', detail }, { status: 500 })
  }

  const data = await res.json()
  return NextResponse.json({ id: data.id as string }, { status: 201 })
}
