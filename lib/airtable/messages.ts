import type { Message } from "@/lib/types";
import { airtableFetch } from "@/lib/airtable/client";
import { TABLES, FIELDS } from "@/lib/airtable/constants";

const API_BASE = "https://api.airtable.com/v0";
const MESSAGES_TABLE = encodeURIComponent(TABLES.MESSAGES);

function getCredentials() {
  const apiKey = process.env.AIRTABLE_API_KEY;
  const baseId = process.env.AIRTABLE_BASE_ID;
  if (!apiKey || !baseId) throw new Error("Missing Airtable credentials");
  return { apiKey, baseId };
}

function mapRecord(record: { id: string; fields: Record<string, unknown> }): Message {
  const f = record.fields
  const meetingLinks = f[FIELDS.MESSAGES.MEETING] as string[] | undefined;
  const userLinks = (f[FIELDS.MESSAGES.CLIENT] ?? []) as string[];
  return {
    id: record.id,
    messageName: (f[FIELDS.MESSAGES.MESSAGE_NAME] as string) ?? "",
    subject: f[FIELDS.MESSAGES.SUBJECT] as string | undefined,
    body: (f[FIELDS.MESSAGES.AI_GENERATED_MESSAGE_CONTENT] ?? f[FIELDS.MESSAGES.DRAFT_CONTENT]) as string | undefined,
    status: ((f[FIELDS.MESSAGES.STATUS] as string) === "Sent" ? "Sent" : "Pending"),
    created: f[FIELDS.MESSAGES.CREATED] as string | undefined,
    sentAt: f[FIELDS.MESSAGES.SENT_DATE] as string | undefined,
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
  const res = await airtableFetch(`${API_BASE}/${baseId}/${MESSAGES_TABLE}`, {
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

  const res = await airtableFetch(`${API_BASE}/${baseId}/Messages/${messageId}`, {
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
  console.log('[debug] getAllMessages table: Messages')
  const res = await airtableFetch(
    `${API_BASE}/${baseId}/Messages?sort%5B0%5D%5Bfield%5D=Created&sort%5B0%5D%5Bdirection%5D=desc`,
    { headers: { Authorization: `Bearer ${apiKey}` }, cache: 'no-store' }
  );
  if (!res.ok) {
    const text = await res.text();
    console.error('[debug] getAllMessages failed status:', res.status, 'body:', text);
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
