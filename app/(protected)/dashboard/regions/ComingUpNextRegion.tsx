import Link from 'next/link'
import { Calendar, ChevronRight, Clock, CalendarDays } from 'lucide-react'
import { TABLES, FIELDS } from '@/lib/airtable/constants'
import { log } from '@/lib/utils/logger'
import { getUsers, getClientsByRelationship, getPortalCoaches } from '@/lib/services/usersService'
import { getRelationshipContexts } from '@/lib/airtable/relationships'
import { getSessionUser } from '@/lib/auth/getSessionUser'
import { getAllUpcomingMeetings } from '@/lib/airtable/meetings'
import { buildEmailToUserMap, findClientForMeeting } from '@/lib/services/meetingsService'
import { getNotesByAuthor } from '@/lib/airtable/notes'
import { getDateInTimezone, getHourInTimezone } from '@/lib/utils/dateFormat'
import UpcomingSessionsCard, { type UpcomingItem } from '../UpcomingSessionsCard'
import DashboardQuickActions from '../DashboardQuickActions'
import type { CurrentUserRecord } from '@/lib/auth/getCurrentUserRecord'
import type { User } from '@/lib/types'

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

const AVATAR_COLORS = [
  'bg-blue-100 text-blue-700',
  'bg-violet-100 text-violet-700',
  'bg-emerald-100 text-emerald-700',
  'bg-amber-100 text-amber-700',
  'bg-rose-100 text-rose-700',
  'bg-cyan-100 text-cyan-700',
]

function avatarColor(id: string): string {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]
}

function formatTimeUntil(iso: string, now: Date): string {
  const diffMs = new Date(iso).getTime() - now.getTime()
  if (diffMs <= 0) return 'starting now'
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 60) return `in ${diffMin} minute${diffMin === 1 ? '' : 's'}`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `in ${diffHr} hour${diffHr === 1 ? '' : 's'}`
  const diffDay = Math.floor(diffHr / 24)
  return `in ${diffDay} day${diffDay === 1 ? '' : 's'}`
}

interface PortalCalendarEvent {
  id: string
  subject: string
  start: string
  timezone: string
}

