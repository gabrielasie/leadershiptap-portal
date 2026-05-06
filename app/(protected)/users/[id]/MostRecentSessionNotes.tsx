'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Pencil } from 'lucide-react'
import { updateSessionNotesAction } from './actions'
import type { Meeting } from '@/lib/types'
import type { Note } from '@/lib/airtable/notes'

import { formatEastern } from '@/lib/utils/dateFormat'

function formatMeetingDate(iso: string): string {
  if (!iso) return ''
  return formatEastern(iso, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })
}

interface Props {
  meeting: Meeting | null
  userId: string
  meetingNotes: Note[]
}

export default function MostRecentSessionNotes({ meeting, userId, meetingNotes }: Props) {
  const router = useRouter()
  const [mode, setMode] = useState<'view' | 'edit'>('view')
  const existingContent = meetingNotes[0]?.content ?? ''
  const [notes, setNotes] = useState(existingContent)
  const [savedFlash, setSavedFlash] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [errorMsg, setErrorMsg] = useState('')

  // If there's no meeting at all, show an empty-state placeholder
  if (!meeting) {
    return (
      <div className="border border-dashed border-slate-200 rounded-xl p-5 text-center">
        <p className="text-sm text-slate-400">No sessions recorded yet.</p>
      </div>
    )
  }

  function handleEdit() {
    setErrorMsg('')
    setSavedFlash(false)
    setMode('edit')
  }

  function handleCancel() {
    setErrorMsg('')
    // Reset textarea to last-saved value so cancel truly discards changes
    setNotes(existingContent)
    setMode('view')
  }

  function handleSave() {
    setErrorMsg('')
    startTransition(async () => {
      const result = await updateSessionNotesAction(meeting!.id, notes, userId)
      if (!result.success) {
        setErrorMsg(result.error ?? 'Failed to save — please try again.')
        return
      }
      setMode('view')
      setSavedFlash(true)
      setTimeout(() => setSavedFlash(false), 2500)
      router.refresh()
    })
  }

  const dateLabel = meeting.startTime ? formatMeetingDate(meeting.startTime) : ''

  return (
    <div className="border-l-4 border-blue-600 bg-blue-50/40 rounded-r-xl overflow-hidden">

      {/* Header row */}
      <div className="flex justify-between items-start px-5 pt-5 pb-3">
        <div>
          <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide">
            Most Recent Session
          </p>
          {dateLabel && (
            <p className="text-sm font-medium text-slate-800 mt-0.5">{dateLabel}</p>
          )}
          {meeting.title && (
            <p className="text-xs text-slate-500 mt-0.5">{meeting.title}</p>
          )}
        </div>
        <Link
          href={`/users/${userId}/sessions/${meeting.id}`}
          className="text-xs text-blue-600 hover:underline whitespace-nowrap flex-shrink-0"
        >
          Full session →
        </Link>
      </div>

      {/* Notes body */}
      <div className="mx-5 mb-5 bg-white/80 rounded-lg border border-blue-100 p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Session Notes
          </p>
          <div className="flex items-center gap-2">
            {savedFlash && (
              <span className="text-xs font-medium text-emerald-600">Saved ✓</span>
            )}
            {mode === 'view' && !savedFlash && (
              <button
                onClick={handleEdit}
                className="flex items-center gap-1 text-xs font-medium text-[hsl(213,70%,30%)] hover:underline"
              >
                <Pencil className="h-3 w-3" />
                {notes ? 'Edit Notes' : 'Add Notes'}
              </button>
            )}
          </div>
        </div>

        {mode === 'view' ? (
          meetingNotes.length > 0 ? (
            <div className="space-y-3">
              {meetingNotes.map((n) => (
                <p key={n.id} className="text-base text-slate-800 whitespace-pre-wrap leading-relaxed">
                  {n.content}
                </p>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400 italic">
              No session notes yet — click Log a Note or Add Notes to add some.
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
      </div>

    </div>
  )
}
