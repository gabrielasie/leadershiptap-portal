import type { User } from "@/lib/types";

const API_BASE = "https://api.airtable.com/v0";

function getCredentials() {
  const apiKey = process.env.AIRTABLE_API_KEY;
  const baseId = process.env.AIRTABLE_BASE_ID;
  if (!apiKey || !baseId) throw new Error("Missing Airtable credentials");
  return { apiKey, baseId };
}

// Airtable lookup fields return either a string[] or a plain string.
// This helper normalises both to a single string value.
function readLookup(val: unknown): string | undefined {
  if (!val) return undefined;
  if (Array.isArray(val)) return (val[0] as string) || undefined;
  if (typeof val === "string") return val || undefined;
  return undefined;
}

// Zip two lookup arrays into strength objects
function readStrengths(
  names: unknown,
  domains: unknown
): Array<{ name: string; domain?: string }> {
  const ns = Array.isArray(names) ? (names as string[]) : [];
  const ds = Array.isArray(domains) ? (domains as string[]) : [];
  return ns.filter(Boolean).map((name, i) => ({ name, domain: ds[i] || undefined }));
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
    profilePhoto: Array.isArray(record.fields["Profile Photo"])
      ? (record.fields["Profile Photo"] as Array<{ url: string }>)[0]?.url
      : undefined,
    timeAtCompany: record.fields["Time at Company"] as string | undefined,
    // Linked record IDs for Coach and Team Lead
    coachIds: Array.isArray(record.fields["Coach"])
      ? (record.fields["Coach"] as string[])
      : [],
    teamLeadIds: Array.isArray(record.fields["Team Lead"])
      ? (record.fields["Team Lead"] as string[])
      : [],
    // Coaching context
    quickNotes: record.fields["Quick Notes"] as string | undefined,
    familyDetails: record.fields["Family Details"] as string | undefined,
    // Personality — lookup fields from linked tables (read only)
    enneagramType: readLookup(record.fields["Enneagram Type (from Enneagram)"]),
    enneagramDescriptor: readLookup(record.fields["Descriptor (from Enneagram)"]),
    mbtiType: readLookup(record.fields["MBTI (from MBTI)"]),
    mbtiDescriptor: readLookup(record.fields["Descriptor (from MBTI)"]),
    // "Conflict Posture" field returns raw linked record IDs — no name lookup exists.
    // Only the descriptor lookup is available in this base.
    conflictPosture: undefined,
    conflictPostureDescriptor: readLookup(record.fields["Descriptor (from Conflict Posture)"]),
    apologyLanguage: readLookup(record.fields["Apology Language (from Apology Language)"]),
    apologyLanguageDescriptor: readLookup(record.fields["Descriptor (from Apology Language)"]),
    strengths: readStrengths(
      record.fields["Strength Name (from Strengths)"],
      record.fields["Domain (from Strengths)"]
    ),
    // Org / Team — linked record IDs
    managerIds: Array.isArray(record.fields["Manager"])
      ? (record.fields["Manager"] as string[])
      : [],
    directReportIds: Array.isArray(record.fields["Direct Reports"])
      ? (record.fields["Direct Reports"] as string[])
      : [],
    teamMemberIds: Array.isArray(record.fields["Team Members"])
      ? (record.fields["Team Members"] as string[])
      : [],
    // Legacy
    enneagram: record.fields["Enneagram"] as string | undefined,
    mbti: record.fields["MBTI"] as string | undefined,
    department: record.fields["Department"] as string | undefined,
    title: record.fields["Title"] as string | undefined,
    startDate: record.fields["Start Date"] as string | undefined,
    engagementLevel: record.fields["Engagement Level"] as string | undefined,
    coachNotes: record.fields["Coach Notes"] as string | undefined,
  };
}

