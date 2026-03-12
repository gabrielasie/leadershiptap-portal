import base from "./client";
import type { Meeting } from "@/lib/types";
import type { FieldSet } from "airtable";

interface MeetingFields extends FieldSet {
  EventName?: string;
  StartTime?: string;
  EndTime?: string;
  SenderEmail?: string;
  ParticipantEmails?: string | string[];
  Notes?: string;
}

function parseEmails(raw: string | string[] | undefined): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  return raw.split(",").map((e) => e.trim()).filter(Boolean);
}

function mapRecord(record: { id: string; fields: MeetingFields }): Meeting {
  return {
    id: record.id,
    title: record.fields["EventName"] ?? "",
    startTime: record.fields["StartTime"] ?? "",
    endTime: record.fields["EndTime"],
    senderEmail: record.fields["SenderEmail"],
    participantEmails: parseEmails(record.fields["ParticipantEmails"]),
    notes: record.fields["Notes"],
  };
}

export async function getAllMeetings(): Promise<Meeting[]> {
  const records = await base<MeetingFields>("Calendar Events")
    .select({ sort: [{ field: "StartTime", direction: "desc" }] })
    .all();
  return records.map(mapRecord);
}

export async function getMeetingsByUserEmail(email: string): Promise<Meeting[]> {
  const records = await base<MeetingFields>("Calendar Events")
    .select({
      filterByFormula: `OR(SEARCH("${email}", {ParticipantEmails}), {SenderEmail} = "${email}")`,
      sort: [{ field: "StartTime", direction: "desc" }],
    })
    .all();
  return records.map(mapRecord);
}

export async function getMeetingById(meetingId: string): Promise<Meeting | null> {
  try {
    const record = await base<MeetingFields>("Calendar Events").find(meetingId);
    return mapRecord(record);
  } catch {
    return null;
  }
}

export async function updateMeetingFields(
  meetingId: string,
  fields: Partial<{ Notes: string }>
): Promise<void> {
  const apiKey = process.env.AIRTABLE_API_KEY;
  const baseId = process.env.AIRTABLE_BASE_ID;
  const res = await fetch(
    `https://api.airtable.com/v0/${baseId}/Calendar%20Events/${meetingId}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ fields }),
    }
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Airtable PATCH failed: ${text}`);
  }
}
