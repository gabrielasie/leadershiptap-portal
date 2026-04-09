import type { User } from "@/lib/types";

const API_BASE = "https://api.airtable.com/v0";

// Minimal scope descriptor — avoids importing from the auth layer.
// SessionUser in lib/auth/getSessionUser.ts satisfies this structurally.
interface UserScope {
  role: 'admin' | 'coach'
  email: string
}

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
    department: record.fields["Department"] as string | undefined,
    title: record.fields["Title"] as string | undefined,
    startDate: record.fields["Start Date"] as string | undefined,
    engagementLevel: record.fields["Engagement Level"] as string | undefined,
    coachNotes: record.fields["Coach Notes"] as string | undefined,
    // Linked record fields — Airtable returns string[] of record IDs
    managerIds: Array.isArray(record.fields["Manager"])
      ? (record.fields["Manager"] as string[])
      : [],
    directReportIds: Array.isArray(record.fields["Direct Reports"])
      ? (record.fields["Direct Reports"] as string[])
      : [],
  };
}

export async function getAllUsers(scope?: UserScope): Promise<User[]> {
  const { apiKey, baseId } = getCredentials();

  if (!scope) {
    console.warn('[getAllUsers] No session scope — returning all users (open access). See PERMISSIONS.md.');
  }

  // Admins (and the no-scope fallback) receive the full list.
  // Coaches receive only clients where the "Coach Email" field matches their email.
  const isCoachScoped = scope?.role === 'coach' && !!scope.email;
  const formula = isCoachScoped
    ? `?filterByFormula=${encodeURIComponent(`{Coach Email} = "${scope!.email}"`)}`
    : '';

  const res = await fetch(`${API_BASE}/${baseId}/Users${formula}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    next: { revalidate: 60 },
  });

  if (!res.ok) {
    const text = await res.text();
    // "Coach Email" field not yet added to Airtable — fall back to all users
    // and warn so the developer knows what to fix. See PERMISSIONS.md.
    if (isCoachScoped && text.includes('UNKNOWN_FIELD_NAME')) {
      console.warn(
        '[getAllUsers] "Coach Email" field missing in Airtable — open access fallback.' +
        ' Add the field per PERMISSIONS.md to enable coach scoping.'
      );
      const fallback = await fetch(`${API_BASE}/${baseId}/Users`, {
        headers: { Authorization: `Bearer ${apiKey}` },
        next: { revalidate: 60 },
      });
      if (!fallback.ok) throw new Error(`Airtable GET failed: ${await fallback.text()}`);
      const fd = await fallback.json();
      return (fd.records ?? []).map(mapRecord);
    }
    throw new Error(`Airtable GET failed: ${text}`);
  }

  const data = await res.json();
  return (data.records ?? []).map(mapRecord);
}

export async function updateUserCoachNotes(userId: string, notes: string): Promise<void> {
  const { apiKey, baseId } = getCredentials();
  const res = await fetch(`${API_BASE}/${baseId}/Users/${userId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fields: { 'Coach Notes': notes } }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Airtable PATCH failed: ${text}`);
  }
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
