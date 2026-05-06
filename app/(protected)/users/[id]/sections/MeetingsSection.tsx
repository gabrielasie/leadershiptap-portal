import Link from 'next/link'
import { Calendar, ChevronRight } from 'lucide-react'
import RecentSessionCard from '../RecentSessionCard'
import { formatMeetingDate, formatMeetingDay, relativeDays } from './helpers'
import type { Meeting } from '@/lib/types'

interface Props {
  nextMeeting: Meeting | null
  lastMeeting: Meeting | null
  recentMeetings: Meeting[]
  allMeetings: number
  userId: string
}

export default function MeetingsSection({
  nextMeeting,
  lastMeeting,
  recentMeetings,
  allMeetings,
  userId,
}: Props) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-4 md:p-6">
      <div className="flex items-center gap-2 mb-5">
        <Calendar className="h-5 w-5 text-slate-400" />
        <h2 className="text-lg font-semibold text-slate-900">Meetings</h2>
        {allMeetings > 0 && (
          <span className="ml-auto text-xs text-slate-400">{allMeetings} total</span>
        )}
      </div>

      {allMeetings === 0 ? (
        <p className="text-sm text-slate-400">No meetings recorded yet.</p>
      ) : (
        <div className="space-y-6">

          {/* NEXT SESSION */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
              Next Session
            </p>
            {nextMeeting ? (() => {
              const { weekday, day, month, time } = formatMeetingDay(nextMeeting.startTime, nextMeeting.timezone)
              const label = relativeDays(nextMeeting.startTime)
              return (
                <Link
                  href={`/users/${userId}/sessions/${nextMeeting.id}`}
                  className="flex items-start gap-4 p-4 rounded-xl border-2 border-[hsl(213,60%,90%)] bg-[hsl(213,60%,97%)] hover:bg-[hsl(213,60%,95%)] transition-colors group"
                >
                  <div className="flex-shrink-0 w-12 text-center bg-[hsl(213,70%,30%)] text-white rounded-lg py-2 px-1">
                    <p className="text-[10px] font-bold uppercase tracking-wide opacity-80">{weekday}</p>
                    <p className="text-2xl font-bold leading-none mt-0.5">{day}</p>
                    <p className="text-[10px] opacity-80 mt-0.5">{month}</p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-900 truncate">
                      {nextMeeting.title || 'Untitled Meeting'}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">{time}</p>
                    <span className="mt-2 inline-block text-xs font-semibold text-[hsl(213,70%,30%)] bg-[hsl(213,60%,90%)] px-2 py-0.5 rounded-full">
                      {label}
                    </span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-[hsl(213,70%,50%)] group-hover:text-[hsl(213,70%,30%)] flex-shrink-0 mt-1 transition-colors" />
                </Link>
              )
            })() : (
              <p className="text-sm text-slate-400 pl-1">No upcoming sessions scheduled.</p>
            )}
          </div>

          {/* LAST SESSION */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
              Last Session
            </p>
            {lastMeeting ? (() => {
              const { weekday, day, month, time } = formatMeetingDay(lastMeeting.startTime, lastMeeting.timezone)
              const label = relativeDays(lastMeeting.startTime)
              return (
                <div className="rounded-xl border border-slate-200 bg-slate-50 overflow-hidden">
                  <Link
                    href={`/users/${userId}/sessions/${lastMeeting.id}`}
                    className="flex items-start gap-4 p-4 hover:bg-slate-100 transition-colors group"
                  >
                    <div className="flex-shrink-0 w-12 text-center bg-slate-200 text-slate-600 rounded-lg py-2 px-1">
                      <p className="text-[10px] font-bold uppercase tracking-wide">{weekday}</p>
                      <p className="text-2xl font-bold leading-none mt-0.5">{day}</p>
                      <p className="text-[10px] mt-0.5">{month}</p>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-800 truncate">
                        {lastMeeting.title || 'Untitled Meeting'}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">{time}</p>
                      <span className="mt-2 inline-block text-xs font-medium text-slate-500 bg-slate-200 px-2 py-0.5 rounded-full">
                        {label}
                      </span>
                    </div>
                    <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-slate-500 flex-shrink-0 mt-1 transition-colors" />
                  </Link>
                  {(lastMeeting.notes || lastMeeting.actionItems) && (
                    <div className="px-4 pb-4 border-t border-slate-100">
                      <RecentSessionCard
                        notes={lastMeeting.notes ?? ''}
                        actionItems={lastMeeting.actionItems ?? null}
                      />
                    </div>
                  )}
                </div>
              )
            })() : (
              <p className="text-sm text-slate-400 pl-1">No past sessions.</p>
            )}
          </div>

          {/* PAST SESSIONS */}
          {recentMeetings.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
                Past Sessions
              </p>
              <div className="rounded-lg border border-slate-100 overflow-hidden">
                {recentMeetings.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-start gap-3 px-4 py-3 border-b border-slate-100 last:border-0"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">
                        {m.title || 'Untitled Meeting'}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <p className="text-xs text-slate-400">{formatMeetingDate(m.startTime)}</p>
                        {m.sessionStatus && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide bg-slate-100 text-slate-500 border border-slate-200">
                            {m.sessionStatus}
                          </span>
                        )}
                      </div>
                      {m.notes ? (
                        <p className="text-xs text-slate-400 mt-1 line-clamp-1">{m.notes}</p>
                      ) : (
                        <p className="text-xs text-slate-300 mt-1 italic">No notes</p>
                      )}
                    </div>
                    <Link
                      href={`/users/${userId}/sessions/${m.id}`}
                      className="flex-shrink-0 mt-0.5 text-xs font-medium text-[hsl(213,70%,30%)] hover:underline whitespace-nowrap"
                    >
                      View Full Notes
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  )
}
