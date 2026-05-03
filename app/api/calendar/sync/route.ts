import { auth } from '@clerk/nextjs/server'
import { getCurrentUserRecord } from '@/lib/auth/getCurrentUserRecord'
import { TABLES, FIELDS } from '@/lib/airtable/constants'

export const maxDuration = 60

const AIRTABLE_API = 'https://api.airtable.com/v0'
const GRAPH_API = 'https://graph.microsoft.com/v1.0'
const MEETINGS_TABLE = encodeURIComponent(TABLES.MEETINGS)

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
  const userRecord = await getCurrentUserRecord()
  return { authorized: true, scopeToEmail: userRecord.email || null }
}

// ── Airtable: fetch @leadershiptap.com coach emails ──────────────────────────

async function getCoachEmails(): Promise<string[]> {
  const apiKey = process.env.AIRTABLE_API_KEY
  const baseId = process.env.AIRTABLE_BASE_ID
  if (!apiKey || !baseId) throw new Error('Missing AIRTABLE_API_KEY or AIRTABLE_BASE_ID')

  const formula = encodeURIComponent('SEARCH("@leadershiptap.com",{Work Email})')
  const res = await fetch(
    `${AIRTABLE_API}/${baseId}/${TABLES.PEOPLE}?filterByFormula=${formula}&fields[]=Work%20Email&maxRecords=200`,
    { headers: { Authorization: `Bearer ${apiKey}` }, cache: 'no-store' },
  )
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

// ── Global sync index ─────────────────────────────────────────────────────────
// Fetched once per sync run; used to build per-coach context maps in memory.

interface UserEntry {
  id: string
  name: string
  firstName: string
}

interface ContextEntry {
  id: string       // Relationship Context record ID
  leadId: string   // coach's Airtable ID
  personId: string // coachee's Airtable ID
  personName: string
}

interface SyncIndex {
  emailToUser: Map<string, UserEntry>  // lowercase email → user
  idToEmails: Map<string, string[]>    // airtable ID → [lowercase emails]
  contexts: ContextEntry[]             // all active relationship contexts
}

async function buildSyncIndex(apiKey: string, baseId: string): Promise<SyncIndex> {
  const [usersRes, ctxRes] = await Promise.all([
    fetch(
      `${AIRTABLE_API}/${baseId}/${TABLES.PEOPLE}` +
        `?fields[]=Full%20Name&fields[]=First%20Name&fields[]=Last%20Name` +
        `&fields[]=Work%20Email&fields[]=Email&maxRecords=5000`,
      { headers: { Authorization: `Bearer ${apiKey}` }, cache: 'no-store' },
    ),
    fetch(
      `${AIRTABLE_API}/${baseId}/${encodeURIComponent(TABLES.RELATIONSHIP_CONTEXTS)}` +
        `?filterByFormula=${encodeURIComponent(`{${FIELDS.RELATIONSHIP_CONTEXTS.STATUS}}="Active"`)}&maxRecords=5000`,
      { headers: { Authorization: `Bearer ${apiKey}` }, cache: 'no-store' },
    ),
  ])

  const usersData = usersRes.ok ? await usersRes.json() : { records: [] }
  const ctxData = ctxRes.ok ? await ctxRes.json() : { records: [] }

  const emailToUser = new Map<string, UserEntry>()
  const idToUser = new Map<string, UserEntry>()
  const idToEmails = new Map<string, string[]>()

  for (const r of usersData.records ?? []) {
    const f = r.fields as Record<string, unknown>
    const fullName = (f['Full Name'] as string | undefined)?.trim()
    const firstName = (f['First Name'] as string | undefined)?.trim() ?? ''
    const lastName = (f['Last Name'] as string | undefined)?.trim()
    const name = fullName || [firstName, lastName].filter(Boolean).join(' ') || '(Unknown)'
    const entry: UserEntry = { id: r.id as string, name, firstName }
    idToUser.set(r.id as string, entry)

    const workEmail = (f['Work Email'] as string | undefined)?.toLowerCase().trim()
    const email = (f['Email'] as string | undefined)?.toLowerCase().trim()
    const emails: string[] = []
    if (workEmail) {
      emailToUser.set(workEmail, entry)
      emails.push(workEmail)
    }
    if (email && email !== workEmail) {
      emailToUser.set(email, entry)
      emails.push(email)
    }
    if (emails.length > 0) idToEmails.set(r.id as string, emails)
  }

  const contexts: ContextEntry[] = []
  for (const r of ctxData.records ?? []) {
    const f = r.fields as Record<string, unknown>
    const leadIds = Array.isArray(f[FIELDS.RELATIONSHIP_CONTEXTS.LEAD])
      ? (f[FIELDS.RELATIONSHIP_CONTEXTS.LEAD] as string[])
      : []
    const personIds = Array.isArray(f[FIELDS.RELATIONSHIP_CONTEXTS.PERSON])
      ? (f[FIELDS.RELATIONSHIP_CONTEXTS.PERSON] as string[])
      : []
    if (leadIds.length === 0 || personIds.length === 0) continue
    const leadId = leadIds[0]
    const personId = personIds[0]
    contexts.push({
      id: r.id as string,
      leadId,
      personId,
      personName: idToUser.get(personId)?.name ?? personId,
    })
  }

  return { emailToUser, idToEmails, contexts }
}

// Per-coach context map: lowercase person email → match info
type CoachContextMap = Map<string, { contextId: string; personId: string; personName: string }>

function buildCoachContextMap(
  coachEmail: string,
  index: SyncIndex,
): { contextMap: CoachContextMap; coachFirstName: string } {
  const coachEntry = index.emailToUser.get(coachEmail.toLowerCase())
  const contextMap: CoachContextMap = new Map()
  if (!coachEntry) return { contextMap, coachFirstName: '' }

  for (const ctx of index.contexts) {
    if (ctx.leadId !== coachEntry.id) continue
    for (const email of index.idToEmails.get(ctx.personId) ?? []) {
      contextMap.set(email, {
        contextId: ctx.id,
        personId: ctx.personId,
        personName: ctx.personName,
      })
    }
  }

  return { contextMap, coachFirstName: coachEntry.firstName }
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
  isCancelled?: boolean
  iCalUId?: string
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
    $select: 'id,subject,isCancelled,iCalUId,start,end,attendees',
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

// ── Event pre-filter ──────────────────────────────────────────────────────────

const NOISE_PATTERN =
  /buffer|focus day|recovery day|ooo|out of office|hold|block|haircut|lunch w\//i

/**
 * Returns true if the event should be discarded before attendee matching.
 * Cancelled events are NOT passed here — they are handled separately.
 */
function shouldDiscard(event: GraphEvent, coachEmail: string): boolean {
  const attendees = event.attendees ?? []
  if (attendees.length === 0) return true

  const coachLower = coachEmail.toLowerCase()
  const others = attendees
    .map((a) => a.emailAddress.address.toLowerCase())
    .filter((e) => e !== coachLower)

  if (others.length === 0) return true

  const hasExternal = others.some((e) => !e.endsWith('@leadershiptap.com'))
  if (!hasExternal) return true

  if (NOISE_PATTERN.test(event.subject ?? '')) return true

  return false
}

// ── Airtable: upsert one Meeting record (fan-out) ─────────────────────────────

async function upsertMeeting(
  apiKey: string,
  baseId: string,
  event: GraphEvent,
  coachEmail: string,
  coachFirstName: string,
  contextId: string,
  personName: string,
): Promise<void> {
  const start = event.start.dateTime ?? event.start.date
  const end = event.end.dateTime ?? event.end.date
  if (!start || !end) throw new Error(`Event ${event.id} has no start/end`)

  const fields = {
    [FIELDS.MEETINGS.TITLE]: `${coachFirstName} / ${personName} — ${event.subject ?? '(No Subject)'}`,
    [FIELDS.MEETINGS.REL_CONTEXT]: [contextId],  // linked field — always an array
    [FIELDS.MEETINGS.START]: start,
    [FIELDS.MEETINGS.END]: end,
    [FIELDS.MEETINGS.STATUS]: 'Scheduled',
    [FIELDS.MEETINGS.PROVIDER]: 'Outlook',
    [FIELDS.MEETINGS.PROVIDER_EVENT_ID]: event.id,
    [FIELDS.MEETINGS.ICAL_UID]: event.iCalUId ?? '',
    [FIELDS.MEETINGS.OWNER_EMAIL]: coachEmail,
    [FIELDS.MEETINGS.TIMEZONE]: event.start.timeZone ?? 'America/New_York',
  }

  // Find existing records matching this Provider Event ID.
  // Airtable formula filters on linked record fields return primary field values, not IDs,
  // so we fetch all matches and filter by contextId in JavaScript.
  const safeId = event.id.replace(/"/g, '\\"')
  const formula = encodeURIComponent(`{${FIELDS.MEETINGS.PROVIDER_EVENT_ID}}="${safeId}"`)
  const findRes = await fetch(
    `${AIRTABLE_API}/${baseId}/${MEETINGS_TABLE}?filterByFormula=${formula}&maxRecords=50` +
      `&fields[]=${encodeURIComponent(FIELDS.MEETINGS.PROVIDER_EVENT_ID)}` +
      `&fields[]=${encodeURIComponent(FIELDS.MEETINGS.REL_CONTEXT)}`,
    { headers: { Authorization: `Bearer ${apiKey}` }, cache: 'no-store' },
  )
  const findData = findRes.ok ? await findRes.json() : { records: [] }

  const existingRecord = (findData.records ?? []).find(
    (r: { id: string; fields: Record<string, unknown> }) => {
      const ctxIds = Array.isArray(r.fields[FIELDS.MEETINGS.REL_CONTEXT])
        ? (r.fields[FIELDS.MEETINGS.REL_CONTEXT] as string[])
        : []
      return ctxIds.includes(contextId)
    },
  )

  if (existingRecord) {
    const res = await fetch(`${AIRTABLE_API}/${baseId}/${MEETINGS_TABLE}/${existingRecord.id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields }),
    })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`PATCH failed for ${event.id}|${contextId}: ${text}`)
    }
  } else {
    const res = await fetch(`${AIRTABLE_API}/${baseId}/${MEETINGS_TABLE}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields }),
    })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`POST failed for ${event.id}|${contextId}: ${text}`)
    }
  }
}

