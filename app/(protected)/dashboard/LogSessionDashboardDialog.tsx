'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { logManualSessionAction } from '../users/[id]/actions'

interface Client {
  id: string
  name: string
}

interface Props {
  clients: Client[]
  trigger: React.ReactNode
}

function todayStr(): string {
  return new Date().toISOString().split('T')[0]
}

function roundedTimeStr(): string {
  const now = new Date()
  const mins = now.getMinutes()
  const rounded = mins < 15 ? 0 : mins < 45 ? 30 : 60
  if (rounded === 60) {
    now.setHours(now.getHours() + 1, 0)
  } else {
    now.setMinutes(rounded)
  }
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
}

export default function LogSessionDashboardDialog({ clients, trigger }: Props) {
  const router = useRouter()

  const [open, setOpen] = useState(false)
  const [clientId, setClientId] = useState('')
  const [date, setDate] = useState(todayStr)
  const [time, setTime] = useState(roundedTimeStr)
  const [duration, setDuration] = useState('60')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const canSubmit = !!clientId && date.length > 0 && time.length > 0 && !saving

  function handleOpen() {
    setClientId('')
    setDate(todayStr())
    setTime(roundedTimeStr())
    setDuration('60')
    setNotes('')
    setSaveError(null)
    setOpen(true)
  }

  function handleOpenChange(v: boolean) {
    if (saving) return
    setOpen(v)
    if (!v) setSaveError(null)
  }

  async function handleSave() {
    if (!canSubmit) return
    setSaving(true)
    setSaveError(null)

    try {
      const startIso = new Date(`${date}T${time}:00`).toISOString()
      await logManualSessionAction({
        subjectPersonId: clientId,
        startIso,
        durationMinutes: Number(duration),
        notes: notes.trim() || undefined,
      })
      toast.success('Session logged')
      setOpen(false)
      router.refresh()
    } catch (err) {
      const code = err instanceof Error ? err.message : ''
      if (code === 'NO_RELATIONSHIP') {
        setSaveError('No active coaching or reporting relationship reaches this person.')
      } else {
        setSaveError('Failed to log session. Please try again.')
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div onClick={handleOpen}>{trigger}</div>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Log a Session</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="dash-session-client">
                Client <span className="text-destructive">*</span>
              </Label>
              <Select value={clientId} onValueChange={setClientId} disabled={saving}>
                <SelectTrigger id="dash-session-client">
                  <SelectValue placeholder="Select a client…" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="dash-session-date">Date</Label>
                <Input
                  id="dash-session-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  disabled={saving}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="dash-session-time">Time</Label>
                <Input
                  id="dash-session-time"
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  disabled={saving}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="dash-session-duration">Duration</Label>
              <Select value={duration} onValueChange={setDuration} disabled={saving}>
                <SelectTrigger id="dash-session-duration">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="30">30 minutes</SelectItem>
                  <SelectItem value="45">45 minutes</SelectItem>
                  <SelectItem value="60">60 minutes</SelectItem>
                  <SelectItem value="90">90 minutes</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="dash-session-notes">
                Notes <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Textarea
                id="dash-session-notes"
                placeholder="Session observations, follow-up items…"
                rows={4}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="resize-none"
                disabled={saving}
              />
            </div>
          </div>

          {saveError && (
            <p className="text-xs text-destructive -mt-1">{saveError}</p>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!canSubmit}>
              {saving ? 'Saving…' : saveError ? 'Try Again' : 'Log Session'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
