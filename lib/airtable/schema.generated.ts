// Auto-generated from the Airtable Meta API. 2026-05-10
//
// This file is a REFERENCE — it's not yet imported by the active code, which
// still uses field names via lib/airtable/constants.ts. When we migrate to
// ID-based references (the planned migration), update constants.ts to point
// at these IDs and append `returnFieldsByFieldId=true` to every fetch URL.
//
// To regenerate: npx tsx scripts/dump-airtable-schema.ts

// ── TABLES ─────────────────────────────────────────────────────────────────

export const TABLE_IDS = {
  USERS: 'tblD4Pttofq0sDl2R',                       // "Users"
  COMPANIES: 'tbl56SmsLjb0odxag',                   // "Companies"
  STRENGTHS: 'tblXyaww4PqwXxNjN',                   // "Strengths"
  PERSONALITIES_16: 'tblXqHT7DoRNEF7nb',            // "16Personalities"
  ENNEAGRAM: 'tblxIXPnTaO2GcxRp',                   // "Enneagram"
  APOLOGY_LANGUAGES: 'tblwxN86JQrYPqVlv',           // "Apology Languages"
  CONFLICT_POSTURES: 'tblqe4I8l7y1Y0TAI',           // "Conflict Postures"
  CALENDAR_EVENTS: 'tblBhfhZzNEOPOKqs',             // "Calendar Events"        — REVIEW: legacy
  LINKED_TODOIST_TASKS: 'tblK0103V31eeZD0c',        // "Linked Todoist Tasks"   — REVIEW: not used by portal
  MESSAGES: 'tbl8VGHVCU8cXyAis',                    // "Messages"
  TOOLS_RESOURCES: 'tblWyhmeuvvlt77ud',             // "Tools & Resources"
  NOTES: 'tblSTELdCWLYk5dq4',                       // "Notes"
  TASKS: 'tbleG9GWJEB9jd6yt',                       // "Tasks"
  COACH_PERSON_CONTEXT: 'tbly1SOW603Qhd2nJ',        // "Coach-Person Context"   — REVIEW: deprecation candidate
  COACH_SESSION: 'tblPFj41wHQXZVzzZ',               // "Coach Session"          — REVIEW: deprecation candidate
  MEETINGS: 'tblUm3dEvQqQBhxSE',                    // "Meetings"
  RELATIONSHIP_CONTEXTS: 'tblYdLi7dp2RmhNjh',       // "Relationship Contexts"
  PERMISSION_PROFILES: 'tbl1XeWzXjE41fSSE',         // "Permission Profiles"
  ORGANIZATION_MEMBERSHIPS: 'tbl6Ld2QCBAN4EI62',    // "Organization Memberships"
} as const

// ── FIELDS the code actually uses ─────────────────────────────────────────
// (Full schema dump including all 258 fields lives in airtable-schema.txt
// at the repo root. This block is the trimmed version mapped to the keys
// constants.ts uses today.)

