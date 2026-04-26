import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getCurrentUserRecord } from '@/lib/auth/getCurrentUserRecord'
import { getSessionNotes, updateSessionNote } from '@/lib/airtable/sessionNotes'

interface Props {
  params: Promise<{ id: string }>
}

export async function PATCH(req: Request, { params }: Props) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userRecord = await getCurrentUserRecord()
  if (!userRecord.airtableId) {
    return NextResponse.json({ error: 'Coach record not found' }, { status: 400 })
  }

  const { id } = await params

  // Verify ownership: only the note's author can update it
  const notes = await getSessionNotes(userRecord.airtableId)
  const existing = notes.find((n) => n.id === id)
  if (!existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const body = (await req.json()) as {
    title?: string
    content?: string
    sessionDate?: string
    visibility?: string
  }

  const updated = await updateSessionNote(id, {
    title: body.title?.trim(),
    content: body.content?.trim(),
    sessionDate: body.sessionDate,
    visibility: body.visibility,
  })
  return NextResponse.json(updated)
}
