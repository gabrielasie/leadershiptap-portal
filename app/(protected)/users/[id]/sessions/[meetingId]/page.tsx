import Link from 'next/link'
import { ArrowLeft, Calendar, Clock, Users, CheckSquare } from 'lucide-react'
import { notFound } from 'next/navigation'
import { getUserById } from '@/lib/services/usersService'
import { getMeetingById } from '@/lib/airtable/meetings'
import SessionNotesEditor from './SessionNotesEditor'

interface Props {
  params: Promise<{ id: string; meetingId: string }>
}

function formatDateTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

const SESSION_STATUS_STYLES: Record<string, string> = {
  Completed:  'bg-emerald-50 text-emerald-700 border-emerald-200',
  Scheduled:  'bg-blue-50 text-blue-700 border-blue-200',
  Cancelled:  'bg-rose-50 text-rose-700 border-rose-200',
}

export default async function SessionDetailPage({ params }: Props) {
  const { id, meetingId } = await params

  const [user, meeting] = await Promise.all([
    getUserById(id),
    getMeetingById(meetingId),
  ])

  if (!meeting) notFound()

  const userName = user?.fullName ?? user?.preferredName ?? user?.firstName ?? 'Client'

  const dateLabel = meeting.endTime
    ? `${formatDateTime(meeting.startTime)} – ${formatTime(meeting.endTime)}`
    : formatDateTime(meeting.startTime)

  const statusStyle = meeting.sessionStatus
    ? (SESSION_STATUS_STYLES[meeting.sessionStatus] ?? 'bg-slate-100 text-slate-600 border-slate-200')
    : null

  return (
    <div className="px-4 py-5 md:p-8 max-w-3xl mx-auto space-y-6">

      {/* Back link */}
      <Link
        href={`/users/${id}`}
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to {userName}
      </Link>

      {/* Session header */}
      <div className="bg-white rounded-xl shadow-sm p-5 md:p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <h1 className="text-xl font-bold text-slate-900 leading-snug">
            {meeting.title || 'Untitled Session'}
          </h1>
          {meeting.sessionStatus && statusStyle && (
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border flex-shrink-0 ${statusStyle}`}>
              {meeting.sessionStatus}
            </span>
          )}
        </div>

        <div className="mt-4 space-y-2">
          <div className="flex items-start gap-2 text-sm text-slate-600">
            <Calendar className="h-4 w-4 text-slate-400 flex-shrink-0 mt-0.5" />
            <span>{dateLabel}</span>
          </div>

          {meeting.participantEmails.length > 0 && (
            <div className="flex items-start gap-2 text-sm text-slate-600">
              <Users className="h-4 w-4 text-slate-400 flex-shrink-0 mt-0.5" />
              <div className="flex flex-wrap gap-1.5">
                {meeting.participantEmails.map((email) => (
                  <span
                    key={email}
                    className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs"
                  >
                    {email}
                  </span>
                ))}
              </div>
            </div>
          )}

          {meeting.senderEmail && (
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Clock className="h-3.5 w-3.5 flex-shrink-0" />
              Organised by {meeting.senderEmail}
            </div>
          )}
        </div>
      </div>

      {/* Session Notes */}
      <div className="bg-white rounded-xl shadow-sm p-5 md:p-6">
        <SessionNotesEditor meetingId={meetingId} initialNotes={meeting.notes} />
      </div>

      {/* Action Items */}
      {meeting.actionItems && (
        <div className="bg-white rounded-xl shadow-sm p-5 md:p-6">
          <div className="flex items-center gap-2 mb-3">
            <CheckSquare className="h-4 w-4 text-amber-500" />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
              Action Items
            </h2>
          </div>
          <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
            {meeting.actionItems}
          </p>
        </div>
      )}

    </div>
  )
}
