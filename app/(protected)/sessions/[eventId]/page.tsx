import Link from 'next/link'
import { ArrowLeft, Lock, Users, Eye } from 'lucide-react'
import { getMeetingById } from '@/lib/airtable/meetings'
import { getNotesByMeetingId } from '@/lib/airtable/notes'
import { getCurrentUserRecord } from '@/lib/auth/getCurrentUserRecord'
import { getRelationshipContexts } from '@/lib/airtable/relationships'
import { getPermissionLevel, canWrite } from '@/lib/auth/permissions'
import NoteForm from '../NoteForm'

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

function VisibilityBadge({ value }: { value: string }) {
  if (value === 'shared_with_client') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
        <Eye className="h-3 w-3" />
        Shared with client
      </span>
    )
  }
  if (value === 'internal_only') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
        <Users className="h-3 w-3" />
        Internal
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-500">
      <Lock className="h-3 w-3" />
      Private
    </span>
  )
}

export default async function SessionPage({ params }: Props) {
  const { eventId } = await params

  const userRecord = await getCurrentUserRecord()

  const [meeting, allNotes, contexts] = await Promise.all([
    getMeetingById(eventId),
    getNotesByMeetingId(eventId),
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

  // Resolve client Airtable ID from the matched Relationship Context
  const matchedContext = meeting.relationshipContextId
    ? contexts.find((c) => c.id === meeting.relationshipContextId)
    : null
  const clientAirtableId = matchedContext?.clientAirtableId ?? undefined

  // Permission level relative to this session's client
  const permissionLevel = clientAirtableId
    ? await getPermissionLevel(userRecord.airtableId, userRecord.role, clientAirtableId)
    : userRecord.role === 'admin' ? 'internal_admin' : 'coach_owner'

  const userCanWrite = canWrite(permissionLevel)

  // Read-only users only see notes shared with the client
  const notes = userCanWrite
    ? allNotes
    : allNotes.filter((n) => n.visibility === 'shared_with_client')

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
            {meeting.clientName}
          </p>
        )}
      </div>

      {/* Existing notes */}
      <div className="bg-white rounded-xl shadow-sm p-5 space-y-4">
        <h2 className="text-base font-semibold text-slate-900">
          Notes
          {notes.length > 0 && (
            <span className="ml-2 text-sm font-normal text-slate-400">({notes.length})</span>
          )}
        </h2>

        {notes.length === 0 ? (
          <p className="text-sm text-slate-400">No notes yet — add one below.</p>
        ) : (
          <div className="space-y-4">
            {notes.map((note) => (
              <div key={note.id} className="border border-slate-100 rounded-lg p-4 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-slate-400">
                    {note.createdDate
                      ? new Date(note.createdDate + 'T12:00:00').toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })
                      : ''}
                  </p>
                  <VisibilityBadge value={note.visibility} />
                </div>
                <p className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">
                  {note.body}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add note form — only for coaches and admins */}
      {userCanWrite && (
        <div className="bg-white rounded-xl shadow-sm p-5">
          <h2 className="text-base font-semibold text-slate-900 mb-4">Add a Note</h2>
          <NoteForm
            eventId={eventId}
            clientAirtableId={clientAirtableId}
          />
        </div>
      )}

    </div>
  )
}
