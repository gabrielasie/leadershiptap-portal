'use client'

import { useState } from 'react'

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
    <div className="space-y-4">
      {/* Subject */}
      <div>
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
          Subject
        </label>
        {isSent ? (
          <p className="text-sm font-medium text-gray-900">{subject}</p>
        ) : (
          <input
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            value={subject}
            onChange={(e) => { setSubject(e.target.value); setSavedAt(null) }}
          />
        )}
      </div>

      {/* Body */}
      <div>
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
          Message
        </label>
        {isSent ? (
          <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
            {body}
          </div>
        ) : (
          <textarea
            className="w-full rounded-lg border border-gray-200 bg-white p-3 text-sm resize-y min-h-[200px] focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            value={body}
            onChange={(e) => { setBody(e.target.value); setSavedAt(null) }}
          />
        )}
      </div>

      {/* Sent badge + timestamp */}
      {isSent && (
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 border border-emerald-200">
            Sent
          </span>
          {sentAt && (
            <span className="text-xs text-gray-400">{formatSentAt(sentAt)}</span>
          )}
        </div>
      )}

      {/* Actions — only when Pending */}
      {!isSent && (
        <div className="space-y-3">
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="bg-slate-900 text-white hover:bg-slate-800 h-9 px-4 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              {isSaving ? 'Saving…' : 'Save'}
            </button>

            {!confirming && (
              <button
                onClick={() => { setConfirming(true); setError('') }}
                disabled={isSaving}
                className="bg-amber-500 text-white hover:bg-amber-600 h-9 px-4 rounded-lg text-sm font-medium transition-colors border-0 disabled:opacity-50"
              >
                Mark as Sent
              </button>
            )}

            {savedAt && !confirming && (
              <span className="text-sm text-emerald-600 font-medium">Saved ✓</span>
            )}
          </div>

          {/* Inline confirm */}
          {confirming && (
            <div className="flex items-center gap-3 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 flex-wrap">
              <span className="text-sm text-gray-700">This will mark the message as sent. Continue?</span>
              <button
                onClick={handleMarkSent}
                disabled={isSending}
                className="bg-amber-500 text-white hover:bg-amber-600 h-8 px-3 rounded-md text-sm font-medium disabled:opacity-50"
              >
                {isSending ? 'Marking…' : 'Confirm'}
              </button>
              <button
                onClick={() => setConfirming(false)}
                disabled={isSending}
                className="text-gray-500 hover:text-gray-700 h-8 px-3 rounded-md text-sm"
              >
                Cancel
              </button>
            </div>
          )}

          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>
      )}
    </div>
  )
}
