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
import { upsertCoachPersonContext } from '@/lib/airtable/coachPersonContext'
import { getCurrentUserRecord } from '@/lib/auth/getCurrentUserRecord'
import { resolveContextForSubject } from '@/lib/airtable/relationships'

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
export async function saveNoteAction(
  subjectPersonId: string,
  content: string,
): Promise<void> {
  const userRecord = await getCurrentUserRecord()
  if (!userRecord.airtableId) throw new Error('SAVE_FAILED')

  const rc = await resolveContextForSubject(userRecord.airtableId, subjectPersonId)
  if (!rc) throw new Error('NO_RELATIONSHIP')

  try {
    await createNote({
      content: content.trim(),
      authorPersonId: userRecord.airtableId,
      coachName: userRecord.name || undefined,
      subjectPersonId,
      clientId: subjectPersonId,
      relationshipContextId: rc.id,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('TABLE_NOT_FOUND') || msg.includes('Could not find table')) {
      throw new Error('NOTES_TABLE_MISSING')
    }
    console.error('[saveNoteAction] Airtable error:', msg)
    throw new Error('SAVE_FAILED')
  }
  revalidatePath(`/users/${subjectPersonId}`)
}

// ── Edit / Delete Note ────────────────────────────────────────────────────────

export async function updateNoteAction(
  noteId: string,
  body: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const { updateNote } = await import('@/lib/airtable/notes')
    const result = await updateNote(noteId, body)
    if ('error' in result) {
      console.error('[updateNoteAction] Airtable error:', result.error)
      return { success: false, error: result.error }
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
    const { deleteNote } = await import('@/lib/airtable/notes')
    const result = await deleteNote(noteId)
    if ('error' in result) {
      console.error('[deleteNoteAction] Airtable error:', result.error)
      return { success: false, error: result.error }
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
  status: import('@/lib/types').TaskStatus,
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
    const userRecord = await getCurrentUserRecord()
    if (!userRecord.airtableId) {
      return { success: false, error: 'Could not resolve your coach record.' }
    }

    const rc = await resolveContextForSubject(userRecord.airtableId, userId)
    if (!rc) {
      return { success: false, error: 'No active coaching or reporting relationship reaches this person.' }
    }

    await createNote({
      content: notes,
      authorPersonId: userRecord.airtableId,
      coachName: userRecord.name || undefined,
      subjectPersonId: userId,
      clientId: userId,
      relationshipContextId: rc.id,
      meetingId,
      noteType: 'meeting_note',
    })
    revalidatePath(`/users/${userId}`)
    return { success: true }
  } catch (err) {
    console.error('[updateSessionNotesAction]', err)
    return { success: false, error: 'Failed to save notes — please try again' }
  }
}

// ── Coach-Person Context ──────────────────────────────────────────────────────

export async function upsertCoachContextAction(
  personId: string,
  fields: { quickNotes?: string; familyDetails?: string; flags?: string[] },
): Promise<{ success: true } | { error: string }> {
  try {
    const userRecord = await getCurrentUserRecord()
    if (!userRecord.airtableId) {
      return { error: 'Could not resolve your coach record — please try again.' }
    }
    await upsertCoachPersonContext(userRecord.airtableId, personId, fields)
    revalidatePath(`/users/${personId}`)
    return { success: true }
  } catch (err) {
    console.error('[upsertCoachContextAction] error:', err)
    return { error: 'Failed to save coaching context — please try again.' }
  }
}

// ── Upload Profile Photo ──────────────────────────────────────────────────────

// ── Add Task ──────────────────────────────────────────────────────────────────

export async function saveTaskAction(
  subjectPersonId: string,
  taskName: string,
  dueDate: string | null,
  notes: string | null,
): Promise<void> {
  const userRecord = await getCurrentUserRecord()
  if (!userRecord.airtableId) throw new Error('Could not resolve your user record.')
  await createTask({
    title: taskName,
    notes: notes ?? undefined,
    dueDate: dueDate ?? undefined,
    clientId: subjectPersonId,
    createdByPersonId: userRecord.airtableId,
    assignedToPersonId: subjectPersonId,
  })
  revalidatePath(`/users/${subjectPersonId}`)
}

// ── Log Manual Session ────────────────────────────────────────────────────────

export async function logManualSessionAction(params: {
  subjectPersonId: string
  startIso: string
  durationMinutes: number
  notes?: string
}): Promise<void> {
  const userRecord = await getCurrentUserRecord()
  if (!userRecord.airtableId) throw new Error('SAVE_FAILED')

  const rc = await resolveContextForSubject(userRecord.airtableId, params.subjectPersonId)
  if (!rc) throw new Error('NO_RELATIONSHIP')

  const { getUserById } = await import('@/lib/services/usersService')
  const subject = await getUserById(params.subjectPersonId)
  const subjectName = subject
    ? subject.fullName || [subject.firstName, subject.lastName].filter(Boolean).join(' ')
    : 'Unknown'

  const coachFirst = userRecord.name.split(' ')[0] || 'Coach'

  const start = new Date(params.startIso)
  const end = new Date(start.getTime() + params.durationMinutes * 60_000)

  // Populate Attendees so the profile-page email-match query picks this
  // session up. Without it, manual sessions don't appear under the client.
  const subjectEmail = subject?.workEmail ?? subject?.email ?? ''

  const { createManualMeeting } = await import('@/lib/airtable/meetings')
  const meetingId = await createManualMeeting({
    title: `${coachFirst} / ${subjectName} — Manual Session`,
    startIso: start.toISOString(),
    endIso: end.toISOString(),
    timezone: 'America/New_York',
    calendarOwnerEmail: userRecord.email,
    relationshipContextId: rc.id,
    clientName: subjectName,
    attendeeEmails: subjectEmail || undefined,
  })

  if (params.notes && params.notes.trim().length > 0) {
    await createNote({
      content: params.notes.trim(),
      authorPersonId: userRecord.airtableId,
      coachName: userRecord.name || undefined,
      subjectPersonId: params.subjectPersonId,
      clientId: params.subjectPersonId,
      relationshipContextId: rc.id,
      meetingId,
      noteType: 'meeting_note',
    })
  }

  revalidatePath(`/users/${params.subjectPersonId}`)
}
