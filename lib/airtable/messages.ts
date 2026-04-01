import type { Message } from "@/lib/types";

const API_BASE = "https://api.airtable.com/v0";

function getCredentials() {
  const apiKey = process.env.AIRTABLE_API_KEY;
  const baseId = process.env.AIRTABLE_BASE_ID;
  if (!apiKey || !baseId) throw new Error("Missing Airtable credentials");
  return { apiKey, baseId };
}

function mapRecord(record: { id: string; fields: Record<string, unknown> }): Message {
  const meetingLinks = record.fields["Meeting"] as string[] | undefined;
  const userLinks = (record.fields["Client"] ?? []) as string[];
  return {
    id: record.id,
    messageName: (record.fields["Message Name"] as string) ?? "",
    subject: record.fields["Subject"] as string | undefined,
    body: record.fields["Draft Content"] as string | undefined,
    status: ((record.fields["Status"] as string) === "Sent" ? "Sent" : "Pending"),
    created: record.fields["Created"] as string | undefined,
    sentAt: record.fields["Sent Date"] as string | undefined,
    meetingId: meetingLinks?.[0],
    userIds: userLinks,
  };
}

export async function createMessage(fields: {
  "Message Name": string;
  Subject: string;
  Status: "Pending" | "Sent";
  "Client"?: string[];
}): Promise<Message> {
  const { apiKey, baseId } = getCredentials();
  // Only send writable scalar fields on creation.
  // "Draft Content" is omitted — Airtable rejects empty strings
  // for this field type. Coaches fill it in via updateMessage (PATCH) after creation.
  const res = await fetch(`${API_BASE}/${baseId}/Messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ fields }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Airtable POST failed: ${text}`);
  }
  const data = await res.json();
  return mapRecord(data);
}

export async function updateMessage(
  messageId: string,
  fields: {
    Subject?: string;
    "Draft Content"?: string;
    Status?: "Pending" | "Sent";
    "Sent Date"?: string;
  }
): Promise<Message> {
  const { apiKey, baseId } = getCredentials();

  // Airtable rejects non-string values for this long-text field.
  // Coerce to a plain string so undefined/null never reaches the API.
  const sanitisedFields = {
    ...fields,
    ...("Draft Content" in fields
      ? { "Draft Content": String(fields["Draft Content"] ?? "") }
      : {}),
  };

  const res = await fetch(`${API_BASE}/${baseId}/Messages/${messageId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ fields: sanitisedFields }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Airtable PATCH failed: ${text}`);
  }
  const data = await res.json();
  return mapRecord(data);
}

export async function fetchAllMessages(): Promise<Message[]> {
  const { apiKey, baseId } = getCredentials();
  return getAllMessages(apiKey, baseId);
}

async function getAllMessages(apiKey: string, baseId: string): Promise<Message[]> {
  const res = await fetch(
    `${API_BASE}/${baseId}/Messages?sort%5B0%5D%5Bfield%5D=Created&sort%5B0%5D%5Bdirection%5D=desc`,
    { headers: { Authorization: `Bearer ${apiKey}` }, next: { revalidate: 60 } }
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Airtable GET failed: ${text}`);
  }
  const data = await res.json();
  return (data.records ?? []).map(mapRecord);
}

export async function getMessagesByMeeting(meetingId: string): Promise<Message[]> {
  const { apiKey, baseId } = getCredentials();
  const all = await getAllMessages(apiKey, baseId);
  return all.filter((m) => m.meetingId === meetingId);
}

export async function getMessagesByUser(userId: string): Promise<Message[]> {
  const { apiKey, baseId } = getCredentials();
  const all = await getAllMessages(apiKey, baseId);
  return all.filter((m) => (m.userIds ?? []).includes(userId));
}
