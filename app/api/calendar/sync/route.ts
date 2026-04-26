import { auth } from '@clerk/nextjs/server'
import { getCurrentUserRecord } from '@/lib/auth/getCurrentUserRecord'

export const maxDuration = 30

const AIRTABLE_API = 'https://api.airtable.com/v0'
const GRAPH_API = 'https://graph.microsoft.com/v1.0'

// ── Auth ─────────────────────────────────────────────────────────────────────

type AuthResult =
  | { authorized: false }
  | { authorized: true; scopeToEmail: string | null }

/**
 * Resolves who is allowed to trigger a sync and what scope they get:
 * - x-sync-secret header (cron job) → sync all coaches (scopeToEmail = null)
 * - Clerk session (manual trigger)  → sync only the logged-in coach's calendar
 */
async function resolveAuth(request: Request): Promise<AuthResult> {
  const secret = process.env.SYNC_SECRET
  if (secret && request.headers.get('x-sync-secret') === secret) {
    return { authorized: true, scopeToEmail: null }
  }
  const { userId } = await auth()
  if (!userId) return { authorized: false }

  // Clerk session: scope to just this coach's Work Email (same value matched in Airtable)
  const userRecord = await getCurrentUserRecord()
  return { authorized: true, scopeToEmail: userRecord.email || null }
}

// ── Airtable: fetch @leadershiptap.com coach emails ──────────────────────────

async function getCoachEmails(): Promise<string[]> {
  const apiKey = process.env.AIRTABLE_API_KEY
  const baseId = process.env.AIRTABLE_BASE_ID
  if (!apiKey || !baseId) throw new Error('Missing AIRTABLE_API_KEY or AIRTABLE_BASE_ID')

  const formula = encodeURIComponent('SEARCH("@leadershiptap.com",{Work Email})')
  const url = `${AIRTABLE_API}/${baseId}/Users?filterByFormula=${formula}&fields[]=Work%20Email&maxRecords=200`

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}` },
    cache: 'no-store',
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Airtable Users fetch failed (${res.status}): ${text}`)
  }

  const data = await res.json()
  const emails: string[] = []
  for (const record of data.records ?? []) {
    const email = (record.fields['Work Email'] as string | undefined)?.trim()
    if (email?.toLowerCase().includes('@leadershiptap.com')) emails.push(email)
  }
  return emails
}

// ── Sync index: people + relationship contexts ────────────────────────────────
// Built once per sync run; passed into each upsertEvent call so we never
// make per-event Airtable lookups.

interface PersonEntry {
  id: string
  name: string
}

interface SyncIndex {
  // Lowercase email → PersonEntry (both Work Email and Email fields indexed)
  emailToPerson: Map<string, PersonEntry>
  // "coachAirtableId|clientAirtableId" → relationship context record ID
  contextByKey: Map<string, string>
}

async function buildSyncIndex(apiKey: string, baseId: string): Promise<SyncIndex> {
  // Fetch all Users: need record IDs, names, and emails for matching
  const usersRes = await fetch(
    `${AIRTABLE_API}/${baseId}/Users?fields[]=Full%20Name&fields[]=First%20Name&fields[]=Last%20Name&fields[]=Work%20Email&fields[]=Email&maxRecords=5000`,
    { headers: { Authorization: `Bearer ${apiKey}` }, cache: 'no-store' },
  )
  const usersData = usersRes.ok ? await usersRes.json() : { records: [] }

  const emailToPerson = new Map<string, PersonEntry>()
  for (const r of usersData.records ?? []) {
    const f = r.fields as Record<string, unknown>
    const fullName = (f['Full Name'] as string | undefined)?.trim()
    const firstName = (f['First Name'] as string | undefined)?.trim()
    const lastName = (f['Last Name'] as string | undefined)?.trim()
    const name = fullName || [firstName, lastName].filter(Boolean).join(' ') || '(Unknown)'
    const entry: PersonEntry = { id: r.id as string, name }
    const workEmail = (f['Work Email'] as string | undefined)?.toLowerCase().trim()
    const email = (f['Email'] as string | undefined)?.toLowerCase().trim()
    if (workEmail) emailToPerson.set(workEmail, entry)
    if (email && email !== workEmail) emailToPerson.set(email, entry)
  }

  // Fetch all active Relationship Contexts: Coach + Client linked IDs
  const ctxRes = await fetch(
    `${AIRTABLE_API}/${baseId}/${encodeURIComponent('Relationship Contexts')}?filterByFormula=${encodeURIComponent('{Status}="active"')}&fields[]=Coach&fields[]=Client&maxRecords=5000`,
    { headers: { Authorization: `Bearer ${apiKey}` }, cache: 'no-store' },
  )
  const ctxData = ctxRes.ok ? await ctxRes.json() : { records: [] }

  const contextByKey = new Map<string, string>()
  for (const r of ctxData.records ?? []) {
    const f = r.fields as Record<string, unknown>
    const coachIds = Array.isArray(f['Coach']) ? (f['Coach'] as string[]) : []
    const clientIds = Array.isArray(f['Client']) ? (f['Client'] as string[]) : []
    for (const coachId of coachIds) {
      for (const clientId of clientIds) {
        contextByKey.set(`${coachId}|${clientId}`, r.id as string)
      }
    }
  }

  return { emailToPerson, contextByKey }
}

