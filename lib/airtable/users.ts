import type { User } from "@/lib/types";
import { airtableFetch } from "@/lib/airtable/client";
import { TABLES, FIELDS } from "@/lib/airtable/constants";

const API_BASE = "https://api.airtable.com/v0";
const USERS_TABLE = encodeURIComponent(TABLES.PEOPLE);

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
  const f = record.fields
  return {
    id: record.id,
    fullName: f[FIELDS.USERS.FULL_NAME] as string | undefined,
    preferredName: f[FIELDS.USERS.PREFERRED_NAME] as string | undefined,
    firstName: f[FIELDS.USERS.FIRST_NAME] as string | undefined,
    lastName: f[FIELDS.USERS.LAST_NAME] as string | undefined,
    email: (f[FIELDS.USERS.EMAIL] as string) ?? "",
    workEmail: f[FIELDS.USERS.WORK_EMAIL] as string | undefined,
    jobTitle: f[FIELDS.USERS.JOB_TITLE] as string | undefined,
    role: f[FIELDS.USERS.ROLE] as string | undefined,
    // Company ID and Company Name are Airtable lookup fields — they come back
    // as arrays, not strings. Use readLookup to normalise.
    companyId: readLookup(f[FIELDS.USERS.COMPANY_ID]),
    companyName: readLookup(f[FIELDS.USERS.COMPANY_NAME]),
    avatarUrl: f[FIELDS.USERS.AVATAR_URL] as string | undefined,
    profilePhoto: Array.isArray(f[FIELDS.USERS.PROFILE_PHOTO])
      ? (f[FIELDS.USERS.PROFILE_PHOTO] as Array<{ url: string }>)[0]?.url
      : undefined,
    timeAtCompany: f[FIELDS.USERS.TIME_AT_COMPANY] as string | undefined,
    // Linked record IDs for Coach and Team Lead
    coachIds: Array.isArray(f[FIELDS.USERS.COACH])
      ? (f[FIELDS.USERS.COACH] as string[])
      : [],
    teamLeadIds: Array.isArray(f[FIELDS.USERS.TEAM_LEAD])
      ? (f[FIELDS.USERS.TEAM_LEAD] as string[])
      : [],
    // Coaching context
    quickNotes: f[FIELDS.USERS.QUICK_NOTES] as string | undefined,
    familyDetails: f[FIELDS.USERS.FAMILY_DETAILS] as string | undefined,
    // Personality — lookup fields from linked tables (read only)
    enneagramType: readLookup(f[FIELDS.USERS.ENNEAGRAM_TYPE_FROM_ENNEAGRAM]),
    enneagramDescriptor: readLookup(f[FIELDS.USERS.DESCRIPTOR_FROM_ENNEAGRAM]),
    mbtiType: readLookup(f[FIELDS.USERS.MBTI_FROM_MBTI]),
    mbtiDescriptor: readLookup(f[FIELDS.USERS.DESCRIPTOR_FROM_MBTI]),
    // "Conflict Posture" field returns raw linked record IDs — no name lookup exists.
    // Only the descriptor lookup is available in this base.
    conflictPosture: undefined,
    conflictPostureDescriptor: readLookup(f[FIELDS.USERS.DESCRIPTOR_FROM_CONFLICT_POSTURE]),
    apologyLanguage: readLookup(f[FIELDS.USERS.APOLOGY_LANGUAGE_FROM_APOLOGY_LANGUAGE]),
    apologyLanguageDescriptor: readLookup(f[FIELDS.USERS.DESCRIPTOR_FROM_APOLOGY_LANGUAGE]),
    strengths: readStrengths(
      f[FIELDS.USERS.STRENGTH_NAME_FROM_STRENGTHS],
      f[FIELDS.USERS.DOMAIN_FROM_STRENGTHS]
    ),
    associatedMeetingIds: Array.isArray(f[FIELDS.USERS.ASSOCIATED_MEETINGS])
      ? (f[FIELDS.USERS.ASSOCIATED_MEETINGS] as string[])
      : [],
    // Org / Team — linked record IDs
    managerIds: Array.isArray(f[FIELDS.USERS.MANAGER])
      ? (f[FIELDS.USERS.MANAGER] as string[])
      : [],
    directReportIds: Array.isArray(f[FIELDS.USERS.DIRECT_REPORTS])
      ? (f[FIELDS.USERS.DIRECT_REPORTS] as string[])
      : [],
    teamMemberIds: Array.isArray(f[FIELDS.USERS.TEAM_MEMBERS])
      ? (f[FIELDS.USERS.TEAM_MEMBERS] as string[])
      : [],
    // Raw linked record IDs for edit forms
    enneagramIds: Array.isArray(f[FIELDS.USERS.ENNEAGRAM])
      ? (f[FIELDS.USERS.ENNEAGRAM] as string[]) : [],
    mbtiIds: Array.isArray(f[FIELDS.USERS.MBTI])
      ? (f[FIELDS.USERS.MBTI] as string[]) : [],
    conflictPostureIds: Array.isArray(f[FIELDS.USERS.CONFLICT_POSTURE])
      ? (f[FIELDS.USERS.CONFLICT_POSTURE] as string[]) : [],
    apologyLanguageIds: Array.isArray(f[FIELDS.USERS.APOLOGY_LANGUAGE])
      ? (f[FIELDS.USERS.APOLOGY_LANGUAGE] as string[]) : [],
    strengthIds: Array.isArray(f[FIELDS.USERS.STRENGTHS])
      ? (f[FIELDS.USERS.STRENGTHS] as string[]) : [],
    companyLinkedIds: Array.isArray(f[FIELDS.USERS.COMPANY])
      ? (f[FIELDS.USERS.COMPANY] as string[]) : [],
    // Extra contact fields
    personalEmail: f[FIELDS.USERS.PERSONAL_EMAIL] as string | undefined,
    birthday: f[FIELDS.USERS.BIRTHDAY] as string | undefined,
    workDeskNumber: f[FIELDS.USERS.WORK_DESK_NUMBER] as string | undefined,
    workCellNumber: f[FIELDS.USERS.WORK_CELL_NUMBER] as string | undefined,
    personalCellNumber: f[FIELDS.USERS.PERSONAL_CELL_NUMBER] as string | undefined,
    // Legacy / alternate read paths
    enneagram: f[FIELDS.USERS.ENNEAGRAM] as string | undefined,
    mbti: f[FIELDS.USERS.MBTI] as string | undefined,
    department: f[FIELDS.USERS.DEPARTMENT] as string | undefined,
    title: f[FIELDS.USERS.TITLE] as string | undefined,
    startDate: f[FIELDS.USERS.START_DATE] as string | undefined,
    hireDate: f[FIELDS.USERS.HIRE_DATE] as string | undefined,
    engagementLevel: f[FIELDS.USERS.ENGAGEMENT_LEVEL] as string | undefined,
    coachNotes: f[FIELDS.USERS.COACH_NOTES] as string | undefined,
    internalNotes: f[FIELDS.USERS.INTERNAL_NOTES] as string | undefined,
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
  const res = await airtableFetch(
    `${API_BASE}/${baseId}/${USERS_TABLE}?filterByFormula=${formula}&maxRecords=20`,
    { headers: { Authorization: `Bearer ${apiKey}` }, cache: 'no-store' },
  )
  if (!res.ok) return []
  const data = await res.json()
  return (data.records ?? []).map((r: { id: string; fields: Record<string, unknown> }) => {
    const f = r.fields
    const name =
      (f[FIELDS.USERS.FULL_NAME] as string | undefined) ||
      [f[FIELDS.USERS.FIRST_NAME], f[FIELDS.USERS.LAST_NAME]].filter(Boolean).join(' ') ||
      (f[FIELDS.USERS.EMAIL] as string | undefined) ||
      r.id
    return { id: r.id, name, jobTitle: f[FIELDS.USERS.JOB_TITLE] as string | undefined }
  })
}

