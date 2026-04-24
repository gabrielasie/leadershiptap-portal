import { auth } from '@clerk/nextjs/server'
import { getGraphAccessToken } from '@/lib/graph/auth'
import { fetchCalendarEvents } from '@/lib/graph/calendar'
import { upsertCalendarEvent } from '@/lib/airtable/calendarEvents'

// Sync events from the last 90 days to 30 days ahead
const DAYS_BACK = 90
const DAYS_AHEAD = 30

function getCoachEmails(): string[] {
  const emails: string[] = []
  if (process.env.GRAPH_COACH_EMAIL) emails.push(process.env.GRAPH_COACH_EMAIL)
  if (process.env.GRAPH_COACH_EMAIL_2) emails.push(process.env.GRAPH_COACH_EMAIL_2)
  if (process.env.GRAPH_COACH_EMAIL_3) emails.push(process.env.GRAPH_COACH_EMAIL_3)
  return emails
}

export async function POST() {
  // Verify Clerk session
  const { userId } = await auth()
  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const coachEmails = getCoachEmails()
  if (coachEmails.length === 0) {
    return Response.json(
      { error: 'No coach emails configured (GRAPH_COACH_EMAIL)' },
      { status: 500 },
    )
  }

  let accessToken: string
  try {
    accessToken = await getGraphAccessToken()
  } catch (err) {
    console.error('[calendar/sync] Failed to get Graph token:', err)
    return Response.json(
      { error: err instanceof Error ? err.message : 'Failed to authenticate with Microsoft Graph' },
      { status: 500 },
    )
  }

  const now = new Date()
  const startDate = new Date(now.getTime() - DAYS_BACK * 24 * 60 * 60 * 1000)
  const endDate = new Date(now.getTime() + DAYS_AHEAD * 24 * 60 * 60 * 1000)

  let synced = 0
  const errors: string[] = []

  for (const coachEmail of coachEmails) {
    let events
    try {
      events = await fetchCalendarEvents(accessToken, coachEmail, startDate, endDate)
      console.log(`[calendar/sync] Fetched ${events.length} events for ${coachEmail}`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : `Failed to fetch events for ${coachEmail}`
      console.error(`[calendar/sync] ${msg}`)
      errors.push(msg)
      continue
    }

    for (const event of events) {
      try {
        const attendeeEmails = event.attendees
          .map((a) => a.emailAddress.address)
          .filter(Boolean)

        await upsertCalendarEvent({
          providerEventId: event.id,
          eventName: event.subject ?? '(No Subject)',
          startTime: event.start.dateTime,
          endTime: event.end.dateTime,
          senderEmail: coachEmail,
          participantEmails: attendeeEmails,
        })
        synced++
      } catch (err) {
        const msg = err instanceof Error ? err.message : `Failed to upsert event ${event.id}`
        console.error(`[calendar/sync] ${msg}`)
        errors.push(msg)
      }
    }
  }

  return Response.json({ synced, errors })
}
