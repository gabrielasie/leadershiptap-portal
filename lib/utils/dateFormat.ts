export function formatEastern(
  dateString: string,
  options?: Intl.DateTimeFormatOptions,
  timezone: string = 'America/New_York',
): string {
  return new Date(dateString).toLocaleString('en-US', {
    timeZone: timezone,
    ...options,
  })
}

/** Format just the time portion of a calendar event in its stored timezone. */
export function formatEventTime(
  dateString: string,
  timezone: string = 'America/New_York',
): string {
  return formatEastern(
    dateString,
    { hour: 'numeric', minute: '2-digit', hour12: true },
    timezone,
  )
}

export function formatEasternTime(dateString: string): string {
  return formatEastern(dateString, { hour: 'numeric', minute: '2-digit', hour12: true })
}

export function formatEasternDate(dateString: string): string {
  return formatEastern(dateString, { month: 'short', day: 'numeric', year: 'numeric' })
}
