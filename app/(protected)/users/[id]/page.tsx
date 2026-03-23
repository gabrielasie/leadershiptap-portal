import Link from 'next/link'
import {
  Mail,
  ArrowLeft,
  Calendar,
  ChevronRight,
  FileText,
  MessageSquare,
  CheckSquare,
  Paperclip,
} from 'lucide-react'
import { getUserById } from '@/lib/services/usersService'
import { getMeetingsForUser } from '@/lib/services/meetingsService'
import { getUserMessages } from '@/lib/services/messagesService'
import PlaceholderSection from '@/components/ui/PlaceholderSection'
import type { User, Meeting, Message } from '@/lib/types'

interface Props {
  params: Promise<{ id: string }>
}

// ── helpers ──────────────────────────────────────────────────────────────────

function getDisplayName(user: User): string {
  if (user.fullName) return user.fullName
  if (user.firstName || user.lastName)
    return [user.firstName, user.lastName].filter(Boolean).join(' ')
  return user.preferredName ?? user.email
}

function getInitials(user: User): string {
  const first = user.firstName ?? user.fullName?.split(' ')[0] ?? ''
  const last = user.lastName ?? user.fullName?.split(' ').slice(-1)[0] ?? ''
  return `${first[0] ?? ''}${last[0] ?? ''}`.toUpperCase() || user.email[0].toUpperCase()
}

function formatMeetingDate(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).replace(',', '').replace(/(\d{4}),/, '$1 at')
  // produces e.g. "Mon Mar 25 2026 at 2:00 PM"
}

function formatMessageDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

// ── sub-components (server-safe) ──────────────────────────────────────────────

function SectionHeading({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <Icon className="h-5 w-5 text-slate-400" />
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
    </div>
  )
}


function MeetingRow({ meeting, userId }: { meeting: Meeting; userId: string }) {
  return (
    <Link
      href={`/users/${userId}/meetings/${meeting.id}`}
      className="flex items-center gap-4 px-4 py-3 border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors group"
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-900 truncate">
          {meeting.title || 'Untitled Meeting'}
        </p>
        <p className="text-xs text-slate-400 mt-0.5">{formatMeetingDate(meeting.startTime)}</p>
      </div>
      <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-slate-500 flex-shrink-0 transition-colors" />
    </Link>
  )
}

function StatusBadge({ status }: { status: 'Pending' | 'Sent' }) {
  if (status === 'Sent') {
    return (
      <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-medium border border-emerald-200 flex-shrink-0">
        Sent
      </span>
    )
  }
  return (
    <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-xs font-medium border border-amber-200 flex-shrink-0">
      Pending
    </span>
  )
}

function MessageRow({ msg, userId }: { msg: Message; userId: string }) {
  const subject = msg.subject ?? msg.messageName
  const preview = msg.body ? msg.body.slice(0, 120) + (msg.body.length > 120 ? '…' : '') : null

  const inner = (
    <div className="px-4 py-3 border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-slate-900 truncate">{subject}</p>
          {msg.created && (
            <p className="text-xs text-slate-400 mt-0.5">{formatMessageDate(msg.created)}</p>
          )}
          {preview && (
            <p className="text-xs text-slate-500 mt-1 line-clamp-1">{preview}</p>
          )}
        </div>
        <StatusBadge status={msg.status} />
      </div>
    </div>
  )

  if (msg.meetingId) {
    return (
      <Link href={`/users/${userId}/meetings/${msg.meetingId}`} className="block">
        {inner}
      </Link>
    )
  }
  return <div>{inner}</div>
}

// ── page ──────────────────────────────────────────────────────────────────────

