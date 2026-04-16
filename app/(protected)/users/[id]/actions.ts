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
  console.log('[saveNoteAction] called — userId:', userId, '| date:', date, '| contentLen:', content.length)
  const sessionUser = await getSessionUser()
  console.log('[saveNoteAction] sessionUser:', sessionUser?.email, '| role:', sessionUser?.role)
  try {
    await createNote(userId, content.trim(), date, sessionUser)
    console.log('[saveNoteAction] createNote succeeded')
  } catch (err) {
    console.error('[saveNoteAction] createNote threw:', err)
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
