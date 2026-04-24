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

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(
      `Graph calendar fetch failed for ${coachEmail} (${res.status}): ${text}`,
    )
  }

  const data = await res.json()
  return (data.value ?? []) as GraphEvent[]
}
