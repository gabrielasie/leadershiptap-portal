'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import MessageEditor from '@/components/MessageEditor'
import type { Message } from '@/lib/types'

interface FollowUpSectionProps {
  initialMessage: Message | null
  userId: string
  meetingId: string
  eventName: string
  startTime: string
  participantEmails: string[]
  createAction: (
    userId: string,
    meetingId: string,
    eventName: string,
    startTime: string,
    participantEmails: string[]
  ) => Promise<{ ok: true; data: Message } | { ok: false; error: string }>
  updateDraftAction: (
    messageId: string,
    subject: string,
    body: string
  ) => Promise<{ ok: true } | { ok: false; error: string }>
  markSentAction: (
    messageId: string
  ) => Promise<{ ok: true; sentAt: string } | { ok: false; error: string }>
}

export default function FollowUpSection({
  initialMessage,
  userId,
  meetingId,
  eventName,
  startTime,
  participantEmails,
  createAction,
  updateDraftAction,
  markSentAction,
}: FollowUpSectionProps) {
  const [message, setMessage] = useState<Message | null>(initialMessage)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  async function handleCreate() {
    setCreating(true)
    setError('')
    const result = await createAction(userId, meetingId, eventName, startTime, participantEmails)
    if (result.ok) {
      setMessage(result.data)
    } else {
      setError(result.error)
    }
    setCreating(false)
  }

  if (!message) {
    return (
      <div className="space-y-2">
        <Button size="sm" onClick={handleCreate} disabled={creating}>
          {creating ? 'Creating…' : 'Create follow-up draft'}
        </Button>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    )
  }

  return (
    <MessageEditor
      messageId={message.id}
      initialSubject={message.subject ?? ''}
      initialBody={message.body ?? ''}
      initialStatus={message.status}
      initialSentAt={message.sentAt}
      updateDraftAction={updateDraftAction}
      markSentAction={markSentAction}
    />
  )
}
