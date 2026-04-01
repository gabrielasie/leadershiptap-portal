'use client'

import { useState } from 'react'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { CheckSquare } from 'lucide-react'
import { saveTaskAction } from './actions'

type Priority = 'Low' | 'Medium' | 'High'

interface AddTaskDialogProps {
  userId: string
}

export default function AddTaskDialog({ userId }: AddTaskDialogProps) {
  const [open, setOpen] = useState(false)
  const [taskName, setTaskName] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [priority, setPriority] = useState<Priority>('Medium')
  const [saving, setSaving] = useState(false)

  const canSubmit = taskName.trim().length > 0 && !saving

  async function handleSave() {
    if (!canSubmit) return
    setSaving(true)
    try {
      await saveTaskAction(
        userId,
        taskName.trim(),
        dueDate || null,
        priority,
      )
      toast.success('Task added')
      setOpen(false)
      setTaskName('')
      setDueDate('')
      setPriority('Medium')
    } catch (err) {
      console.error(err)
      toast.error('Failed to add task', {
        description: err instanceof Error ? err.message : 'Unknown error',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <CheckSquare />
        Add Task
      </Button>

      <Dialog open={open} onOpenChange={(v) => { if (!saving) setOpen(v) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Task</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Task name */}
            <div className="space-y-1.5">
              <Label htmlFor="task-name">Task name <span className="text-destructive">*</span></Label>
              <Input
                id="task-name"
                placeholder="e.g. Send session recap email"
                value={taskName}
                onChange={(e) => setTaskName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSave()}
              />
            </div>

            {/* Due date + Priority — side by side */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="task-due">Due date</Label>
                <Input
                  id="task-due"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="task-priority">Priority</Label>
                <Select
                  value={priority}
                  onValueChange={(v) => setPriority(v as Priority)}
                >
                  <SelectTrigger id="task-priority">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Low">Low</SelectItem>
                    <SelectItem value="Medium">Medium</SelectItem>
                    <SelectItem value="High">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
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
              {saving ? 'Adding…' : 'Add Task'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
