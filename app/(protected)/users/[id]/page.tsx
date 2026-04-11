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
  BookOpen,
  ExternalLink,
  Network,
} from 'lucide-react'
import { getUserById } from '@/lib/services/usersService'
import { getMeetingsForUser } from '@/lib/services/meetingsService'
import { getUserMessages } from '@/lib/services/messagesService'
import { getNotesByUser } from '@/lib/airtable/notes'
import { getTasksByUser } from '@/lib/airtable/tasks'
import { getSessionUser } from '@/lib/auth/getSessionUser'
import PlaceholderSection from '@/components/ui/PlaceholderSection'
import UserActionsBar from './UserActionsBar'
import type { User, Meeting, Message, Note, Task } from '@/lib/types'

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

function formatMeetingDay(iso: string): { weekday: string; day: number; month: string; time: string } {
  const d = new Date(iso)
  return {
    weekday: d.toLocaleString('en-US', { weekday: 'short' }),
    day: d.getDate(),
    month: d.toLocaleString('en-US', { month: 'short' }),
    time: d.toLocaleString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
  }
}

function relativeDays(iso: string): string {
  const now = new Date()
  const target = new Date(iso)
  // compare at day granularity
  const nowDay = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
  const targetDay = Date.UTC(target.getFullYear(), target.getMonth(), target.getDate())
  const diff = Math.round((targetDay - nowDay) / 86_400_000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  if (diff === -1) return 'Yesterday'
  if (diff > 0) return `In ${diff} days`
  return `${-diff} days ago`
}

// ── sub-components (server-safe) ──────────────────────────────────────────────

const PRIORITY_STYLES: Record<string, string> = {
  High:   'bg-rose-50 text-rose-700 border-rose-200',
  Medium: 'bg-amber-50 text-amber-700 border-amber-200',
  Low:    'bg-slate-100 text-slate-500 border-slate-200',
}

const STATUS_STYLES: Record<string, string> = {
  'To Do':       'bg-slate-100 text-slate-500',
  'In Progress': 'bg-blue-50 text-blue-700',
  'Done':        'bg-emerald-50 text-emerald-700',
}

function formatTaskDueDate(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function TaskRow({ task }: { task: Task }) {
  const isOverdue =
    task.dueDate &&
    task.status !== 'Done' &&
    new Date(task.dueDate + 'T23:59:59') < new Date()

  return (
    <div className="flex items-start gap-3 px-3 py-2.5 rounded-lg border border-slate-100 hover:border-slate-200 transition-colors">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-900">{task.name}</p>
        {task.dueDate && (
          <p className={`text-xs mt-0.5 ${isOverdue ? 'text-rose-500 font-medium' : 'text-slate-400'}`}>
            {isOverdue ? 'Overdue · ' : 'Due '}{formatTaskDueDate(task.dueDate)}
          </p>
        )}
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0 mt-0.5">
        {task.status && (
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[task.status] ?? 'bg-slate-100 text-slate-500'}`}>
            {task.status}
          </span>
        )}
        {task.priority && (
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${PRIORITY_STYLES[task.priority] ?? 'bg-slate-100 text-slate-500 border-slate-200'}`}>
            {task.priority}
          </span>
        )}
      </div>
    </div>
  )
}

