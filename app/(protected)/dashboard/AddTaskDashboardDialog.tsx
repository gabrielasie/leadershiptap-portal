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
import { Plus } from 'lucide-react'
import { dashboardCreateTaskAction } from './actions'

interface Client {
  id: string
  name: string
}

interface Props {
  clients: Client[]
  /** Optional custom trigger element. If omitted, renders a default "+ Add Task" button. */
  trigger?: React.ReactNode
}

export default function AddTaskDashboardDialog({ clients, trigger }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [clientId, setClientId] = useState('')
  const [title, setTitle] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const canSubmit = title.trim().length > 0 && clientId.length > 0 && !saving

  function handleOpen() {
    setClientId('')
    setTitle('')
    setDueDate('')
    setNotes('')
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
    const result = await dashboardCreateTaskAction(
      clientId,
      title.trim(),
      dueDate || null,
      notes.trim() || null,
    )
    setSaving(false)
    if (!result.success) {
      setError('Failed to add task — please try again')
      return
    }
    toast.success('Task added')
    setOpen(false)
    router.refresh()
  }

  return (
    <>
      {trigger ? (
        <div onClick={handleOpen}>{trigger}</div>
      ) : (
        <Button variant="outline" size="sm" onClick={handleOpen}>
          <Plus className="h-4 w-4" />
          Add Task
        </Button>
      )}

      <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose() }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Task</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="add-task-client">
                Client <span className="text-destructive">*</span>
              </Label>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger id="add-task-client">
                  <SelectValue placeholder="Select a client..." />
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

            <div className="space-y-1.5">
              <Label htmlFor="add-task-title">
                Task name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="add-task-title"
                placeholder="e.g. Send session recap email"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                disabled={saving}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="add-task-due">Due Date</Label>
              <Input
                id="add-task-due"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                disabled={saving}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="add-task-notes">Notes</Label>
              <Textarea
                id="add-task-notes"
                placeholder="Optional notes..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                disabled={saving}
              />
            </div>
          </div>

          <DialogFooter>
            {error && (
              <p className="text-xs font-medium text-rose-600 mr-auto self-center">{error}</p>
            )}
            <Button variant="outline" onClick={handleClose} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!canSubmit}>
              {saving ? 'Adding…' : 'Add Task'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
