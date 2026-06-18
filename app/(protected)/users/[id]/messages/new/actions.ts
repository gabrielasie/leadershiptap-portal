'use server'

import { redirect } from 'next/navigation'
import { createUserFollowUpDraft } from '@/lib/services/messagesService'

export async function saveDraftAction(userId: string, formData: FormData) {
  const subject = (formData.get('subject') as string | null)?.trim() ?? 'Follow-up'
  const body = (formData.get('body') as string | null) ?? ''

  await createUserFollowUpDraft(userId, subject, body)

  redirect(`/users/${userId}`)
}