// ── Microsoft Graph: get access token ────────────────────────────────────────

async function getGraphToken(): Promise<string> {
  const tenantId = process.env.AZURE_TENANT_ID
  const clientId = process.env.AZURE_CLIENT_ID
  const clientSecret = process.env.AZURE_CLIENT_SECRET
  if (!tenantId || !clientId || !clientSecret) {
    throw new Error('Missing AZURE_TENANT_ID, AZURE_CLIENT_ID, or AZURE_CLIENT_SECRET')
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10_000)

  let res: Response
  try {
    res = await fetch(
      `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: clientId,
          client_secret: clientSecret,
          scope: 'https://graph.microsoft.com/.default',
        }).toString(),
        signal: controller.signal,
        cache: 'no-store',
      },
    )
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw new Error('Graph auth timeout')
    throw err
  } finally {
    clearTimeout(timeout)
  }

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Graph token request failed (${res.status}): ${text}`)
  }

  const data = await res.json()
  return data.access_token as string
}

// ── Microsoft Graph: fetch calendar events for one mailbox ───────────────────

interface GraphAttendee {
  emailAddress: { address: string; name: string }
  type: string
}

interface GraphEventDateTime {
  dateTime?: string
  date?: string
  timeZone: string
}

interface GraphEvent {
  id: string
  subject: string
  start: GraphEventDateTime
  end: GraphEventDateTime
  attendees?: GraphAttendee[]
}

async function fetchEvents(token: string, email: string): Promise<GraphEvent[]> {
  const now = new Date()
  const end = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000)

  const params = new URLSearchParams({
    startDateTime: now.toISOString(),
    endDateTime: end.toISOString(),
    $select: 'id,subject,start,end,attendees',
    $top: '500',
  })

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15_000)

  let res: Response
  try {
    res = await fetch(
      `${GRAPH_API}/users/${encodeURIComponent(email)}/calendarView?${params}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
        cache: 'no-store',
      },
    )
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw new Error(`Graph calendar timeout for ${email}`)
    throw err
  } finally {
    clearTimeout(timeout)
  }

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Graph calendarView failed for ${email} (${res.status}): ${text}`)
  }

  const data = await res.json()
  return (data.value ?? []) as GraphEvent[]
}

// ── Airtable: upsert one Portal Calendar Events record ───────────────────────

