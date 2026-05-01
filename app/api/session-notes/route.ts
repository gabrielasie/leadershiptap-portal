import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getCurrentUserRecord } from '@/lib/auth/getCurrentUserRecord'
import { createSessionNote, getSessionNotes, logSessionNoteFields } from '@/lib/airtable/sessionNotes'

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userRecord = await getCurrentUserRecord()
  if (!userRecord.airtableId) {
    return NextResponse.json({ error: 'Coach record not found' }, { status: 400 })
  }

  // DEV DIAGNOSTIC: log actual field names once — remove after confirming field names
  await logSessionNoteFields()

  const notes = await getSessionNotes(userRecord.airtableId)
  return NextResponse.json(notes)
}

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userRecord = await getCurrentUserRecord()
  if (!userRecord.airtableId) {
    return NextResponse.json({ error: 'Coach record not found' }, { status: 400 })
  }

  const body = (await req.json()) as {
    title: string
    content: string
    clientAirtableId?: string
    eventProviderId?: string
    sessionDate: string
  }

  if (!body.title?.trim()) {
    return NextResponse.json({ error: 'Title is required' }, { status: 400 })
  }
  if (!body.content?.trim()) {
    return NextResponse.json({ error: 'Content is required' }, { status: 400 })
  }

  const note = await createSessionNote({
    title: body.title.trim(),
    content: body.content.trim(),
    coachAirtableId: userRecord.airtableId,
    clientAirtableId: body.clientAirtableId,
    eventProviderId: body.eventProviderId,
    sessionDate: body.sessionDate,
  })
  return NextResponse.json(note, { status: 201 })
}
