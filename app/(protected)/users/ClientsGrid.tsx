'use client'

import { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import { ChevronRight, Plus, Search, Users, X, LayoutGrid, Building2 } from 'lucide-react'
import type { User } from '@/lib/types'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface EnrichedUser {
  user: User
  noteCount: number
  openTaskCount: number
  meetingCount: number  // from user.associatedMeetingIds.length
  lastSession: string | null   // "Mar 12" — most recent past session
  nextSession: string | null   // "May 2"  — nearest upcoming session
}

interface Props {
  users: EnrichedUser[]
  coaches: Array<{ id: string; name: string }>
  companies: Array<{ id: string; name: string }>
}

type ViewMode = 'clients' | 'company'

// ── Helpers ───────────────────────────────────────────────────────────────────

function getDisplayName(user: User): string {
  if (user.fullName) return user.fullName
  if (user.firstName || user.lastName)
    return [user.firstName, user.lastName].filter(Boolean).join(' ')
  return user.preferredName ?? user.email
}

function getInitials(user: User): string {
  if (user.firstName && user.lastName)
    return (user.firstName[0] + user.lastName[0]).toUpperCase()
  if (user.fullName) {
    const parts = user.fullName.trim().split(/\s+/)
    return parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : parts[0][0].toUpperCase()
  }
  return user.email[0].toUpperCase()
}

const AVATAR_COLORS = [
  'bg-blue-100 text-blue-700',
  'bg-violet-100 text-violet-700',
  'bg-emerald-100 text-emerald-700',
  'bg-amber-100 text-amber-700',
  'bg-rose-100 text-rose-700',
  'bg-cyan-100 text-cyan-700',
]

function avatarColor(id: string): string {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]
}

function isRecordId(v: string): boolean {
  return /^rec[A-Za-z0-9]{8,}$/.test(v)
}

// ── Sub-components ────────────────────────────────────────────────────────────

function RoleBadge({ role }: { role: string }) {
  if (!role || isRecordId(role)) return null
  const lower = role.toLowerCase()
  if (lower === 'coach')
    return <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-700 whitespace-nowrap">{role}</span>
  if (lower === 'admin')
    return <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-slate-800 text-white whitespace-nowrap">{role}</span>
  return <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-slate-100 text-slate-500 whitespace-nowrap">{role}</span>
}

