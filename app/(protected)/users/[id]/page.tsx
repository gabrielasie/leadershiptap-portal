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
  Network,
  Brain,
  Heart,
  Clock,
  UserCheck,
} from 'lucide-react'
import { getUserById } from '@/lib/services/usersService'
import { getMeetingsForUser } from '@/lib/services/meetingsService'
import { getUserMessages } from '@/lib/services/messagesService'
import { getNotesByUser } from '@/lib/airtable/notes'
import { getTasksByUser } from '@/lib/airtable/tasks'
import { getPortalEventsByClientEmail } from '@/lib/airtable/meetings'
import { getSessionUser } from '@/lib/auth/getSessionUser'
import { getCurrentUserRecord } from '@/lib/auth/getCurrentUserRecord'
import { getPermissionLevel, canWrite } from '@/lib/auth/permissions'
import { getCoachPersonContext } from '@/lib/airtable/coachPersonContext'
import { getRecentCoachSessionsForPerson } from '@/lib/airtable/coachSessions'
import { getRelationshipContext } from '@/lib/airtable/relationships'
import { formatEastern } from '@/lib/utils/dateFormat'
import PlaceholderSection from '@/components/ui/PlaceholderSection'
import UserActionsBar from './UserActionsBar'
import RecentSessionCard from './RecentSessionCard'
import MostRecentSessionNotes from './MostRecentSessionNotes'
import EditProfileDialog from './EditProfileDialog'
import AddTeamMemberDialog from './AddTeamMemberDialog'
import TaskItem from './TaskItem'
import NoteItem from './NoteItem'
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

function formatMeetingDate(iso: string, timezone: string = 'America/New_York'): string {
  return formatEastern(iso, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }, timezone).replace(',', '').replace(/(\d{4}),/, '$1 at') + ' ET'
}

function formatMessageDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatMeetingDay(iso: string, timezone: string = 'America/New_York'): { weekday: string; day: number; month: string; time: string } {
  return {
    weekday: formatEastern(iso, { weekday: 'short' }, timezone),
    day: parseInt(formatEastern(iso, { day: 'numeric' }, timezone), 10),
    month: formatEastern(iso, { month: 'short' }, timezone),
    time: formatEastern(iso, { hour: 'numeric', minute: '2-digit', hour12: true }, timezone) + ' ET',
  }
}

