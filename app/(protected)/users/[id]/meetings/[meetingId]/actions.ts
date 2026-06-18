'use server'

import { revalidatePath } from 'next/cache'
import { upsertCoachSession } from '@/lib/airtable/coachSessions'
import { getCurrentUserRecord } from '@/lib/auth/getCurrentUserRecord'
import { createFollowUpDraft, updateDraftContent, markMessageSent } from '@/lib/services/messagesService'
import type { Message } from '@/lib/types'

type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string }

export async function saveNotes(
  userId: string,
  meetingId: string,
  notes: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const userRecord = await getCurrentUserRecord()
    if (!userRecord.airtableId) {
      return { ok: false, error: 'Could not resolve your coach record.' }
    }
    await upsertCoachSession(userRecord.airtableId, meetingId, userId, {
      sessionNotes: notes,
    })
    revalidatePath(`/users/${userId}/meetings/${meetingId}`)
    revalidatePath(`/users/${userId}`)
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
