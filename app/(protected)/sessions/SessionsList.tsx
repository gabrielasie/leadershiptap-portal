'use client'

import { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import { Search, ChevronRight, FileText, Calendar, X } from 'lucide-react'
import type { UpcomingItem } from '../dashboard/UpcomingSessionsCard'

type Filter = 'needs-notes' | 'upcoming' | 'past' | 'all'

interface ListItem extends UpcomingItem {
  /** ms since epoch for sort */
  startMs: number
  isPast: boolean
}

const FILTER_LABELS: { key: Filter; label: string }[] = [
  { key: 'needs-notes', label: 'Needs Notes' },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'past', label: 'Past' },
  { key: 'all', label: 'All' },
]

const EMPTY_COPY: Record<Filter, { title: string; message: string }> = {
  'needs-notes': {
    title: 'All caught up.',
    message: 'No past sessions are missing notes.',
  },
  upcoming: {
    title: 'Nothing on the calendar.',
    message: 'No upcoming sessions in the next 60 days.',
  },
  past: {
    title: 'No past sessions yet.',
    message: 'Sessions you have already had will show up here.',
  },
  all: {
    title: 'No sessions found.',
    message: 'Try a different filter or run a calendar sync from Settings.',
  },
}

function formatRowDate(item: ListItem): string {
  return `${item.weekday} ${item.month} ${item.day}`
}

function groupByMonth(items: ListItem[]): { label: string; rows: ListItem[] }[] {
  const groups: Map<string, ListItem[]> = new Map()
  for (const item of items) {
    const d = new Date(item.startMs)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = d.toLocaleString('en-US', { month: 'long', year: 'numeric' })
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(item)
    // Use label as a side-channel via a parallel Map, but simpler: store on first push
    ;(groups as unknown as { _labels?: Map<string, string> })._labels ??= new Map()
    ;(groups as unknown as { _labels?: Map<string, string> })._labels!.set(key, label)
  }
  const labelMap = (groups as unknown as { _labels?: Map<string, string> })._labels ?? new Map()
  return [...groups.entries()].map(([key, rows]) => ({
    label: labelMap.get(key) ?? key,
    rows,
  }))
}

interface Props {
  items: ListItem[]
  initialFilter: Filter
}

export default function SessionsList({ items, initialFilter }: Props) {
  const [filter, setFilter] = useState<Filter>(initialFilter)
  const [query, setQuery] = useState('')

  // Update URL when filter changes (without navigation)
  useEffect(() => {
    const url = new URL(window.location.href)
    if (filter === 'needs-notes') url.searchParams.delete('filter')
    else url.searchParams.set('filter', filter)
    window.history.replaceState({}, '', url.toString())
  }, [filter])

  const counts = useMemo(() => {
    const all = items.length
    const upcoming = items.filter((i) => !i.isPast).length
    const past = items.filter((i) => i.isPast).length
    const needsNotes = items.filter((i) => i.isPast && !i.hasNote).length
    return { all, upcoming, past, 'needs-notes': needsNotes }
  }, [items])

  const filtered = useMemo(() => {
    let result = items
    if (filter === 'needs-notes') {
      result = result.filter((i) => i.isPast && !i.hasNote)
    } else if (filter === 'upcoming') {
      result = result.filter((i) => !i.isPast)
    } else if (filter === 'past') {
      result = result.filter((i) => i.isPast)
    }
    if (query.trim()) {
      const q = query.toLowerCase()
      result = result.filter(
        (i) =>
          (i.clientName ?? '').toLowerCase().includes(q) ||
          (i.title ?? '').toLowerCase().includes(q) ||
          (i.displayLabel ?? '').toLowerCase().includes(q),
      )
    }
    // Sort: upcoming asc (soonest first), past desc (most recent first), all by abs distance from now? Use simple desc.
    if (filter === 'upcoming') {
      result = [...result].sort((a, b) => a.startMs - b.startMs)
    } else {
      result = [...result].sort((a, b) => b.startMs - a.startMs)
    }
    return result
  }, [items, filter, query])

  const grouped = useMemo(() => groupByMonth(filtered), [filtered])
  const empty = EMPTY_COPY[filter]

  return (
    <div className="space-y-5">
      {/* Filter + search bar */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
        <div className="flex gap-1.5 overflow-x-auto scrollbar-none">
          {FILTER_LABELS.map(({ key, label }) => {
            const count = counts[key]
            const active = filter === key
            return (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                  active
                    ? 'bg-slate-800 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {label}
                {count > 0 && (
                  <span className={`ml-1.5 text-xs ${active ? 'text-slate-300' : 'text-slate-400'}`}>
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        <div className="relative sm:ml-auto sm:max-w-xs sm:flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by client or title…"
            className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-9 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[hsl(213,70%,30%)]/30 focus:border-[hsl(213,70%,30%)]"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Results */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-10 text-center">
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
            <Calendar className="h-6 w-6 text-slate-400" />
          </div>
          <p className="text-sm font-medium text-slate-700 mb-1">{empty.title}</p>
          <p className="text-xs text-slate-400">{empty.message}</p>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(({ label, rows }) => (
            <div key={label}>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2 px-1">
                {label}
              </p>
              <ul className="bg-white rounded-xl shadow-sm divide-y divide-slate-100 overflow-hidden">
                {rows.map((item) => {
                  const subjectName = item.clientName ?? item.displayLabel ?? 'Unknown'
                  const needsNotes = item.isPast && !item.hasNote
                  const href = item.clientId
                    ? `/users/${item.clientId}/sessions/${item.meetingId}`
                    : `/sessions/${item.meetingId}`
                  return (
                    <li key={item.meetingId}>
                      <Link
                        href={href}
                        className="flex items-center gap-3 py-3 px-4 hover:bg-slate-50 transition-colors group"
                      >
                        <div className="text-xs font-medium text-slate-400 w-20 flex-shrink-0">
                          {formatRowDate(item)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-900 truncate">
                            {subjectName}
                            {item.title && (
                              <span className="text-slate-400 font-normal">
                                {' · '}
                                {item.title}
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-slate-400 mt-0.5">{item.timeRange}</p>
                        </div>
                        {needsNotes ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full whitespace-nowrap">
                            <FileText className="h-3 w-3" />
                            Add notes
                          </span>
                        ) : item.hasNote ? (
                          <span className="text-xs text-slate-400 whitespace-nowrap">
                            Noted
                          </span>
                        ) : null}
                        <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-slate-500 flex-shrink-0" />
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
