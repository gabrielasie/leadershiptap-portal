import { History } from 'lucide-react'
import { getUsers, getClientsByRelationship } from '@/lib/services/usersService'
import { getRelationshipContexts } from '@/lib/airtable/relationships'
import { getSessionUser } from '@/lib/auth/getSessionUser'
import { getRecentPastMeetings } from '@/lib/airtable/meetings'
import { buildEmailToUserMap, findClientForMeeting } from '@/lib/services/meetingsService'
import { getNotesByAuthor } from '@/lib/airtable/notes'
import UpcomingSessionsCard, { type UpcomingItem } from '../UpcomingSessionsCard'
import type { CurrentUserRecord } from '@/lib/auth/getCurrentUserRecord'
import type { User } from '@/lib/types'

const DAYS_BACK = 14

function getDisplayName(user: User): string {
  if (user.fullName) return user.fullName
  if (user.firstName || user.lastName)
    return [user.firstName, user.lastName].filter(Boolean).join(' ')
  return user.preferredName ?? user.email
}

interface Props {
  userRecord: CurrentUserRecord
}

export default async function RecentSessionsRegion({ userRecord }: Props) {
  const sessionUser = await getSessionUser()
  const isAdmin = userRecord.role === 'admin'
  const ownerEmail = userRecord.email || undefined

  const [users, pastMeetings, coachContexts, coachNotes] = await Promise.all([
    isAdmin || !userRecord.airtableId
      ? getUsers(sessionUser)
      : getClientsByRelationship(userRecord.airtableId),
    getRecentPastMeetings(DAYS_BACK, ownerEmail),
    !isAdmin && userRecord.airtableId
      ? getRelationshipContexts(userRecord.airtableId)
      : Promise.resolve([]),
    userRecord.airtableId
      ? getNotesByAuthor(userRecord.airtableId)
      : Promise.resolve([]),
  ])

  const emailToUser = buildEmailToUserMap(users)
  const notedMeetingIds = new Set(coachNotes.map((n) => n.meetingId).filter(Boolean))

  // Same RC-membership filter as the upcoming widget.
  const activeContextIds = new Set(coachContexts.map((c) => c.id))
  const ownershipFiltered = isAdmin
    ? pastMeetings
    : pastMeetings.filter(
        (m) => !m.relationshipContextId || activeContextIds.has(m.relationshipContextId),
      )

  // Dedup by Provider Event ID (calendar fan-out from the sync).
  const seenById = new Set<string>()
  const seenKeys = new Set<string>()
  const deduped = ownershipFiltered.filter((m) => {
    if (m.providerEventId) {
      if (seenById.has(m.providerEventId)) return false
      seenById.add(m.providerEventId)
      return true
    }
    const key = `${m.title ?? ''}|${m.startTime ?? ''}`
    if (seenKeys.has(key)) return false
    seenKeys.add(key)
    return true
  })

  const coachEmail = sessionUser?.email?.toLowerCase() ?? ''
  const items: UpcomingItem[] = deduped.map((meeting) => {
    const client =
      findClientForMeeting(meeting, emailToUser) ??
      (meeting.senderEmail
        ? (emailToUser.get(meeting.senderEmail.toLowerCase().trim()) ?? null)
        : null)
    const tz = meeting.timezone || 'America/New_York'
    const fmt = (iso: string) =>
      new Date(iso).toLocaleString('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit', hour12: true })
    const timeRange = meeting.endTime
      ? `${fmt(meeting.startTime)} – ${fmt(meeting.endTime)} ET`
      : `${fmt(meeting.startTime)} ET`

    const externalEmails = meeting.participantEmails.filter(
      (e) => e && !e.toLowerCase().includes('leadershiptap.com') && e.toLowerCase() !== coachEmail,
    )

    return {
      meetingId: meeting.id,
      providerEventId: meeting.providerEventId ?? null,
      title: meeting.title,
      startTime: meeting.startTime,
      endTime: meeting.endTime,
      timezone: tz,
      weekday: new Date(meeting.startTime).toLocaleString('en-US', { timeZone: tz, weekday: 'short' }),
      day: parseInt(new Date(meeting.startTime).toLocaleString('en-US', { timeZone: tz, day: 'numeric' }), 10),
      month: new Date(meeting.startTime).toLocaleString('en-US', { timeZone: tz, month: 'short' }),
      timeRange,
      clientId: client?.id ?? null,
      clientName: meeting.clientName ?? (client ? getDisplayName(client) : null),
      displayLabel: client ? null : (() => {
        const allEmails = [meeting.senderEmail, ...meeting.participantEmails]
          .filter(Boolean)
          .map((e) => e!.trim().toLowerCase())
          .filter((e) => e && !e.includes('leadershiptap') && e !== coachEmail)
        const domains = [...new Set(
          allEmails
            .map((e) => e.split('@')[1]?.replace(/\.(com|net|org|io)$/, '') ?? '')
            .filter(Boolean),
        )]
        return domains.slice(0, 2).join(', ') || null
      })(),
      participantEmails: externalEmails,
      hasNote: notedMeetingIds.has(meeting.id),
    }
  })

  // Hide the section entirely if there are no past sessions to show.
  if (items.length === 0) return null

  const noteCount = items.filter((i) => i.hasNote).length
  const needsNotes = items.length - noteCount

  return (
    <div className="mb-4 md:mb-6 bg-white rounded-xl shadow-sm p-4 md:p-6">
      <div className="flex items-center gap-2 mb-5">
        <History className="h-5 w-5 text-slate-400" />
        <h2 className="text-lg font-semibold text-slate-900">Recent Sessions</h2>
        <span className="ml-auto text-xs text-slate-400 font-medium">
          {needsNotes > 0
            ? `${needsNotes} need${needsNotes === 1 ? 's' : ''} notes`
            : `${items.length} session${items.length === 1 ? '' : 's'} in last ${DAYS_BACK} days`}
        </span>
      </div>
      <UpcomingSessionsCard
        items={items}
        emptyMessage={`No sessions in the last ${DAYS_BACK} days.`}
      />
    </div>
  )
}