export async function searchUsersByName(
  query: string,
): Promise<Array<{ id: string; name: string; jobTitle?: string }>> {
  const { apiKey, baseId } = getCredentials()
  const q = query.toLowerCase().replace(/"/g, '')
  const formula = encodeURIComponent(
    `OR(` +
    `SEARCH("${q}",LOWER(IF({Full Name},{Full Name},"")),0),` +
    `SEARCH("${q}",LOWER(IF({First Name},{First Name},"")&" "&IF({Last Name},{Last Name},"")),0)` +
    `)`,
  )
  const res = await fetch(
    `${API_BASE}/${baseId}/Users?filterByFormula=${formula}&maxRecords=20`,
    { headers: { Authorization: `Bearer ${apiKey}` }, cache: 'no-store' },
  )
  if (!res.ok) return []
  const data = await res.json()
  return (data.records ?? []).map((r: { id: string; fields: Record<string, unknown> }) => {
    const f = r.fields
    const name =
      (f['Full Name'] as string | undefined) ||
      [f['First Name'], f['Last Name']].filter(Boolean).join(' ') ||
      (f['Email'] as string | undefined) ||
      r.id
    return { id: r.id, name, jobTitle: f['Job Title'] as string | undefined }
  })
}

export async function createUserRecord(fields: {
  'First Name'?: string
  'Last Name'?: string
  'Job Title'?: string
  'Company Name'?: string
}): Promise<string> {
  const { apiKey, baseId } = getCredentials()

  // Sample one record to confirm real field names before writing
  const sampleRes = await fetch(`${API_BASE}/${baseId}/Users?maxRecords=1`, {
    headers: { Authorization: `Bearer ${apiKey}` }, cache: 'no-store',
  })
  const sampleData = await sampleRes.json()
  console.log('[createUserRecord] Users table fields:', Object.keys(sampleData.records?.[0]?.fields ?? {}))

  // Build a Full Name from first+last for the primary field
  const fullName = [fields['First Name'], fields['Last Name']].filter(Boolean).join(' ')
  const body = {
    fields: {
      ...(fullName ? { 'Full Name': fullName } : {}),
      ...fields,
    },
  }
  console.log('[createUserRecord] POST body:', JSON.stringify(body))
  const res = await fetch(`${API_BASE}/${baseId}/Users`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  console.log('[createUserRecord] response:', JSON.stringify(data))
  if (!res.ok) {
    throw new Error(`Airtable POST failed: ${JSON.stringify(data)}`)
  }
  return data.id as string
}

export async function patchTeamMembers(
  userId: string,
  memberIds: string[],
): Promise<void> {
  const { apiKey, baseId } = getCredentials()
  const body = { fields: { 'Team Members': memberIds } }
  console.log('[patchTeamMembers] PATCH userId:', userId, 'body:', JSON.stringify(body))
  const res = await fetch(`${API_BASE}/${baseId}/Users/${userId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  console.log('[patchTeamMembers] status:', res.status, 'response:', JSON.stringify(data))
  if (!res.ok) {
    throw new Error(`Airtable PATCH failed: ${JSON.stringify(data)}`)
  }
}

export async function getAllUsers(): Promise<User[]> {
  let apiKey: string, baseId: string;
  try {
    ({ apiKey, baseId } = getCredentials());
  } catch (e) {
    console.error('[getAllUsers] Missing Airtable credentials:', e);
    return [];
  }

  try {
    const res = await fetch(`${API_BASE}/${baseId}/Users`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      next: { revalidate: 60 },
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`[getAllUsers] Airtable GET failed: ${text}`);
      return [];
    }

    const data = await res.json();
    return (data.records ?? []).map(mapRecord);
  } catch (e) {
    console.error('[getAllUsers] Unexpected error fetching users:', e);
    return [];
  }
}

export async function updateUserCoachNotes(userId: string, notes: string): Promise<void> {
  let apiKey: string, baseId: string;
  try {
    ({ apiKey, baseId } = getCredentials());
  } catch (e) {
    console.error('[updateUserCoachNotes] Missing Airtable credentials:', e);
    return;
  }
  try {
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
      console.error('[updateUserCoachNotes] Airtable PATCH failed:', text);
    }
  } catch (e) {
    console.error('[updateUserCoachNotes] Unexpected error:', e);
  }
}

export interface UserProfileFields {
  'Preferred Name'?: string
  'Quick Notes'?: string
  'Family Details'?: string
  'Time at Company'?: string
  'Title'?: string
}

export async function updateUserProfile(
  userId: string,
  fields: UserProfileFields,
): Promise<void> {
  const { apiKey, baseId } = getCredentials()
  const res = await fetch(`${API_BASE}/${baseId}/Users/${userId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fields }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Airtable PATCH failed: ${text}`)
  }
}

export async function getUserById(id: string): Promise<User | null> {
  let apiKey: string, baseId: string;
  try {
    ({ apiKey, baseId } = getCredentials());
  } catch (e) {
    console.error('[getUserById] Missing Airtable credentials:', e);
    return null;
  }
  try {
    const res = await fetch(`${API_BASE}/${baseId}/Users/${id}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return mapRecord(data);
  } catch (e) {
    console.error('[getUserById] Unexpected error:', e);
    return null;
  }
}
