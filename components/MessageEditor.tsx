'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

interface MessageEditorProps {
  messageId: string
  initialSubject: string
  initialBody: string
  initialStatus: 'Pending' | 'Sent'
  initialSentAt?: string
  updateDraftAction: (messageId: string, subject: string, body: string) => Promise<{ ok: true } | { ok: false; error: string }>
  markSentAction: (messageId: string) => Promise<{ ok: true; sentAt: string } | { ok: false; error: string }>
}

function formatSentAt(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

export default function MessageEditor({
  messageId,
  initialSubject,
  initialBody,
  initialStatus,
  initialSentAt,
  updateDraftAction,
  markSentAction,
}: MessageEditorProps) {
  const [subject, setSubject] = useState(initialSubject)
  const [body, setBody] = useState(initialBody)
  const [status, setStatus] = useState<'Pending' | 'Sent'>(initialStatus)
  const [sentAt, setSentAt] = useState<string | undefined>(initialSentAt)
  const [isSaving, setIsSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState('')

  const isSent = status === 'Sent'

  async function handleSave() {
    setIsSaving(true)
    setError('')
    setSavedAt(null)
    const result = await updateDraftAction(messageId, subject, body)
    setIsSaving(false)
    if (result.ok) {
      setSavedAt(new Date())
    } else {
      setError(result.error)
    }
  }

  async function handleMarkSent() {
    setIsSending(true)
    setError('')
    const result = await markSentAction(messageId)
    setIsSending(false)
    if (result.ok) {
      setStatus('Sent')
      setSentAt(result.sentAt)
      setConfirming(false)
    } else {
      setError(result.error)
      setConfirming(false)
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
            onChange={(e) => { setSubject(e.target.value); setSavedAt(null) }}
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
            onChange={(e) => { setBody(e.target.value); setSavedAt(null) }}
          />
        )}
      </div>

      {/* Sent badge + timestamp */}
      {isSent && (
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
            Sent
          </span>
          {sentAt && (
            <span className="text-xs text-muted-foreground">{formatSentAt(sentAt)}</span>
          )}
        </div>
      )}

      {/* Actions — only when Pending */}
      {!isSent && (
        <div className="space-y-3">
          <div className="flex items-center gap-3 flex-wrap">
            <Button size="sm" onClick={handleSave} disabled={isSaving}>
              {isSaving ? 'Saving…' : 'Save'}
            </Button>

            {!confirming && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => { setConfirming(true); setError('') }}
                disabled={isSaving}
              >
                Mark as Sent
              </Button>
            )}

            {savedAt && !confirming && (
              <span className="text-sm text-green-600">Saved ✓</span>
            )}
          </div>

          {/* Inline confirm */}
          {confirming && (
            <div className="flex items-center gap-3 rounded-md border border-muted bg-muted/30 px-3 py-2 flex-wrap">
              <span className="text-sm">This will mark the message as sent. Continue?</span>
              <Button size="sm" onClick={handleMarkSent} disabled={isSending}>
                {isSending ? 'Marking…' : 'Confirm'}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirming(false)} disabled={isSending}>
                Cancel
              </Button>
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
      )}
    </div>
  )
}
