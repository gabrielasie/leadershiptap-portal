export interface GraphEvent {
  id: string
  subject: string
  start: { dateTime: string; timeZone: string }
  end: { dateTime: string; timeZone: string }
  attendees: Array<{
    emailAddress: { address: string; name: string }
    type: string
  }>
  bodyPreview: string
  organizer?: { emailAddress: { address: string; name: string } }
}

export async function fetchCalendarEvents(
  accessToken: string,
  coachEmail: string,
  startDate: Date,
  endDate: Date,
): Promise<GraphEvent[]> {
  const params = new URLSearchParams({
    startDateTime: startDate.toISOString(),
    endDateTime: endDate.toISOString(),
    $select: 'id,subject,start,end,attendees,bodyPreview,organizer',
    $top: '500',
  })

  const url = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(coachEmail)}/calendarView?${params}`

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15_000)

  let res: Response
  try {
    res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
      signal: controller.signal,
    })
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      throw new Error(`Graph calendar timeout for ${coachEmail}`)
    }
    throw err
  } finally {
    clearTimeout(timeout)
  }

  if (!res.ok) {
    const text = await res.text()
    throw new Error(
      `Graph calendar fetch failed for ${coachEmail} (${res.status}): ${text}`,
    )
  }

  const data = await res.json()
  return (data.value ?? []) as GraphEvent[]
}
