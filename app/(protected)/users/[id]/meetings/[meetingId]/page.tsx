import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { notFound } from 'next/navigation'
import { getUserById } from '@/lib/services/usersService'
import { getMeetingDetail } from '@/lib/services/meetingsService'
import { getMeetingMessages } from '@/lib/services/messagesService'
import NotesEditor from '@/components/NotesEditor'
import FollowUpSection from '@/components/FollowUpSection'
import { formatEastern } from '@/lib/utils/dateFormat'
import { saveNotes, createDraft, updateDraft, markSent } from './actions'

interface Props {
  params: Promise<{ id: string; meetingId: string }>
}

function formatDateTime(iso: string, timezone: string = 'America/New_York'): string {
  return formatEastern(iso, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }, timezone)
}

export default async function MeetingDetailPage({ params }: Props) {
  const { id, meetingId } = await params
  const [user, meeting, messages] = await Promise.all([
    getUserById(id),
    getMeetingDetail(meetingId),
    getMeetingMessages(meetingId),
  ])

  if (!meeting) notFound()

  const userName = user?.fullName ?? user?.preferredName ?? user?.firstName ?? 'User'
  const existingMessage = messages[0] ?? null

  const tz = meeting.timezone || 'America/New_York'
  const formattedDate = meeting.endTime
    ? `${formatDateTime(meeting.startTime, tz)} – ${formatEastern(meeting.endTime, { hour: 'numeric', minute: '2-digit', hour12: true }, tz)} ET`
    : `${formatDateTime(meeting.startTime, tz)} ET`

  return (
    <div className="p-8 max-w-3xl mx-auto">
      {/* Back link */}
      <Link
        href={`/users/${id}`}
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to {userName}
      </Link>

      {/* Meeting header card */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h1 className="text-xl font-bold text-gray-900">{meeting.title || 'Untitled Event'}</h1>
        <p className="text-sm text-gray-500 mt-1">{formattedDate}</p>
        {/* Participant chips */}
        {meeting.participantEmails.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-4">
            {meeting.participantEmails.map((email) => (
              <span
                key={email}
                className="inline-flex items-center px-2.5 py-1 rounded-full bg-gray-100 text-gray-700 text-xs"
              >
                {email}
              </span>
            ))}
          </div>
        )}
        {meeting.senderEmail && (
          <p className="text-xs text-gray-400 mt-3">Organiser: {meeting.senderEmail}</p>
        )}
      </div>

      {/* Notes section */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">
          Notes &amp; Transcript
        </h2>
        <NotesEditor
          meetingId={meetingId}
          userId={id}
          initialNotes={meeting.notes}
          saveAction={saveNotes}
        />
      </div>

      {/* Follow-up Message section */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">
          Follow-up Message
        </h2>
        <FollowUpSection
          initialMessage={existingMessage}
          userId={id}
          meetingId={meetingId}
          eventName={meeting.title}
          startTime={meeting.startTime}
          participantEmails={meeting.participantEmails}
          createAction={createDraft}
          updateDraftAction={updateDraft}
          markSentAction={markSent}
        />
      </div>
    </div>
  )
}
