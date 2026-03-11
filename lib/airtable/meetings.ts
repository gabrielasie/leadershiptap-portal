import base from "./client";
import type { Meeting } from "@/lib/types";
import type { FieldSet } from "airtable";

interface MeetingFields extends FieldSet {
  EventName?: string;
  StartTime?: string;
  EndTime?: string;
  "Participant Emails"?: string[];
  "Coach Email"?: string;
  Notes?: string;
  "Recording URL"?: string;
}

function mapRecord(record: { id: string; fields: MeetingFields }): Meeting {
  return {
    id: record.id,
    title: record.fields["EventName"] ?? "",
    startTime: record.fields["StartTime"] ?? "",
    endTime: record.fields["EndTime"],
    participantEmails: record.fields["Participant Emails"] ?? [],
    coachEmail: record.fields["Coach Email"],
    notes: record.fields["Notes"],
    recordingUrl: record.fields["Recording URL"],
  };
}

export async function getMeetingsByUserEmail(email: string): Promise<Meeting[]> {
  const records = await base("Calendar Events").select().firstPage();
  if (records.length > 0) {
    console.log("CALENDAR EVENTS FIELDS:", Object.keys(records[0].fields));
  }
  return [];
}
