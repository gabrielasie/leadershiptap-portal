'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import type { Message } from '@/lib/types'

interface MessageEditorProps {
  message: Message
  userId: string
  meetingId: string
  updateAction: (
    userId: string,
    meetingId: string,
    messageId: string,
    subject: string,
    body: string
  ) => Promise<{ ok: true; data: Message } | { ok: false; error: string }>
  markSentAction: (
    userId: string,
    meetingId: string,
    messageId: string
  ) => Promise<{ ok: true; data: Message } | { ok: false; error: string }>
}

export default function MessageEditor({
  message,
  userId,
  meetingId,
  updateAction,
  markSentAction,
}: MessageEditorProps) {
  const [subject, setSubject] = useState(message.subject ?? '')
  const [body, setBody] = useState(message.body ?? '')
  const [status, setStatus] = useState<Message['status']>(message.status)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [sendStatus, setSendStatus] = useState<'idle' | 'confirming' | 'sending' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  const isSent = status === 'Sent'

  async function handleSave() {
    setSaveStatus('saving')
    const result = await updateAction(userId, meetingId, message.id, subject, body)
    if (result.ok) {
      setSaveStatus('saved')
    } else {
      setSaveStatus('error')
      setErrorMsg(result.error)
    }
  }

  async function handleMarkSent() {
    setSendStatus('sending')
    const result = await markSentAction(userId, meetingId, message.id)
    if (result.ok) {
      setStatus('Sent')
      setSendStatus('idle')
    } else {
      setSendStatus('error')
      setErrorMsg(result.error)
    }
  }

  return (
    <div className="space-y-4 rounded-md border p-4">
      {/* Subject */}
      <div className="space-y-1">
        <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Subject
        </label>
        {isSent ? (
          <p className="text-sm font-medium">{subject}</p>
        ) : (
          <input
            className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            value={subject}
            onChange={(e) => { setSubject(e.target.value); setSaveStatus('idle') }}
          />
        )}
      </div>

      {/* Body */}
      <div className="space-y-1">
        <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Message
        </label>
        {isSent ? (
          <div className="rounded-md bg-muted/40 p-3 text-sm whitespace-pre-wrap">{body}</div>
        ) : (
          <textarea
            className="w-full rounded-md border bg-background p-3 text-sm resize-y min-h-[200px] focus:outline-none focus:ring-2 focus:ring-ring"
            value={body}
            onChange={(e) => { setBody(e.target.value); setSaveStatus('idle') }}
          />
        )}
      </div>

      {/* Status indicator */}
      {isSent && (
        <p className="text-xs font-medium text-green-600">Sent ✓</p>
      )}

      {/* Actions */}
      {!isSent && (
        <div className="flex items-center gap-3 flex-wrap">
          <Button size="sm" onClick={handleSave} disabled={saveStatus === 'saving'}>
            {saveStatus === 'saving' ? 'Saving…' : 'Save'}
          </Button>

          {sendStatus === 'confirming' ? (
            <>
              <span className="text-sm">Mark this message as sent?</span>
              <Button size="sm" variant="default" onClick={handleMarkSent}>
                Yes, mark sent
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSendStatus('idle')}>
                Cancel
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setSendStatus('confirming')}
              disabled={sendStatus === 'sending'}
            >
              {sendStatus === 'sending' ? 'Marking…' : 'Mark as Sent'}
            </Button>
          )}

          {saveStatus === 'saved' && <span className="text-sm text-green-600">Saved ✓</span>}
          {(saveStatus === 'error' || sendStatus === 'error') && (
            <span className="text-sm text-destructive">{errorMsg}</span>
          )}
        </div>
      )}
    </div>
  )
}
