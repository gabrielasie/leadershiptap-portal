import { findClientForMeeting } from '@/lib/services/meetingsService'
import type { Meeting, User } from '@/lib/types'
import type { UpcomingItem } from '../UpcomingSessionsCard'

function getDisplayName(user: User): string {
  if (user.fullName) return user.fullName
  if (user.firstName || user.lastName)
    return [user.firstName, user.lastName].filter(Boolean).join(' ')
  return user.preferredName ?? user.email
}

interface MapOpts {
  emailToUser: Map<string, User>
  notedMeetingIds: Set<string>
  coachEmail: string
}

/**
 * Filters and dedupes a list of Meetings, then maps them into UpcomingItems
 * for rendering in dashboard widgets.
 *
 * - `activeContextIds`: when provided (i.e. for non-admins), drops meetings
 *   whose RC isn't in the coach's active set. Pass `null` to skip.
 * - Dedups by `Provider Event ID` first (so calendar fan-out collapses),
 *   then by title+startTime as a fallback for legacy rows.
 */
export function meetingsToUpcomingItems(
  meetings: Meeting[],
  opts: MapOpts & { activeContextIds: Set<string> | null },
): UpcomingItem[] {
  const { emailToUser, notedMeetingIds, coachEmail, activeContextIds } = opts

  const ownershipFiltered = activeContextIds
    ? meetings.filter(
        (m) => !m.relationshipContextId || activeContextIds.has(m.relationshipContextId),
      )
    : meetings

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

  return deduped.map((meeting) => {
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
}