function ClientCard({ enriched }: { enriched: EnrichedUser }) {
  const { user, meetingCount, noteCount, openTaskCount, lastSession, nextSession } = enriched
  const name = getDisplayName(user)
  const subtitle = [user.title ?? user.jobTitle, user.companyName].filter(Boolean).join(' · ')
  const role = user.role && !isRecordId(user.role) ? user.role : null

  return (
    <Link
      href={`/users/${user.id}`}
      className="block bg-white rounded-lg shadow-sm p-4 hover:shadow-md transition-shadow"
    >
      <div className="flex items-start gap-3">
        {/* Avatar */}
        {(user.profilePhoto ?? user.avatarUrl) ? (
          <img
            src={(user.profilePhoto ?? user.avatarUrl)!}
            alt={name}
            className="w-11 h-11 rounded-full object-cover flex-shrink-0 mt-0.5"
          />
        ) : (
          <div
            className={`w-11 h-11 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0 mt-0.5 ${avatarColor(user.id)}`}
          >
            {getInitials(user)}
          </div>
        )}

        {/* Info */}
        <div className="flex-1 min-w-0">
          {/* Name row + role badge + chevron */}
          <div className="flex items-center gap-1.5">
            <p className="font-semibold text-slate-900 truncate flex-1 min-w-0">{name}</p>
            {role && <RoleBadge role={role} />}
            <ChevronRight className="h-4 w-4 text-slate-300 flex-shrink-0" />
          </div>

          {/* Subtitle: Title · Company */}
          {subtitle && (
            <p className="text-sm text-slate-500 truncate mt-0.5">{subtitle}</p>
          )}

          {/* Session dates */}
          {(lastSession || nextSession) && (
            <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5">
              {lastSession && (
                <span className="text-xs text-slate-400">
                  Last: <span className="text-slate-600">{lastSession}</span>
                </span>
              )}
              {nextSession && (
                <span className="text-xs text-[hsl(213,70%,40%)] font-medium">
                  Next: {nextSession}
                </span>
              )}
              {lastSession && !nextSession && (
                <span className="text-xs text-slate-300 italic">No upcoming</span>
              )}
            </div>
          )}

          {/* Stats row */}
          {(noteCount > 0 || openTaskCount > 0 || meetingCount > 0) && (
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
              {meetingCount > 0 && (
                <span className="text-xs text-slate-400">{meetingCount} session{meetingCount !== 1 ? 's' : ''}</span>
              )}
              {noteCount > 0 && (
                <>
                  <span className="text-slate-200 text-xs">·</span>
                  <span className="text-xs text-slate-400">{noteCount} note{noteCount !== 1 ? 's' : ''}</span>
                </>
              )}
              {openTaskCount > 0 && (
                <>
                  <span className="text-slate-200 text-xs">·</span>
                  <span className="text-xs text-amber-600 font-medium">{openTaskCount} task{openTaskCount !== 1 ? 's' : ''}</span>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </Link>
  )
}

// ── Select helper ─────────────────────────────────────────────────────────────

function FilterSelect({
  value,
  onChange,
  children,
}: {
  value: string
  onChange: (v: string) => void
  children: React.ReactNode
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-[hsl(213,70%,30%)]/30 focus:border-[hsl(213,70%,30%)] pr-8 appearance-none cursor-pointer"
      style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%2394a3b8\' stroke-width=\'2\'%3E%3Cpolyline points=\'6 9 12 15 18 9\'%3E%3C/polyline%3E%3C/svg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center' }}
    >
      {children}
    </select>
  )
}

// ── View toggle ───────────────────────────────────────────────────────────────

function ViewToggle({ mode, onChange }: { mode: ViewMode; onChange: (m: ViewMode) => void }) {
  return (
    <div className="inline-flex rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
      <button
        onClick={() => onChange('clients')}
        className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors ${
          mode === 'clients'
            ? 'bg-[hsl(213,70%,30%)] text-white'
            : 'text-slate-600 hover:bg-slate-50'
        }`}
      >
        <LayoutGrid className="h-3.5 w-3.5" />
        By Client
      </button>
      <button
        onClick={() => onChange('company')}
        className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors border-l border-slate-200 ${
          mode === 'company'
            ? 'bg-[hsl(213,70%,30%)] text-white'
            : 'text-slate-600 hover:bg-slate-50'
        }`}
      >
        <Building2 className="h-3.5 w-3.5" />
        By Company
      </button>
    </div>
  )
}

// ── Main grid ─────────────────────────────────────────────────────────────────

export default function ClientsGrid({ users, coaches, companies }: Props) {
  const [query, setQuery] = useState('')
  const [selectedRole, setSelectedRole] = useState('all')
  const [selectedCoach, setSelectedCoach] = useState('all')
  const [sortBy, setSortBy] = useState('recent')
  const [viewMode, setViewMode] = useState<ViewMode>('clients')

  // Restore view mode from localStorage after mount
  useEffect(() => {
    const saved = localStorage.getItem('clientsViewMode')
    if (saved === 'clients' || saved === 'company') setViewMode(saved)
  }, [])

  function handleViewModeChange(mode: ViewMode) {
    setViewMode(mode)
    localStorage.setItem('clientsViewMode', mode)
  }

  // Unique roles from data
  const roles = useMemo(() => {
    const found = new Set(
      users.map((e) => e.user.role).filter((r): r is string => !!r && !isRecordId(r))
    )
    return [...found].sort()
  }, [users])

  const hasFilters = query.trim() !== '' || selectedRole !== 'all' || selectedCoach !== 'all'

  const filtered = useMemo(() => {
    let result = [...users]

    // Text search
    if (query.trim()) {
      const q = query.toLowerCase()
      result = result.filter(({ user }) =>
        getDisplayName(user).toLowerCase().includes(q) ||
        (user.companyName ?? '').toLowerCase().includes(q) ||
        (user.workEmail ?? user.email ?? '').toLowerCase().includes(q)
      )
    }

    // Role filter
    if (selectedRole !== 'all') {
      result = result.filter(({ user }) => user.role === selectedRole)
    }

    // Coach filter
    if (selectedCoach !== 'all') {
      result = result.filter(({ user }) => user.coachIds?.includes(selectedCoach))
    }

    // Sort
    if (sortBy === 'name-asc') {
      result.sort((a, b) => getDisplayName(a.user).localeCompare(getDisplayName(b.user)))
    } else if (sortBy === 'name-desc') {
      result.sort((a, b) => getDisplayName(b.user).localeCompare(getDisplayName(a.user)))
    } else {
      result.sort((a, b) => b.meetingCount - a.meetingCount)
    }

    return result
  }, [users, query, selectedRole, selectedCoach, sortBy])

  // Group by company for company view
  const groupedByCompany = useMemo(() => {
    const map = new Map<string, EnrichedUser[]>()
    for (const enriched of filtered) {
      const company = enriched.user.companyName?.trim() || 'Individual'
      if (!map.has(company)) map.set(company, [])
      map.get(company)!.push(enriched)
    }
    return [...map.entries()].sort(([a], [b]) => {
      if (a === 'Individual') return 1
      if (b === 'Individual') return -1
      return a.localeCompare(b)
    })
  }, [filtered])

  function clearFilters() {
    setQuery('')
    setSelectedRole('all')
    setSelectedCoach('all')
    setSortBy('recent')
  }

  return (
    <div className="p-4 md:p-8 space-y-5">

      {/* ── Filter bar ──────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2 items-center">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or company..."
            className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-4 py-2 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-[hsl(213,70%,30%)]/30 focus:border-[hsl(213,70%,30%)]"
          />
        </div>

        {/* Role filter */}
        {roles.length > 1 && (
          <FilterSelect value={selectedRole} onChange={setSelectedRole}>
            <option value="all">All Roles</option>
            {roles.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </FilterSelect>
        )}

        {/* Coach filter */}
        {coaches.length > 1 && (
          <FilterSelect value={selectedCoach} onChange={setSelectedCoach}>
            <option value="all">All Coaches</option>
            {coaches.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </FilterSelect>
        )}

        {/* Sort */}
        <FilterSelect value={sortBy} onChange={setSortBy}>
          <option value="recent">Recently Active</option>
          <option value="name-asc">Name A–Z</option>
          <option value="name-desc">Name Z–A</option>
          <option value="sessions">Most Sessions</option>
        </FilterSelect>

        {/* View toggle */}
        <ViewToggle mode={viewMode} onChange={handleViewModeChange} />

        {/* Add Client button */}
        <Link
          href="/people/new"
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Add Client
        </Link>
      </div>

      {/* ── Grid or empty state ─────────────────────────────────────────────── */}
      {users.length === 0 ? (
        <p className="text-sm text-slate-500">No clients yet.</p>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
            <Users className="h-6 w-6 text-slate-400" />
          </div>
          <p className="text-sm font-medium text-slate-700 mb-1">No clients match your search</p>
          <p className="text-xs text-slate-400 mb-4">Try adjusting your filters</p>
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-[hsl(213,70%,30%)] hover:underline"
            >
              <X className="h-3.5 w-3.5" />
              Clear filters
            </button>
          )}
        </div>
      ) : viewMode === 'company' ? (
        /* ── Company grouped view ─────────────────────────────────────────── */
        <div className="space-y-8">
          {groupedByCompany.map(([company, members]) => (
            <div key={company}>
              <div className="flex items-center gap-2 mb-3">
                <Building2 className="h-4 w-4 text-slate-400 flex-shrink-0" />
                <h3 className="text-sm font-semibold text-slate-700">{company}</h3>
                {members.length > 1 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 text-xs font-medium">
                    {members.length}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {members.map((enriched) => (
                  <ClientCard key={enriched.user.id} enriched={enriched} />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* ── Default flat grid ────────────────────────────────────────────── */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((enriched) => (
            <ClientCard key={enriched.user.id} enriched={enriched} />
          ))}
        </div>
      )}
    </div>
  )
}
