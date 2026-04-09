import { getAllMeetings, getMeetingsByUserEmail, getMeetingById, updateMeetingFields } from "@/lib/airtable/meetings";
import { canAccessUser } from "@/lib/auth/isAuthorized";
import type { SessionUser } from "@/lib/auth/getSessionUser";
import type { Meeting, User } from "@/lib/types";

interface SplitMeetings {
  upcoming: Meeting[];
  past: Meeting[];
}

export async function getMeetings(): Promise<SplitMeetings> {
  const all = await getAllMeetings();
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
 */
export async function getMeetingsForUser(
  userEmail: string,
  sessionUser?: SessionUser | null,
  userId?: string,
): Promise<SplitMeetings> {
  if (sessionUser && userId) {
    const allowed = await canAccessUser(userId, sessionUser);
    if (!allowed) return { upcoming: [], past: [] };
  }

  const meetings = await getMeetingsByUserEmail(userEmail);
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
  return updateMeetingFields(meetingId, { Notes: notes });
}

// ── Email-based matching helpers ──────────────────────────────────────────────
// All helpers normalise emails to lowercase+trimmed so casing and whitespace
// in Airtable never break a match.

export function buildEmailToUserMap(users: User[]): Map<string, User> {
  const map = new Map<string, User>();
  for (const user of users) {
    if (user.email) map.set(user.email.toLowerCase().trim(), user);
    if (user.workEmail) map.set(user.workEmail.toLowerCase().trim(), user);
  }
  return map;
}

// Returns the first User whose email matches any participant in the meeting.
export function findClientForMeeting(
  meeting: Meeting,
  emailToUser: Map<string, User>
): User | null {
  for (const email of meeting.participantEmails) {
    const user = emailToUser.get(email.toLowerCase().trim());
    if (user) return user;
  }
  return null;
}

// Returns a Map<userId, Meeting[]> — each meeting appears under the first
// participant email that matches a known user.
export function groupMeetingsByUser(
  meetings: Meeting[],
  users: User[]
): Map<string, Meeting[]> {
  const emailToUser = buildEmailToUserMap(users);
  const result = new Map<string, Meeting[]>();
  for (const meeting of meetings) {
    for (const email of meeting.participantEmails) {
      const user = emailToUser.get(email.toLowerCase().trim());
      if (user) {
        if (!result.has(user.id)) result.set(user.id, []);
        result.get(user.id)!.push(meeting);
        break; // stop at first match so the meeting isn't counted twice
      }
    }
  }
  return result;
}
