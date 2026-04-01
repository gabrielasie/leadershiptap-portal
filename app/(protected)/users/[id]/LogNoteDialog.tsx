'use client'

import { useState } from 'react'
import { useUser } from '@clerk/nextjs'
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

function todayISO() {
  return new Date().toISOString().split('T')[0]
}

interface LogNoteDialogProps {
  userId: string
}

export default function LogNoteDialog({ userId }: LogNoteDialogProps) {
  const { user } = useUser()
  const [open, setOpen] = useState(false)
  const [content, setContent] = useState('')
  const [date, setDate] = useState(todayISO)
  const [saving, setSaving] = useState(false)

  const contentTooShort = content.trim().length > 0 && content.trim().length < 10
  const canSubmit = content.trim().length >= 10 && date && !saving

  async function handleSave() {
    if (!canSubmit) return
    setSaving(true)
    try {
      const coachName = user?.fullName ?? user?.primaryEmailAddress?.emailAddress ?? ''
      await saveNoteAction(userId, content, date, coachName)
      toast.success('Note saved')
      setOpen(false)
      setContent('')
      setDate(todayISO())
    } catch (err) {
      console.error(err)
      toast.error('Failed to save note', {
        description: err instanceof Error ? err.message : 'Unknown error',
      })
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

      <Dialog open={open} onOpenChange={(v) => { if (!saving) setOpen(v) }}>
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
                onChange={(e) => setDate(e.target.value)}
                max={todayISO()}
              />
            </div>

            {/* Note content */}
            <div className="space-y-1.5">
              <Label htmlFor="note-content">Note</Label>
              <Textarea
                id="note-content"
                placeholder="Session observations, follow-up items, coaching themes…"
                rows={6}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="resize-none"
              />
              {contentTooShort && (
                <p className="text-xs text-destructive">
                  Note must be at least 10 characters.
                </p>
              )}
              <p className="text-xs text-muted-foreground text-right">
                {content.trim().length} chars
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!canSubmit}>
              {saving ? 'Saving…' : 'Save Note'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
