'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { FileText } from 'lucide-react'
import NoteComposer from '@/components/notes/NoteComposer'

interface LogNoteDialogProps {
  userId: string
}

/**
 * Thin modal wrapper around the shared NoteComposer. All actual note-creation
 * logic (validation, save, ink shortcut, error messaging) lives in the
 * composer so the entry points stay consistent.
 */
export default function LogNoteDialog({ userId }: LogNoteDialogProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <FileText />
        Log a Note
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Log a Note</DialogTitle>
          </DialogHeader>
          <NoteComposer
            subjectPersonId={userId}
            onSaved={() => setOpen(false)}
            onCancel={() => setOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  )
}
