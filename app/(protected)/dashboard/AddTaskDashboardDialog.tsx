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
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Plus } from 'lucide-react'
import { dashboardCreateTaskAction } from './actions'

interface Assignee {
  id: string
  name: string
}

interface Props {
  clients: Assignee[]
  coaches: Assignee[]
  /** Optional custom trigger element. If omitted, renders a default "+ Add Task" button. */
  trigger?: React.ReactNode
}

// Sentinel value for "Just me" — self-assign → personal_reminder
const PERSONAL_VALUE = '__personal__'

export default function AddTaskDashboardDialog({ clients, coaches, trigger }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [dueDate, setDueDate] = useState('')
  // assignTo is PERSONAL_VALUE | a real airtable record ID
  const [assignTo, setAssignTo] = useState(PERSONAL_VALUE)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const canSubmit = title.trim().length > 0 && !saving

  // Resolve name for the visibility preview
  const assignee =
    assignTo === PERSONAL_VALUE
      ? null
      : clients.find((c) => c.id === assignTo) ?? coaches.find((c) => c.id === assignTo) ?? null

  function handleOpen() {
    setTitle('')
    setDescription('')
    setDueDate('')
    setAssignTo(PERSONAL_VALUE)
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

    const result = await dashboardCreateTaskAction({
      title: title.trim(),
      notes: description.trim() || undefined,
      dueDate: dueDate || undefined,
      assignedToPersonId: assignTo === PERSONAL_VALUE ? undefined : assignTo,
    })

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
              <Label htmlFor="add-task-title">
                Title <span className="text-destructive">*</span>
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
              <Label htmlFor="add-task-notes">Notes</Label>
              <Textarea
                id="add-task-notes"
                placeholder="Optional details…"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
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
              <Label htmlFor="add-task-assign">Assign To</Label>
              <Select value={assignTo} onValueChange={setAssignTo} disabled={saving}>
                <SelectTrigger id="add-task-assign">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={PERSONAL_VALUE}>Just me</SelectItem>
                  {clients.length > 0 && (
                    <SelectGroup>
                      <SelectLabel>My Clients</SelectLabel>
                      {clients.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  )}
                  {coaches.length > 0 && (
                    <SelectGroup>
                      <SelectLabel>Co-coaches</SelectLabel>
                      {coaches.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  )}
                </SelectContent>
              </Select>
              {/* Visibility preview */}
              {assignee ? (
                <p className="text-xs text-blue-600">
                  This task will be visible to {assignee.name}.
                </p>
              ) : (
                <p className="text-xs text-slate-400">
                  Only visible to you.
                </p>
              )}
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