async function upsertEvent(
  apiKey: string,
  baseId: string,
  event: GraphEvent,
  coachEmail: string,
  syncIndex: SyncIndex,
): Promise<void> {
  const start = event.start.dateTime ?? event.start.date
  const end = event.end.dateTime ?? event.end.date
  if (!start || !end) throw new Error(`Event ${event.id} has no start/end`)

  const coachLower = coachEmail.toLowerCase()

  // Build participant list: all attendees excluding coach and other @leadershiptap.com addresses
  const attendees = (event.attendees ?? []).filter(
    (a) =>
      a.emailAddress.address.toLowerCase() !== coachLower &&
      !a.emailAddress.address.toLowerCase().includes('@leadershiptap.com'),
  )

  const participantEmails = attendees
    .map((a) => a.emailAddress.address.trim())
    .filter(Boolean)
    .join(', ')

  // Note Name: "YYYY-MM-DD // First Attendee Name-or-Email"
  const dateStr = start.slice(0, 10) // YYYY-MM-DD from ISO
  const firstAttendee = attendees[0]
  const attendeeDisplay =
    firstAttendee?.emailAddress.name?.trim() ||
    firstAttendee?.emailAddress.address?.trim() ||
    event.subject ||
    '(No Attendee)'
  const noteName = `${dateStr} // ${attendeeDisplay}`

  // Match attendees against known Airtable people.
  // Client Name: any attendee in the system (email match), comma-separated.
  // Relationship Context ID: first attendee who also has an active context with this coach.
  const coachEntry = syncIndex.emailToPerson.get(coachEmail.toLowerCase())
  const clientNames: string[] = []
  let matchedContextId = ''
  if (coachEntry) {
    for (const a of attendees) {
      const clientEntry = syncIndex.emailToPerson.get(a.emailAddress.address.toLowerCase())
      if (!clientEntry) continue
      clientNames.push(clientEntry.name)
      if (!matchedContextId) {
        const contextId = syncIndex.contextByKey.get(`${coachEntry.id}|${clientEntry.id}`)
        if (contextId) matchedContextId = contextId
      }
    }
  }
  const matchedClientName = clientNames.join(', ')

  // These fields are always written on both POST and PATCH.
  // Notes is intentionally omitted — coaches fill it in manually.
  const fields = {
    'Subject': event.subject ?? '(No Subject)',
    'Start': start,
    'End': end,
    'Provider Event ID': event.id,
    'Participant Emails': participantEmails,
    'Note Name': noteName,
    'Calendar Owner': coachEmail,
    'Client Name': matchedClientName,
    'Relationship Context ID': matchedContextId,
  }

  const table = encodeURIComponent('Portal Calendar Events')
  const safeId = event.id.replace(/"/g, '\\"')
  const formula = encodeURIComponent(`({Provider Event ID}="${safeId}")`)

  const findRes = await fetch(
    `${AIRTABLE_API}/${baseId}/${table}?filterByFormula=${formula}&maxRecords=1&fields[]=Provider%20Event%20ID`,
    { headers: { Authorization: `Bearer ${apiKey}` }, cache: 'no-store' },
  )
  const findData = findRes.ok ? await findRes.json() : { records: [] }
  const existingId = (findData.records?.[0]?.id as string) ?? null

  if (existingId) {
    const res = await fetch(`${AIRTABLE_API}/${baseId}/${table}/${existingId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields }),
    })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`PATCH failed for ${event.id}: ${text}`)
    }
  } else {
    const res = await fetch(`${AIRTABLE_API}/${baseId}/${table}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields }),
    })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`POST failed for ${event.id}: ${text}`)
    }
  }
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    console.log('[calendar/sync] Starting sync')

    const authResult = await resolveAuth(request)
    if (!authResult.authorized) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { scopeToEmail } = authResult
    const isCron = scopeToEmail === null
    console.log(isCron ? '[calendar/sync] Cron: syncing all coaches' : `[calendar/sync] Manual: scoped to ${scopeToEmail}`)

    // 1. Discover coach emails (all for cron; just the current user for manual)
    let coachEmails: string[]
    if (isCron) {
      console.log('[calendar/sync] Fetching coach emails from Airtable...')
      try {
        coachEmails = await getCoachEmails()
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to fetch coach emails'
        console.error('[calendar/sync]', msg)
        return Response.json({ error: msg }, { status: 500 })
      }
    } else {
      coachEmails = [scopeToEmail!]
    }
    console.log(`[calendar/sync] Found ${coachEmails.length} coaches:`, coachEmails)

    if (coachEmails.length === 0) {
      return Response.json({
        synced: 0,
        coaches: [],
        errors: ['No @leadershiptap.com emails found in Airtable Users (check Work Email field)'],
      })
    }

    // 2. Get Graph token
    console.log('[calendar/sync] Getting Graph token...')
    let token: string
    try {
      token = await getGraphToken()
      console.log('[calendar/sync] Token received')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to get Graph token'
      console.error('[calendar/sync] Token failed:', msg)
      return Response.json({ error: msg }, { status: 500 })
    }

    const apiKey = process.env.AIRTABLE_API_KEY!
    const baseId = process.env.AIRTABLE_BASE_ID!

    // 3. Build the people + relationship-context index (one fetch, used per-event)
    console.log('[calendar/sync] Building sync index...')
    const syncIndex = await buildSyncIndex(apiKey, baseId)
    console.log(`[calendar/sync] Index: ${syncIndex.emailToPerson.size} people, ${syncIndex.contextByKey.size} context keys`)

    // 4. Sync each mailbox
    let synced = 0
    const errors: string[] = []
    const syncedCoaches: string[] = []

    for (const email of coachEmails) {
      console.log(`[calendar/sync] Syncing ${email}...`)

      let events: GraphEvent[]
      try {
        events = await fetchEvents(token, email)
        console.log(`[calendar/sync] ${email}: ${events.length} events before filtering`)
      } catch (err) {
        const msg = err instanceof Error ? err.message : `Failed to fetch events for ${email}`
        console.error(`[calendar/sync] ${msg}`)
        errors.push(msg)
        continue
      }

      // Filter out internal buffer/block events and meetings with no external clients.
      const NOISE_PATTERN = /buffer|focus time|ooo|out of office|hold|block/i
      const coachLower = email.toLowerCase()
      events = events.filter((event) => {
        const attendees = event.attendees ?? []
        // Skip events with 0 or 1 attendees (no client on the invite)
        if (attendees.length <= 1) return false
        // Skip known buffer/block subjects
        if (NOISE_PATTERN.test(event.subject ?? '')) return false
        // Skip events where every attendee is @leadershiptap.com (internal-only)
        const hasExternalClient = attendees.some(
          (a) =>
            !a.emailAddress.address.toLowerCase().endsWith('@leadershiptap.com') &&
            a.emailAddress.address.toLowerCase() !== coachLower,
        )
        return hasExternalClient
      })
      console.log(`[calendar/sync] ${email}: ${events.length} events after filtering`)

      for (const event of events) {
        try {
          await upsertEvent(apiKey, baseId, event, email, syncIndex)
          synced++
        } catch (err) {
          const msg = err instanceof Error ? err.message : `Failed to upsert ${event.id}`
          console.error(`[calendar/sync] ${msg}`)
          errors.push(msg)
        }
      }

      syncedCoaches.push(email)
    }

    console.log(`[calendar/sync] Done: ${synced} events synced across ${syncedCoaches.length} mailboxes`)
    return Response.json({ synced, coaches: syncedCoaches, errors })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unexpected error'
    console.error('[calendar/sync] Unhandled error:', err)
    return Response.json({ error: msg }, { status: 500 })
  }
}
