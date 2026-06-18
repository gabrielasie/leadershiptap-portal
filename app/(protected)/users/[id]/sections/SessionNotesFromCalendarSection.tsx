import { BookOpen } from 'lucide-react'
import { SectionHeading } from './helpers'
import { formatEastern } from '@/lib/utils/dateFormat'
import type { Meeting } from '@/lib/types'

interface Props {
  portalSessionEvents: Meeting[]
}

export default function SessionNotesFromCalendarSection({ portalSessionEvents }: Props) {
  if (portalSessionEvents.length === 0) return null

  return (
    <div className="bg-white rounded-xl shadow-sm p-4 md:p-6">
      <SectionHeading icon={BookOpen} title="Session Notes (from Calendar)" />
      <div className="space-y-3">
        {portalSessionEvents.map((event) => (
          <div
            key={event.id}
            className="border border-slate-100 rounded-lg p-4 space-y-2"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-medium text-slate-900">{event.title || 'Untitled Session'}</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {formatEastern(event.startTime, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }, event.timezone)}
                </p>
              </div>
            </div>
            {event.notes ? (
              <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                {event.notes}
              </p>
            ) : (
              <p className="text-xs text-slate-300 italic">No notes yet</p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
