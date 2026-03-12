'use server'

import { revalidatePath } from 'next/cache'
import { updateMeetingNotes } from '@/lib/services/meetingsService'
import { createFollowUpDraft, updateDraftContent, markMessageSent } from '@/lib/services/messagesService'
import type { Message } from '@/lib/types'

type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string }

export async function saveNotes(
  userId: string,
  meetingId: string,
  notes: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await updateMeetingNotes(meetingId, notes)
    revalidatePath(`/users/${userId}/meetings/${meetingId}`)
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

export async function createDraft(
  userId: string,
  meetingId: string,
  eventName: string,
  startTime: string,
  participantEmails: string[]
): Promise<ActionResult<Message>> {
  try {
    const message = await createFollowUpDraft(meetingId, eventName, startTime, participantEmails)
    revalidatePath(`/users/${userId}/meetings/${meetingId}`)
    return { ok: true, data: message }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

export async function updateDraft(
  messageId: string,
  subject: string,
  body: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await updateDraftContent(messageId, subject, body)
    revalidatePath('/users', 'layout')
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

export async function markSent(
  messageId: string
): Promise<{ ok: true; sentAt: string } | { ok: false; error: string }> {
  try {
    const message = await markMessageSent(messageId)
    revalidatePath('/users', 'layout')
    return { ok: true, sentAt: message.sentAt ?? new Date().toISOString() }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}
