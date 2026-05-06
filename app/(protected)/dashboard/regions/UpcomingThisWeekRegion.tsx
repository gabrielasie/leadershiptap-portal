import { Calendar } from 'lucide-react'
import { getUsers, getClientsByRelationship } from '@/lib/services/usersService'
import { getRelationshipContexts } from '@/lib/airtable/relationships'
import { getSessionUser } from '@/lib/auth/getSessionUser'
import { getAllUpcomingMeetings } from '@/lib/airtable/meetings'
import { buildEmailToUserMap } from '@/lib/services/meetingsService'
import { getNotesByAuthor } from '@/lib/airtable/notes'
import { getDateInTimezone } from '@/lib/utils/dateFormat'
import UpcomingSessionsCard from '../UpcomingSessionsCard'
import { meetingsToUpcomingItems } from './meetingMappers'
import type { CurrentUserRecord } from '@/lib/auth/getCurrentUserRecord'

interface Props {
  userRecord: CurrentUserRecord
}

export default async function UpcomingThisWeekRegion({ userRecord }: Props) {
  const sessionUser = await getSessionUser()
  const isAdmin = userRecord.role === 'admin'
  const ownerEmail = userRecord.email || undefined

  const [users, upcomingMeetings, coachContexts, coachNotes] = await Promise.all([
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
  ])

  const emailToUser = buildEmailToUserMap(users)
  const notedMeetingIds = new Set(coachNotes.map((n) => n.meetingId).filter(Boolean) as string[])
  const activeContextIds = isAdmin ? null : new Set(coachContexts.map((c) => c.id))
  const coachEmail = sessionUser?.email?.toLowerCase() ?? ''

  const allItems = meetingsToUpcomingItems(upcomingMeetings, {
    emailToUser,
    notedMeetingIds,
    coachEmail,
    activeContextIds,
  })

  // Hide today (those are in the Today chip row in ComingUpNextRegion).
  const todayStr = getDateInTimezone(new Date().toISOString())
  const items = allItems.filter(
    (item) => getDateInTimezone(item.startTime, item.timezone || undefined) !== todayStr,
  )

  if (items.length === 0) return null

  const clientCount = items.filter((i) => i.clientId).length

  return (
    <div id="upcoming" className="bg-white rounded-xl shadow-sm p-4 md:p-6 mb-4 md:mb-6">
      <div className="flex items-center gap-2 mb-5">
        <Calendar className="h-5 w-5 text-slate-400" />
        <h2 className="text-lg font-semibold text-slate-900">Upcoming This Week</h2>
        <span className="ml-auto text-xs text-slate-400 font-medium">
          {clientCount > 0
            ? `${clientCount} client ${clientCount === 1 ? 'meeting' : 'meetings'}`
            : `${items.length} ${items.length === 1 ? 'meeting' : 'meetings'}`}
        </span>
      </div>
      <UpcomingSessionsCard items={items} />
    </div>
  )
}
