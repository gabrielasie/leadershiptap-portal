'use server'

import { revalidatePath } from 'next/cache'
import { createNote } from '@/lib/airtable/notes'
import { createTask } from '@/lib/airtable/tasks'
import { getSessionUser } from '@/lib/auth/getSessionUser'

// ── Log a Note ────────────────────────────────────────────────────────────────
// Resolves the Clerk session server-side and passes it to createNote so the
// write is authorisation-checked before it reaches Airtable.

export async function saveNoteAction(
  userId: string,
  content: string,
  date: string,         // YYYY-MM-DD from the date input
): Promise<void> {
  const sessionUser = await getSessionUser()
  try {
    await createNote(userId, content.trim(), date, sessionUser)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg === 'NOT_AUTHORIZED') throw new Error('NOT_AUTHORIZED')
    if (msg.includes('TABLE_NOT_FOUND') || msg.includes('Could not find table')) {
      throw new Error('NOTES_TABLE_MISSING')
    }
    throw new Error('SAVE_FAILED')
  }
  revalidatePath(`/users/${userId}`)
}

// ── Add Task ──────────────────────────────────────────────────────────────────
// Writes to the Tasks table. See AIRTABLE SETUP section in the response for
// the required table schema — this will throw if the table doesn't exist yet.

export async function saveTaskAction(
  userId: string,
  taskName: string,
  dueDate: string | null,   // YYYY-MM-DD or null
  priority: 'Low' | 'Medium' | 'High',
): Promise<void> {
  await createTask({
    Title: taskName,
    ...(dueDate ? { 'Due Date': dueDate } : {}),
    Priority: priority,
    Client: [userId],
  })
  revalidatePath(`/users/${userId}`)
}
