'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Calendar, ChevronRight, X } from 'lucide-react'

export interface UpcomingItem {
  meetingId: string
  title: string
  startTime: string
  endTime?: string
  weekday: string
  day: number
  month: string
  timeRange: string
  // Matched client
  clientId: string | null
  clientName: string | null
  // Shown when no client matched — already filtered/cleaned
  displayLabel: string | null
  // For the unmatched detail modal
  participantEmails: string[]
  notes?: string
}

function formatTimeRange(startIso: string, endIso?: string): string {
  const fmt = (iso: string) =>
    new Date(iso).toLocaleString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  return endIso ? `${fmt(startIso)} – ${fmt(endIso)}` : fmt(startIso)
}

function formatFullDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  })
}

// ── Unmatched meeting modal ───────────────────────────────────────────────────

function UnmatchedMeetingModal({
  item,
  onClose,
}: {
  item: UpcomingItem
  onClose: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold text-slate-900">{item.title || 'Untitled Meeting'}</h3>
            <p className="text-sm text-slate-500 mt-0.5">{formatFullDate(item.startTime)}</p>
            <p className="text-xs text-slate-400 mt-0.5">{item.timeRange}</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 flex-shrink-0 mt-0.5"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {item.participantEmails.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1.5">
              Participants
            </p>
            <div className="flex flex-wrap gap-1.5">
              {item.participantEmails.map((e) => (
                <span
                  key={e}
                  className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs"
                >
                  {e}
                </span>
              ))}
            </div>
          </div>
        )}

        {item.notes && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1.5">
              Notes
            </p>
            <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed line-clamp-6">
              {item.notes}
            </p>
          </div>
        )}

        <div className="pt-2 border-t border-slate-100">
          {item.clientId ? (
            <Link
              href={`/users/${item.clientId}/sessions/${item.meetingId}`}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-[hsl(213,70%,30%)] hover:underline"
              onClick={onClose}
            >
              Open Full Session
              <ChevronRight className="h-4 w-4" />
            </Link>
          ) : (
            <p className="text-xs text-slate-400">No client profile linked</p>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main card ─────────────────────────────────────────────────────────────────

export default function UpcomingSessionsCard({ items }: { items: UpcomingItem[] }) {
  const [modalItem, setModalItem] = useState<UpcomingItem | null>(null)

  if (items.length === 0) {
    return (
      <p className="text-sm text-slate-400">No meetings scheduled in the next 7 days.</p>
    )
  }

  return (
    <>
      <div className="space-y-3">
        {items.map((item) => {
          const dateBlock = (
            <div className="flex-shrink-0 w-11 text-center">
              <p className="text-[11px] font-bold uppercase tracking-wide text-[hsl(213,70%,30%)]">
                {item.weekday}
              </p>
              <p className="text-2xl font-bold text-slate-900 leading-none mt-0.5">
                {item.day}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">{item.month}</p>
            </div>
          )

          const body = (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-900 truncate">
                {item.title || 'Untitled Meeting'}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">{item.timeRange}</p>
              {item.clientName ? (
                <p className="text-xs font-medium text-[hsl(213,70%,30%)] mt-1">
                  {item.clientName}
                </p>
              ) : item.displayLabel ? (
                <p className="text-xs text-slate-400 mt-1">{item.displayLabel}</p>
              ) : null}
            </div>
          )

          const chevron = (
            <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-slate-500 flex-shrink-0 mt-1 transition-colors" />
          )

          const rowClass =
            'flex items-start gap-4 p-4 rounded-lg border border-slate-100 hover:border-slate-200 hover:bg-slate-50 transition-colors group'

          if (item.clientId) {
            return (
              <Link
                key={item.meetingId}
                href={`/users/${item.clientId}/sessions/${item.meetingId}`}
                className={rowClass}
              >
                {dateBlock}
                {body}
                {chevron}
              </Link>
            )
          }

          return (
            <button
              key={item.meetingId}
              onClick={() => setModalItem(item)}
              className={`${rowClass} w-full text-left`}
            >
              {dateBlock}
              {body}
              {chevron}
            </button>
          )
        })}
      </div>

      {modalItem && (
        <UnmatchedMeetingModal item={modalItem} onClose={() => setModalItem(null)} />
      )}
    </>
  )
}
