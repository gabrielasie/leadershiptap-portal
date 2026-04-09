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
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { FileText } from 'lucide-react'
import { saveNoteAction } from './actions'

const MIN_CHARS = 5

function todayISO() {
  return new Date().toISOString().split('T')[0]
}

function isValidDate(d: string): boolean {
  if (!d) return false
  return !isNaN(new Date(d + 'T12:00:00').getTime())
}

interface LogNoteDialogProps {
  userId: string
}

export default function LogNoteDialog({ userId }: LogNoteDialogProps) {
  const router = useRouter()

  const [open, setOpen] = useState(false)
  const [content, setContent] = useState('')
  const [date, setDate] = useState(todayISO)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [dateError, setDateError] = useState<string | null>(null)

  const trimmed = content.trim()
  const contentTooShort = trimmed.length > 0 && trimmed.length < MIN_CHARS
  const canSubmit = trimmed.length >= MIN_CHARS && isValidDate(date) && !saving

  function handleContentChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setContent(e.target.value)
    if (saveError) setSaveError(null)
  }

  function handleDateChange(e: React.ChangeEvent<HTMLInputElement>) {
    setDate(e.target.value)
    if (dateError) setDateError(null)
    if (saveError) setSaveError(null)
  }

  function handleOpenChange(v: boolean) {
    if (saving) return
    setOpen(v)
    if (!v) {
      setSaveError(null)
      setDateError(null)
    }
  }

  async function handleSave() {
    // Inline validation — run before hitting the server
    if (!isValidDate(date)) {
      setDateError('Please select a valid date.')
      return
    }
    if (trimmed.length < MIN_CHARS) return

    setSaving(true)
    setSaveError(null)

    try {
      await saveNoteAction(userId, content, date)
      toast.success('Note saved')
      // Success: close + reset
      setOpen(false)
      setContent('')
      setDate(todayISO())
      setSaveError(null)
      router.refresh()
    } catch (err) {
      const code = err instanceof Error ? err.message : ''
      if (code === 'NOTES_TABLE_MISSING') {
        setSaveError('Notes table not configured. Contact your administrator.')
      } else {
        setSaveError('Failed to save note. Please try again.')
      }
      // Modal stays open, content preserved — user can retry
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <FileText />
        Log a Note
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Log a Note</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Date */}
            <div className="space-y-1.5">
              <Label htmlFor="note-date">Date</Label>
              <Input
                id="note-date"
                type="date"
                value={date}
                onChange={handleDateChange}
                max={todayISO()}
                aria-invalid={!!dateError}
              />
              {dateError && (
                <p className="text-xs text-destructive">{dateError}</p>
              )}
            </div>

            {/* Note content */}
            <div className="space-y-1.5">
              <Label htmlFor="note-content">Note</Label>
              <Textarea
                id="note-content"
                placeholder="Session observations, follow-up items, coaching themes…"
                rows={6}
                value={content}
                onChange={handleContentChange}
                className="resize-none"
                aria-invalid={contentTooShort}
              />
              {contentTooShort && (
                <p className="text-xs text-destructive">
                  Note must be at least {MIN_CHARS} characters.
                </p>
              )}
              <p className="text-xs text-muted-foreground text-right">
                {trimmed.length} chars
              </p>
            </div>
          </div>

          {/* Save error — sits between form and footer buttons */}
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
              {saving ? 'Saving…' : saveError ? 'Try Again' : 'Save Note'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
