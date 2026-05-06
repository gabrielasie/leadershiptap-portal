import Link from 'next/link'
import { FileText, ChevronRight } from 'lucide-react'
import { getUsers, getClientsByRelationship } from '@/lib/services/usersService'
import { getRelationshipContexts } from '@/lib/airtable/relationships'
import { getSessionUser } from '@/lib/auth/getSessionUser'
import { getRecentPastMeetings } from '@/lib/airtable/meetings'
import { buildEmailToUserMap } from '@/lib/services/meetingsService'
import { getNotesByAuthor } from '@/lib/airtable/notes'
import { getDateInTimezone } from '@/lib/utils/dateFormat'
import { meetingsToUpcomingItems } from './meetingMappers'
import type { CurrentUserRecord } from '@/lib/auth/getCurrentUserRecord'

const DAYS_BACK = 14
const MAX_VISIBLE = 6

interface Props {
  userRecord: CurrentUserRecord
}

export default async function SessionsNeedingNotesRegion({ userRecord }: Props) {
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
  const notedMeetingIds = new Set(coachNotes.map((n) => n.meetingId).filter(Boolean) as string[])
  const activeContextIds = isAdmin ? null : new Set(coachContexts.map((c) => c.id))
  const coachEmail = sessionUser?.email?.toLowerCase() ?? ''

  const allItems = meetingsToUpcomingItems(pastMeetings, {
    emailToUser,
    notedMeetingIds,
    coachEmail,
    activeContextIds,
  })

  // Worklist semantics: only sessions without notes, exclude today (those
  // appear in the Today chip row above).
  const todayStr = getDateInTimezone(new Date().toISOString())
  const items = allItems.filter(
    (item) =>
      !item.hasNote &&
      getDateInTimezone(item.startTime, item.timezone || undefined) !== todayStr,
  )

  if (items.length === 0) return null

  const visible = items.slice(0, MAX_VISIBLE)
  const overflow = items.length - visible.length

  return (
    <div className="mb-4 md:mb-6 bg-white rounded-xl shadow-sm p-4 md:p-6">
      <div className="flex items-center gap-2 mb-3">
        <FileText className="h-5 w-5 text-amber-500" />
        <h2 className="text-lg font-semibold text-slate-900">Sessions Needing Notes</h2>
        <span className="ml-auto text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
          {items.length} pending
        </span>
      </div>
      <ul className="divide-y divide-slate-100">
        {visible.map((item) => {
          const dateLabel = `${item.weekday} ${item.month} ${item.day}`
          const subjectName = item.clientName ?? item.displayLabel ?? 'Unknown'
          const href = item.clientId
            ? `/users/${item.clientId}/sessions/${item.meetingId}`
            : `/sessions/${item.meetingId}`
          return (
            <li key={item.meetingId}>
              <Link
                href={href}
                className="flex items-center gap-3 py-2.5 px-1 rounded-md hover:bg-slate-50 transition-colors group"
              >
                <span className="text-xs font-medium text-slate-400 w-20 flex-shrink-0">
                  {dateLabel}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">
                    {subjectName}
                    <span className="text-slate-400 font-normal">
                      {' · '}
                      {item.title || 'Untitled'}
                    </span>
                  </p>
                </div>
                <span className="text-xs font-medium text-[hsl(213,70%,40%)] whitespace-nowrap group-hover:text-[hsl(213,70%,30%)]">
                  Add notes
                </span>
                <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-slate-500 flex-shrink-0" />
              </Link>
            </li>
          )
        })}
      </ul>
      {overflow > 0 && (
        <p className="text-xs text-slate-400 mt-3 pl-1">
          and {overflow} more session{overflow === 1 ? '' : 's'} from the last {DAYS_BACK} days
        </p>
      )}
    </div>
  )
}
