'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface Client {
  id: string
  name: string
}

interface Props {
  /** Airtable record ID of the Portal Calendar Events record. Omit for /sessions/new. */
  eventId?: string
  /** Pre-selected client (event page). When absent, a dropdown is shown. */
  clientAirtableId?: string
  /** Available clients for the dropdown (new note page). */
  clients?: Client[]
  /** Where to navigate after a successful save. Defaults to refreshing the current page. */
  redirectTo?: string
}

export default function NoteForm({ eventId, clientAirtableId, clients, redirectTo }: Props) {
  const router = useRouter()
  const [body, setBody] = useState('')
  const [selectedClientId, setSelectedClientId] = useState(clientAirtableId ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  const showClientDropdown = !clientAirtableId && Array.isArray(clients) && clients.length > 0

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    const resolvedClientId = clientAirtableId ?? selectedClientId
    if (!body.trim()) {
      setError('Please enter a note.')
      return
    }
    if (showClientDropdown && !resolvedClientId) {
      setError('Please select a client.')
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/notes/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          body: body.trim(),
          eventId: eventId || undefined,
          clientAirtableId: resolvedClientId || undefined,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? 'Failed to save note — please try again.')
        return
      }

      setSaved(true)
      setBody('')
      setSelectedClientId(clientAirtableId ?? '')

      if (redirectTo) {
        router.push(redirectTo)
      } else {
        // Refresh server data on the session page to show the new note
        router.refresh()
        setTimeout(() => setSaved(false), 3000)
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">

      {/* Client dropdown — only on /sessions/new */}
      {showClientDropdown && (
        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Client
          </label>
          <Select value={selectedClientId} onValueChange={setSelectedClientId}>
            <SelectTrigger>
              <SelectValue placeholder="Select a client…" />
            </SelectTrigger>
            <SelectContent>
              {clients!.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Body */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Note
        </label>
        <Textarea
          placeholder="Observations, themes, action items…"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={6}
          disabled={saving}
          className="resize-y"
        />
      </div>

      {error && <p className="text-sm text-rose-500">{error}</p>}

      {saved && !redirectTo && (
        <p className="text-sm text-emerald-600 font-medium">Note saved ✓</p>
      )}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={saving}>
          {saving ? 'Saving…' : 'Save Note'}
        </Button>
      </div>
    </form>
  )
}
