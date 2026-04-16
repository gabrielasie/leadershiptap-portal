'use server'

import { revalidatePath } from 'next/cache'
import { createNote } from '@/lib/airtable/notes'
import { createTask } from '@/lib/airtable/tasks'
import {
  updateUserProfile,
  type UserProfileFields,
  searchUsersByName,
  createUserRecord,
  patchTeamMembers,
} from '@/lib/airtable/users'
import { getSessionUser } from '@/lib/auth/getSessionUser'

// ── Edit Profile ──────────────────────────────────────────────────────────────

export async function updateProfileAction(
  userId: string,
  changed: UserProfileFields,
): Promise<{ success: true } | { error: string }> {
  try {
    await updateUserProfile(userId, changed)
    revalidatePath(`/users/${userId}`)
    return { success: true }
  } catch (err) {
    console.error('[updateProfileAction]', err)
    return { error: 'Failed to update profile — please try again' }
  }
}

// ── Team Members ──────────────────────────────────────────────────────────────

export async function searchUsersAction(
  query: string,
): Promise<Array<{ id: string; name: string; jobTitle?: string }>> {
  if (!query.trim()) return []
  return searchUsersByName(query.trim())
}

export async function linkExistingTeamMember(
  leaderId: string,
  existingMemberIds: string[],
  newMemberId: string,
): Promise<{ success: true } | { error: string }> {
  if (existingMemberIds.includes(newMemberId)) return { success: true }
  try {
    await patchTeamMembers(leaderId, [...existingMemberIds, newMemberId])
    revalidatePath(`/users/${leaderId}`)
    return { success: true }
  } catch (err) {
    console.error('[linkExistingTeamMember]', err)
    return { error: 'Failed to link team member — please try again' }
  }
}

export async function createAndLinkTeamMember(
  leaderId: string,
  existingMemberIds: string[],
  memberData: {
    firstName: string
    lastName?: string
    jobTitle?: string
    companyName?: string
  },
): Promise<{ success: true } | { error: string }> {
  try {
    const newId = await createUserRecord({
      'First Name': memberData.firstName || undefined,
      'Last Name': memberData.lastName || undefined,
      'Job Title': memberData.jobTitle || undefined,
      'Company Name': memberData.companyName || undefined,
    })
    await patchTeamMembers(leaderId, [...existingMemberIds, newId])
    revalidatePath(`/users/${leaderId}`)
    return { success: true }
  } catch (err) {
    console.error('[createAndLinkTeamMember]', err)
    return { error: 'Failed to create team member — please try again' }
  }
}

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
    console.error('[saveNoteAction] Airtable error:', msg)
    throw new Error('SAVE_FAILED')
  }
  revalidatePath(`/users/${userId}`)
}

// ── Edit / Delete Note ────────────────────────────────────────────────────────

export async function updateNoteAction(
  noteId: string,
  content: string,
  date: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const baseId = process.env.AIRTABLE_BASE_ID!
    const token = process.env.AIRTABLE_API_KEY!
    const res = await fetch(`https://api.airtable.com/v0/${baseId}/Notes/${noteId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: { Content: content, Date: date } }),
    })
    if (!res.ok) {
      const data = await res.json()
      console.error('[updateNoteAction] Airtable error:', data)
      return { success: false, error: JSON.stringify(data) }
    }
    return { success: true }
  } catch (err) {
    console.error('[updateNoteAction] error:', err)
    return { success: false, error: String(err) }
  }
}

export async function deleteNoteAction(
  noteId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const baseId = process.env.AIRTABLE_BASE_ID!
    const token = process.env.AIRTABLE_API_KEY!
    const res = await fetch(`https://api.airtable.com/v0/${baseId}/Notes/${noteId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) {
      const data = await res.json()
      console.error('[deleteNoteAction] Airtable error:', data)
      return { success: false, error: JSON.stringify(data) }
    }
    return { success: true }
  } catch (err) {
    console.error('[deleteNoteAction] error:', err)
    return { success: false, error: String(err) }
  }
}

// ── Update Task Status ────────────────────────────────────────────────────────

export async function updateTaskStatusAction(
  taskId: string,
  status: string,
): Promise<{ success: boolean }> {
  try {
    const baseId = process.env.AIRTABLE_BASE_ID!
    const token = process.env.AIRTABLE_API_KEY!

    // Sample one record so we can see the real Status option values in the logs
    const sampleRes = await fetch(
      `https://api.airtable.com/v0/${baseId}/Linked%20Todoist%20Tasks?maxRecords=3`,
      { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' },
    )
    const sampleData = await sampleRes.json()
    console.log('[updateTaskStatus] sample Status values:',
      sampleData.records?.map((r: { fields: Record<string, unknown> }) => r.fields['Status']))

    console.log('[updateTaskStatus] sending status:', status, 'for task:', taskId)
    const res = await fetch(
      `https://api.airtable.com/v0/${baseId}/Linked%20Todoist%20Tasks/${taskId}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ fields: { Status: status } }),
      },
    )
    const data = await res.json()
    console.log('[updateTaskStatus] response:', JSON.stringify(data))
    if (!res.ok) return { success: false }
    return { success: true }
  } catch (err) {
    console.error('[updateTaskStatusAction] error:', err)
    return { success: false }
  }
}

// ── Add Task ──────────────────────────────────────────────────────────────────

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
