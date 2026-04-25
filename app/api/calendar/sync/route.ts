import { auth } from '@clerk/nextjs/server'

export const maxDuration = 30

const AIRTABLE_API = 'https://api.airtable.com/v0'
const GRAPH_API = 'https://graph.microsoft.com/v1.0'

// ── Auth ─────────────────────────────────────────────────────────────────────

async function isAuthorized(request: Request): Promise<boolean> {
  const secret = process.env.SYNC_SECRET
  if (secret && request.headers.get('x-sync-secret') === secret) return true
  const { userId } = await auth()
  return userId !== null
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
}

async function fetchEvents(token: string, email: string): Promise<GraphEvent[]> {
  const now = new Date()
  const end = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000)

  const params = new URLSearchParams({
    startDateTime: now.toISOString(),
    endDateTime: end.toISOString(),
    $select: 'id,subject,start,end',
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
): Promise<void> {
  const start = event.start.dateTime ?? event.start.date
  const end = event.end.dateTime ?? event.end.date
  if (!start || !end) throw new Error(`Event ${event.id} has no start/end`)

  // Exact field names confirmed from Airtable table schema
  const fields = {
    'Subject': event.subject ?? '(No Subject)',
    'Start': start,
    'End': end,
    'Provider Event ID': event.id,
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

    if (!(await isAuthorized(request))) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 1. Discover coach emails
    console.log('[calendar/sync] Fetching coach emails from Airtable...')
    let coachEmails: string[]
    try {
      coachEmails = await getCoachEmails()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch coach emails'
      console.error('[calendar/sync]', msg)
      return Response.json({ error: msg }, { status: 500 })
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

    // 3. Sync each mailbox
    let synced = 0
    const errors: string[] = []
    const syncedCoaches: string[] = []

    for (const email of coachEmails) {
      console.log(`[calendar/sync] Syncing ${email}...`)

      let events: GraphEvent[]
      try {
        events = await fetchEvents(token, email)
        console.log(`[calendar/sync] ${email}: ${events.length} events`)
      } catch (err) {
        const msg = err instanceof Error ? err.message : `Failed to fetch events for ${email}`
        console.error(`[calendar/sync] ${msg}`)
        errors.push(msg)
        continue
      }

      for (const event of events) {
        try {
          await upsertEvent(apiKey, baseId, event)
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
