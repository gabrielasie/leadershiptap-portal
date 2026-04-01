'use server'

import { revalidatePath } from 'next/cache'
import { getUserById } from '@/lib/services/usersService'
import { updateUserCoachNotes } from '@/lib/airtable/users'
import { createTask } from '@/lib/airtable/tasks'

// ── Log a Note ────────────────────────────────────────────────────────────────
// Prepends a dated entry to the user's Coach Notes field in Airtable.
// A dedicated Notes table is not yet provisioned; this keeps history intact
// by prepending rather than overwriting.

export async function saveNoteAction(
  userId: string,
  content: string,
  date: string,         // YYYY-MM-DD from the date input
  coachName: string,
): Promise<void> {
  const user = await getUserById(userId)
  if (!user) throw new Error('User not found')

  const dateLabel = new Date(date + 'T12:00:00').toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })

  const header = coachName
    ? `[${dateLabel} — ${coachName}]`
    : `[${dateLabel}]`

  const newEntry = `${header}\n${content.trim()}`
  const existing = user.coachNotes?.trim()
  const combined = existing ? `${newEntry}\n\n---\n\n${existing}` : newEntry

  await updateUserCoachNotes(userId, combined)
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
    Name: taskName,
    ...(dueDate ? { 'Due Date': dueDate } : {}),
    Priority: priority,
    Client: [userId],
  })
  revalidatePath(`/users/${userId}`)
}
