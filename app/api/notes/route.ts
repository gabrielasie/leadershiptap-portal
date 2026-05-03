import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getCurrentUserRecord } from '@/lib/auth/getCurrentUserRecord'
import { getNotes, createNote } from '@/lib/airtable/notes'

export async function GET(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userRecord = await getCurrentUserRecord()
  if (!userRecord.airtableId) {
    return NextResponse.json({ error: 'User record not found' }, { status: 400 })
  }

  const { searchParams } = new URL(req.url)
  const relationshipContextId = searchParams.get('relationshipContextId')
  if (!relationshipContextId) {
    return NextResponse.json({ error: 'relationshipContextId is required' }, { status: 400 })
  }

  const notes = await getNotes(userRecord.airtableId, relationshipContextId)
  return NextResponse.json(notes)
}

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userRecord = await getCurrentUserRecord()
  if (!userRecord.airtableId) {
    return NextResponse.json({ error: 'User record not found' }, { status: 400 })
  }

  const body = (await req.json()) as {
    body: string
    subjectPersonId?: string
    relationshipContextId?: string
    meetingId?: string
    noteType?: string
  }

  if (!body.body?.trim()) {
    return NextResponse.json({ error: 'Note body is required' }, { status: 400 })
  }

  const note = await createNote({
    body: body.body.trim(),
    authorPersonId: userRecord.airtableId,
    subjectPersonId: body.subjectPersonId,
    relationshipContextId: body.relationshipContextId,
    meetingId: body.meetingId,
    noteType: body.noteType,
  })
  return NextResponse.json(note, { status: 201 })
}
