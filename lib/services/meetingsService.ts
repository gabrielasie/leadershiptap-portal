import { getMeetingsByUserEmail } from "@/lib/airtable/meetings";
import type { Meeting } from "@/lib/types";

interface SplitMeetings {
  upcoming: Meeting[];
  past: Meeting[];
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