export const FIELD_IDS = {
  RELATIONSHIP_CONTEXTS: {
    PERSON: 'fldvNEiXLMymiyCTj',                    // "Person"
    LEAD: 'fld1f2J50eTmLoSXG',                      // "Lead"
    TYPE: 'fldjEfITRItxf7OLl',                      // "Relationship Type"
    PERMISSION_LEVEL: 'fldbZwRLGEz5mAsws',          // "Permission Level"
    STATUS: 'fldm3QrrCbs34ai2F',                    // "Status"
    START_DATE: 'fld3bTwZSm3lQNi9N',                // "Start Date"
  },
  MEETINGS: {
    TITLE: 'fldAk4BCE60mYBv4I',                     // "Subject"
    START: 'fldvUrf7tG2xQ8Q1E',                     // "Start Time"
    END: 'fldfdh1Tq2Xmsp68X',                       // "End Time"
    PROVIDER_EVENT_ID: 'fldcugcsHlIPbEgna',         // "Provider Event ID"
    ATTENDEES: 'fldpCCYTuIOXuqqCd',                 // "Attendees"
    CALENDAR_OWNER: 'fld790fAzn86Lquig',            // "Calendar Owner"
    CLIENT_NAME: 'fldK2TOXuqUOSWdk9',               // "Client Name"
    RELATIONSHIP_CONTEXT: 'fldwLPj5ahMVI9mam',      // "Relationship Context"
    TIMEZONE: 'fld0MYHtXEbwJ0EFe',                  // "Timezone"
    MEETING_STATUS: 'fldj6d4eqytFAjg56',            // "Meeting Status"
    CALENDAR_PROVIDER: 'fldBhVB6jjJZVER4o',         // "Calendar Provider"
    // Legacy fields still present:
    RELATIONSHIP_CONTEXT_ID_LEGACY: 'fldJdvP94uJKQ4eeZ', // "Relationship Context ID" — REVIEW
    PARTICIPANT_EMAILS_LEGACY: 'fldrKHTiLsfdCwHLG',      // "Participant Emails"      — REVIEW (duplicate of Attendees)
  },
  NOTES: {
    CONTENT: 'fldCT8P7Da1INkG0T',                   // "Content"     — currently used as BODY by code
    BODY: 'fldA9OAIkuQYhFL0R',                      // "Body"        — spec-correct name; unused today
    DATE: 'fldnOSv13VmCbOtEY',                      // "Date"
    CLIENT: 'fldDLBsX8zXpJInAD',                    // "Client"
    COACH_NAME: 'fld4QwJB7HdqZPQZt',                // "Coach Name"
    AUTHOR_PERSON: 'fldWJgq54h0A2OvCy',             // "Author Person"
    SUBJECT_PERSON: 'fldzCJbxYI9Ny5nwj',            // "Subject Person"
    MEETING: 'flduXwHTvTUjaZ9Fz',                   // "Meeting"     — singleLineText (spec wants linked record)
    NOTE_TYPE: 'fldRCz98Sppbgbq5e',                 // "Note Type"
    VISIBILITY: 'fldan9xqdso86TKBv',                // "Visibility"
    RELATIONSHIP_CONTEXT: 'fldltUsIa9P0U73li',      // "Relationship Context"
    RELATIONSHIP_CONTEXT_ID_LEGACY: 'fldXc6lPXxw5Y84PM', // "Relationship Context ID" — REVIEW
  },
  TASKS: {
    TITLE: 'fldRgrskNdZharknP',                     // "Title"
    STATUS: 'fldtsgD1YZ6t1mwpm',                    // "Status"
    DUE_DATE: 'fldrSWXmgm4vSuLyV',                  // "Due Date"
    CLIENT: 'flduy2wmhQfarU9yP',                    // "Client"
    NOTES: 'fldPjSEnJ22a10vfw',                     // "Notes"
    RELATIONSHIP_CONTEXT: 'fldQbgGA2WfAXXVuV',      // "Relationship Context"
    CREATED_BY_PERSON: 'fldVIIP6weGTTYB07',         // "Created By Person"
    ASSIGNED_TO_PERSON: 'fldFOgzUG94oxI4jU',        // "Assigned To Person"
    TASK_TYPE: 'fldhJUxdZGKijHSKX',                 // "Task Type"
    VISIBILITY: 'fldOpVCxStZP5tMhP',                // "Visibility"
    // Legacy fields:
    COACH_NAME_LEGACY: 'fldL9jwQH58TZ6dcA',         // "Coach Name"       — REVIEW
    ASSIGNED_TO_LEGACY: 'fldSvowzJWL9cqbBr',        // "Assigned To"      — REVIEW
    ASSIGNED_TO_NAME_LEGACY: 'fldhYvTCbxm00iRwY',   // "Assigned To Name" — REVIEW
    ASSIGNMENT_TYPE_LEGACY: 'fld6uspPoBcAJS0gk',    // "Assignment Type"  — REVIEW (superseded by Task Type + Visibility)
  },
  COACH_SESSION: {
    COACH: 'fldMKmrbXmxpXV3Y5',                     // "Coach"
    CALENDAR_EVENT: 'fldoHpg3OxFnuKeJ5',            // "Calendar Event"
    FOCAL_PERSON: 'fldz6kvciTYm30gNq',              // "Focal Person"
    SESSION_NOTES: 'fldEy7rDjvvIG13Af',             // "Session Notes"
    ACTION_ITEMS: 'fldVJ8aeHxjrHd1Gh',              // "Action Items"
    LAST_UPDATED: 'fld5Veqq1nQpQkdaG',              // "Last Updated"
  },
  USERS: {
    TITLE: 'fldVwZtWoJjZp920l',                     // "Title"
    FIRST_NAME: 'fldOGveomFlCV6DjD',                // "First Name"
    LAST_NAME: 'fldJh2vuJqYkyyZqx',                 // "Last Name"
    FULL_NAME: 'fldH8rST4tjq0gis7',                 // "Full Name"        — formula, read-only
    WORK_EMAIL: 'fldlL8HrXCnd3K4KL',                // "Work Email"
    COMPANY: 'fldUu6I5aaiIhTVj6',                   // "Company"          — multipleRecordLinks
    ROLE: 'fldaSnC1UCEukV8Um',                     // "Role"             — values mismatch spec (Team Lead | Team Member | Both | Coach | Senior Leader)
    COACH: 'fld4kKouAYi5plNVL',                     // "Coach"            — REVIEW: spec wants reports_to RC rows
    TEAM_LEAD: 'fldRyJGLnzfoZlIpN',                 // "Team Lead"        — REVIEW
    TEAM_MEMBERS: 'fldbpthkjaXy7mU0R',              // "Team Members"     — REVIEW
    PROFILE_PHOTO: 'fldHj7YBmed6S8s58',             // "Profile Photo"
    QUICK_NOTES: 'fldduqJaVzxE9u6IP',               // "Quick Notes"      — REVIEW: code reads from Coach-Person Context now
    FAMILY_DETAILS: 'fldZb1F9kHhHPjqLk',            // "Family Details"   — REVIEW: same
    ASSOCIATED_MEETINGS: 'fld1t3bIXyBxHEh4B',       // "Associated Meetings"  — auto-mirror
    // No "Internal Notes" field exists in this base. Code reads it and gets undefined silently.
  },
  COMPANIES: {
    NAME: 'fldl7bZkR5JCKyLHk',                      // "Company Name"
    STATUS: 'fldk33AceBzzND138',                    // "Status"
    ORGANIZATION_TYPE: 'fldkxkzOX87KZctuL',         // "Organization Type"
  },
  COACH_PERSON_CONTEXT: {
    COACH: 'fldMidd750nvVaOuD',                     // "Coach"
    PERSON: 'fldgP7Hn2EnOCeEOn',                    // "Person"
    QUICK_NOTES: 'fldeCsw5wQ9cJJJte',               // "Quick Notes"
    FAMILY_DETAILS: 'fldICfOOjlBgwXLzI',            // "Family Details"
    RELATIONSHIP_FLAGS: 'fldkaBmcetVEbGD02',        // "Relationship Flags"
    LAST_UPDATED: 'fldV5RnOV6h0IkPkR',              // "Last Updated"
  },
  PERMISSION_PROFILES: {
    PROFILE_NAME: 'fldnGsXftdue5s0Ws',              // "Profile Name"
    NOTES_DEFAULT_VISIBILITY: 'fldoio0Bwxso2736X',  // "Notes Default Visibility"
  },
} as const
