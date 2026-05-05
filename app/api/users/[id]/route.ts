import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getCurrentUserRecord } from '@/lib/auth/getCurrentUserRecord'
import { getRelationshipContext } from '@/lib/airtable/relationships'
import { TABLES, FIELDS } from '@/lib/airtable/constants'

const API_BASE = 'https://api.airtable.com/v0'

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const body = await req.json()
  const { internalNotes, title } = body as { internalNotes?: string; title?: string }

  // Nothing to update
  if (internalNotes === undefined && title === undefined) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  // Authorization: logged-in user must have an active RC where Lead = them, Person = id
  const currentUser = await getCurrentUserRecord()
  if (!currentUser.airtableId) {
    return NextResponse.json({ error: 'Could not resolve your user record' }, { status: 403 })
  }

  const rc = await getRelationshipContext(currentUser.airtableId, id)
  if (!rc) {
    return NextResponse.json(
      { error: 'No active relationship context — you are not authorized to edit this profile' },
      { status: 403 },
    )
  }

  // Build Airtable PATCH payload
  const fields: Record<string, unknown> = {}
  if (internalNotes !== undefined) fields[FIELDS.USERS.INTERNAL_NOTES] = internalNotes
  if (title !== undefined) fields[FIELDS.USERS.TITLE] = title

  const apiKey = process.env.AIRTABLE_API_KEY
  const baseId = process.env.AIRTABLE_BASE_ID
  if (!apiKey || !baseId) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
  }

  const res = await fetch(
    `${API_BASE}/${baseId}/${encodeURIComponent(TABLES.PEOPLE)}/${id}`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fields }),
    },
  )

  if (!res.ok) {
    const detail = await res.text()
    console.error(`[PATCH /api/users/${id}] Airtable error:`, res.status, detail)
    return NextResponse.json(
      { error: 'Failed to update profile' },
      { status: res.status >= 400 && res.status < 500 ? res.status : 500 },
    )
  }

  const data = await res.json()
  return NextResponse.json({ success: true, record: data })
}
