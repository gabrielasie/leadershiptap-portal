'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { StickyNote, CheckSquare, Users } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { saveNoteAction, saveTaskAction } from '@/app/(protected)/users/[id]/actions'

interface Client {
  id: string
  name: string
}

interface Props {
  clients: Client[]
}

function todayString(): string {
  return new Date().toISOString().slice(0, 10)
}

// ── Log a Note dialog ─────────────────────────────────────────────────────────

function LogNoteDialog({ clients }: { clients: Client[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [clientId, setClientId] = useState('')
  const [content, setContent] = useState('')
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')

  function handleOpenChange(next: boolean) {
    if (next) { setClientId(''); setContent(''); setError('') }
    setOpen(next)
  }

  function handleSave() {
    if (!clientId || !content.trim()) {
      setError('Please select a client and enter note content.')
      return
    }
    setError('')
    startTransition(async () => {
      try {
        await saveNoteAction(clientId, content.trim(), todayString())
        setOpen(false)
        router.refresh()
      } catch {
        setError('Failed to save note — please try again.')
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <button className="flex flex-col items-center gap-2 p-4 rounded-xl border border-slate-200 bg-white hover:border-[hsl(213,60%,80%)] hover:bg-[hsl(213,60%,97%)] transition-colors group w-full">
          <StickyNote className="h-5 w-5 text-slate-400 group-hover:text-[hsl(213,70%,30%)]" />
          <span className="text-sm font-medium text-slate-700 group-hover:text-[hsl(213,70%,30%)]">Log a Note</span>
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Log a Note</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-1">
          <div className="space-y-1.5">
            <Label>Client</Label>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a client…" />
              </SelectTrigger>
              <SelectContent>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Note</Label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="What happened in the session?"
              rows={4}
              disabled={isPending}
            />
          </div>
        </div>
        <DialogFooter>
          {error && <p className="text-xs font-medium text-rose-600 mr-auto self-center">{error}</p>}
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>Cancel</Button>
          <Button onClick={handleSave} disabled={isPending || !clientId || !content.trim()}>
            {isPending ? 'Saving…' : 'Save Note'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Add Task dialog ───────────────────────────────────────────────────────────

function AddTaskDialog({ clients }: { clients: Client[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [clientId, setClientId] = useState('')
  const [taskName, setTaskName] = useState('')
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')

  function handleOpenChange(next: boolean) {
    if (next) { setClientId(''); setTaskName(''); setError('') }
    setOpen(next)
  }

  function handleSave() {
    if (!clientId || !taskName.trim()) {
      setError('Please select a client and enter a task name.')
      return
    }
    setError('')
    startTransition(async () => {
      try {
        await saveTaskAction(clientId, taskName.trim(), null, 'Medium')
        setOpen(false)
        router.refresh()
      } catch {
        setError('Failed to save task — please try again.')
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <button className="flex flex-col items-center gap-2 p-4 rounded-xl border border-slate-200 bg-white hover:border-[hsl(213,60%,80%)] hover:bg-[hsl(213,60%,97%)] transition-colors group w-full">
          <CheckSquare className="h-5 w-5 text-slate-400 group-hover:text-[hsl(213,70%,30%)]" />
          <span className="text-sm font-medium text-slate-700 group-hover:text-[hsl(213,70%,30%)]">Add Task</span>
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Task</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-1">
          <div className="space-y-1.5">
            <Label>Client</Label>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a client…" />
              </SelectTrigger>
              <SelectContent>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Task</Label>
            <Input
              value={taskName}
              onChange={(e) => setTaskName(e.target.value)}
              placeholder="e.g. Send follow-up email"
              disabled={isPending}
            />
          </div>
        </div>
        <DialogFooter>
          {error && <p className="text-xs font-medium text-rose-600 mr-auto self-center">{error}</p>}
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>Cancel</Button>
          <Button onClick={handleSave} disabled={isPending || !clientId || !taskName.trim()}>
            {isPending ? 'Saving…' : 'Add Task'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function DashboardQuickActions({ clients }: Props) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-4 md:p-6 mb-4 md:mb-6">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">Quick Actions</p>
      <div className="grid grid-cols-3 gap-3">
        <LogNoteDialog clients={clients} />
        <AddTaskDialog clients={clients} />
        <Link
          href="/users"
          className="flex flex-col items-center gap-2 p-4 rounded-xl border border-slate-200 bg-white hover:border-[hsl(213,60%,80%)] hover:bg-[hsl(213,60%,97%)] transition-colors group"
        >
          <Users className="h-5 w-5 text-slate-400 group-hover:text-[hsl(213,70%,30%)]" />
          <span className="text-sm font-medium text-slate-700 group-hover:text-[hsl(213,70%,30%)]">All Clients</span>
        </Link>
      </div>
    </div>
  )
}
