'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import type { SessionNote } from '@/lib/airtable/sessionNotes'

interface Props {
  eventProviderId: string
  clientAirtableId?: string
  sessionDate: string        // YYYY-MM-DD, pre-filled from the meeting's start time
  existingNote?: SessionNote // present when editing
}

export default function SessionNoteForm({
  eventProviderId,
  clientAirtableId,
  sessionDate,
  existingNote,
}: Props) {
  const router = useRouter()
  const isEdit = !!existingNote

  const [title, setTitle] = useState(existingNote?.title ?? '')
  const [content, setContent] = useState(existingNote?.content ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!title.trim()) { setError('Title is required.'); return }
    if (!content.trim()) { setError('Content is required.'); return }

    setSaving(true)
    try {
      let res: Response
      if (isEdit) {
        res = await fetch(`/api/session-notes/${existingNote.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: title.trim(), content: content.trim() }),
        })
      } else {
        res = await fetch('/api/session-notes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: title.trim(),
            content: content.trim(),
            eventProviderId,
            clientAirtableId,
            sessionDate,
          }),
        })
      }

      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? 'Failed to save — please try again.')
        return
      }

      setSaved(true)
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">

      {/* Title */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Title
        </label>
        <Input
          placeholder="e.g. Q2 Leadership Review"
          value={title}
          onChange={(e) => { setTitle(e.target.value); setSaved(false) }}
          disabled={saving}
        />
      </div>

      {/* Content */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Notes
        </label>
        <Textarea
          placeholder="Session observations, themes, action items…"
          value={content}
          onChange={(e) => { setContent(e.target.value); setSaved(false) }}
          rows={8}
          disabled={saving}
          className="resize-y"
        />
      </div>

      {error && <p className="text-sm text-rose-500">{error}</p>}

      {saved && (
        <p className="text-sm text-emerald-600 font-medium">
          {isEdit ? 'Note updated ✓' : 'Note saved ✓'}
        </p>
      )}

      <Button type="submit" disabled={saving}>
        {saving ? 'Saving…' : isEdit ? 'Update Note' : 'Save Note'}
      </Button>
    </form>
  )
}
