'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

interface NotesEditorProps {
  meetingId: string
  userId: string
  initialNotes?: string
  saveAction: (userId: string, meetingId: string, notes: string) => Promise<{ ok: true } | { ok: false; error: string }>
}

export default function NotesEditor({ meetingId, userId, initialNotes, saveAction }: NotesEditorProps) {
  const [editing, setEditing] = useState(!initialNotes)
  const [value, setValue] = useState(initialNotes ?? '')
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  async function handleSave() {
    setStatus('saving')
    const result = await saveAction(userId, meetingId, value)
    if (result.ok) {
      setStatus('saved')
      setEditing(false)
    } else {
      setStatus('error')
      setErrorMsg(result.error)
    }
  }

  if (!editing && value) {
    return (
      <div className="space-y-2">
        <div className="rounded-md border bg-muted/40 p-4 text-sm whitespace-pre-wrap">
          {value}
        </div>
        <Button variant="outline" size="sm" onClick={() => { setEditing(true); setStatus('idle') }}>
          Edit
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <textarea
        className="w-full rounded-md border bg-background p-3 text-sm resize-y min-h-[160px] focus:outline-none focus:ring-2 focus:ring-ring"
        placeholder="Paste transcript or notes here..."
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      <div className="flex items-center gap-3">
        <Button size="sm" onClick={handleSave} disabled={status === 'saving'}>
          {status === 'saving' ? 'Saving…' : 'Save Notes'}
        </Button>
        {initialNotes && (
          <Button variant="ghost" size="sm" onClick={() => { setEditing(false); setValue(initialNotes); setStatus('idle') }}>
            Cancel
          </Button>
        )}
        {status === 'saved' && <span className="text-sm text-green-600">Saved ✓</span>}
        {status === 'error' && <span className="text-sm text-destructive">{errorMsg}</span>}
      </div>
    </div>
  )
}
