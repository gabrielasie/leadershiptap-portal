'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FileText, CheckSquare, Calendar } from 'lucide-react'
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

// ── Shared card shell ─────────────────────────────────────────────────────────

function ActionCard({
  icon,
  iconBg,
  label,
  description,
  children,
}: {
  icon: React.ReactNode
  iconBg: string
  label: string
  description: string
  children: React.ReactNode
}) {
  return (
    <div className="relative">
      {children}
      {/* Non-interactive label layer — pointer-events-none so the trigger above captures clicks */}
      <div className="pointer-events-none absolute inset-0 flex items-center gap-4 px-5 rounded-xl">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${iconBg}`}>
          {icon}
        </div>
        <div className="text-left">
          <p className="text-sm font-semibold text-slate-800">{label}</p>
          <p className="text-xs text-slate-400 mt-0.5">{description}</p>
        </div>
      </div>
    </div>
  )
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
      <ActionCard
        icon={<FileText className="w-5 h-5 text-blue-600" />}
        iconBg="bg-blue-100"
        label="Log a Note"
        description="Record coaching observations"
      >
        <DialogTrigger asChild>
          <button className="w-full min-h-[72px] rounded-xl border border-slate-200 bg-white hover:border-blue-200 hover:bg-blue-50/40 transition-colors" />
        </DialogTrigger>
      </ActionCard>
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
      <ActionCard
        icon={<CheckSquare className="w-5 h-5 text-emerald-600" />}
        iconBg="bg-emerald-100"
        label="Add Task"
        description="Assign a follow-up to a client"
      >
        <DialogTrigger asChild>
          <button className="w-full min-h-[72px] rounded-xl border border-slate-200 bg-white hover:border-emerald-200 hover:bg-emerald-50/40 transition-colors" />
        </DialogTrigger>
      </ActionCard>
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
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <LogNoteDialog clients={clients} />
        <AddTaskDialog clients={clients} />
        <ActionCard
          icon={<Calendar className="w-5 h-5 text-violet-600" />}
          iconBg="bg-violet-100"
          label="My Schedule"
          description="Jump to upcoming sessions"
        >
          <a
            href="#upcoming"
            className="block w-full min-h-[72px] rounded-xl border border-slate-200 bg-white hover:border-violet-200 hover:bg-violet-50/40 transition-colors"
          />
        </ActionCard>
      </div>
    </div>
  )
}
