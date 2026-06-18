import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getCurrentUserRecord } from '@/lib/auth/getCurrentUserRecord'
import { getNotesByClient, createNote } from '@/lib/airtable/notes'
import type { NoteType } from '@/lib/airtable/notes'

export async function GET(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userRecord = await getCurrentUserRecord()
  if (!userRecord.airtableId) {
    return NextResponse.json({ error: 'User record not found' }, { status: 400 })
  }

  const { searchParams } = new URL(req.url)
  const clientId = searchParams.get('clientId')
  if (!clientId) {
    return NextResponse.json({ error: 'clientId is required' }, { status: 400 })
  }

  const notes = await getNotesByClient(clientId)
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
    content: string
    date?: string
    clientId?: string
    subjectPersonId?: string
    meetingId?: string
    noteType?: NoteType
  }

  if (!body.content?.trim()) {
    return NextResponse.json({ error: 'Note content is required' }, { status: 400 })
  }

  const note = await createNote({
    content: body.content.trim(),
    date: body.date,
    authorPersonId: userRecord.airtableId,
    coachName: userRecord.name || undefined,
    clientId: body.clientId,
    subjectPersonId: body.subjectPersonId ?? body.clientId,
    meetingId: body.meetingId,
    noteType: body.noteType,
  })
  return NextResponse.json(note, { status: 201 })
}
