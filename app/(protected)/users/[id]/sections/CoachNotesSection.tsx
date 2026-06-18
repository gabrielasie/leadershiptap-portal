'use client'

import { useMemo, useState } from 'react'
import { BookOpen, Search, X } from 'lucide-react'
import NoteItem from '../NoteItem'
import type { Note } from '@/lib/types'

interface Props {
  sessionNotes: Note[]
  userCanWrite: boolean
}

/**
 * Coach Notes section on the client profile. Lists every note where this
 * person is the subject. The search box filters by substring match against
 * the note body. Filter + type chip can both be active simultaneously (an
 * AND).
 */
export default function CoachNotesSection({ sessionNotes, userCanWrite }: Props) {
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | 'general_context' | 'meeting_note'>('all')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return sessionNotes.filter((note) => {
      if (typeFilter !== 'all' && note.noteType !== typeFilter) return false
      if (!q) return true
      return note.content.toLowerCase().includes(q)
    })
  }, [sessionNotes, query, typeFilter])

  if (!userCanWrite) return null

  const hasAny = sessionNotes.length > 0

  return (
    <div className="bg-white rounded-xl shadow-sm p-4 md:p-6">
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <BookOpen className="h-5 w-5 text-slate-400" />
        <h2 className="text-lg font-semibold text-slate-900">Notes</h2>
        {hasAny && (
          <span className="text-xs text-slate-400 font-medium">
            {filtered.length} of {sessionNotes.length}
          </span>
        )}
      </div>

      {hasAny && (
        <div className="space-y-2 mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search notes…"
              className="w-full pl-9 pr-9 py-2 text-sm rounded-md border border-slate-200 focus:outline-none focus:ring-1 focus:ring-[hsl(213,70%,30%)] focus:border-[hsl(213,70%,30%)] placeholder:text-slate-400"
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

          <div className="flex items-center gap-1.5 flex-wrap">
            {(
              [
                { key: 'all', label: 'All' },
                { key: 'general_context', label: 'Context' },
                { key: 'meeting_note', label: 'Meeting' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.key}
                onClick={() => setTypeFilter(opt.key)}
                className={`text-xs font-medium px-2.5 py-1 rounded-full border transition-colors ${
                  typeFilter === opt.key
                    ? 'border-[hsl(213,70%,30%)] bg-[hsl(213,60%,94%)] text-[hsl(213,70%,30%)]'
                    : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {!hasAny ? (
        <p className="text-sm text-slate-400">No notes yet — use the Log a Note button above.</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-slate-400 italic">No notes match this filter.</p>
      ) : (
        <div className="space-y-3">
          {filtered.map((note) => (
            <NoteItem key={note.id} note={note} />
          ))}
        </div>
      )}
    </div>
  )
}
