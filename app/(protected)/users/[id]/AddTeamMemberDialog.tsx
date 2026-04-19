'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { searchUsersAction, linkExistingTeamMember, createAndLinkTeamMember } from './actions'

interface Props {
  leaderId: string
  existingMemberIds: string[]
}

type SearchResult = { id: string; name: string; jobTitle?: string }

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase()
}

export default function AddTeamMemberDialog({ leaderId, existingMemberIds }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [errorMsg, setErrorMsg] = useState('')

  // ── Find Existing tab ────────────────────────────────────────────────────────
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [searched, setSearched] = useState(false)

  // ── Create New tab ───────────────────────────────────────────────────────────
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [jobTitle, setJobTitle] = useState('')

  function resetState() {
    setQuery('')
    setResults([])
    setSearched(false)
    setFirstName('')
    setLastName('')
    setJobTitle('')
    setErrorMsg('')
  }

  function handleOpenChange(next: boolean) {
    if (next) resetState()
    setOpen(next)
  }

  // ── Search ───────────────────────────────────────────────────────────────────
  function handleSearch() {
    if (!query.trim()) return
    setErrorMsg('')
    startTransition(async () => {
      const found = await searchUsersAction(query)
      // Exclude the leader themselves and already-linked members
      const filtered = found.filter(
        (r) => r.id !== leaderId && !existingMemberIds.includes(r.id),
      )
      setResults(filtered)
      setSearched(true)
    })
  }

  // ── Link existing ────────────────────────────────────────────────────────────
  function handleLink(memberId: string) {
    setErrorMsg('')
    startTransition(async () => {
      const result = await linkExistingTeamMember(leaderId, existingMemberIds, memberId)
      if ('error' in result) {
        setErrorMsg(result.error)
        return
      }
      setOpen(false)
      router.refresh()
    })
  }

  // ── Create & Link ────────────────────────────────────────────────────────────
  function handleCreate() {
    if (!firstName.trim()) {
      setErrorMsg('First name is required.')
      return
    }
    setErrorMsg('')
    startTransition(async () => {
      const result = await createAndLinkTeamMember(leaderId, existingMemberIds, {
        firstName: firstName.trim(),
        lastName: lastName.trim() || undefined,
        jobTitle: jobTitle.trim() || undefined,
      })
      if ('error' in result) {
        setErrorMsg(result.error)
        return
      }
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <button className="text-xs font-medium text-[hsl(213,70%,30%)] hover:underline">
          + Add Team Member
        </button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Team Member</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="find">
          <TabsList className="w-full mb-4">
            <TabsTrigger value="find" className="flex-1">Find Existing</TabsTrigger>
            <TabsTrigger value="create" className="flex-1">Create New</TabsTrigger>
          </TabsList>

          {/* ── Find Existing ────────────────────────────────────────────── */}
          <TabsContent value="find" className="space-y-3 mt-0">
            <div className="flex gap-2">
              <Input
                placeholder="Search by name…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                disabled={isPending}
              />
              <Button
                variant="outline"
                onClick={handleSearch}
                disabled={isPending || !query.trim()}
                className="flex-shrink-0"
              >
                {isPending ? 'Searching…' : 'Search'}
              </Button>
            </div>

            {searched && results.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-4">
                No matching users found.
              </p>
            )}

            {results.length > 0 && (
              <ul className="divide-y divide-slate-100 rounded-lg border border-slate-100 overflow-hidden max-h-64 overflow-y-auto">
                {results.map((r) => (
                  <li
                    key={r.id}
                    className="flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 transition-colors"
                  >
                    <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center text-xs font-semibold flex-shrink-0 select-none">
                      {getInitials(r.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{r.name}</p>
                      {r.jobTitle && (
                        <p className="text-xs text-slate-400 truncate">{r.jobTitle}</p>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleLink(r.id)}
                      disabled={isPending}
                      className="flex-shrink-0"
                    >
                      Link
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>

          {/* ── Create New ───────────────────────────────────────────────── */}
          <TabsContent value="create" className="space-y-4 mt-0">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="tm-first">First Name <span className="text-rose-400">*</span></Label>
                <Input
                  id="tm-first"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Alex"
                  disabled={isPending}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tm-last">Last Name</Label>
                <Input
                  id="tm-last"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Rivera"
                  disabled={isPending}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tm-title">Title</Label>
              <Input
                id="tm-title"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                placeholder="e.g. Product Manager"
                disabled={isPending}
              />
            </div>
            <div className="flex items-center justify-between pt-1">
              {errorMsg ? (
                <p className="text-xs font-medium text-rose-600">{errorMsg}</p>
              ) : (
                <span />
              )}
              <div className="flex gap-2 ml-auto">
                <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
                  Cancel
                </Button>
                <Button onClick={handleCreate} disabled={isPending || !firstName.trim()}>
                  {isPending ? 'Saving…' : 'Create & Link'}
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Shared error banner for Find Existing tab actions */}
        {errorMsg && results.length > 0 && (
          <p className="text-xs font-medium text-rose-600 -mt-2">{errorMsg}</p>
        )}
      </DialogContent>
    </Dialog>
  )
}
