'use server'

import { updateMeetingFields } from '@/lib/airtable/meetings'

export async function updateSessionNotes(
  meetingId: string,
  notes: string,
): Promise<{ success: true } | { error: string }> {
  try {
    await updateMeetingFields(meetingId, { Notes: notes })
    return { success: true }
  } catch (err) {
    console.error('[updateSessionNotes]', err)
    return { error: 'Failed to save — please try again' }
  }
}
