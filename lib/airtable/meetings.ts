import type { Meeting } from "@/lib/types";

const API_BASE = "https://api.airtable.com/v0";

function getCredentials() {
  const apiKey = process.env.AIRTABLE_API_KEY;
  const baseId = process.env.AIRTABLE_BASE_ID;
  if (!apiKey || !baseId) throw new Error("Missing Airtable credentials");
  return { apiKey, baseId };
}

function parseEmails(raw: unknown): string[] {
  if (!raw) return [];
  const items: string[] = Array.isArray(raw)
    ? raw.map(String)
    : typeof raw === "string"
    ? raw.split(",")
    : [];
  return items.map((e) => e.trim()).filter(Boolean);
}

function mapRecord(record: { id: string; fields: Record<string, unknown> }): Meeting {
  return {
    id: record.id,
    title: (record.fields["EventName"] as string) ?? "",
    startTime: (record.fields["StartTime"] as string) ?? "",
    endTime: record.fields["EndTime"] as string | undefined,
    senderEmail: record.fields["SenderEmail"] as string | undefined,
    participantEmails: parseEmails(record.fields["ParticipantEmails"]),
    notes: record.fields["Notes"] as string | undefined,
    sessionStatus: (record.fields["Session Status"] as string) ?? null,
    actionItems: (record.fields["Action Items"] as string) ?? null,
  };
}

export async function getAllUpcomingMeetings(daysAhead = 7): Promise<Meeting[]> {
  const { apiKey, baseId } = getCredentials();
  const now = new Date().toISOString();
  const cutoff = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000).toISOString();
  const formula = encodeURIComponent(
    `AND(IS_AFTER({StartTime}, "${now}"), IS_BEFORE({StartTime}, "${cutoff}"))`,
  );
  const res = await fetch(
    `${API_BASE}/${baseId}/Calendar%20Events?filterByFormula=${formula}&sort%5B0%5D%5Bfield%5D=StartTime&sort%5B0%5D%5Bdirection%5D=asc&maxRecords=50`,
    {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: 'no-store',
    }
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Airtable GET failed: ${text}`);
  }
  const data = await res.json();
  return (data.records ?? []).map(mapRecord);
}

export async function getAllMeetings(): Promise<Meeting[]> {
  const { apiKey, baseId } = getCredentials();
  const res = await fetch(
    `${API_BASE}/${baseId}/Calendar%20Events?sort%5B0%5D%5Bfield%5D=StartTime&sort%5B0%5D%5Bdirection%5D=desc`,
    {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: 'no-store',
    }
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Airtable GET failed: ${text}`);
  }
  const data = await res.json();
  // Debug: log raw ParticipantEmails format from Airtable (comma string or array?)
  const firstRaw = data.records?.[0]?.fields?.ParticipantEmails;
  console.log('[meetings] raw ParticipantEmails type:', typeof firstRaw, '| value:', firstRaw);
  return (data.records ?? []).map(mapRecord);
}

export async function getMeetingsByUserEmail(email: string): Promise<Meeting[]> {
  const { apiKey, baseId } = getCredentials();
  const formula = encodeURIComponent(`OR(SEARCH("${email}", {ParticipantEmails}), {SenderEmail} = "${email}")`);
  const res = await fetch(
    `${API_BASE}/${baseId}/Calendar%20Events?filterByFormula=${formula}&sort%5B0%5D%5Bfield%5D=StartTime&sort%5B0%5D%5Bdirection%5D=desc`,
    {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: 'no-store',
    }
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Airtable GET failed: ${text}`);
  }
  const data = await res.json();
  return (data.records ?? []).map(mapRecord);
}

export async function getMeetingById(meetingId: string): Promise<Meeting | null> {
  const { apiKey, baseId } = getCredentials();
  const res = await fetch(
    `${API_BASE}/${baseId}/Calendar%20Events/${meetingId}`,
    {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: 'no-store',
    }
  );
  if (!res.ok) return null;
  const data = await res.json();
  return mapRecord(data);
}

export async function updateMeetingFields(
  meetingId: string,
  fields: Partial<{ Notes: string }>
): Promise<void> {
  const { apiKey, baseId } = getCredentials();
  const res = await fetch(
    `${API_BASE}/${baseId}/Calendar%20Events/${meetingId}`,
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
