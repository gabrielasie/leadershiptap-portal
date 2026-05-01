'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Pencil } from 'lucide-react'
import { dashboardUpdateTaskStatusAction } from './actions'
import EditTaskDialog from './EditTaskDialog'

type Status = 'pending' | 'in progress' | 'completed'

export interface DashboardTask {
  id: string
  name: string
  status: Status
  dueDate: string | null
  notes: string | null
  clientId: string | null
  clientName: string | null
  assignedToId?: string | null
  assignedToName?: string | null
  assignmentType?: 'personal' | 'shared_with_client' | 'delegated_to_coach' | null
}

export default function DashboardTaskItem({ task }: { task: DashboardTask }) {
  const router = useRouter()
  const [optimisticStatus, setOptimisticStatus] = useState<Status>(task.status)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [editOpen, setEditOpen] = useState(false)

  const isDone = optimisticStatus === 'completed'
  const isOverdue =
    task.dueDate && !isDone && new Date(task.dueDate + 'T23:59:59') < new Date()

  async function toggle() {
    const prev = optimisticStatus
    const next: Status = isDone ? 'pending' : 'completed'
    setOptimisticStatus(next)
    setError('')
    setLoading(true)
    const result = await dashboardUpdateTaskStatusAction(task.id, next)
    setLoading(false)
    if (!result.success) {
      setOptimisticStatus(prev)
      setError('Failed to update')
    } else {
      router.refresh()
    }
  }

  return (
    <>
      <div
        className={`flex items-center gap-3 py-3 first:pt-0 last:pb-0 group transition-opacity ${
          isDone ? 'opacity-50' : ''
        }`}
      >
        {/* Checkbox */}
        <button
          onClick={toggle}
          disabled={loading}
          aria-label={isDone ? 'Mark incomplete' : 'Mark complete'}
          className={`flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors disabled:opacity-50 ${
            isDone
              ? 'bg-emerald-500 border-emerald-500 text-white'
              : 'border-slate-300 hover:border-emerald-400'
          }`}
        >
          {isDone && <span className="text-[10px] leading-none">✓</span>}
        </button>

        {/* Task info */}
        <div className="flex-1 min-w-0">
          <p
            className={`text-sm font-medium truncate ${
              isDone ? 'line-through text-slate-400' : 'text-slate-800'
            }`}
          >
            {task.name}
          </p>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            {task.assignmentType === 'shared_with_client' && task.assignedToName && (
              <span className="text-xs font-medium text-blue-700">
                → {task.assignedToName}
              </span>
            )}
            {task.assignmentType === 'delegated_to_coach' && task.assignedToName && (
              <span className="text-xs font-medium text-purple-700">
                → {task.assignedToName}
              </span>
            )}
            {!task.assignmentType && task.clientId && task.clientName && (
              <Link
                href={`/users/${task.clientId}`}
                className="text-xs text-[hsl(213,70%,30%)] hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                {task.clientName}
              </Link>
            )}
            {task.dueDate && (
              <span
                className={`text-xs font-medium ${
                  isOverdue ? 'text-rose-600' : 'text-slate-400'
                }`}
              >
                {isOverdue ? 'Overdue · ' : 'Due '}
                {new Date(task.dueDate + 'T12:00:00').toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
            )}
            {error && <span className="text-xs text-rose-500">{error}</span>}
          </div>
        </div>

        {/* Edit button — visible on hover */}
        <button
          onClick={() => setEditOpen(true)}
          aria-label="Edit task"
          className="flex-shrink-0 p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors opacity-0 group-hover:opacity-100"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      </div>

      <EditTaskDialog
        task={{ ...task, status: optimisticStatus }}
        open={editOpen}
        onOpenChange={setEditOpen}
        onSuccess={() => {
          setEditOpen(false)
          router.refresh()
        }}
      />
    </>
  )
}
