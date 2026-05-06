'use server'

import { revalidatePath } from 'next/cache'
import { createTask, updateTask, updateTaskStatus, deleteTask, type UpdateTaskData } from '@/lib/airtable/tasks'
import type { TaskStatus } from '@/lib/types'
import { createNote, updateNote, deleteNote } from '@/lib/airtable/notes'
import { getMeetingsByUserEmail } from '@/lib/airtable/meetings'
import { getUserById } from '@/lib/services/usersService'
import { getCurrentUserRecord } from '@/lib/auth/getCurrentUserRecord'
import { resolveContextForSubject } from '@/lib/airtable/relationships'

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
  data: UpdateTaskData,
): Promise<{ success: boolean; error?: string }> {
  const result = await updateTask(taskId, data)
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

export async function dashboardCreateTaskAction(data: {
  title: string
  notes?: string
  dueDate?: string
  assignedToPersonId?: string   // undefined → self-assign (personal_reminder)
  clientId?: string
}): Promise<{ success: boolean; error?: string }> {
  try {
    const userRecord = await getCurrentUserRecord()
    if (!userRecord.airtableId) {
      return { success: false, error: 'Could not resolve your coach record.' }
    }
    await createTask({
      title: data.title,
      notes: data.notes,
      dueDate: data.dueDate,
      clientId: data.clientId ?? data.assignedToPersonId,
      createdByPersonId: userRecord.airtableId,
      assignedToPersonId: data.assignedToPersonId ?? userRecord.airtableId,
    })
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
  try {
    const userRecord = await getCurrentUserRecord()
    if (!userRecord.airtableId) {
      return { success: false, error: 'Could not resolve your coach record.' }
    }

    const rc = await resolveContextForSubject(userRecord.airtableId, params.clientId)
    if (!rc) {
      return { success: false, error: 'No active coaching or reporting relationship reaches this person.' }
    }

    await createNote({
      content: params.content,
      authorPersonId: userRecord.airtableId,
      coachName: userRecord.name || undefined,
      subjectPersonId: params.clientId,
      clientId: params.clientId,
      relationshipContextId: rc.id,
      meetingId: params.meetingId,
      noteType: params.meetingId ? 'meeting_note' : 'general_context',
    })
    revalidatePath('/dashboard')
    if (params.meetingId) revalidatePath(`/users/${params.clientId}`)
    return { success: true }
  } catch (err) {
    console.error('[dashboardLogNoteAction]', err)
    return { success: false, error: String(err) }
  }
}

export async function dashboardSaveNoteAction(
  clientId: string,
  content: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const userRecord = await getCurrentUserRecord()
    if (!userRecord.airtableId) {
      return { success: false, error: 'Could not resolve your coach record.' }
    }

    const rc = await resolveContextForSubject(userRecord.airtableId, clientId)
    if (!rc) {
      return { success: false, error: 'No active coaching or reporting relationship reaches this person.' }
    }

    await createNote({
      content,
      authorPersonId: userRecord.airtableId,
      coachName: userRecord.name || undefined,
      subjectPersonId: clientId,
      clientId,
      relationshipContextId: rc.id,
    })
    revalidatePath('/dashboard')
    return { success: true }
  } catch (err) {
    console.error('[dashboardSaveNoteAction]', err)
    return { success: false, error: String(err) }
  }
}

export async function dashboardUpdateNoteAction(
  noteId: string,
  body: string,
): Promise<{ success: boolean }> {
  const result = await updateNote(noteId, body)
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
  meetingId: string,
  notes: string,
  clientId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const userRecord = await getCurrentUserRecord()
    if (!userRecord.airtableId) {
      return { success: false, error: 'Could not resolve your coach record.' }
    }

    const rc = await resolveContextForSubject(userRecord.airtableId, clientId)
    if (!rc) {
      return { success: false, error: 'No active coaching or reporting relationship reaches this person.' }
    }

    await createNote({
      content: notes,
      authorPersonId: userRecord.airtableId,
      coachName: userRecord.name || undefined,
      subjectPersonId: clientId,
      clientId,
      relationshipContextId: rc.id,
      meetingId,
      noteType: 'meeting_note',
    })
    revalidatePath('/dashboard')
    revalidatePath(`/users/${clientId}`)
    return { success: true }
  } catch (err) {
    console.error('[savePortalEventNotesAction]', err)
    return { success: false, error: String(err) }
  }
}
