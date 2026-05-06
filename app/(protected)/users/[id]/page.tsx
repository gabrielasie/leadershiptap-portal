import Link from 'next/link'
import {
  ArrowLeft,
  ChevronRight,
  CheckSquare,
  Paperclip,
} from 'lucide-react'
import { getUserById } from '@/lib/services/usersService'
import { getMeetingsForUser } from '@/lib/services/meetingsService'
import { getUserMessages } from '@/lib/services/messagesService'
import { getNotesByUser, getNotesByMeetingId } from '@/lib/airtable/notes'
import { getTasksByUser } from '@/lib/airtable/tasks'
import { getPortalEventsByClientEmail } from '@/lib/airtable/meetings'
import { getSessionUser } from '@/lib/auth/getSessionUser'
import { getCurrentUserRecord } from '@/lib/auth/getCurrentUserRecord'
import { getPermissionLevel, canWrite } from '@/lib/auth/permissions'
import { getCoachPersonContext } from '@/lib/airtable/coachPersonContext'
import { getRelationshipContext, getDirectReports } from '@/lib/airtable/relationships'
import PlaceholderSection from '@/components/ui/PlaceholderSection'
import UserActionsBar from './UserActionsBar'
import { getDisplayName, getInitials, isRecordId, SectionHeading } from './sections/helpers'
import ProfileCardSection from './sections/ProfileCardSection'
import MostRecentSessionSection from './sections/MostRecentSessionSection'
import SessionNotesFromCalendarSection from './sections/SessionNotesFromCalendarSection'
import CoachingContextSection from './sections/CoachingContextSection'
import PersonalityStrengthsSection from './sections/PersonalityStrengthsSection'
import ProfileDetailsSection from './sections/ProfileDetailsSection'
import CoachNotesSection from './sections/CoachNotesSection'
import TeamSection from './sections/TeamSection'
import TheirTeamSection from './sections/TheirTeamSection'
import MeetingsSection from './sections/MeetingsSection'
import MessagesSection from './sections/MessagesSection'
import TasksSection from './sections/TasksSection'
import type { User, Note, Task } from '@/lib/types'

interface Props {
  params: Promise<{ id: string }>
  searchParams: Promise<{ trail?: string }>
}

// ── page ──────────────────────────────────────────────────────────────────────

