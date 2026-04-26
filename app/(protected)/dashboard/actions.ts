'use server'

import { revalidatePath } from 'next/cache'
import { createTask, updateTask, updateTaskStatus, deleteTask } from '@/lib/airtable/tasks'
import { createNote, updateNote, deleteNote } from '@/lib/airtable/notes'
import { getMeetingsByUserEmail, updatePortalEventNotes } from '@/lib/airtable/meetings'
import { upsertCoachSession } from '@/lib/airtable/coachSessions'
import { getUserById } from '@/lib/services/usersService'
import { getSessionUser } from '@/lib/auth/getSessionUser'
import { getCurrentUserRecord } from '@/lib/auth/getCurrentUserRecord'

type TaskStatus = 'pending' | 'in progress' | 'completed'

export async function dashboardUpdateTaskStatusAction(
  taskId: string,
  status: TaskStatus,
): Promise<{ success: boolean }> {
  const result = await updateTaskStatus(taskId, status)
  if ('error' in result) {
    console.error('[dashboardUpdateTaskStatusAction]', result.error)
    return { success: false }
  }
  revalidatePath('/dashboard')
  return { success: true }
}

export async function dashboardUpdateTaskAction(
  taskId: string,
  fields: {
    Title?: string
    Status?: TaskStatus
    'Due Date'?: string | null
    Notes?: string
  },
): Promise<{ success: boolean; error?: string }> {
  const result = await updateTask(taskId, fields)
  if ('error' in result) {
    console.error('[dashboardUpdateTaskAction]', result.error)
    return { success: false, error: result.error }
  }
  revalidatePath('/dashboard')
  return { success: true }
}

export async function dashboardDeleteTaskAction(
  taskId: string,
): Promise<{ success: boolean; error?: string }> {
  const result = await deleteTask(taskId)
  if ('error' in result) {
    console.error('[dashboardDeleteTaskAction]', result.error)
    return { success: false, error: result.error }
  }
  revalidatePath('/dashboard')
  return { success: true }
}

export async function dashboardCreateTaskAction(
  userId: string,
  title: string,
  dueDate: string | null,
  notes: string | null,
): Promise<{ success: boolean; error?: string }> {
  try {
    await createTask(userId, title, dueDate ?? undefined, notes ?? undefined)
    revalidatePath('/dashboard')
    return { success: true }
  } catch (err) {
    console.error('[dashboardCreateTaskAction]', err)
    return { success: false, error: String(err) }
  }
}

// ── Notes ──────────────────────────────────────────────────────────────────────

// Fetch a client's 10 most recent past sessions for the session-link dropdown
export async function fetchClientSessionsAction(
  clientId: string,
): Promise<Array<{ id: string; label: string }>> {
  try {
    const user = await getUserById(clientId)
    if (!user) return []
    const email = user.workEmail ?? user.email
    if (!email) return []
    const meetings = await getMeetingsByUserEmail(email)
    const now = new Date()
    return meetings
      .filter((m) => m.startTime && new Date(m.startTime) < now)
      .slice(0, 10)
      .map((m) => {
        const d = new Date(m.startTime)
        const dateLabel = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        return { id: m.id, label: `${dateLabel} · ${m.title || 'Untitled Meeting'}` }
      })
  } catch (err) {
    console.error('[fetchClientSessionsAction]', err)
    return []
  }
}

// Save a note — either as a Coach Session record or a general note
export async function dashboardLogNoteAction(params: {
  clientId: string
  content: string
  meetingId?: string
}): Promise<{ success: boolean; error?: string }> {
  const today = new Date().toISOString().slice(0, 10)
  try {
    if (params.meetingId) {
      const userRecord = await getCurrentUserRecord()
      if (!userRecord.airtableId) {
        return { success: false, error: 'Could not resolve your coach record.' }
      }
      await upsertCoachSession(
        userRecord.airtableId,
        params.meetingId,
        params.clientId,
        { sessionNotes: params.content },
      )
      revalidatePath(`/users/${params.clientId}`)
    } else {
      const sessionUser = await getSessionUser()
      await createNote(params.clientId, params.content, today, sessionUser)
    }
    revalidatePath('/dashboard')
    return { success: true }
  } catch (err) {
    console.error('[dashboardLogNoteAction]', err)
    return { success: false, error: String(err) }
  }
}

export async function dashboardSaveNoteAction(
  clientId: string,
  content: string,
  date: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const sessionUser = await getSessionUser()
    await createNote(clientId, content, date, sessionUser)
    revalidatePath('/dashboard')
    return { success: true }
  } catch (err) {
    console.error('[dashboardSaveNoteAction]', err)
    return { success: false, error: String(err) }
  }
}

export async function dashboardUpdateNoteAction(
  noteId: string,
  content: string,
  date: string,
): Promise<{ success: boolean }> {
  const result = await updateNote(noteId, content, date)
  if ('error' in result) {
    console.error('[dashboardUpdateNoteAction]', result.error)
    return { success: false }
  }
  revalidatePath('/dashboard')
  return { success: true }
}

export async function dashboardDeleteNoteAction(
  noteId: string,
): Promise<{ success: boolean }> {
  const result = await deleteNote(noteId)
  if ('error' in result) {
    console.error('[dashboardDeleteNoteAction]', result.error)
    return { success: false }
  }
  revalidatePath('/dashboard')
  return { success: true }
}

export async function savePortalEventNotesAction(
  recordId: string,
  notes: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    await updatePortalEventNotes(recordId, notes)
    revalidatePath('/dashboard')
    return { success: true }
  } catch (err) {
    console.error('[savePortalEventNotesAction]', err)
    return { success: false, error: String(err) }
  }
}
