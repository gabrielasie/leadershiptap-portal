'use client'

import { useState, useEffect, useTransition } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Trash2 } from 'lucide-react'
import { dashboardUpdateTaskAction, dashboardDeleteTaskAction } from './actions'
import type { DashboardTask } from './DashboardTaskItem'
import type { TaskStatus } from '@/lib/types'

interface Props {
  task: DashboardTask
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export default function EditTaskDialog({ task, open, onOpenChange, onSuccess }: Props) {
  const [isPending, startTransition] = useTransition()
  const [title, setTitle] = useState(task.title)
  const [status, setStatus] = useState<TaskStatus>(task.status)
  const [dueDate, setDueDate] = useState(task.dueDate ?? '')
  const [notes, setNotes] = useState(task.notes ?? '')
  const [errorMsg, setErrorMsg] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)

  // Reset form whenever dialog opens
  useEffect(() => {
    if (open) {
      setTitle(task.title)
      setStatus(task.status)
      setDueDate(task.dueDate ?? '')
      setNotes(task.notes ?? '')
      setErrorMsg('')
      setConfirmDelete(false)
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleSave() {
    if (!title.trim()) return
    setErrorMsg('')
    startTransition(async () => {
      const data: Parameters<typeof dashboardUpdateTaskAction>[1] = {}
      if (title.trim() !== task.title) data.title = title.trim()
      if (status !== task.status) data.status = status
      const origDue = task.dueDate ?? ''
      if (dueDate !== origDue) data.dueDate = dueDate || null
      const origNotes = task.notes ?? ''
      if (notes !== origNotes) data.notes = notes

      if (Object.keys(data).length === 0) {
        onOpenChange(false)
        return
      }

      const result = await dashboardUpdateTaskAction(task.id, data)
      if (!result.success) {
        setErrorMsg('Failed to update task — please try again')
        return
      }
      onSuccess()
    })
  }

  function handleDelete() {
    startTransition(async () => {
      const result = await dashboardDeleteTaskAction(task.id)
      if (!result.success) {
        setErrorMsg('Failed to delete task — please try again')
        setConfirmDelete(false)
        return
      }
      onSuccess()
    })
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!isPending) onOpenChange(v) }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{confirmDelete ? 'Delete Task' : 'Edit Task'}</DialogTitle>
        </DialogHeader>

        {confirmDelete ? (
          <>
            <p className="text-sm text-slate-700 py-2">
              Delete &ldquo;{task.title}&rdquo;? This cannot be undone.
            </p>
            {errorMsg && <p className="text-xs text-rose-600">{errorMsg}</p>}
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmDelete(false)} disabled={isPending}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleDelete} disabled={isPending}>
                {isPending ? 'Deleting…' : 'Delete'}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            {task.taskType === 'assignment' && task.assignedToName && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-slate-500">Assigned To</p>
                <p className="text-sm text-slate-700 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2">
                  {task.assignedToName}
                </p>
              </div>
            )}

            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="edit-title">
                  Title <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="edit-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  disabled={isPending}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="edit-status">Status</Label>
                  <Select value={status} onValueChange={(v) => setStatus(v as TaskStatus)} disabled={isPending}>
                    <SelectTrigger id="edit-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="not started">Not Started</SelectItem>
                      <SelectItem value="in progress">In Progress</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="edit-due">Due Date</Label>
                  <Input
                    id="edit-due"
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    disabled={isPending}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-notes">Notes</Label>
                <Textarea
                  id="edit-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  disabled={isPending}
                />
              </div>
            </div>

            {errorMsg && (
              <p className="text-xs font-medium text-rose-600">{errorMsg}</p>
            )}

            <DialogFooter>
              <Button
                variant="ghost"
                size="sm"
                className="mr-auto text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                onClick={() => setConfirmDelete(true)}
                disabled={isPending}
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" />
                Delete
              </Button>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={isPending || !title.trim()}>
                {isPending ? 'Saving…' : 'Save'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