export async function createUserRecord(fields: {
  'First Name'?: string
  'Last Name'?: string
  'Job Title'?: string
  'Title'?: string
  'Work Email'?: string
  'Role'?: string
  'Coach'?: string[]  // Airtable record IDs of coach users
  'Company'?: string[]  // Airtable record IDs of company records
}): Promise<string> {
  const { apiKey, baseId } = getCredentials()

  // Only write to confirmed writable fields.
  // 'Full Name' is a formula — Airtable rejects writes to it.
  // 'Company Name' is a lookup — not writable.
  const body = {
    fields: {
      ...(fields['First Name'] ? { 'First Name': fields['First Name'] } : {}),
      ...(fields['Last Name'] ? { 'Last Name': fields['Last Name'] } : {}),
      ...(fields['Job Title'] ? { 'Job Title': fields['Job Title'] } : {}),
      ...(fields['Title'] ? { 'Title': fields['Title'] } : {}),
      ...(fields['Work Email'] ? { 'Work Email': fields['Work Email'] } : {}),
      ...(fields['Role'] ? { 'Role': fields['Role'] } : {}),
      ...(fields['Coach']?.length ? { 'Coach': fields['Coach'] } : {}),
      ...(fields['Company']?.length ? { 'Company': fields['Company'] } : {}),
    },
  }
  console.log('[createUserRecord] POST body:', JSON.stringify(body, null, 2))
  const res = await airtableFetch(`${API_BASE}/${baseId}/${USERS_TABLE}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  console.log('[createUserRecord] status:', res.status, '| response:', JSON.stringify(data, null, 2))
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
  const res = await airtableFetch(`${API_BASE}/${baseId}/${USERS_TABLE}/${userId}`, {
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
    console.log('[debug] getAllUsers table: Users')
    const res = await airtableFetch(`${API_BASE}/${baseId}/${USERS_TABLE}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      next: { revalidate: 60 },
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`[debug] getAllUsers failed status: ${res.status} body: ${text}`);
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
    const res = await airtableFetch(`${API_BASE}/${baseId}/${USERS_TABLE}/${userId}`, {
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
  // Text / date fields
  'First Name'?: string
  'Last Name'?: string
  'Preferred Name'?: string
  'Work Email'?: string
  'Personal Email'?: string
  'Title'?: string
  'Hire Date'?: string
  'Birthday'?: string
  'Work Desk Number'?: string
  'Work Cell Number'?: string
  'Personal Cell Number'?: string
  'Role'?: string
  'Internal Notes'?: string
  // NOTE: Quick Notes and Family Details are coach-specific — write to
  // Coach-Person Context table via upsertCoachPersonContext, not here.
  // Linked record fields — arrays of record IDs
  'Enneagram'?: string[]
  'MBTI'?: string[]
  'Conflict Posture'?: string[]
  'Apology Language'?: string[]
  'Strengths'?: string[]
  'Coach'?: string[]
  'Team Lead'?: string[]
  'Company'?: string[]
}

export async function updateUserProfile(
  userId: string,
  fields: UserProfileFields,
): Promise<void> {
  const { apiKey, baseId } = getCredentials()

  // Never send empty strings or empty arrays — skip fields with no value.
  const sanitized = Object.fromEntries(
    Object.entries(fields).filter(([, v]) => {
      if (v === undefined || v === null) return false
      if (typeof v === 'string') return v !== ''
      if (Array.isArray(v)) return v.length > 0
      return true
    })
  )

  console.log('[updateUserProfile] userId:', userId)
  console.log('[updateUserProfile] fields to write:', JSON.stringify(sanitized, null, 2))

  const res = await airtableFetch(`${API_BASE}/${baseId}/${USERS_TABLE}/${userId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fields: sanitized }),
  })

  // Read body as text once — avoids double-read issues and captures full error
  const responseText = await res.text()
  console.log('[updateUserProfile] Airtable status:', res.status)
  console.log('[updateUserProfile] Airtable response:', responseText)

  if (!res.ok) {
    console.error('[updateUserProfile] Full Airtable error:', res.status, responseText)
    throw new Error(`Airtable PATCH failed (${res.status}): ${responseText}`)
  }
}

// ── Profile options (for the Edit Profile dialog dropdowns) ───────────────────

export interface ProfileOption {
  id: string
  name: string
}

async function fetchTableOptions(
  tableName: string,
  nameField: string,
  filterFormula?: string,
): Promise<ProfileOption[]> {
  try {
    const { apiKey, baseId } = getCredentials()
    const params = new URLSearchParams()
    params.append('fields[]', nameField)
    params.set('maxRecords', '200')
    if (filterFormula) params.set('filterByFormula', filterFormula)
    const res = await airtableFetch(
      `${API_BASE}/${baseId}/${encodeURIComponent(tableName)}?${params}`,
      { headers: { Authorization: `Bearer ${apiKey}` }, cache: 'no-store' },
    )
    if (!res.ok) {
      console.warn(`[fetchTableOptions] ${tableName} failed:`, res.status)
      return []
    }
    const data = await res.json()
    return (data.records ?? [])
      .map((r: { id: string; fields: Record<string, unknown> }) => ({
        id: r.id,
        name: (r.fields[nameField] as string) ?? '',
      }))
      .filter((r: ProfileOption) => r.name)
  } catch (e) {
    console.warn(`[fetchTableOptions] ${tableName} error:`, e)
    return []
  }
}

export async function fetchProfileOptions(allUsers: User[]): Promise<{
  companies: ProfileOption[]
  enneagrams: ProfileOption[]
  mbtis: ProfileOption[]
  conflictPostures: ProfileOption[]
  apologyLanguages: ProfileOption[]
  strengths: ProfileOption[]
  coaches: ProfileOption[]
  allUsers: ProfileOption[]
}> {
  const [companies, enneagrams, mbtis, conflictPostures, apologyLanguages, strengths] =
    await Promise.all([
      // Companies primary field is "Company Name", not "Name". Restrict to
      // Active orgs only — spec Section 5 Table 2.
      fetchTableOptions(TABLES.ORGANIZATIONS, FIELDS.COMPANIES.NAME, `{${FIELDS.COMPANIES.STATUS}}="Active"`),
      fetchTableOptions('Enneagram', FIELDS.ENNEAGRAM.NAME),
      fetchTableOptions('16Personalities', FIELDS.PERSONALITIES_16.NAME),
      fetchTableOptions('Conflict Postures', FIELDS.CONFLICT_POSTURES.NAME),
      fetchTableOptions('Apology Languages', FIELDS.APOLOGY_LANGUAGES.NAME),
      fetchTableOptions('Strengths', FIELDS.STRENGTHS.NAME),
    ])

  const nameOf = (u: User) =>
    (u.fullName ?? [u.firstName, u.lastName].filter(Boolean).join(' ')) || u.email

  const coaches = allUsers
    .filter((u) => u.role?.toLowerCase() === 'coach' || u.role?.toLowerCase() === 'admin')
    .map((u) => ({ id: u.id, name: nameOf(u) }))

  const users = allUsers.map((u) => ({ id: u.id, name: nameOf(u) }))

  return { companies, enneagrams, mbtis, conflictPostures, apologyLanguages, strengths, coaches, allUsers: users }
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
    const res = await airtableFetch(`${API_BASE}/${baseId}/${USERS_TABLE}/${id}`, {
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
