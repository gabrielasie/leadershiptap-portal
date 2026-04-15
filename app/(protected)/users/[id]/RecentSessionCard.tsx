'use client'

import { useState } from 'react'

const NOTES_PREVIEW_CHARS = 300

interface Props {
  notes: string
  actionItems: string | null
}

export default function RecentSessionCard({ notes, actionItems }: Props) {
  const [expanded, setExpanded] = useState(false)

  const needsTruncation = notes.length > NOTES_PREVIEW_CHARS
  const visibleNotes =
    needsTruncation && !expanded ? notes.slice(0, NOTES_PREVIEW_CHARS) + '…' : notes

  return (
    <div className="mt-3 space-y-3">
      {/* Notes */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">
          Session Notes
        </p>
        <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
          {visibleNotes}
        </p>
        {needsTruncation && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="mt-1 text-xs font-medium text-[hsl(213,70%,30%)] hover:underline"
          >
            {expanded ? 'Show less' : 'Show more'}
          </button>
        )}
      </div>

      {/* Action Items */}
      {actionItems && (
        <div className="rounded-lg bg-amber-50 border border-amber-100 px-3 py-2.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-600 mb-1">
            Action Items
          </p>
          <p className="text-sm text-amber-900 whitespace-pre-wrap leading-relaxed">
            {actionItems}
          </p>
        </div>
      )}
    </div>
  )
}
