import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { getMeetingById } from '@/lib/airtable/meetings'
import { getCurrentUserRecord } from '@/lib/auth/getCurrentUserRecord'
import { getRelationshipContexts } from '@/lib/airtable/relationships'
import { getSessionNoteByEventId } from '@/lib/airtable/sessionNotes'
import { getPermissionLevel, canWrite } from '@/lib/auth/permissions'
import SessionNoteForm from './SessionNoteForm'

interface Props {
  params: Promise<{ eventId: string }>
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

export default async function SessionPage({ params }: Props) {
  const { eventId } = await params

  const userRecord = await getCurrentUserRecord()

  const [meeting, contexts] = await Promise.all([
    getMeetingById(eventId),
    userRecord.airtableId
      ? getRelationshipContexts(userRecord.airtableId)
      : Promise.resolve([]),
  ])

  if (!meeting) {
    return (
      <div className="px-4 py-8 max-w-2xl mx-auto">
        <p className="text-slate-500">Session not found.</p>
      </div>
    )
  }

  // Resolve the client from the matched Relationship Context
  const matchedContext = meeting.relationshipContextId
    ? contexts.find((c) => c.id === meeting.relationshipContextId)
    : null
  const clientAirtableId = matchedContext?.clientAirtableId ?? undefined

  // Permission level for this session's client
  const permissionLevel = clientAirtableId
    ? await getPermissionLevel(userRecord.airtableId, userRecord.role, clientAirtableId)
    : userRecord.role === 'admin' ? 'internal_admin' : 'coach_owner'

  const userCanWrite = canWrite(permissionLevel)

  // Fetch the session note for this event (scoped to this coach)
  const existingNote =
    meeting.providerEventId && userRecord.airtableId
      ? await getSessionNoteByEventId(meeting.providerEventId, userRecord.airtableId)
      : null

  const sessionDate = meeting.startTime
    ? meeting.startTime.slice(0, 10)
    : new Date().toISOString().slice(0, 10)

  return (
    <div className="px-4 py-5 md:p-8 max-w-2xl mx-auto space-y-6">

      {/* Back */}
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Dashboard
      </Link>

      {/* Event header */}
      <div className="bg-white rounded-xl shadow-sm p-5 space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-[hsl(213,70%,40%)]">
          Session
        </p>
        <h1 className="text-xl font-bold text-slate-900 leading-snug">
          {meeting.title || 'Untitled Meeting'}
        </h1>
        {meeting.startTime && (
          <p className="text-sm text-slate-500">{formatDateTime(meeting.startTime)}</p>
        )}
        {meeting.clientName && (
          <p className="text-sm font-medium text-[hsl(213,70%,30%)] mt-1">
            with {meeting.clientName}
          </p>
        )}
      </div>

      {/* Session note — create or edit */}
      <div className="bg-white rounded-xl shadow-sm p-5">
        <h2 className="text-base font-semibold text-slate-900 mb-1">
          {existingNote ? 'Session Note' : 'Add a Session Note'}
        </h2>
        {existingNote && (
          <p className="text-xs text-slate-400 mb-5">
            Last updated{' '}
            {existingNote.sessionDate
              ? new Date(existingNote.sessionDate + 'T12:00:00').toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })
              : ''}
          </p>
        )}

        {userCanWrite ? (
          <SessionNoteForm
            eventProviderId={meeting.providerEventId ?? eventId}
            clientAirtableId={clientAirtableId}
            sessionDate={sessionDate}
            existingNote={existingNote ?? undefined}
          />
        ) : existingNote ? (
          // Read-only view for non-coaches
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-900">{existingNote.title}</h3>
            <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
              {existingNote.content}
            </p>
          </div>
        ) : (
          <p className="text-sm text-slate-400">No session note yet.</p>
        )}
      </div>

    </div>
  )
}
