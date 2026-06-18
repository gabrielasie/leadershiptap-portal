'use client'

import { useState } from 'react'
import { CheckSquare } from 'lucide-react'
import type { Task } from '@/lib/types'
import TaskItem from '../TaskItem'

type Filter = 'open' | 'done' | 'all'

const OPEN_STATUSES = new Set(['Not Started', 'In Progress'])
const DONE_STATUSES = new Set(['Complete', 'Cancelled'])

const FILTER_LABELS: { key: Filter; label: string }[] = [
  { key: 'open', label: 'Open' },
  { key: 'done', label: 'Done' },
  { key: 'all', label: 'All' },
]

const EMPTY_MESSAGES: Record<Filter, string> = {
  open: 'No open tasks',
  done: 'No completed tasks',
  all: 'No tasks yet',
}

export default function TasksSection({ tasks }: { tasks: Task[] }) {
  const [filter, setFilter] = useState<Filter>('open')

  const filtered = tasks.filter((t) => {
    if (filter === 'open') return OPEN_STATUSES.has(t.status)
    if (filter === 'done') return DONE_STATUSES.has(t.status)
    return true
  })

  return (
    <>
      {tasks.length > 0 && (
        <div className="flex gap-1.5 mb-3">
          {FILTER_LABELS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                filter === key
                  ? 'bg-slate-800 text-white'
                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mb-3">
            <CheckSquare className="w-5 h-5 text-slate-400" />
          </div>
          <p className="text-sm font-medium text-slate-500">
            {tasks.length === 0 ? 'No tasks yet' : EMPTY_MESSAGES[filter]}
          </p>
          {tasks.length === 0 && (
            <p className="text-xs text-slate-400 mt-1">
              Use the Add Task button above to create a task for this client.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((task) => (
            <TaskItem key={task.id} task={task} />
          ))}
        </div>
      )}
    </>
  )
}