async function getUpcomingPortalEvents(ownerEmail: string): Promise<PortalCalendarEvent[]> {
  const apiKey = process.env.AIRTABLE_API_KEY
  const baseId = process.env.AIRTABLE_BASE_ID
  if (!apiKey || !baseId) return []

  const now = new Date()
  const cutoff = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
  const safeOwner = ownerEmail.toLowerCase().replace(/"/g, '\\"')
  const formula = encodeURIComponent(
    `AND(IS_AFTER({${FIELDS.MEETINGS.START}}, "${now.toISOString()}"), IS_BEFORE({${FIELDS.MEETINGS.START}}, "${cutoff.toISOString()}"), LOWER({${FIELDS.MEETINGS.CALENDAR_OWNER}}) = "${safeOwner}")`,
  )
  try {
    log.debug('[getUpcomingPortalEvents] table:', TABLES.MEETINGS, 'filter:', decodeURIComponent(formula))
    const res = await fetch(
      `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(TABLES.MEETINGS)}?filterByFormula=${formula}&sort%5B0%5D%5Bfield%5D=${encodeURIComponent(FIELDS.MEETINGS.START)}&sort%5B0%5D%5Bdirection%5D=asc&maxRecords=10`,
      { headers: { Authorization: `Bearer ${apiKey}` }, cache: 'no-store' },
    )
    if (!res.ok) {
      log.error('[getUpcomingPortalEvents] failed status:', res.status, await res.text())
      return []
    }
    const data = await res.json()
    return (data.records ?? []).map((r: { id: string; fields: Record<string, unknown> }) => ({
      id: r.id,
      subject: (r.fields[FIELDS.MEETINGS.TITLE] as string) ?? '(No Subject)',
      start: (r.fields[FIELDS.MEETINGS.START] as string) ?? '',
      timezone: (r.fields[FIELDS.MEETINGS.TIMEZONE] as string) || 'America/New_York',
    })).filter((e: PortalCalendarEvent) => e.start)
  } catch {
    return []
  }
}

interface Props {
  userRecord: CurrentUserRecord
}

export default async function ComingUpNextRegion({ userRecord }: Props) {
  const sessionUser = await getSessionUser()
  const isAdmin = userRecord.role === 'admin'
  const ownerEmail = userRecord.email || undefined

  const [users, upcomingMeetings, coachContexts, coachNotes, portalEvents, coachUsers] = await Promise.all([
    isAdmin || !userRecord.airtableId
      ? getUsers(sessionUser)
      : getClientsByRelationship(userRecord.airtableId),
    getAllUpcomingMeetings(7, ownerEmail),
    !isAdmin && userRecord.airtableId
      ? getRelationshipContexts(userRecord.airtableId)
      : Promise.resolve([]),
    userRecord.airtableId
      ? getNotesByAuthor(userRecord.airtableId)
      : Promise.resolve([]),
    isAdmin && ownerEmail ? getUpcomingPortalEvents(ownerEmail) : Promise.resolve([]),
    getPortalCoaches(userRecord.airtableId ?? undefined),
  ])

  const emailToUser = buildEmailToUserMap(users)
  const now = new Date()

  const notedMeetingIds = new Set(
    coachNotes.map((n) => n.meetingId).filter(Boolean),
  )

  const activeContextIds = new Set(coachContexts.map((c) => c.id))
  const ownershipFilteredUpcoming = isAdmin
    ? upcomingMeetings
    : upcomingMeetings.filter(
        (m) => !m.relationshipContextId || activeContextIds.has(m.relationshipContextId),
      )

  // Dedup
  const seenById = new Set<string>()
  const seenKeys = new Set<string>()
  const dedupedUpcoming = ownershipFilteredUpcoming.filter((m) => {
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
  const upcomingItems: UpcomingItem[] = dedupedUpcoming.map((meeting) => {
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

  const todayStr = getDateInTimezone(now.toISOString())
  const todayItems = upcomingItems.filter(
    (item) => getDateInTimezone(item.startTime, item.timezone || undefined) === todayStr,
  )
  const nextItem = upcomingItems.find((item) => new Date(item.startTime) > now) ?? null
  const otherTodayItems = todayItems.filter((item) => item !== nextItem)

  const nextClient = nextItem?.clientId
    ? (users.find((u) => u.id === nextItem.clientId) ?? null)
    : null

  const clientsForActions = users.map((u) => ({ id: u.id, name: getDisplayName(u) }))
  const coachesForActions = coachUsers.map((u) => ({ id: u.id, name: getDisplayName(u) }))

  return (
    <>
      {/* ── Coming Up Next ───────────────────────────────────────────────────── */}
      {nextItem && (
        <div className="bg-[hsl(213,60%,97%)] border border-[hsl(213,50%,88%)] rounded-xl p-5 mb-4 md:mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="h-4 w-4 text-[hsl(213,70%,45%)]" />
            <span className="text-xs font-semibold uppercase tracking-wide text-[hsl(213,70%,45%)]">
              Coming Up Next
            </span>
            <span className="ml-auto text-xs font-semibold text-[hsl(213,70%,45%)]">
              {formatTimeUntil(nextItem.startTime, now)}
            </span>
          </div>

          <div className="flex items-start gap-4">
            {nextClient && (nextClient.profilePhoto ?? nextClient.avatarUrl) ? (
              <img
                src={(nextClient.profilePhoto ?? nextClient.avatarUrl)!}
                alt={nextItem.clientName ?? ''}
                className="w-12 h-12 rounded-full object-cover flex-shrink-0"
              />
            ) : nextClient ? (
              <div
                className={`w-12 h-12 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0 ${avatarColor(nextClient.id)}`}
              >
                {getInitials(nextClient)}
              </div>
            ) : null}

            <div className="flex-1 min-w-0">
              {nextItem.clientName && (
                <p className="text-sm font-semibold text-[hsl(213,70%,30%)] mb-0.5">
                  {nextItem.clientName}
                </p>
              )}
              <p className="text-base font-bold text-slate-900 leading-snug">
                {nextItem.title || 'Untitled Meeting'}
              </p>
              <p className="text-sm text-slate-500 mt-0.5">{nextItem.timeRange}</p>
            </div>
          </div>

          {nextItem.clientId && (
            <div className="mt-4">
              <Link
                href={`/users/${nextItem.clientId}`}
                className="inline-flex items-center justify-center gap-1.5 h-12 px-6 w-full md:w-auto rounded-lg bg-[hsl(213,70%,30%)] text-white text-base font-medium hover:bg-[hsl(213,70%,25%)] transition-colors"
              >
                Open Client Profile
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          )}
        </div>
      )}

      {/* ── Other today sessions — chip row ──────────────────────────────────── */}
      {otherTodayItems.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1 mb-4 md:mb-6 scrollbar-none">
          {otherTodayItems.map((item) => {
            const inner = (
              <span className="inline-flex items-center gap-2 whitespace-nowrap px-3 py-1.5 rounded-full bg-white border border-slate-200 text-sm hover:border-[hsl(213,60%,70%)] hover:text-[hsl(213,70%,30%)] transition-colors">
                <span className="text-slate-400 text-xs font-medium">{item.timeRange}</span>
                <span className="text-slate-700 font-medium">
                  {item.clientName ?? item.title}
                </span>
              </span>
            )
            return item.clientId ? (
              <Link key={item.meetingId} href={`/users/${item.clientId}`}>
                {inner}
              </Link>
            ) : (
              <div key={item.meetingId}>{inner}</div>
            )
          })}
        </div>
      )}

      {/* ── Quick Actions ─────────────────────────────────────────────────────── */}
      <DashboardQuickActions clients={clientsForActions} coaches={coachesForActions} />

      {/* ── Upcoming Sessions (from Calendar) — admin only ────────────────────── */}
      {isAdmin && portalEvents.length > 0 && (
        <div className="mb-4 md:mb-6 bg-white rounded-xl shadow-sm p-4 md:p-6">
          <div className="flex items-center gap-2 mb-4">
            <CalendarDays className="h-5 w-5 text-slate-400" />
            <h2 className="text-lg font-semibold text-slate-900">Upcoming Sessions (from Calendar)</h2>
            <span className="ml-auto text-xs text-slate-400 font-medium">
              {portalEvents.length} {portalEvents.length === 1 ? 'event' : 'events'}
            </span>
          </div>
          <div className="divide-y divide-slate-100">
            {portalEvents.map((event) => (
              <div key={event.id} className="py-3 flex items-center gap-3">
                <div className="flex-shrink-0 text-center w-10">
                  <p className="text-xs font-medium text-slate-400 uppercase">
                    {new Date(event.start).toLocaleString('en-US', { timeZone: event.timezone, month: 'short' })}
                  </p>
                  <p className="text-lg font-bold text-slate-900 leading-none">
                    {new Date(event.start).toLocaleString('en-US', { timeZone: event.timezone, day: 'numeric' })}
                  </p>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">{event.subject}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {new Date(event.start).toLocaleString('en-US', {
                      timeZone: event.timezone,
                      weekday: 'short',
                      hour: 'numeric',
                      minute: '2-digit',
                      hour12: true,
                    })} ET
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Upcoming This Week ────────────────────────────────────────────────── */}
      <div id="upcoming" className="bg-white rounded-xl shadow-sm p-4 md:p-6">
        <div className="flex items-center gap-2 mb-5">
          <Calendar className="h-5 w-5 text-slate-400" />
          <h2 className="text-lg font-semibold text-slate-900">Upcoming This Week</h2>
          {upcomingItems.length > 0 && (() => {
            const clientCount = upcomingItems.filter((i) => i.clientId).length
            return (
              <span className="ml-auto text-xs text-slate-400 font-medium">
                {clientCount > 0
                  ? `${clientCount} client ${clientCount === 1 ? 'meeting' : 'meetings'}`
                  : `${upcomingItems.length} ${upcomingItems.length === 1 ? 'meeting' : 'meetings'}`}
              </span>
            )
          })()}
        </div>
        <UpcomingSessionsCard items={upcomingItems} />
      </div>
    </>
  )
}
