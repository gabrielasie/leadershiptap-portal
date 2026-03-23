import {
  createMessage,
  updateMessage,
  getMessagesByMeeting,
  getMessagesByUser,
} from "@/lib/airtable/messages";
import type { Message } from "@/lib/types";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export async function createFollowUpDraft(
  meetingId: string,
  eventName: string,
  startTime: string,
  participantEmails: string[]
): Promise<Message> {
  const date = formatDate(startTime);
  const firstName = participantEmails[0]?.split("@")[0] ?? "there";
  const messageName = `${date} // ${eventName} // Follow-up`;

  return createMessage({
    "Message Name": messageName,
    Subject: `Follow-up: ${eventName}`,
    Status: "Pending",
  });
}

export async function getMeetingMessages(meetingId: string): Promise<Message[]> {
  return getMessagesByMeeting(meetingId);
}

export async function getUserMessages(userId: string): Promise<Message[]> {
  return getMessagesByUser(userId);
}

export async function updateDraftContent(
  messageId: string,
  subject: string,
  body: string
): Promise<Message> {
  return updateMessage(messageId, {
    Subject: subject,
    "Draft Content": body,
  });
}

export async function markMessageSent(messageId: string): Promise<Message> {
  return updateMessage(messageId, { Status: "Sent", "Sent Date": new Date().toISOString() });
}

export async function createUserFollowUpDraft(
  userId: string,
  subject: string,
  body: string
): Promise<Message> {
  const date = formatDate(new Date().toISOString());
  const messageName = `${date} // ${subject} // Draft`;

  const draft = await createMessage({
    "Message Name": messageName,
    Subject: subject,
    Status: "Pending",
    "Client": [userId],
  });

  if (!body.trim()) return draft;

  return updateMessage(draft.id, {
    Subject: subject,
    "Draft Content": body,
  });
}