function formatNoteDate(dateStr: string): string {
  if (!dateStr) return ''
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

function NoteCard({ note }: { note: Note }) {
  return (
    <div className="rounded-lg border border-slate-100 p-4">
      {note.date && (
        <p className="text-xs font-semibold text-slate-500 mb-2">
          {formatNoteDate(note.date)}
        </p>
      )}
      <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
        {note.content}
      </p>
    </div>
  )
}

function SectionHeading({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <Icon className="h-5 w-5 text-slate-400" />
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
    </div>
  )
}


function OrgPersonLink({ user }: { user: User }) {
  return (
    <Link
      href={`/users/${user.id}`}
      className="flex items-center gap-3 p-3 rounded-lg border border-slate-100 hover:border-slate-200 hover:bg-slate-50 transition-colors group"
    >
      {user.avatarUrl ? (
        <img
          src={user.avatarUrl}
          alt={getDisplayName(user)}
          className="w-8 h-8 rounded-full object-cover flex-shrink-0"
        />
      ) : (
        <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center text-xs font-semibold flex-shrink-0 select-none">
          {getInitials(user)}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-slate-900 truncate">{getDisplayName(user)}</p>
        {(user.title ?? user.jobTitle) && (
          <p className="text-xs text-slate-400 truncate">{user.title ?? user.jobTitle}</p>
        )}
      </div>
      <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-slate-500 flex-shrink-0 transition-colors" />
    </Link>
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
  const bodyText = msg.body?.trim()
  const preview = bodyText
    ? bodyText.slice(0, 120) + (bodyText.length > 120 ? '…' : '')
    : null

  const inner = (
    <div className="px-4 py-3 border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-slate-900 truncate">{subject}</p>
          {msg.created && (
            <p className="text-xs text-slate-400 mt-0.5">{formatMessageDate(msg.created)}</p>
          )}
          {preview ? (
            <p className="text-xs text-slate-500 mt-1 line-clamp-1">{preview}</p>
          ) : (
            <p className="text-xs text-slate-300 mt-1 italic">No content yet</p>
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
  const [user, sessionUser] = await Promise.all([getUserById(id), getSessionUser()])

  if (!user) {
    return (
      <div className="p-8">
        <p className="text-slate-500">User not found.</p>
      </div>
    )
  }

  const contactEmail = user.workEmail ?? user.email
  const managerId = user.managerIds?.[0] ?? null
  const reportIds = user.directReportIds ?? []

  const [{ upcoming, past }, messages, sessionNotes, tasks, manager, reportResults] = await Promise.all([
    getMeetingsForUser(contactEmail, sessionUser, id),
    getUserMessages(id),
    getNotesByUser(id, sessionUser).catch(() => [] as import('@/lib/types').Note[]),
    getTasksByUser(id).catch(() => [] as import('@/lib/types').Task[]),
    managerId ? getUserById(managerId) : Promise.resolve(null),
    Promise.all(reportIds.map((rid) => getUserById(rid))),
  ])

  const directReports = reportResults.filter((u): u is User => u !== null)

  // ensure sort order
  const upcomingSorted = [...upcoming].sort(
    (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
  )
  const pastSorted = [...past].sort(
    (a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
  )
  const allMeetings = upcomingSorted.length + pastSorted.length
  const nextMeeting = upcomingSorted[0] ?? null
  const lastMeeting = pastSorted[0] ?? null
  const recentMeetings = pastSorted.slice(1, 4) // up to 3 more past meetings

  const name = getDisplayName(user)
  const initials = getInitials(user)

  // Airtable returns raw record IDs (e.g. "recXxx…") when a linked-record field
  // hasn't been expanded. Never show those to the user.
  const isRecordId = (v: string) => /^rec[A-Za-z0-9]{8,}$/.test(v)

  const badges = [
    user.enneagram && !isRecordId(user.enneagram)
      ? { label: `Enneagram ${user.enneagram}`, className: 'bg-blue-50 text-blue-700' }
      : null,
    user.mbti && !isRecordId(user.mbti)
      ? { label: user.mbti, className: 'bg-violet-50 text-violet-700' }
      : null,
    user.role && !isRecordId(user.role)
      ? { label: user.role, className: 'bg-slate-100 text-slate-600' }
      : null,
  ].filter((b): b is { label: string; className: string } => b !== null)

  return (
    <div className="px-4 py-5 md:p-8 max-w-5xl mx-auto space-y-6">

      {/* Back link */}
      <Link
        href="/users"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Clients
      </Link>

      {/* ── Actions bar ──────────────────────────────────────────────────── */}
      <UserActionsBar userId={id} />

      {/* ── Profile card ─────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm p-4 md:p-6">
        <div className="flex flex-col sm:flex-row items-start gap-4 sm:gap-5">
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

          <div className="min-w-0 flex-1">
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

      {/* ── Profile Details ──────────────────────────────────────────────── */}
      {(user.department || user.title || user.startDate || user.engagementLevel) && (
        <div className="bg-white rounded-xl shadow-sm p-4 md:p-6">
          <SectionHeading icon={FileText} title="Profile Details" />
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
            {user.title && (
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-0.5">Title</dt>
                <dd className="text-sm text-slate-800">{user.title}</dd>
              </div>
            )}
            {user.department && (
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-0.5">Department</dt>
                <dd className="text-sm text-slate-800">{user.department}</dd>
              </div>
            )}
            {user.startDate && (
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-0.5">Start Date</dt>
                <dd className="text-sm text-slate-800">
                  {new Date(user.startDate + 'T12:00:00').toLocaleDateString('en-US', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </dd>
              </div>
            )}
            {user.engagementLevel && (
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-0.5">Engagement Level</dt>
                <dd>
                  <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    user.engagementLevel.toLowerCase().includes('high')
                      ? 'bg-emerald-50 text-emerald-700'
                      : user.engagementLevel.toLowerCase().includes('low')
                      ? 'bg-rose-50 text-rose-700'
                      : 'bg-amber-50 text-amber-700'
                  }`}>
                    {user.engagementLevel}
                  </span>
                </dd>
              </div>
            )}
          </dl>
        </div>
      )}

      {/* ── Coach Notes ───────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm p-4 md:p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-slate-400" />
            <h2 className="text-lg font-semibold text-slate-900">Coach Notes</h2>
          </div>
          {process.env.AIRTABLE_BASE_ID && process.env.AIRTABLE_USERS_TABLE_ID && (
            <a
              href={`https://airtable.com/${process.env.AIRTABLE_BASE_ID}/${process.env.AIRTABLE_USERS_TABLE_ID}/${user.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-[hsl(213,70%,30%)] transition-colors"
            >
              Edit in Airtable
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
        {user.coachNotes ? (
          <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
            {user.coachNotes}
          </p>
        ) : (
          <p className="text-sm text-slate-400">
            No coach notes yet.{' '}
            {process.env.AIRTABLE_BASE_ID && process.env.AIRTABLE_USERS_TABLE_ID && (
              <a
                href={`https://airtable.com/${process.env.AIRTABLE_BASE_ID}/${process.env.AIRTABLE_USERS_TABLE_ID}/${user.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[hsl(213,70%,30%)] hover:underline inline-flex items-center gap-0.5"
              >
                Add notes in Airtable
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </p>
        )}
      </div>

      {/* ── Org Chart ────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm p-4 md:p-6">
        <SectionHeading icon={Network} title="Org Chart" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">

          {/* Manager */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
              Manager
            </p>
            {manager ? (
              <OrgPersonLink user={manager} />
            ) : (
              <p className="text-sm text-slate-300">None</p>
            )}
          </div>

          {/* Direct Reports */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
              Direct Reports{directReports.length > 0 && ` (${directReports.length})`}
            </p>
            {directReports.length === 0 ? (
              <p className="text-sm text-slate-300">None</p>
            ) : (
              <div className="space-y-2">
                {directReports.map((report) => (
                  <OrgPersonLink key={report.id} user={report} />
                ))}
              </div>
            )}
          </div>

        </div>
      </div>

      {/* ── Meetings ─────────────────────────────────────────────────────── */}
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

            {/* NEXT SESSION ──────────────────────────────────────────── */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
                Next Session
              </p>
              {nextMeeting ? (() => {
                const { weekday, day, month, time } = formatMeetingDay(nextMeeting.startTime)
                const label = relativeDays(nextMeeting.startTime)
                return (
                  <Link
                    href={`/users/${id}/meetings/${nextMeeting.id}`}
                    className="flex items-start gap-4 p-4 rounded-xl border-2 border-[hsl(213,60%,90%)] bg-[hsl(213,60%,97%)] hover:bg-[hsl(213,60%,95%)] transition-colors group"
                  >
                    {/* Date block */}
                    <div className="flex-shrink-0 w-12 text-center bg-[hsl(213,70%,30%)] text-white rounded-lg py-2 px-1">
                      <p className="text-[10px] font-bold uppercase tracking-wide opacity-80">{weekday}</p>
                      <p className="text-2xl font-bold leading-none mt-0.5">{day}</p>
                      <p className="text-[10px] opacity-80 mt-0.5">{month}</p>
                    </div>
                    {/* Details */}
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

            {/* LAST SESSION ───────────────────────────────────────────── */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
                Last Session
              </p>
              {lastMeeting ? (() => {
                const { weekday, day, month, time } = formatMeetingDay(lastMeeting.startTime)
                const label = relativeDays(lastMeeting.startTime)
                return (
                  <Link
                    href={`/users/${id}/meetings/${lastMeeting.id}`}
                    className="flex items-start gap-4 p-4 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 transition-colors group"
                  >
                    {/* Date block */}
                    <div className="flex-shrink-0 w-12 text-center bg-slate-200 text-slate-600 rounded-lg py-2 px-1">
                      <p className="text-[10px] font-bold uppercase tracking-wide">{weekday}</p>
                      <p className="text-2xl font-bold leading-none mt-0.5">{day}</p>
                      <p className="text-[10px] mt-0.5">{month}</p>
                    </div>
                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-800 truncate">
                        {lastMeeting.title || 'Untitled Meeting'}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">{time}</p>
                      <span className="mt-2 inline-block text-xs font-medium text-slate-500 bg-slate-200 px-2 py-0.5 rounded-full">
                        {label}
                      </span>
                      {lastMeeting.notes && (
                        <p className="text-xs text-slate-500 mt-2 line-clamp-2 leading-relaxed">
                          {lastMeeting.notes}
                        </p>
                      )}
                    </div>
                    <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-slate-500 flex-shrink-0 mt-1 transition-colors" />
                  </Link>
                )
              })() : (
                <p className="text-sm text-slate-400 pl-1">No past sessions.</p>
              )}
            </div>

            {/* RECENT SESSIONS ────────────────────────────────────────── */}
            {recentMeetings.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
                  Recent Sessions
                </p>
                <div className="rounded-lg border border-slate-100 overflow-hidden">
                  {recentMeetings.map((m) => (
                    <Link
                      key={m.id}
                      href={`/users/${id}/meetings/${m.id}`}
                      className="flex items-start gap-3 px-4 py-3 border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors group"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">
                          {m.title || 'Untitled Meeting'}
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">{formatMeetingDate(m.startTime)}</p>
                        {m.notes && (
                          <p className="text-xs text-slate-400 mt-1 line-clamp-1">{m.notes}</p>
                        )}
                      </div>
                      <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-slate-500 flex-shrink-0 mt-0.5 transition-colors" />
                    </Link>
                  ))}
                </div>
              </div>
            )}

          </div>
        )}
      </div>

      {/* ── Session Notes ─────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm p-4 md:p-6">
        <SectionHeading icon={FileText} title="Session Notes" />
        {sessionNotes.length === 0 ? (
          <p className="text-sm text-slate-400">No notes logged yet — use the Log a Note button above.</p>
        ) : (
          <div className="space-y-4">
            {sessionNotes.map((note) => (
              <NoteCard key={note.id} note={note} />
            ))}
          </div>
        )}
      </div>

      {/* ── Messages & Follow-ups ────────────────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm p-4 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
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
          <PlaceholderSection
            icon={<MessageSquare />}
            title="No messages yet"
            message="Use the button above to draft a follow-up for this client."
          />
        ) : (
          <div className="rounded-lg border border-slate-100 overflow-hidden">
            {messages.map((msg) => (
              <MessageRow key={msg.id} msg={msg} userId={id} />
            ))}
          </div>
        )}
      </div>

      {/* ── Tasks ────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm p-4 md:p-6">
        <SectionHeading icon={CheckSquare} title="Tasks" />
        {tasks.length === 0 ? (
          <PlaceholderSection
            icon={<CheckSquare />}
            title="No tasks yet"
            message="Use the Add Task button above to create a task for this client."
          />
        ) : (
          <div className="space-y-2">
            {tasks.map((task) => (
              <TaskRow key={task.id} task={task} />
            ))}
          </div>
        )}
      </div>

      {/* ── Resources ────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm p-4 md:p-6">
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
