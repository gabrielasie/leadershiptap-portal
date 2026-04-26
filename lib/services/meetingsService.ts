import { getAllMeetings, getMeetingsByUserEmail, getMeetingById, updatePortalEventNotes } from "@/lib/airtable/meetings";
import { canAccessUser } from "@/lib/auth/isAuthorized";
import type { SessionUser } from "@/lib/auth/getSessionUser";
import type { Meeting, User } from "@/lib/types";

interface SplitMeetings {
  upcoming: Meeting[];
  past: Meeting[];
}

// Dedup by Provider Event ID when available; fall back to title+startTime
function deduplicateMeetings(meetings: Meeting[]): Meeting[] {
  const seenById = new Set<string>()
  const seenByKey = new Set<string>()
  return meetings.filter((m) => {
    if (m.providerEventId) {
      if (seenById.has(m.providerEventId)) return false
      seenById.add(m.providerEventId)
      return true
    }
    const key = `${m.title ?? ''}|${m.startTime ?? ''}`
    if (seenByKey.has(key)) return false
    seenByKey.add(key)
    return true
  })
}

export async function getMeetings(): Promise<SplitMeetings> {
  const raw = await getAllMeetings();
  const all = deduplicateMeetings(raw);
  const now = new Date();

  const upcoming = all
    .filter((m) => m.startTime && new Date(m.startTime) >= now)
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

  const past = all
    .filter((m) => m.startTime && new Date(m.startTime) < now);
  // past is already sorted desc from getAllMeetings

  return { upcoming, past };
}

/**
 * Fetch meetings for a client by their email address.
 *
 * Pass sessionUser + userId to enforce visibility scoping:
 * - Admin: proceeds normally
 * - Coach: returns empty if userId is not in their assigned client list
 * - No sessionUser: proceeds (open-access dev mode)
 *
 * ownerEmail: when provided, only returns events where {Calendar Owner} matches
 * this address, preventing Coach A from seeing Coach B's events.
 */
export async function getMeetingsForUser(
  userEmail: string,
  sessionUser?: SessionUser | null,
  userId?: string,
  ownerEmail?: string,
): Promise<SplitMeetings> {
  if (sessionUser && userId) {
    const allowed = await canAccessUser(userId, sessionUser);
    if (!allowed) return { upcoming: [], past: [] };
  }

  const meetings = deduplicateMeetings(await getMeetingsByUserEmail(userEmail, ownerEmail));
  const now = new Date();

  const upcoming: Meeting[] = [];
  const past: Meeting[] = [];

  for (const meeting of meetings) {
    const startTime = new Date(meeting.startTime);
    if (startTime >= now) {
      upcoming.push(meeting);
    } else {
      past.push(meeting);
    }
  }

  return { upcoming, past };
}

export async function getMeetingDetail(meetingId: string): Promise<Meeting | null> {
  return getMeetingById(meetingId);
}

export async function updateMeetingNotes(meetingId: string, notes: string): Promise<void> {
  return updatePortalEventNotes(meetingId, notes);
}

// ── Email-based matching helpers ──────────────────────────────────────────────

// Normalise: lowercase, remove all whitespace (Airtable sometimes stores
// "j  barton@..." with stray spaces), trim.
function normalizeEmail(email: string): string {
  return email.replace(/\s+/g, '').toLowerCase().trim()
}

// Strip the last TLD segment so "nmayorga@specializedstaffing.com" also matches
// a stored value of "nmayorga@specializedstaffing" (missing-TLD data quality issue).
function stripTld(email: string): string {
  return email.replace(/\.[a-z]{2,6}$/, '')
}

// Index both the normalised email and its TLD-stripped variant so fuzzy lookups work.
export function buildEmailToUserMap(users: User[]): Map<string, User> {
  const map = new Map<string, User>()
  for (const user of users) {
    for (const raw of [user.email, user.workEmail]) {
      if (!raw) continue
      const norm = normalizeEmail(raw)
      if (!norm) continue
      map.set(norm, user)
      // Also index the TLD-stripped form so a stored "user@domain" matches
      // a meeting participant "user@domain.com".
      const noTld = stripTld(norm)
      if (noTld !== norm) map.set(noTld, user)
    }
  }
  return map
}

// Look up a meeting participant email with exact-then-TLD-stripped fallback.
function lookupEmail(email: string, emailToUser: Map<string, User>): User | null {
  const norm = normalizeEmail(email)
  return emailToUser.get(norm) ?? emailToUser.get(stripTld(norm)) ?? null
}

// Returns the first User whose email matches any participant in the meeting.
export function findClientForMeeting(
  meeting: Meeting,
  emailToUser: Map<string, User>
): User | null {
  for (const email of meeting.participantEmails) {
    const user = lookupEmail(email, emailToUser)
    if (user) return user
  }
  return null
}

// Returns a Map<userId, Meeting[]> — each meeting appears under every matched
// participant, capped at the first non-duplicate match per meeting.
export function groupMeetingsByUser(
  meetings: Meeting[],
  users: User[]
): Map<string, Meeting[]> {
  const emailToUser = buildEmailToUserMap(users)
  const result = new Map<string, Meeting[]>()
  for (const meeting of meetings) {
    for (const email of meeting.participantEmails) {
      const user = lookupEmail(email, emailToUser)
      if (user) {
        if (!result.has(user.id)) result.set(user.id, [])
        result.get(user.id)!.push(meeting)
        break // stop at first match so the meeting isn't counted twice
      }
    }
  }
  return result
}
