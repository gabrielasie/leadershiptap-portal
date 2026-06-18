'use client'

import { useState, useEffect } from 'react'
import { X, User } from 'lucide-react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { savePortalEventNotesAction } from './actions'

export interface PanelEvent {
  meetingId: string
  title: string
  startTime: string
  endTime?: string
  clientId: string | null
  clientName: string | null
  participantEmails: string[]
  notes?: string
}

interface Props {
  events: PanelEvent[]
  initialEventId?: string
  emailToClientName: Record<string, string>
  onClose: () => void
}

function formatPanelDate(startIso: string, endIso?: string): string {
  const fmt = (iso: string) =>
    new Date(iso).toLocaleString('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit', hour12: true })
  const date = new Date(startIso).toLocaleString('en-US', {
    timeZone: 'America/New_York', weekday: 'long', month: 'long', day: 'numeric',
  })
  return endIso ? `${date} · ${fmt(startIso)} – ${fmt(endIso)} ET` : `${date} · ${fmt(startIso)} ET`
}

export default function SessionNotePanel({
  events,
  initialEventId,
  emailToClientName,
  onClose,
}: Props) {
  const router = useRouter()
  const showPicker = !initialEventId

  const [selectedId, setSelectedId] = useState<string>(
    initialEventId ?? events[0]?.meetingId ?? '',
  )
  const [notes, setNotes] = useState<string>('')
  const [saving, setSaving] = useState(false)

  const event = events.find((e) => e.meetingId === selectedId) ?? null

  // Pre-fill notes when selected event changes
  useEffect(() => {
    setNotes(event?.notes ?? '')
  }, [selectedId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSave() {
    if (!event || saving) return
    setSaving(true)
    if (!event.clientId) {
      toast.error('No client linked to this event')
      return
    }
    const result = await savePortalEventNotesAction(event.meetingId, notes, event.clientId)
    setSaving(false)
    if (!result.success) {
      toast.error('Failed to save notes')
      return
    }
    toast.success('Notes saved')
    router.refresh()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />

      {/* Panel */}
      <div className="relative bg-white w-full max-w-md flex flex-col shadow-xl h-full overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <h2 className="text-base font-semibold text-slate-900">Session Notes</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 transition-colors"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">

          {/* Event picker — only shown when opened from "Log a Note" */}
          {showPicker && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Session
              </p>
              {events.length === 0 ? (
                <p className="text-sm text-slate-400">No upcoming sessions this week.</p>
              ) : (
                <Select value={selectedId} onValueChange={setSelectedId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pick a session…" />
                  </SelectTrigger>
                  <SelectContent className="max-h-52 overflow-y-auto">
                    {events.map((ev) => {
                      const d = new Date(ev.startTime)
                      const label = `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · ${ev.title || 'Untitled'}`
                      return (
                        <SelectItem key={ev.meetingId} value={ev.meetingId}>
                          {label}
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          {/* Selected event details */}
          {event && (
            <>
              <div className="rounded-lg bg-slate-50 p-4 space-y-1">
                <p className="text-sm font-semibold text-slate-900">
                  {event.title || 'Untitled Meeting'}
                </p>
                <p className="text-xs text-slate-500">
                  {formatPanelDate(event.startTime, event.endTime)}
                </p>
                {event.clientId && (
                  <Link
                    href={`/users/${event.clientId}`}
                    className="text-xs font-medium text-[hsl(213,70%,30%)] hover:underline"
                    onClick={onClose}
                  >
                    Open Client Profile →
                  </Link>
                )}
              </div>

              {/* Participants */}
              {event.participantEmails.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Participants
                  </p>
                  <div className="space-y-1.5">
                    {event.participantEmails.map((email) => {
                      const name = emailToClientName[email.toLowerCase()]
                      return (
                        <div key={email} className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                            <User className="h-3 w-3 text-slate-400" />
                          </div>
                          <div className="min-w-0">
                            {name ? (
                              <>
                                <p className="text-sm font-medium text-slate-900 truncate">{name}</p>
                                <p className="text-xs text-slate-400 truncate">{email}</p>
                              </>
                            ) : (
                              <p className="text-sm text-slate-600 truncate">{email}</p>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Notes textarea */}
              <div className="space-y-1.5">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Notes
                </p>
                <Textarea
                  placeholder="Session notes, observations, follow-ups…"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={8}
                  disabled={saving}
                  className="resize-none"
                />
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 shrink-0 flex items-center justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!event || saving || (!showPicker && selectedId === '')}
          >
            {saving ? 'Saving…' : 'Save Notes'}
          </Button>
        </div>
      </div>
    </div>
  )
}
