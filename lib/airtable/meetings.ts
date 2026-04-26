import type { Meeting } from "@/lib/types";

const API_BASE = "https://api.airtable.com/v0";
const TABLE = "Portal%20Calendar%20Events";

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
    ? raw.split(/[,;]/)
    : [];
  return items.map((e) => e.trim()).filter(Boolean);
}

// Maps a record from Portal Calendar Events
// Fields: Subject, Start, End, Provider Event ID, Participant Emails, Notes, Note Name
function mapRecord(record: { id: string; fields: Record<string, unknown> }): Meeting {
  return {
    id: record.id,
    providerEventId: record.fields["Provider Event ID"] as string | undefined,
    title: (record.fields["Subject"] as string) ?? "",
    startTime: (record.fields["Start"] as string) ?? "",
    endTime: record.fields["End"] as string | undefined,
    senderEmail: undefined,
    participantEmails: parseEmails(record.fields["Participant Emails"]),
    notes: (record.fields["Notes"] as string) || undefined,
    sessionStatus: null,
    actionItems: null,
  };
}

// All upcoming meetings in the next N days (used by dashboard "Upcoming This Week")
// ownerEmail: when provided, only returns events where {Calendar Owner} matches this email.
export async function getAllUpcomingMeetings(daysAhead = 7, ownerEmail?: string): Promise<Meeting[]> {
  const { apiKey, baseId } = getCredentials();
  const now = new Date().toISOString();
  const cutoff = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000).toISOString();
  const timeFilter = `AND(IS_AFTER({Start}, "${now}"), IS_BEFORE({Start}, "${cutoff}"))`;
  const safeOwner = ownerEmail ? ownerEmail.toLowerCase().replace(/"/g, '\\"') : null;
  const formula = safeOwner
    ? `AND(${timeFilter}, LOWER({Calendar Owner}) = "${safeOwner}")`
    : timeFilter;
  const res = await fetch(
    `${API_BASE}/${baseId}/${TABLE}?filterByFormula=${encodeURIComponent(formula)}&sort%5B0%5D%5Bfield%5D=Start&sort%5B0%5D%5Bdirection%5D=asc&maxRecords=50`,
    { headers: { Authorization: `Bearer ${apiKey}` }, cache: "no-store" },
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Airtable GET failed: ${text}`);
  }
  const data = await res.json();
  return (data.records ?? []).map(mapRecord);
}

// All meetings sorted by Start desc (used by dashboard client activity section)
// ownerEmail: when provided, only returns events where {Calendar Owner} matches this email.
export async function getAllMeetings(ownerEmail?: string): Promise<Meeting[]> {
  const { apiKey, baseId } = getCredentials();
  const safeOwner = ownerEmail ? ownerEmail.toLowerCase().replace(/"/g, '\\"') : null;
  const filterParam = safeOwner
    ? `filterByFormula=${encodeURIComponent(`LOWER({Calendar Owner}) = "${safeOwner}"`)}&`
    : '';
  const res = await fetch(
    `${API_BASE}/${baseId}/${TABLE}?${filterParam}sort%5B0%5D%5Bfield%5D=Start&sort%5B0%5D%5Bdirection%5D=desc&maxRecords=500`,
    { headers: { Authorization: `Bearer ${apiKey}` }, cache: "no-store" },
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Airtable GET failed: ${text}`);
  }
  const data = await res.json();
  return (data.records ?? []).map(mapRecord);
}

// Meetings where Participant Emails contains the given address.
// ownerEmail: when provided, also filters by {Calendar Owner} so Coach A never
// sees Coach B's events for the same client.
export async function getMeetingsByUserEmail(email: string, ownerEmail?: string): Promise<Meeting[]> {
  const { apiKey, baseId } = getCredentials();
  const safeEmail = email.toLowerCase().trim().replace(/"/g, '\\"');
  const participantFilter = `SEARCH("${safeEmail}", LOWER({Participant Emails}))`;
  const safeOwner = ownerEmail ? ownerEmail.toLowerCase().replace(/"/g, '\\"') : null;
  const formula = safeOwner
    ? `AND(${participantFilter}, LOWER({Calendar Owner}) = "${safeOwner}")`
    : participantFilter;
  const res = await fetch(
    `${API_BASE}/${baseId}/${TABLE}?filterByFormula=${encodeURIComponent(formula)}&sort%5B0%5D%5Bfield%5D=Start&sort%5B0%5D%5Bdirection%5D=desc&maxRecords=100`,
    { headers: { Authorization: `Bearer ${apiKey}` }, cache: "no-store" },
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Airtable GET failed: ${text}`);
  }
  const data = await res.json();
  return (data.records ?? []).map(mapRecord);
}

// Fetch a single Portal Calendar Events record by Airtable record ID
export async function getMeetingById(meetingId: string): Promise<Meeting | null> {
  const { apiKey, baseId } = getCredentials();
  const res = await fetch(
    `${API_BASE}/${baseId}/${TABLE}/${meetingId}`,
    { headers: { Authorization: `Bearer ${apiKey}` }, cache: "no-store" },
  );
  if (!res.ok) return null;
  const data = await res.json();
  return mapRecord(data);
}

// Patch the Notes field on a Portal Calendar Events record
export async function updatePortalEventNotes(
  recordId: string,
  notes: string,
): Promise<void> {
  const { apiKey, baseId } = getCredentials();
  const res = await fetch(
    `${API_BASE}/${baseId}/${TABLE}/${recordId}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ fields: { Notes: notes } }),
    },
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Airtable PATCH failed for ${recordId}: ${text}`);
  }
}

// Meetings for a client's profile page — same as getMeetingsByUserEmail
// (kept as a named alias for clarity at the call site)
export async function getPortalEventsByClientEmail(email: string, ownerEmail?: string): Promise<Meeting[]> {
  return getMeetingsByUserEmail(email, ownerEmail);
}