export default async function UserDetailPage({ params }: Props) {
  const { id } = await params
  const user = await getUserById(id)

  if (!user) {
    return (
      <div className="p-8">
        <p className="text-slate-500">User not found.</p>
      </div>
    )
  }

  const contactEmail = user.workEmail ?? user.email
  const [{ upcoming, past }, messages] = await Promise.all([
    getMeetingsForUser(contactEmail),
    getUserMessages(id),
  ])

  // ensure sort order
  const upcomingSorted = [...upcoming].sort(
    (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
  )
  const pastSorted = [...past].sort(
    (a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
  )
  const allMeetings = upcomingSorted.length + pastSorted.length

  const name = getDisplayName(user)
  const initials = getInitials(user)

  const badges = [
    user.enneagram ? { label: `Enneagram ${user.enneagram}`, className: 'bg-blue-50 text-blue-700' } : null,
    user.mbti       ? { label: user.mbti,                      className: 'bg-violet-50 text-violet-700' } : null,
    user.role       ? { label: user.role,                      className: 'bg-slate-100 text-slate-600' } : null,
  ].filter((b): b is { label: string; className: string } => b !== null)

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">

      {/* Back link */}
      <Link
        href="/users"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Clients
      </Link>

      {/* ── Profile card ─────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-start gap-5">
          {user.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt={name}
              className="w-16 h-16 rounded-full object-cover flex-shrink-0"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center text-2xl font-bold flex-shrink-0 select-none">
              {initials}
            </div>
          )}

          <div className="min-w-0">
            <h1
              className="text-2xl font-bold text-slate-900 leading-tight"
              style={{ fontFamily: 'var(--font-plus-jakarta-sans)' }}
            >
              {name}
            </h1>
            {(user.jobTitle ?? user.role) && (
              <p className="text-base text-slate-500 mt-0.5">{user.jobTitle ?? user.role}</p>
            )}
            {user.companyName && (
              <p className="text-sm text-slate-400 mt-0.5">{user.companyName}</p>
            )}
            {contactEmail && (
              <p className="flex items-center gap-1.5 text-sm text-slate-400 mt-1">
                <Mail className="h-3.5 w-3.5 flex-shrink-0" />
                {contactEmail}
              </p>
            )}
          </div>
        </div>

        {badges.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-5 pt-5 border-t border-slate-100">
            {badges.map((b) => (
              <span key={b.label} className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${b.className}`}>
                {b.label}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ── Meetings ─────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <SectionHeading icon={Calendar} title="Meetings" />

        {allMeetings === 0 ? (
          <p className="text-sm text-slate-400">No meetings recorded yet.</p>
        ) : (
          <div className="space-y-6">
            {/* Upcoming */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
                Upcoming{upcomingSorted.length > 0 && ` (${upcomingSorted.length})`}
              </p>
              {upcomingSorted.length === 0 ? (
                <p className="text-sm text-slate-400 pl-1">No upcoming meetings.</p>
              ) : (
                <div className="rounded-lg border border-slate-100 overflow-hidden">
                  {upcomingSorted.map((m) => (
                    <MeetingRow key={m.id} meeting={m} userId={id} />
                  ))}
                </div>
              )}
            </div>

            {/* Past */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
                Past{pastSorted.length > 0 && ` (${pastSorted.length})`}
              </p>
              {pastSorted.length === 0 ? (
                <p className="text-sm text-slate-400 pl-1">No past meetings yet.</p>
              ) : (
                <div className="rounded-lg border border-slate-100 overflow-hidden">
                  {pastSorted.map((m) => (
                    <MeetingRow key={m.id} meeting={m} userId={id} />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Notes & Transcripts ──────────────────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <SectionHeading icon={FileText} title="Notes & Transcripts" />
        <PlaceholderSection
          icon={<FileText />}
          title="No notes yet"
          message="Transcript and session notes will appear here once meetings are completed."
        />
      </div>

      {/* ── Messages & Follow-ups ────────────────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-slate-400" />
            <h2 className="text-lg font-semibold text-slate-900">Messages & Follow-ups</h2>
          </div>
          <Link
            href={`/users/${id}/messages/new`}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[hsl(213,70%,30%)] px-3 py-1.5 text-xs font-medium text-white hover:bg-[hsl(213,70%,25%)] transition-colors"
          >
            + Create Follow-up Draft
          </Link>
        </div>

        {messages.length === 0 ? (
          <p className="text-sm text-slate-400">
            No messages yet. Use the button above to draft a follow-up.
          </p>
        ) : (
          <div className="rounded-lg border border-slate-100 overflow-hidden">
            {messages.map((msg) => (
              <MessageRow key={msg.id} msg={msg} userId={id} />
            ))}
          </div>
        )}
      </div>

      {/* ── Tasks ────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <SectionHeading icon={CheckSquare} title="Tasks" />
        <PlaceholderSection
          icon={<CheckSquare />}
          title="No tasks yet"
          message="Todoist tasks will appear here once syncing is finalized."
        />
      </div>

      {/* ── Resources ────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <SectionHeading icon={Paperclip} title="Resources" />
        <PlaceholderSection
          icon={<Paperclip />}
          title="No resources yet"
          message="Resources and documents attached to this client will appear here."
        />
      </div>

    </div>
  )
}