export default async function UserDetailPage({ params, searchParams }: Props) {
  const { id } = await params
  const { trail: trailParam } = await searchParams

  // Parse breadcrumb trail: comma-separated "recID:Name" pairs
  const trailEntries: Array<{ id: string; name: string }> = (trailParam ?? '')
    .split(',')
    .filter(Boolean)
    .map((seg) => {
      const idx = seg.indexOf(':')
      return idx > 0
        ? { id: seg.slice(0, idx), name: decodeURIComponent(seg.slice(idx + 1)) }
        : { id: seg, name: seg }
    })
  const currentDepth = trailEntries.length  // 0 = top-level, 1 = one hop, etc.
  const MAX_DRILL_DEPTH = 3

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
  // Resolved display name — passed to getMeetingsForUser so the lookup can
  // also match meetings via the {Client Name} field (set by sync), not just
  // by email substring in {Attendees}. Belt-and-suspenders for sparse data.
  const displayName = getDisplayName(user)

  const [
    { upcoming, past },
    messages,
    sessionNotes,
    tasks,
    manager,
    coach,
    teamLead,
    teamMemberResults,
    coachContext,
    relationshipContext,
    portalSessionEvents,
    theirTeamReports,
  ] = await Promise.all([
    getMeetingsForUser(contactEmail, sessionUser, id, currentUserRecord.email || undefined, displayName),
    getUserMessages(id),
    getNotesByUser(id).catch(() => [] as Note[]),
    getTasksByUser(id).catch(() => [] as Task[]),
    managerId ? getUserById(managerId) : Promise.resolve(null),
    coachId ? getUserById(coachId) : Promise.resolve(null),
    teamLeadId ? getUserById(teamLeadId) : Promise.resolve(null),
    Promise.all(teamMemberIdList.map((tid) => getUserById(tid))),
    currentUserRecord.airtableId
      ? getCoachPersonContext(currentUserRecord.airtableId, id).catch(() => null)
      : Promise.resolve(null),
    currentUserRecord.airtableId
      ? getRelationshipContext(currentUserRecord.airtableId, id).catch(() => null)
      : Promise.resolve(null),
    contactEmail
      ? getPortalEventsByClientEmail(contactEmail, currentUserRecord.email || undefined, displayName).catch(() => [])
      : Promise.resolve([]),
    getDirectReports(id).catch(() => []),
  ])

  const directReports = theirTeamReports
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

  // Fetch meeting-linked notes for the most recent session
  const lastMeetingNotes = lastMeeting
    ? await getNotesByMeetingId(lastMeeting.id).catch(() => [])
    : []

  const name = getDisplayName(user)
  const initials = getInitials(user)

  // Build the next trail segment for downstream drill-down links
  const nextTrail = [...trailEntries, { id, name }]
    .map((e) => `${e.id}:${encodeURIComponent(e.name)}`)
    .join(',')
  const canDrillDeeper = currentDepth < MAX_DRILL_DEPTH

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
    ...(coachContext?.flags ?? []).map((flag) => ({
      label: flag,
      className: 'bg-amber-50 text-amber-700 border border-amber-200',
    })),
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

      {/* Breadcrumb trail for downstream navigation */}
      {trailEntries.length > 0 && (
        <nav className="flex items-center gap-1 text-sm text-slate-500 flex-wrap" aria-label="Org trail">
          {trailEntries.map((entry, i) => {
            // Build partial trail up to this entry
            const partialTrail = trailEntries
              .slice(0, i)
              .map((e) => `${e.id}:${encodeURIComponent(e.name)}`)
              .join(',')
            return (
              <span key={entry.id} className="flex items-center gap-1">
                <Link
                  href={`/users/${entry.id}${partialTrail ? `?trail=${partialTrail}` : ''}`}
                  className="text-[hsl(213,70%,30%)] hover:underline font-medium"
                >
                  {entry.name}
                </Link>
                <ChevronRight className="h-3.5 w-3.5 text-slate-300 flex-shrink-0" />
              </span>
            )
          })}
          <span className="font-semibold text-slate-900">{name}</span>
        </nav>
      )}

      {/* ── Relationship context badge ────────────────────────────────────── */}
      {currentUserRecord.role !== 'admin' && (
        relationshipContext ? (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-700">
            <span className="font-semibold capitalize">
              {relationshipContext.relationshipType?.replace(/_/g, ' ') || 'Relationship'}
            </span>
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
        ) : trailEntries.length > 0 ? (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-700">
            <span className="font-semibold">
              Reached via your coaching with {trailEntries[trailEntries.length - 1].name}
            </span>
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
      <ProfileCardSection
        user={user}
        name={name}
        initials={initials}
        contactEmail={contactEmail}
        displayTitle={displayTitle}
        showPreferredName={!!showPreferredName}
        badges={badges}
        coach={coach}
        teamLead={teamLead}
        coachContext={coachContext}
        userCanWrite={userCanWrite}
      />

      {/* ── Most Recent Session ───────────────────────────────────────────── */}
      <MostRecentSessionSection
        lastMeeting={lastMeeting}
        lastMeetingNotes={lastMeetingNotes}
        recentMeetings={recentMeetings}
        userId={id}
      />

      {/* ── Session Notes (from Calendar) ─────────────────────────────────── */}
      <SessionNotesFromCalendarSection portalSessionEvents={portalSessionEvents} />

      {/* ── Coaching Context ──────────────────────────────────────────────── */}
      <CoachingContextSection user={user} coachContext={coachContext} />

      {/* ── Personality & Strengths ───────────────────────────────────────── */}
      <PersonalityStrengthsSection user={user} />

      {/* ── Profile Details ──────────────────────────────────────────────── */}
      <ProfileDetailsSection user={user} />

      {/* ── Coach Notes ──────────────────────────────────────────────────── */}
      <CoachNotesSection sessionNotes={sessionNotes} userCanWrite={userCanWrite} />

      {/* ── Team ─────────────────────────────────────────────────────────── */}
      <TeamSection
        userId={id}
        manager={manager}
        directReports={directReports}
        teamMembers={teamMembers}
        teamMemberIdList={teamMemberIdList}
        userCanWrite={userCanWrite}
      />

      {/* ── Their Team ───────────────────────────────────────────────────── */}
      <TheirTeamSection
        directReports={directReports}
        nextTrail={nextTrail}
        canDrillDeeper={canDrillDeeper}
      />

      {/* ── Meetings ─────────────────────────────────────────────────────── */}
      <MeetingsSection
        nextMeeting={nextMeeting}
        lastMeeting={lastMeeting}
        recentMeetings={recentMeetings}
        allMeetings={allMeetings}
        userId={id}
      />

      {/* ── Messages & Follow-ups ────────────────────────────────────────── */}
      <MessagesSection messages={messages} userId={id} userCanWrite={userCanWrite} />

      {/* ── Tasks ────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm p-4 md:p-6">
        <SectionHeading icon={CheckSquare} title="Tasks" />
        <TasksSection tasks={tasks} />
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
