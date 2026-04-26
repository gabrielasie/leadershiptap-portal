import Link from 'next/link'

export interface UpcomingItem {
  meetingId: string
  providerEventId: string | null
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
  // For participant display in the note panel
  participantEmails: string[]
  hasNote: boolean
}

interface Props {
  items: UpcomingItem[]
}

export default function UpcomingSessionsCard({ items }: Props) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-slate-400">No meetings scheduled in the next 7 days.</p>
    )
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <Link
          key={item.meetingId}
          href={`/sessions/${item.meetingId}`}
          className="flex items-center gap-4 px-4 py-4 min-h-[64px] rounded-lg border border-slate-100 hover:border-slate-200 hover:bg-slate-50 transition-colors"
        >
          {/* Date block */}
          <div className="flex-shrink-0 w-11 text-center">
            <p className="text-[11px] font-bold uppercase tracking-wide text-[hsl(213,70%,30%)]">
              {item.weekday}
            </p>
            <p className="text-2xl font-bold text-slate-900 leading-none mt-0.5">
              {item.day}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">{item.month}</p>
          </div>

          {/* Body */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-900 truncate">
              {item.title || 'Untitled Meeting'}
            </p>
            <p className="text-xs text-slate-400 mt-0.5">{item.timeRange}</p>
            {item.clientName ? (
              <p className="text-xs font-medium text-[hsl(213,70%,30%)] mt-1">
                with {item.clientName}
              </p>
            ) : item.displayLabel ? (
              <p className="text-xs text-slate-400 mt-1">{item.displayLabel}</p>
            ) : (
              <p className="text-xs text-slate-300 italic mt-1">Internal meeting</p>
            )}
          </div>

          {/* Note CTA */}
          <span className="flex-shrink-0 text-xs font-medium text-[hsl(213,70%,40%)] whitespace-nowrap">
            {item.hasNote ? '📝 View Note' : 'Log Note →'}
          </span>
        </Link>
      ))}
    </div>
  )
}
