import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getUserById } from '@/lib/services/usersService'
import { getMeetingDetail } from '@/lib/services/meetingsService'
import { getMeetingMessages } from '@/lib/services/messagesService'
import NotesEditor from '@/components/NotesEditor'
import FollowUpSection from '@/components/FollowUpSection'
import { saveNotes, createDraft, updateDraft, markSent } from './actions'

interface Props {
  params: Promise<{ id: string; meetingId: string }>
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export default async function MeetingDetailPage({ params }: Props) {
  const { id, meetingId } = await params
  const [user, meeting, messages] = await Promise.all([
    getUserById(id),
    getMeetingDetail(meetingId),
    getMeetingMessages(meetingId),
  ])

  if (!meeting) notFound()

  const userName = user?.preferredName ?? user?.firstName ?? user?.fullName ?? 'User'
  const existingMessage = messages[0] ?? null

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-8">
      {/* Back link */}
      <Link
        href={`/users/${id}`}
        className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
      >
        ← Back to {userName}
      </Link>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">{meeting.title || 'Untitled Event'}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {formatDateTime(meeting.startTime)}
          {meeting.endTime && ` — ${formatDateTime(meeting.endTime)}`}
        </p>
      </div>

      {/* Participants */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
          Participants
        </h2>
        {meeting.participantEmails.length > 0 ? (
          <ul className="space-y-1">
            {meeting.participantEmails.map((email) => (
              <li key={email} className="text-sm">{email}</li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No participants listed.</p>
        )}
        {meeting.senderEmail && (
          <p className="text-xs text-muted-foreground mt-2">
            Organiser: {meeting.senderEmail}
          </p>
        )}
      </section>

      {/* Notes & Transcript */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
          Notes &amp; Transcript
        </h2>
        <NotesEditor
          meetingId={meetingId}
          userId={id}
          initialNotes={meeting.notes}
          saveAction={saveNotes}
        />
      </section>

      {/* Follow-up Message */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
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
          updateAction={updateDraft}
          markSentAction={markSent}
        />
      </section>
    </div>
  )
}
