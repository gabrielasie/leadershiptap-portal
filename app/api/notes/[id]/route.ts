import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getCurrentUserRecord } from '@/lib/auth/getCurrentUserRecord'
import { getNotesByAuthor, updateNote } from '@/lib/airtable/notes'

interface Props {
  params: Promise<{ id: string }>
}

export async function PATCH(req: Request, { params }: Props) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userRecord = await getCurrentUserRecord()
  if (!userRecord.airtableId) {
    return NextResponse.json({ error: 'User record not found' }, { status: 400 })
  }

  const { id } = await params

  // Verify ownership: only the note's author can update it
  const authorNotes = await getNotesByAuthor(userRecord.airtableId)
  const existing = authorNotes.find((n) => n.id === id)
  if (!existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const body = (await req.json()) as { content?: string }
  if (!body.content?.trim()) {
    return NextResponse.json({ error: 'Note content is required' }, { status: 400 })
  }

  const result = await updateNote(id, body.content.trim())
  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}
