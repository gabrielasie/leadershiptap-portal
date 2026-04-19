'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { NotebookPen } from 'lucide-react'
import { updateSessionNotesAction } from './actions'
import type { Meeting } from '@/lib/types'

function formatMeetingDate(iso: string): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

interface Props {
  meeting: Meeting
  userId: string
}

export default function MostRecentSessionNotes({ meeting, userId }: Props) {
  const router = useRouter()
  const [mode, setMode] = useState<'view' | 'edit'>('view')
  const [notes, setNotes] = useState(meeting.notes ?? '')
  const [isPending, startTransition] = useTransition()
  const [errorMsg, setErrorMsg] = useState('')

  function handleEdit() {
    setNotes(meeting.notes ?? '')
    setErrorMsg('')
    setMode('edit')
  }

  function handleCancel() {
    setNotes(meeting.notes ?? '')
    setErrorMsg('')
    setMode('view')
  }

  function handleSave() {
    setErrorMsg('')
    startTransition(async () => {
      const result = await updateSessionNotesAction(meeting.id, notes, userId)
      if (!result.success) {
        setErrorMsg(result.error ?? 'Failed to save — please try again.')
        return
      }
      setMode('view')
      router.refresh()
    })
  }

  const dateLabel = meeting.startTime ? formatMeetingDate(meeting.startTime) : ''

  return (
    <div className="bg-white rounded-xl shadow-sm p-4 md:p-6">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <NotebookPen className="h-4 w-4 text-slate-400 flex-shrink-0" />
          <h2 className="text-sm font-semibold text-slate-800">Last Session Notes</h2>
          {dateLabel && (
            <span className="text-xs text-slate-400 font-normal">{dateLabel}</span>
          )}
        </div>
        {mode === 'view' && (
          <button
            onClick={handleEdit}
            className="text-xs font-medium text-[hsl(213,70%,30%)] hover:underline flex-shrink-0"
          >
            {notes ? 'Edit' : 'Add Notes'}
          </button>
        )}
      </div>

      {mode === 'view' ? (
        notes ? (
          <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
            {notes}
          </p>
        ) : (
          <p className="text-sm text-slate-400 italic">
            No notes recorded for this session yet.
          </p>
        )
      ) : (
        <div className="space-y-3">
          <textarea
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={6}
            disabled={isPending}
            placeholder="Session notes, observations, action items…"
            className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm bg-white resize-y focus:outline-none focus:ring-2 focus:ring-blue-400 leading-relaxed disabled:opacity-50"
          />
          {errorMsg && (
            <p className="text-xs text-rose-500">{errorMsg}</p>
          )}
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={isPending}
              className="px-4 py-2 bg-[hsl(213,70%,30%)] text-white text-sm font-medium rounded-lg hover:bg-[hsl(213,70%,25%)] disabled:opacity-50 transition-colors"
            >
              {isPending ? 'Saving…' : 'Save'}
            </button>
            <button
              onClick={handleCancel}
              disabled={isPending}
              className="px-4 py-2 border border-slate-200 text-sm rounded-lg hover:bg-slate-50 transition-colors text-slate-600 disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {meeting.title && (
        <p className="text-xs text-slate-400 mt-3 pt-3 border-t border-slate-100">
          {meeting.title}
        </p>
      )}
    </div>
  )
}
