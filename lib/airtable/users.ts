import type { User } from "@/lib/types";

const API_BASE = "https://api.airtable.com/v0";

function getCredentials() {
  const apiKey = process.env.AIRTABLE_API_KEY;
  const baseId = process.env.AIRTABLE_BASE_ID;
  if (!apiKey || !baseId) throw new Error("Missing Airtable credentials");
  return { apiKey, baseId };
}

function mapRecord(record: { id: string; fields: Record<string, unknown> }): User {
  return {
    id: record.id,
    fullName: record.fields["Full Name"] as string | undefined,
    preferredName: record.fields["Preferred Name"] as string | undefined,
    firstName: record.fields["First Name"] as string | undefined,
    lastName: record.fields["Last Name"] as string | undefined,
    email: (record.fields["Email"] as string) ?? "",
    workEmail: record.fields["Work Email"] as string | undefined,
    jobTitle: record.fields["Job Title"] as string | undefined,
    role: record.fields["Role"] as string | undefined,
    companyId: record.fields["Company ID"] as string | undefined,
    companyName: record.fields["Company Name"] as string | undefined,
    avatarUrl: record.fields["Avatar URL"] as string | undefined,
    enneagram: record.fields["Enneagram"] as string | undefined,
    mbti: record.fields["MBTI"] as string | undefined,
  };
}

export async function getAllUsers(): Promise<User[]> {
  const { apiKey, baseId } = getCredentials();
  const res = await fetch(`${API_BASE}/${baseId}/Users`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    next: { revalidate: 60 },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Airtable GET failed: ${text}`);
  }
  const data = await res.json();
  return (data.records ?? []).map(mapRecord);
}

export async function getUserById(id: string): Promise<User | null> {
  const { apiKey, baseId } = getCredentials();
  const res = await fetch(`${API_BASE}/${baseId}/Users/${id}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    next: { revalidate: 60 },
  });
  if (!res.ok) return null;
  const data = await res.json();
  return mapRecord(data);
}
