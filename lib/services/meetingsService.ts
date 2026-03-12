import { getAllMeetings, getMeetingsByUserEmail, getMeetingById, updateMeetingFields } from "@/lib/airtable/meetings";
import type { Meeting } from "@/lib/types";

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

export async function getMeetingsForUser(userEmail: string): Promise<SplitMeetings> {
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
