'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { fetchClientSessionsAction, dashboardLogNoteAction } from './actions'

interface Client {
  id: string
  name: string
}

interface SessionOption {
  id: string
  label: string
}

interface Props {
  clients: Client[]
  /** Optional custom trigger element. If omitted, renders a plain text button. */
  trigger?: React.ReactNode
}

export default function GlobalLogNoteDialog({ clients, trigger }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [clientId, setClientId] = useState('')
  const [content, setContent] = useState('')
  const [meetingId, setMeetingId] = useState('')
  const [sessions, setSessions] = useState<SessionOption[]>([])
  const [sessionsLoading, setSessionsLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const canSubmit = clientId.length > 0 && content.trim().length > 0 && !saving

  // Fetch sessions whenever client changes
  useEffect(() => {
    if (!clientId) {
      setSessions([])
      setMeetingId('')
      return
    }
    let cancelled = false
    setSessionsLoading(true)
    setMeetingId('')
    fetchClientSessionsAction(clientId).then((results) => {
      if (!cancelled) {
        setSessions(results)
        setSessionsLoading(false)
      }
    })
    return () => { cancelled = true }
  }, [clientId])

  function handleOpen() {
    setClientId('')
    setContent('')
    setMeetingId('')
    setSessions([])
    setError('')
    setOpen(true)
  }

  function handleClose() {
    if (saving) return
    setOpen(false)
    setError('')
  }

  async function handleSave() {
    if (!canSubmit) return
    setSaving(true)
    setError('')
    const result = await dashboardLogNoteAction({
      clientId,
      content: content.trim(),
      meetingId: (meetingId && meetingId !== '__none__') ? meetingId : undefined,
    })
    setSaving(false)
    if (!result.success) {
      setError('Failed to save note — please try again')
      return
    }
    toast.success('Note saved')
    setOpen(false)
    router.refresh()
  }

  return (
    <>
      {trigger ? (
        <div onClick={handleOpen}>{trigger}</div>
      ) : (
        <button
          onClick={handleOpen}
          className="text-sm font-medium text-[hsl(213,70%,30%)] hover:underline"
        >
          Log a Note
        </button>
      )}

      <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose() }}>
        <DialogContent className="sm:max-w-md max-h-[90vh] flex flex-col overflow-hidden p-0">

          {/* Fixed header */}
          <DialogHeader className="px-6 pt-6 pb-4 shrink-0">
            <DialogTitle>Log a Note</DialogTitle>
          </DialogHeader>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto px-6 pb-2 space-y-4">
            {/* Client */}
            <div className="space-y-1.5">
              <Label htmlFor="log-note-client">
                Client <span className="text-destructive">*</span>
              </Label>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger id="log-note-client">
                  <SelectValue placeholder="Select a client..." />
                </SelectTrigger>
                <SelectContent className="max-h-48 overflow-y-auto">
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Note content */}
            <div className="space-y-1.5">
              <Label htmlFor="log-note-content">
                Note <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="log-note-content"
                placeholder="What happened in this session or observation?"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={4}
                disabled={saving}
              />
            </div>

            {/* Session link — only shown after a client is selected */}
            {clientId && (
              <div className="space-y-1.5">
                <Label htmlFor="log-note-session">Link to a session</Label>
                <Select
                  value={meetingId}
                  onValueChange={setMeetingId}
                  disabled={sessionsLoading || saving}
                >
                  <SelectTrigger id="log-note-session">
                    <SelectValue placeholder={
                      sessionsLoading
                        ? 'Loading sessions…'
                        : 'General note (not tied to a session)'
                    } />
                  </SelectTrigger>
                  <SelectContent className="max-h-48 overflow-y-auto">
                    <SelectItem value="__none__">General note (not tied to a session)</SelectItem>
                    {sessions.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-slate-400">
                  {meetingId && meetingId !== '__none__'
                    ? 'This note will be saved to the session record'
                    : 'This note will be saved as a general coaching note'}
                </p>
              </div>
            )}
          </div>

          {/* Fixed footer */}
          <div className="px-6 py-4 border-t border-slate-100 shrink-0 flex items-center justify-end gap-2">
            {error && (
              <p className="text-xs font-medium text-rose-600 mr-auto">{error}</p>
            )}
            <Button variant="outline" onClick={handleClose} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!canSubmit}>
              {saving ? 'Saving…' : 'Save Note'}
            </Button>
          </div>

        </DialogContent>
      </Dialog>
    </>
  )
}