// ── Airtable: mark all Meeting records for an event as Cancelled ──────────────

async function cancelMeetings(
  apiKey: string,
  baseId: string,
  providerEventId: string,
): Promise<number> {
  const safeId = providerEventId.replace(/"/g, '\\"')
  const formula = encodeURIComponent(`{${FIELDS.MEETINGS.PROVIDER_EVENT_ID}}="${safeId}"`)
  const findRes = await fetch(
    `${AIRTABLE_API}/${baseId}/${MEETINGS_TABLE}?filterByFormula=${formula}&maxRecords=50` +
      `&fields[]=${encodeURIComponent(FIELDS.MEETINGS.PROVIDER_EVENT_ID)}`,
    { headers: { Authorization: `Bearer ${apiKey}` }, cache: 'no-store' },
  )
  if (!findRes.ok) return 0
  const findData = await findRes.json()

  let cancelled = 0
  for (const r of findData.records ?? []) {
    const patchRes = await fetch(`${AIRTABLE_API}/${baseId}/${MEETINGS_TABLE}/${r.id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: { [FIELDS.MEETINGS.STATUS]: 'Cancelled' } }),
    })
    if (patchRes.ok) cancelled++
  }
  return cancelled
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    console.log('[sync] Starting sync')

    const authResult = await resolveAuth(request)
    if (!authResult.authorized) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { scopeToEmail } = authResult
    const isCron = scopeToEmail === null
    console.log(
      isCron
        ? '[sync] Cron: syncing all coaches'
        : `[sync] Manual: scoped to ${scopeToEmail}`,
    )

    // 1. Discover coach emails (all for cron; just the current user for manual)
    let coachEmails: string[]
    if (isCron) {
      try {
        coachEmails = await getCoachEmails()
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to fetch coach emails'
        console.error('[sync]', msg)
        return Response.json({ error: msg }, { status: 500 })
      }
    } else {
      coachEmails = [scopeToEmail!]
    }
    console.log(`[sync] Found ${coachEmails.length} coaches:`, coachEmails)

    if (coachEmails.length === 0) {
      return Response.json({
        synced: 0,
        coaches: [],
        errors: ['No @leadershiptap.com emails found in Airtable Users (check Work Email field)'],
      })
    }

    // 2. Get Graph token
    let token: string
    try {
      token = await getGraphToken()
      console.log('[sync] Graph token received')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to get Graph token'
      console.error('[sync] Token failed:', msg)
      return Response.json({ error: msg }, { status: 500 })
    }

    const apiKey = process.env.AIRTABLE_API_KEY!
    const baseId = process.env.AIRTABLE_BASE_ID!

    // 3. Build the global people + relationship-context index (one fetch, used per-coach)
    console.log('[sync] Building sync index...')
    const syncIndex = await buildSyncIndex(apiKey, baseId)
    console.log(
      `[sync] Index: ${syncIndex.emailToUser.size} users, ${syncIndex.contexts.length} active contexts`,
    )

    // 4. Process each coach mailbox
    let totalMeetings = 0
    const errors: string[] = []
    const syncedCoaches: string[] = []

    for (const coachEmail of coachEmails) {
      // Step 1: build this coach's personEmail → context map
      const { contextMap, coachFirstName } = buildCoachContextMap(coachEmail, syncIndex)

      if (contextMap.size === 0) {
        console.warn(`[sync] ${coachEmail}: no active relationship contexts — skipping`)
        syncedCoaches.push(coachEmail)
        continue
      }
      console.log(`[sync] ${coachEmail}: ${contextMap.size} context entries`)

      // Fetch events from Microsoft Graph
      let events: GraphEvent[]
      try {
        events = await fetchEvents(token, coachEmail)
        console.log(`[sync] ${coachEmail}: ${events.length} events from Graph`)
      } catch (err) {
        const msg = err instanceof Error ? err.message : `Failed to fetch events for ${coachEmail}`
        console.error(`[sync] ${msg}`)
        errors.push(msg)
        continue
      }

      let fanOutCount = 0
      let eventsProcessed = 0
      let discarded = 0
      const coachLower = coachEmail.toLowerCase()

      for (const event of events) {
        // Step 5: handle cancellations — mark existing records, skip fan-out
        if (event.isCancelled === true || /^cancelled:/i.test(event.subject ?? '')) {
          const n = await cancelMeetings(apiKey, baseId, event.id)
          if (n > 0) {
            console.log(`[sync] ${coachEmail}: cancelled ${n} meeting(s) for event ${event.id}`)
          }
          continue
        }

        eventsProcessed++

        // Step 2b–c: noise + attendee pre-filter
        if (shouldDiscard(event, coachEmail)) {
          discarded++
          continue
        }

        // Step 2d: match each attendee against this coach's context map
        const confirmedMatches: Array<{ contextId: string; personId: string; personName: string }> = []
        for (const attendee of event.attendees ?? []) {
          const email = attendee.emailAddress.address.toLowerCase()
          if (email === coachLower) continue
          const match = contextMap.get(email)
          if (match) confirmedMatches.push(match)
        }

        // Step 2e: discard if no attendee matched a relationship context
        if (confirmedMatches.length === 0) {
          discarded++
          continue
        }

        // Steps 3–4: upsert one Meeting record per confirmed match (fan-out)
        for (const match of confirmedMatches) {
          try {
            await upsertMeeting(
              apiKey,
              baseId,
              event,
              coachEmail,
              coachFirstName,
              match.contextId,
              match.personName,
            )
            fanOutCount++
          } catch (err) {
            const msg =
              err instanceof Error ? err.message : `Failed to upsert ${event.id}|${match.contextId}`
            console.error(`[sync] ${msg}`)
            errors.push(msg)
          }
        }
      }

      console.log(
        `[sync] ${coachEmail}: ${fanOutCount} meetings written from ${eventsProcessed} events (${discarded} discarded)`,
      )
      totalMeetings += fanOutCount
      syncedCoaches.push(coachEmail)
    }

    console.log(
      `[sync] Done: ${totalMeetings} meetings written across ${syncedCoaches.length} coaches`,
    )
    return Response.json({ synced: totalMeetings, coaches: syncedCoaches, errors })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unexpected error'
    console.error('[sync] Unhandled error:', err)
    return Response.json({ error: msg }, { status: 500 })
  }
}
