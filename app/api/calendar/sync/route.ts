import { auth } from '@clerk/nextjs/server'
import { getGraphAccessToken } from '@/lib/graph/auth'
import { fetchCalendarEvents } from '@/lib/graph/calendar'
import { upsertCalendarEvent } from '@/lib/airtable/calendarEvents'

export const maxDuration = 30 // seconds (Vercel serverless function limit)

const DAYS_BACK = 90
const DAYS_AHEAD = 30
const DOMAIN = '@leadershiptap.com'

// Fetch Work Email for all Airtable users with a @leadershiptap.com address.
async function getLeadershipTapEmails(): Promise<string[]> {
  const apiKey = process.env.AIRTABLE_API_KEY
  const baseId = process.env.AIRTABLE_BASE_ID
  if (!apiKey || !baseId) throw new Error('Missing Airtable credentials')

  const formula = encodeURIComponent(`SEARCH("${DOMAIN}", {Work Email})`)
  const res = await fetch(
    `https://api.airtable.com/v0/${baseId}/Users?filterByFormula=${formula}&fields[]=Work%20Email&maxRecords=200`,
    { headers: { Authorization: `Bearer ${apiKey}` }, cache: 'no-store' },
  )
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Airtable Users fetch failed: ${text}`)
  }
  const data = await res.json()

  const emails: string[] = []
  for (const record of data.records ?? []) {
    const email = (record.fields['Work Email'] as string | undefined)?.trim()
    if (email?.toLowerCase().includes(DOMAIN)) emails.push(email)
  }
  return emails
}

// Allow requests authenticated by either a Clerk session or the sync secret header.
async function isAuthorized(request: Request): Promise<boolean> {
  const syncSecret = process.env.SYNC_SECRET
  if (syncSecret && request.headers.get('x-sync-secret') === syncSecret) return true
  const { userId } = await auth()
  return userId !== null
}

export async function POST(request: Request) {
  try {
    console.log('[calendar/sync] Starting sync')

    if (!(await isAuthorized(request))) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // ── 1. Discover coach emails ────────────────────────────────────────────
    console.log('[calendar/sync] Fetching emails from Airtable...')
    let coachEmails: string[]
    try {
      coachEmails = await getLeadershipTapEmails()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch emails from Airtable'
      console.error('[calendar/sync] Airtable email fetch failed:', msg)
      return Response.json({ error: msg }, { status: 500 })
    }
    console.log(`[calendar/sync] Found ${coachEmails.length} emails:`, coachEmails)

    if (coachEmails.length === 0) {
      return Response.json({
        synced: 0,
        coaches: [],
        errors: [`No ${DOMAIN} users found in Airtable (check Work Email field)`],
      })
    }

    // ── 2. Get Graph token ──────────────────────────────────────────────────
    console.log('[calendar/sync] Getting Graph token...')
    let accessToken: string
    try {
      accessToken = await getGraphAccessToken()
      console.log('[calendar/sync] Token received')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to authenticate with Microsoft Graph'
      console.error('[calendar/sync] Token failed:', msg)
      return Response.json({ error: msg }, { status: 500 })
    }

    // ── 3. Sync each mailbox ────────────────────────────────────────────────
    const now = new Date()
    const startDate = new Date(now.getTime() - DAYS_BACK * 24 * 60 * 60 * 1000)
    const endDate = new Date(now.getTime() + DAYS_AHEAD * 24 * 60 * 60 * 1000)

    let synced = 0
    const errors: string[] = []
    const syncedCoaches: string[] = []

    for (const coachEmail of coachEmails) {
      console.log(`[calendar/sync] Syncing ${coachEmail}...`)

      let events
      try {
        events = await fetchCalendarEvents(accessToken, coachEmail, startDate, endDate)
        console.log(`[calendar/sync] ${coachEmail}: ${events.length} events fetched`)
      } catch (err) {
        const msg = err instanceof Error ? err.message : `Failed to fetch events for ${coachEmail}`
        console.error(`[calendar/sync] ${msg}`)
        errors.push(msg)
        continue
      }

      for (const event of events) {
        try {
          await upsertCalendarEvent({
            providerEventId: event.id,
            eventName: event.subject ?? '(No Subject)',
            startTime: event.start.dateTime,
            endTime: event.end.dateTime,
            senderEmail: coachEmail,
            participantEmails: event.attendees
              .map((a) => a.emailAddress.address)
              .filter(Boolean),
          })
          synced++
        } catch (err) {
          const msg = err instanceof Error ? err.message : `Failed to upsert event ${event.id}`
          console.error(`[calendar/sync] ${msg}`)
          errors.push(msg)
        }
      }

      syncedCoaches.push(coachEmail)
    }

    console.log(`[calendar/sync] Done: ${synced} events synced across ${syncedCoaches.length} mailboxes`)
    return Response.json({ synced, coaches: syncedCoaches, errors })

  } catch (err) {
    // Top-level safety net — ensures the route always responds
    const msg = err instanceof Error ? err.message : 'Unexpected sync error'
    console.error('[calendar/sync] Unhandled error:', err)
    return Response.json({ error: msg }, { status: 500 })
  }
}
