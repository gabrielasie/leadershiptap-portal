'use server'

import { revalidatePath } from 'next/cache'
import { createNote } from '@/lib/airtable/notes'
import { createTask, updateTaskStatus } from '@/lib/airtable/tasks'
import {
  updateUserProfile,
  type UserProfileFields,
  fetchProfileOptions,
  type ProfileOption,
  searchUsersByName,
  createUserRecord,
  patchTeamMembers,
  getAllUsers,
} from '@/lib/airtable/users'
import { updateMeetingFields } from '@/lib/airtable/meetings'
import { getSessionUser } from '@/lib/auth/getSessionUser'

// ── Edit Profile ──────────────────────────────────────────────────────────────

export async function updateProfileAction(
  userId: string,
  changed: UserProfileFields,
): Promise<{ success: true } | { error: string }> {
  console.log('[updateProfileAction] userId:', userId)
  console.log('[updateProfileAction] fields being sent:', JSON.stringify(changed, null, 2))
  try {
    await updateUserProfile(userId, changed)
    revalidatePath(`/users/${userId}`)
    return { success: true }
  } catch (err) {
    console.error('[updateProfileAction] error:', err)
    const msg = err instanceof Error ? err.message : String(err)
    return { error: msg.includes('Airtable PATCH failed') ? msg : 'Failed to update profile — please try again' }
  }
}

// ── Fetch profile dropdown options (called when Edit Profile modal opens) ──────

export async function fetchProfileOptionsAction(): Promise<{
  companies: ProfileOption[]
  enneagrams: ProfileOption[]
  mbtis: ProfileOption[]
  conflictPostures: ProfileOption[]
  apologyLanguages: ProfileOption[]
  strengths: ProfileOption[]
  coaches: ProfileOption[]
  allUsers: ProfileOption[]
}> {
  const allUsers = await getAllUsers()
  return fetchProfileOptions(allUsers)
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
    const newIds = [...existingMemberIds, newMemberId]
    console.log('[linkExistingTeamMember] PATCH leaderId:', leaderId, '| Team Members:', newIds)
    await patchTeamMembers(leaderId, newIds)
    revalidatePath(`/users/${leaderId}`)
    return { success: true }
  } catch (err) {
    console.error('[linkExistingTeamMember] error:', err)
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
  },
): Promise<{ success: true } | { error: string }> {
  try {
    console.log('[createAndLinkTeamMember] creating user:', memberData)
    const newId = await createUserRecord({
      'First Name': memberData.firstName || undefined,
      'Last Name': memberData.lastName || undefined,
      'Title': memberData.jobTitle || undefined,
    })
    console.log('[createAndLinkTeamMember] created record id:', newId, '| linking to leader:', leaderId)
    await patchTeamMembers(leaderId, [...existingMemberIds, newId])
    revalidatePath(`/users/${leaderId}`)
    return { success: true }
  } catch (err) {
    console.error('[createAndLinkTeamMember] error:', err)
    return { error: String(err instanceof Error ? err.message : err) }
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
  status: 'pending' | 'in progress' | 'completed',
): Promise<{ success: boolean }> {
  const result = await updateTaskStatus(taskId, status)
  if ('error' in result) {
    console.error('[updateTaskStatusAction] error:', result.error)
    return { success: false }
  }
  return { success: true }
}

// ── Session Notes ─────────────────────────────────────────────────────────────

export async function updateSessionNotesAction(
  meetingId: string,
  notes: string,
  userId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    await updateMeetingFields(meetingId, { Notes: notes })
    revalidatePath(`/users/${userId}`)
    return { success: true }
  } catch (err) {
    console.error('[updateSessionNotesAction]', err)
    return { success: false, error: 'Failed to save notes — please try again' }
  }
}

// ── Upload Profile Photo ──────────────────────────────────────────────────────

// ── Add Task ──────────────────────────────────────────────────────────────────

export async function saveTaskAction(
  userId: string,
  taskName: string,
  dueDate: string | null,
  notes: string | null,
): Promise<void> {
  console.log('[saveTaskAction] userId:', userId, '| title:', taskName, '| dueDate:', dueDate)
  await createTask(
    userId,
    taskName,
    dueDate ?? undefined,
    notes ?? undefined,
  )
  revalidatePath(`/users/${userId}`)
}