function relativeDays(iso: string): string {
  const now = new Date()
  const target = new Date(iso)
  const nowDay = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
  const targetDay = Date.UTC(target.getFullYear(), target.getMonth(), target.getDate())
  const diff = Math.round((targetDay - nowDay) / 86_400_000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  if (diff === -1) return 'Yesterday'
  if (diff > 0) return `In ${diff} days`
  return `${-diff} days ago`
}

// ── sub-components ────────────────────────────────────────────────────────────




function SectionHeading({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <Icon className="h-5 w-5 text-slate-400" />
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
    </div>
  )
}

// Server-safe expandable descriptor using native <details>/<summary>
function DescriptorText({ text, maxChars = 200 }: { text: string; maxChars?: number }) {
  if (text.length <= maxChars) {
    return <p className="text-sm text-slate-600 leading-relaxed mt-1">{text}</p>
  }
  return (
    <details className="mt-1 group">
      <summary className="list-none cursor-pointer">
        <p className="text-sm text-slate-600 leading-relaxed inline">
          {text.slice(0, maxChars)}…{' '}
        </p>
        <span className="text-xs text-[hsl(213,70%,30%)] group-open:hidden">read more</span>
      </summary>
      <p className="text-sm text-slate-600 leading-relaxed mt-1">{text}</p>
    </details>
  )
}

function OrgPersonLink({ user }: { user: User }) {
  return (
    <Link
      href={`/users/${user.id}`}
      className="flex items-center gap-3 p-3 rounded-lg border border-slate-100 hover:border-slate-200 hover:bg-slate-50 transition-colors group"
    >
      {(user.profilePhoto ?? user.avatarUrl) ? (
        <img
          src={(user.profilePhoto ?? user.avatarUrl)!}
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
        <p className="text-xs text-slate-400 mt-0.5">{formatMeetingDate(meeting.startTime, meeting.timezone)}</p>
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
  const [user, sessionUser, currentUserRecord] = await Promise.all([
    getUserById(id),
    getSessionUser(),
    getCurrentUserRecord(),
  ])

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
  const coachId = user.coachIds?.[0] ?? null
  const teamLeadId = user.teamLeadIds?.[0] ?? null
  const teamMemberIdList = user.teamMemberIds ?? []

  const [
    { upcoming, past },
    messages,
    sessionNotes,
    tasks,
    manager,
    reportResults,
    coach,
    teamLead,
    teamMemberResults,
    coachContext,
    relationshipContext,
    recentCoachSessions,
    portalSessionEvents,
  ] = await Promise.all([
    getMeetingsForUser(contactEmail, sessionUser, id, currentUserRecord.email || undefined),
    getUserMessages(id),
    getNotesByUser(id, sessionUser).catch(() => [] as Note[]),
    getTasksByUser(id).catch(() => [] as Task[]),
    managerId ? getUserById(managerId) : Promise.resolve(null),
    Promise.all(reportIds.map((rid) => getUserById(rid))),
    coachId ? getUserById(coachId) : Promise.resolve(null),
    teamLeadId ? getUserById(teamLeadId) : Promise.resolve(null),
    Promise.all(teamMemberIdList.map((tid) => getUserById(tid))),
    currentUserRecord.airtableId
      ? getCoachPersonContext(currentUserRecord.airtableId, id).catch(() => null)
      : Promise.resolve(null),
    currentUserRecord.airtableId
      ? getRelationshipContext(currentUserRecord.airtableId, id).catch(() => null)
      : Promise.resolve(null),
    currentUserRecord.airtableId
      ? getRecentCoachSessionsForPerson(currentUserRecord.airtableId, id, 10).catch(() => [])
      : Promise.resolve([]),
    contactEmail
      ? getPortalEventsByClientEmail(contactEmail, currentUserRecord.email || undefined).catch(() => [])
      : Promise.resolve([]),
  ])

  const directReports = reportResults.filter((u): u is User => u !== null)
  const teamMembers = teamMemberResults.filter((u): u is User => u !== null)

  const permissionLevel = await getPermissionLevel(
    currentUserRecord.airtableId,
    currentUserRecord.role,
    id,
  )
  const userCanWrite = canWrite(permissionLevel)

  const upcomingSorted = [...upcoming].sort(
    (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
  )
  const pastSorted = [...past].sort(
    (a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
  )
  const allMeetings = upcomingSorted.length + pastSorted.length
  const nextMeeting = upcomingSorted[0] ?? null
  const lastMeeting = pastSorted[0] ?? null
  const recentMeetings = pastSorted.slice(1)

  const name = getDisplayName(user)
  const initials = getInitials(user)

  // Never show raw Airtable record IDs to the user
  const isRecordId = (v: string) => /^rec[A-Za-z0-9]{8,}$/.test(v)

  const displayTitle =
    user.jobTitle ??
    (user.role && !isRecordId(user.role) ? user.role : undefined)

  // Show preferred name only when it differs from the display name
  const showPreferredName =
    user.preferredName &&
    user.preferredName !== name &&
    !isRecordId(user.preferredName)

  const badges = [
    user.enneagramType
      ? { label: user.enneagramType, className: 'bg-blue-50 text-blue-700' }
      : user.enneagram && !isRecordId(user.enneagram)
      ? { label: `Enneagram ${user.enneagram}`, className: 'bg-blue-50 text-blue-700' }
      : null,
    user.mbtiType
      ? { label: user.mbtiType, className: 'bg-violet-50 text-violet-700' }
      : user.mbti && !isRecordId(user.mbti)
      ? { label: user.mbti, className: 'bg-violet-50 text-violet-700' }
      : null,
    user.role && !isRecordId(user.role)
      ? { label: user.role, className: 'bg-slate-100 text-slate-600' }
      : null,
  ].filter((b): b is { label: string; className: string } => b !== null)

  // Returns true only if the field has at least one line of real content —
  // filters out blank lines and "Label: ?" placeholder patterns.
  function hasRealContent(val: string | undefined): boolean {
    if (!val || !val.trim()) return false
    return val.split('\n').some((line) => {
      const t = line.trim()
      if (!t || t === '?') return false
      // "Spouse: ?" / "Daughter's name:" / "Child: " — label with no real value
      if (/^[^:]{1,30}:\s*\??$/.test(t)) return false
      return true
    })
  }

  // Personality section: show only if at least one field has data
  const hasPersonality =
    !!(user.enneagramType || user.enneagram || user.mbtiType || user.mbti ||
       user.conflictPosture || user.conflictPostureDescriptor ||
       user.apologyLanguage ||
       (user.strengths && user.strengths.length > 0))

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

      {/* ── Relationship context badge ────────────────────────────────────── */}
      {currentUserRecord.role !== 'admin' && (
        relationshipContext ? (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-700">
            <span className="font-semibold">
              {relationshipContext.relationshipType || 'Relationship'}
            </span>
            {relationshipContext.permissionLevel && (
              <>
                <span className="text-emerald-300">·</span>
                <span className="capitalize">
                  {relationshipContext.permissionLevel.replace(/_/g, ' ')}
                </span>
              </>
            )}
            {relationshipContext.startDate && (
              <>
                <span className="text-emerald-300">·</span>
                <span>
                  Active since{' '}
                  {new Date(relationshipContext.startDate + 'T12:00:00').toLocaleDateString(
                    'en-US',
                    { month: 'short', year: 'numeric' },
                  )}
                </span>
              </>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-700">
            <span>⚠️</span>
            <span>No formal relationship context — you&apos;re seeing this client via legacy access</span>
          </div>
        )
      )}

      {/* ── Actions bar ──────────────────────────────────────────────────── */}
      {userCanWrite && <UserActionsBar userId={id} />}

      {/* ── Profile card ─────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm p-4 md:p-6">
        {userCanWrite && (
          <div className="flex items-start justify-between gap-2 mb-4 sm:mb-0">
            <span />
            <EditProfileDialog user={user} coachContext={coachContext} />
          </div>
        )}
        <div className="flex flex-col sm:flex-row items-start gap-4 sm:gap-5">
          {(user.profilePhoto ?? user.avatarUrl) ? (
            <img
              src={(user.profilePhoto ?? user.avatarUrl)!}
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
            {showPreferredName && (
              <p className="text-sm text-slate-400 mt-0.5">Goes by &ldquo;{user.preferredName}&rdquo;</p>
            )}
            {displayTitle && (
              <p className="text-base text-slate-500 mt-0.5">{displayTitle}</p>
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

            {/* Extra profile fields */}
            <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1.5">
              {user.timeAtCompany && (
                <span className="flex items-center gap-1.5 text-xs text-slate-500">
                  <Clock className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                  {user.timeAtCompany}
                </span>
              )}
              {coach && (
                <span className="flex items-center gap-1.5 text-xs text-slate-500">
                  <UserCheck className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                  Coach: {getDisplayName(coach)}
                </span>
              )}
              {teamLead && (
                <span className="flex items-center gap-1.5 text-xs text-slate-500">
                  <UserCheck className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                  Team Lead: {getDisplayName(teamLead)}
                </span>
              )}
            </div>
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

      {/* ── Most Recent Session ───────────────────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm p-4 md:p-6 space-y-5">
        <MostRecentSessionNotes
          meeting={lastMeeting}
          userId={id}
          coachSession={recentCoachSessions[0] ?? null}
        />

        {/* Past sessions list */}
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
                  href={`/users/${id}/sessions/${m.id}`}
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
                href={`/users/${id}/sessions`}
                className="text-sm text-blue-600 hover:underline mt-3 block"
              >
                View all {recentMeetings.length + 1} sessions →
              </Link>
            )}
          </div>
        )}
      </div>

      {/* ── Session Notes (from Calendar) ─────────────────────────────────── */}
      {portalSessionEvents.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-4 md:p-6">
          <SectionHeading icon={BookOpen} title="Session Notes (from Calendar)" />
          <div className="space-y-3">
            {portalSessionEvents.map((event) => (
              <div
                key={event.id}
                className="border border-slate-100 rounded-lg p-4 space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{event.title || 'Untitled Session'}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {formatEastern(event.startTime, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }, event.timezone)}
                    </p>
                  </div>
                </div>
                {event.notes ? (
                  <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                    {event.notes}
                  </p>
                ) : (
                  <p className="text-xs text-slate-300 italic">No notes yet</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Coaching Context ──────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm p-4 md:p-6">
        <SectionHeading icon={Heart} title="Coaching Context" />
        {coachContext === null ? (
          <p className="text-sm text-slate-400 italic">No context added yet — use Edit Profile to add notes.</p>
        ) : (
          <div className="space-y-4">
            {hasRealContent(coachContext.quickNotes ?? undefined) && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">Quick Notes</p>
                <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{coachContext.quickNotes}</p>
              </div>
            )}
            {hasRealContent(coachContext.familyDetails ?? undefined) && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">Family Details</p>
                <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{coachContext.familyDetails}</p>
              </div>
            )}
            {coachContext.flags.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">Relationship Flags</p>
                <div className="flex flex-wrap gap-1.5">
                  {coachContext.flags.map((flag) => (
                    <span key={flag} className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                      {flag}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {!hasRealContent(coachContext.quickNotes ?? undefined) &&
              !hasRealContent(coachContext.familyDetails ?? undefined) &&
              coachContext.flags.length === 0 && (
                <p className="text-sm text-slate-400 italic">No context added yet — use Edit Profile to add notes.</p>
              )}
          </div>
        )}
      </div>

      {/* ── Personality & Strengths ───────────────────────────────────────── */}
      {hasPersonality && (
        <div className="bg-white rounded-xl shadow-sm p-4 md:p-6">
          <SectionHeading icon={Brain} title="Personality & Strengths" />
          <div className="space-y-5">

            {/* Enneagram */}
            {(user.enneagramType || user.enneagram) && (
              <div className="border-b border-slate-100 pb-4 last:border-0 last:pb-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">Enneagram</p>
                <p className="text-sm font-medium text-slate-800">
                  {user.enneagramType ?? user.enneagram}
                </p>
                {user.enneagramDescriptor && (
                  <DescriptorText text={user.enneagramDescriptor} />
                )}
              </div>
            )}

            {/* MBTI */}
            {(user.mbtiType || user.mbti) && (
              <div className="border-b border-slate-100 pb-4 last:border-0 last:pb-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">MBTI</p>
                <p className="text-sm font-medium text-slate-800">
                  {user.mbtiType ?? user.mbti}
                </p>
                {user.mbtiDescriptor && (
                  <DescriptorText text={user.mbtiDescriptor} />
                )}
              </div>
            )}

            {/* Conflict Posture */}
            {(user.conflictPosture || user.conflictPostureDescriptor) && (
              <div className="border-b border-slate-100 pb-4 last:border-0 last:pb-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">Conflict Posture</p>
                {user.conflictPosture && (
                  <p className="text-sm font-medium text-slate-800">{user.conflictPosture}</p>
                )}
                {user.conflictPostureDescriptor && (
                  <DescriptorText text={user.conflictPostureDescriptor} />
                )}
              </div>
            )}

            {/* Apology Language */}
            {user.apologyLanguage && (
              <div className="border-b border-slate-100 pb-4 last:border-0 last:pb-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">Apology Language</p>
                <p className="text-sm font-medium text-slate-800">{user.apologyLanguage}</p>
                {user.apologyLanguageDescriptor && (
                  <DescriptorText text={user.apologyLanguageDescriptor} />
                )}
              </div>
            )}

            {/* Strengths */}
            {user.strengths && user.strengths.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">Strengths</p>
                <ol className="space-y-1.5">
                  {user.strengths.map((s, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-slate-100 text-slate-500 text-xs font-bold flex items-center justify-center">
                        {i + 1}
                      </span>
                      <span className="text-sm text-slate-800 font-medium">{s.name}</span>
                      {s.domain && (
                        <span className="text-xs text-slate-400 px-1.5 py-0.5 bg-slate-50 rounded">
                          {s.domain}
                        </span>
                      )}
                    </li>
                  ))}
                </ol>
              </div>
            )}

          </div>
        </div>
      )}

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

      {/* ── Coach Notes — only visible to coaches and admins ─────────────── */}
      {userCanWrite && (
        <div className="bg-white rounded-xl shadow-sm p-4 md:p-6">
          <div className="flex items-center gap-2 mb-4">
            <BookOpen className="h-5 w-5 text-slate-400" />
            <h2 className="text-lg font-semibold text-slate-900">Coach Notes</h2>
          </div>
          {sessionNotes.length === 0 ? (
            <p className="text-sm text-slate-400">No coach notes yet — use the Log a Note button above.</p>
          ) : (
            <div className="space-y-3">
              {sessionNotes.map((note) => (
                <NoteItem key={note.id} note={note} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Team ─────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm p-4 md:p-6">
        <div className="flex items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2">
            <Network className="h-5 w-5 text-slate-400" />
            <h2 className="text-lg font-semibold text-slate-900">Team</h2>
          </div>
          {userCanWrite && (
            <AddTeamMemberDialog
              leaderId={id}
              existingMemberIds={teamMemberIdList}
            />
          )}
        </div>
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

          {/* Team Members */}
          {teamMembers.length > 0 && (
            <div className="sm:col-span-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
                Team Members ({teamMembers.length})
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {teamMembers.map((member) => (
                  <OrgPersonLink key={member.id} user={member} />
                ))}
              </div>
            </div>
          )}

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
                    href={`/users/${id}/sessions/${nextMeeting.id}`}
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
                      href={`/users/${id}/sessions/${lastMeeting.id}`}
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
                        href={`/users/${id}/sessions/${m.id}`}
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

      {/* ── Messages & Follow-ups ────────────────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm p-4 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-slate-400" />
            <h2 className="text-lg font-semibold text-slate-900">Messages & Follow-ups</h2>
          </div>
          {userCanWrite && (
            <Link
              href={`/users/${id}/messages/new`}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[hsl(213,70%,30%)] px-3 py-1.5 text-xs font-medium text-white hover:bg-[hsl(213,70%,25%)] transition-colors"
            >
              + Create Follow-up Draft
            </Link>
          )}
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
              <TaskItem key={task.id} task={task} />
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
