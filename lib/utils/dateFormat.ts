export function formatEastern(
  dateString: string,
  options?: Intl.DateTimeFormatOptions,
  timezone: string = 'America/New_York',
): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    ...options,
  }).format(new Date(dateString))
}

/** Format just the time portion of a calendar event in Eastern time. */
export function formatEventTime(
  isoString: string,
  timezone: string = 'America/New_York',
): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(isoString))
}

/** Format just the date portion of a calendar event in Eastern time. */
export function formatEventDate(
  isoString: string,
  timezone: string = 'America/New_York',
): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(new Date(isoString))
}

export function formatEasternTime(dateString: string): string {
  return formatEastern(dateString, { hour: 'numeric', minute: '2-digit', hour12: true })
}

export function formatEasternDate(dateString: string): string {
  return formatEastern(dateString, { month: 'short', day: 'numeric', year: 'numeric' })
}
