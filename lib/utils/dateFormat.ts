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

/** Returns YYYY-MM-DD in the given timezone (default America/New_York). */
export function getDateInTimezone(iso: string, tz: string = 'America/New_York'): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(iso))
  const y = parts.find((p) => p.type === 'year')?.value ?? ''
  const m = parts.find((p) => p.type === 'month')?.value ?? ''
  const d = parts.find((p) => p.type === 'day')?.value ?? ''
  return `${y}-${m}-${d}`
}

/** Returns 0-23 hour in the given timezone (default America/New_York). */
export function getHourInTimezone(date: Date = new Date(), tz: string = 'America/New_York'): number {
  const h = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour: 'numeric',
    hour12: false,
  }).format(date)
  return parseInt(h, 10)
}
