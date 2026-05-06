import { Calendar } from 'lucide-react'
import { getUsers, getClientsByRelationship } from '@/lib/services/usersService'
import { getRelationshipContexts } from '@/lib/airtable/relationships'
import { getSessionUser } from '@/lib/auth/getSessionUser'
import { getAllUpcomingMeetings, getRecentPastMeetings } from '@/lib/airtable/meetings'
import { buildEmailToUserMap } from '@/lib/services/meetingsService'
import { getNotesByAuthor } from '@/lib/airtable/notes'
import { getCurrentUserRecord } from '@/lib/auth/getCurrentUserRecord'
import { meetingsToUpcomingItems } from '../dashboard/regions/meetingMappers'
import SessionsList from './SessionsList'

const PAST_DAYS = 90
const FUTURE_DAYS = 60

type Filter = 'needs-notes' | 'upcoming' | 'past' | 'all'

function parseFilter(raw: string | undefined): Filter {
  if (raw === 'upcoming' || raw === 'past' || raw === 'all') return raw
  return 'needs-notes'
}

interface Props {
  searchParams: Promise<{ filter?: string }>
}

export default async function SessionsIndexPage({ searchParams }: Props) {
  const { filter: filterParam } = await searchParams
  const initialFilter = parseFilter(filterParam)

  const [sessionUser, userRecord] = await Promise.all([
    getSessionUser(),
    getCurrentUserRecord(),
  ])

  const isAdmin = userRecord.role === 'admin'
  const ownerEmail = userRecord.email || undefined

  const [users, upcomingMeetings, pastMeetings, coachContexts, coachNotes] = await Promise.all([
    isAdmin || !userRecord.airtableId
      ? getUsers(sessionUser)
      : getClientsByRelationship(userRecord.airtableId),
    getAllUpcomingMeetings(FUTURE_DAYS, ownerEmail),
    getRecentPastMeetings(PAST_DAYS, ownerEmail),
    !isAdmin && userRecord.airtableId
      ? getRelationshipContexts(userRecord.airtableId)
      : Promise.resolve([]),
    userRecord.airtableId
      ? getNotesByAuthor(userRecord.airtableId)
      : Promise.resolve([]),
  ])

  const emailToUser = buildEmailToUserMap(users)
  const notedMeetingIds = new Set(coachNotes.map((n) => n.meetingId).filter(Boolean) as string[])
  const activeContextIds = isAdmin ? null : new Set(coachContexts.map((c) => c.id))
  const coachEmail = sessionUser?.email?.toLowerCase() ?? ''

  const upcomingItems = meetingsToUpcomingItems(upcomingMeetings, {
    emailToUser,
    notedMeetingIds,
    coachEmail,
    activeContextIds,
  }).map((i) => ({ ...i, startMs: new Date(i.startTime).getTime(), isPast: false }))

  const pastItems = meetingsToUpcomingItems(pastMeetings, {
    emailToUser,
    notedMeetingIds,
    coachEmail,
    activeContextIds,
  }).map((i) => ({ ...i, startMs: new Date(i.startTime).getTime(), isPast: true }))

  // Combined, dedup by meetingId in case sync window overlaps
  const seen = new Set<string>()
  const combined = [...upcomingItems, ...pastItems].filter((i) => {
    if (seen.has(i.meetingId)) return false
    seen.add(i.meetingId)
    return true
  })

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-5xl mx-auto">
      <div className="mb-6 flex items-center gap-2">
        <Calendar className="h-6 w-6 text-slate-400" />
        <h1 className="text-2xl font-bold text-slate-900">Sessions</h1>
        <span className="ml-auto text-sm text-slate-400">
          {combined.length} session{combined.length === 1 ? '' : 's'} ({PAST_DAYS} days back · {FUTURE_DAYS} days ahead)
        </span>
      </div>

      <SessionsList items={combined} initialFilter={initialFilter} />
    </div>
  )
}
