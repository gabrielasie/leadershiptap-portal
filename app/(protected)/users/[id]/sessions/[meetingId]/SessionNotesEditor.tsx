'use client'

import { useState, useRef, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updateSessionNotes } from './actions'

interface Props {
  meetingId: string
  userId: string
  initialNotes: string | undefined
}

export default function SessionNotesEditor({ meetingId, userId, initialNotes }: Props) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(initialNotes ?? '')
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [isPending, startTransition] = useTransition()
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  function handleEdit() {
    setDraft(initialNotes ?? '')
    setStatus('idle')
    setEditing(true)
    // Focus textarea on next tick after render
    setTimeout(() => textareaRef.current?.focus(), 0)
  }

  function handleCancel() {
    setEditing(false)
    setStatus('idle')
  }

  function handleSave() {
    setStatus('saving')
    startTransition(async () => {
      const result = await updateSessionNotes(meetingId, draft, userId)
      if ('error' in result) {
        setStatus('error')
        setErrorMsg(result.error)
        return
      }
      setStatus('saved')
      setEditing(false)
      router.refresh()
      setTimeout(() => setStatus('idle'), 2000)
    })
  }

  // ── Read mode ──────────────────────────────────────────────────────────────

  if (!editing) {
    return (
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
            Session Notes
          </h2>
          <div className="flex items-center gap-2">
            {status === 'saved' && (
              <span className="text-xs font-medium text-emerald-600">Notes saved</span>
            )}
            <button
              onClick={handleEdit}
              className="text-xs font-medium text-[hsl(213,70%,30%)] hover:underline"
            >
              Edit Notes
            </button>
          </div>
        </div>

        {initialNotes ? (
          <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
            {initialNotes}
          </p>
        ) : (
          <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center">
            <p className="text-sm text-slate-400">No notes yet for this session.</p>
            <p className="text-xs text-slate-300 mt-1">Click Edit Notes to add some.</p>
          </div>
        )}
      </div>
    )
  }

  // ── Edit mode ──────────────────────────────────────────────────────────────

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
          Session Notes
        </h2>
        <div className="flex items-center gap-2">
          {status === 'error' && (
            <span className="text-xs font-medium text-rose-600">{errorMsg}</span>
          )}
          <button
            onClick={handleCancel}
            disabled={isPending}
            className="text-xs font-medium text-slate-500 hover:text-slate-800 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isPending}
            className="text-xs font-medium px-2.5 py-1 rounded-md bg-[hsl(213,70%,30%)] text-white hover:bg-[hsl(213,70%,25%)] disabled:opacity-50 transition-colors"
          >
            {isPending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      <textarea
        ref={textareaRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        disabled={isPending}
        rows={12}
        placeholder="Add session notes…"
        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 leading-relaxed placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-[hsl(213,70%,50%)] focus:border-transparent resize-y disabled:opacity-50"
      />
    </div>
  )
}
