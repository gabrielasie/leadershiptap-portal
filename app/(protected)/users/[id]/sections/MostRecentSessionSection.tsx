import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import MostRecentSessionNotes from '../MostRecentSessionNotes'
import { formatEastern } from '@/lib/utils/dateFormat'
import type { Meeting, Note } from '@/lib/types'

interface Props {
  lastMeeting: Meeting | null
  lastMeetingNotes: Note[]
  recentMeetings: Meeting[]
  userId: string
}

export default function MostRecentSessionSection({
  lastMeeting,
  lastMeetingNotes,
  recentMeetings,
  userId,
}: Props) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-4 md:p-6 space-y-5">
      <MostRecentSessionNotes
        meeting={lastMeeting}
        userId={userId}
        meetingNotes={lastMeetingNotes}
      />

      {recentMeetings.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
            Past Sessions
            <span className="text-xs font-normal text-slate-400">
              ({recentMeetings.length} more)
            </span>
          </h3>
          <div className="space-y-2">
            {recentMeetings.slice(0, 5).map((m) => (
              <Link
                key={m.id}
                href={`/users/${userId}/sessions/${m.id}`}
                className="flex items-center justify-between p-3 border border-slate-100 rounded-lg hover:bg-slate-50 transition-colors group"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">{m.title || 'Untitled Meeting'}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {formatEastern(m.startTime, { month: 'short', day: 'numeric', year: 'numeric' }, m.timezone)}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {m.notes && (
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                      Has notes
                    </span>
                  )}
                  <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-slate-500 transition-colors" />
                </div>
              </Link>
            ))}
          </div>
          {recentMeetings.length > 5 && (
            <Link
              href={`/users/${userId}/sessions`}
              className="text-sm text-blue-600 hover:underline mt-3 block"
            >
              View all {recentMeetings.length + 1} sessions →
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
