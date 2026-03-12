import Link from 'next/link'
import { Calendar } from 'lucide-react'
import { getMeetings } from '@/lib/services/meetingsService'
import type { Meeting } from '@/lib/types'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

function formatMeetingTime(startIso: string, endIso?: string): string {
  const start = new Date(startIso)
  const weekday = start.toLocaleString('en-GB', { weekday: 'short' })
  const day = start.getDate()
  const month = start.toLocaleString('en-GB', { month: 'short' })
  const startTime = start.toLocaleString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })

  if (endIso) {
    const endTime = new Date(endIso).toLocaleString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })
    return `${weekday} ${day} ${month}, ${startTime}–${endTime}`
  }
  return `${weekday} ${day} ${month}, ${startTime}`
}

function MeetingRow({ meeting, upcoming }: { meeting: Meeting; upcoming: boolean }) {
  const firstParticipant = meeting.participantEmails[0]
  const extraCount = meeting.participantEmails.length - 1

  return (
    <Link
      href={`/meetings/${meeting.id}`}
      className={`flex items-center gap-4 px-5 py-4 border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors group ${
        upcoming ? 'border-l-2 border-l-emerald-400' : ''
      }`}
    >
      {/* Date block */}
      <div className="flex-shrink-0 w-14 text-center">
        <div className="text-xs font-medium text-gray-400 uppercase">
          {new Date(meeting.startTime).toLocaleString('en-GB', { month: 'short' })}
        </div>
        <div className={`text-2xl font-bold leading-none ${upcoming ? 'text-gray-900' : 'text-gray-400'}`}>
          {new Date(meeting.startTime).getDate()}
        </div>
      </div>

      {/* Divider */}
      <div className="w-px h-10 bg-gray-200 flex-shrink-0" />

      {/* Main content */}
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold truncate ${upcoming ? 'text-gray-900' : 'text-gray-500'}`}>
          {meeting.title || 'Untitled Event'}
        </p>
        <p className="text-xs text-gray-400 mt-0.5">
          {formatMeetingTime(meeting.startTime, meeting.endTime)}
        </p>
      </div>

      {/* Participants */}
      <div className="hidden sm:block flex-shrink-0 text-right">
        {firstParticipant ? (
          <p className="text-xs text-gray-400 truncate max-w-[160px]">
            {firstParticipant}
            {extraCount > 0 && <span className="ml-1 text-gray-300">+{extraCount}</span>}
          </p>
        ) : (
          <p className="text-xs text-gray-300">No participants</p>
        )}
      </div>

      {/* Arrow */}
      <span className="flex-shrink-0 text-gray-300 group-hover:text-indigo-500 transition-colors text-sm ml-2">→</span>
    </Link>
  )
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 py-16 text-center">
      <Calendar className="mx-auto h-10 w-10 text-gray-200 mb-3" />
      <p className="text-sm font-medium text-gray-400">{label}</p>
    </div>
  )
}

function MeetingList({ meetings, upcoming }: { meetings: Meeting[]; upcoming: boolean }) {
  if (meetings.length === 0) {
    return <EmptyState label={upcoming ? 'No upcoming meetings.' : 'No past meetings.'} />
  }
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {meetings.map((m) => (
        <MeetingRow key={m.id} meeting={m} upcoming={upcoming} />
      ))}
    </div>
  )
}

export default async function MeetingsPage() {
  const { upcoming, past } = await getMeetings()

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Meetings</h1>
        <p className="text-sm text-gray-500 mt-1">Your coaching sessions</p>
      </div>

      <Tabs defaultValue="upcoming">
        <TabsList className="bg-gray-100 rounded-lg p-1 mb-5">
          <TabsTrigger value="upcoming" className="rounded-md text-sm">
            Upcoming
            {upcoming.length > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-medium">
                {upcoming.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="past" className="rounded-md text-sm">
            Past
            {past.length > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-gray-200 text-gray-600 text-xs font-medium">
                {past.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upcoming">
          <MeetingList meetings={upcoming} upcoming={true} />
        </TabsContent>
        <TabsContent value="past">
          <MeetingList meetings={past} upcoming={false} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
