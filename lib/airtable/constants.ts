// ─────────────────────────────────────────────────────────────────────────────
//  AIRTABLE TABLE + FIELD IDS
// ─────────────────────────────────────────────────────────────────────────────
//  Values are stable Airtable IDs. Renames in Airtable no longer break the
//  portal. Field names are preserved as comments for review.
//
//  Reads: every Airtable GET goes through airtableFetch() in client.ts which
//  appends `returnFieldsByFieldId=true`, so the response is keyed by ID.
//  Code accesses fields via `record.fields[FIELDS.X.Y]` which matches.
//
//  Writes: Airtable accepts both names and IDs in request bodies. Existing
//  write payloads using literal name keys still work; new code can use IDs.
//
//  To regenerate after schema changes:
//    npx tsx scripts/dump-airtable-schema.ts
//
//  Schema reference (with all 258 fields): lib/airtable/schema.generated.ts
// ─────────────────────────────────────────────────────────────────────────────

export const TABLES = {
  PEOPLE: 'tblD4Pttofq0sDl2R',                  // "Users"
  ORGANIZATIONS: 'tbl56SmsLjb0odxag',           // "Companies"
  ORG_MEMBERSHIPS: 'tbl6Ld2QCBAN4EI62',         // "Organization Memberships"
  PERMISSION_PROFILES: 'tbl1XeWzXjE41fSSE',     // "Permission Profiles"
  RELATIONSHIP_CONTEXTS: 'tblYdLi7dp2RmhNjh',   // "Relationship Contexts"
  PORTAL_ACCOUNTS: 'Portal Accounts',           // future — table doesn't exist yet
  MEETINGS: 'tblUm3dEvQqQBhxSE',                // "Meetings"
  NOTES: 'tblSTELdCWLYk5dq4',                   // "Notes"
  TASKS: 'tbleG9GWJEB9jd6yt',                   // "Tasks"
  COACH_SESSION: 'tblPFj41wHQXZVzzZ',           // "Coach Session"
  COACH_PERSON_CONTEXT: 'tbly1SOW603Qhd2nJ',    // "Coach-Person Context"
  MESSAGES: 'tbl8VGHVCU8cXyAis',                // "Messages"
} as const

export const FIELDS = {
  RELATIONSHIP_CONTEXTS: {
    PERSON: 'fldvNEiXLMymiyCTj',                // "Person"
    LEAD: 'fld1f2J50eTmLoSXG',                  // "Lead"
    TYPE: 'fldjEfITRItxf7OLl',                  // "Relationship Type"
    PERMISSION_LEVEL: 'fldbZwRLGEz5mAsws',      // "Permission Level"
    STATUS: 'fldm3QrrCbs34ai2F',                // "Status"
    START_DATE: 'fld3bTwZSm3lQNi9N',            // "Start Date"
  },
  MEETINGS: {
    TITLE: 'fldAk4BCE60mYBv4I',                 // "Subject"
    START: 'fldvUrf7tG2xQ8Q1E',                 // "Start Time"
    END: 'fldfdh1Tq2Xmsp68X',                   // "End Time"
    PROVIDER_EVENT_ID: 'fldcugcsHlIPbEgna',     // "Provider Event ID"
    ATTENDEES: 'fldpCCYTuIOXuqqCd',             // "Attendees"
    CALENDAR_OWNER: 'fld790fAzn86Lquig',        // "Calendar Owner"
    CLIENT_NAME: 'fldK2TOXuqUOSWdk9',           // "Client Name"
    RELATIONSHIP_CONTEXT: 'fldwLPj5ahMVI9mam',  // "Relationship Context"
    TIMEZONE: 'fld0MYHtXEbwJ0EFe',              // "Timezone"
    MEETING_STATUS: 'fldj6d4eqytFAjg56',        // "Meeting Status"
    CALENDAR_PROVIDER: 'fldBhVB6jjJZVER4o',     // "Calendar Provider"
  },
  NOTES: {
    BODY: 'fldCT8P7Da1INkG0T',                  // "Content"
    DATE: 'fldnOSv13VmCbOtEY',                  // "Date"
    CLIENT: 'fldDLBsX8zXpJInAD',                // "Client"
    COACH_NAME: 'fld4QwJB7HdqZPQZt',            // "Coach Name"
    AUTHOR_PERSON: 'fldWJgq54h0A2OvCy',         // "Author Person"
    SUBJECT_PERSON: 'fldzCJbxYI9Ny5nwj',        // "Subject Person"
    MEETING: 'flduXwHTvTUjaZ9Fz',               // "Meeting" (singleLineText today)
    NOTE_TYPE: 'fldRCz98Sppbgbq5e',             // "Note Type"
    VISIBILITY: 'fldan9xqdso86TKBv',            // "Visibility"
    RELATIONSHIP_CONTEXT: 'fldltUsIa9P0U73li',  // "Relationship Context"
  },
  TASKS: {
    TITLE: 'fldRgrskNdZharknP',                 // "Title"
    STATUS: 'fldtsgD1YZ6t1mwpm',                // "Status"
    DUE_DATE: 'fldrSWXmgm4vSuLyV',              // "Due Date"
    CLIENT: 'flduy2wmhQfarU9yP',                // "Client"
    NOTES: 'fldPjSEnJ22a10vfw',                 // "Notes"
    RELATIONSHIP_CONTEXT: 'fldQbgGA2WfAXXVuV',  // "Relationship Context"
    CREATED_BY_PERSON: 'fldVIIP6weGTTYB07',     // "Created By Person"
    ASSIGNED_TO_PERSON: 'fldFOgzUG94oxI4jU',    // "Assigned To Person"
    TASK_TYPE: 'fldhJUxdZGKijHSKX',             // "Task Type"
    VISIBILITY: 'fldOpVCxStZP5tMhP',            // "Visibility"
  },
  COACH_SESSION: {
    COACH: 'fldMKmrbXmxpXV3Y5',                 // "Coach"
    CALENDAR_EVENT: 'fldoHpg3OxFnuKeJ5',        // "Calendar Event"
    FOCAL_PERSON: 'fldz6kvciTYm30gNq',          // "Focal Person"
    SESSION_NOTES: 'fldEy7rDjvvIG13Af',         // "Session Notes"
    ACTION_ITEMS: 'fldVJ8aeHxjrHd1Gh',          // "Action Items"
    LAST_UPDATED: 'fld5Veqq1nQpQkdaG',          // "Last Updated"
  },
  USERS: {
    FULL_NAME: 'fldH8rST4tjq0gis7',                                // "Full Name"
    PREFERRED_NAME: 'fld3HX06VuQWQYCM1',                           // "Preferred Name"
    FIRST_NAME: 'fldOGveomFlCV6DjD',                               // "First Name"
    LAST_NAME: 'fldJh2vuJqYkyyZqx',                                // "Last Name"
    EMAIL: 'Email',                                                // does not exist in schema; read returns undefined
    WORK_EMAIL: 'fldlL8HrXCnd3K4KL',                               // "Work Email"
    JOB_TITLE: 'Job Title',                                        // does not exist in schema; read returns undefined
    TITLE: 'fldVwZtWoJjZp920l',                                    // "Title"
    ROLE: 'fldaSnC1UCEukV8Um',                                     // "Role"
    COMPANY_ID: 'Company ID',                                      // does not exist in schema
    COMPANY_NAME: 'fldHd3omMw7PUAWNJ',                             // "Company Name (from Company)" lookup
    AVATAR_URL: 'Avatar URL',                                      // does not exist in schema
    PROFILE_PHOTO: 'fldHj7YBmed6S8s58',                            // "Profile Photo"
    TIME_AT_COMPANY: 'fldi1Ez09JdS0tjnb',                          // "Time at Company"
    COACH: 'fld4kKouAYi5plNVL',                                    // "Coach"
    TEAM_LEAD: 'fldRyJGLnzfoZlIpN',                                // "Team Lead"
    QUICK_NOTES: 'fldduqJaVzxE9u6IP',                              // "Quick Notes"
    FAMILY_DETAILS: 'fldZb1F9kHhHPjqLk',                           // "Family Details"
    ENNEAGRAM_TYPE_FROM_ENNEAGRAM: 'fld3NTWw3EmFRVBRY',            // "Enneagram Type (from Enneagram)"
    DESCRIPTOR_FROM_ENNEAGRAM: 'fldfTiZfRCarNCvUe',                // "Descriptor (from Enneagram)"
    MBTI_FROM_MBTI: 'fldetFbWFerHgk3Ai',                           // "MBTI (from MBTI)"
    DESCRIPTOR_FROM_MBTI: 'fld3rOcdWcI0jexPr',                     // "Descriptor (from MBTI)"
    DESCRIPTOR_FROM_CONFLICT_POSTURE: 'fldW64peeLXRGtaMt',         // "Descriptor (from Conflict Posture)"
    APOLOGY_LANGUAGE_FROM_APOLOGY_LANGUAGE: 'fldz2XhOUPxcU3W0O',   // "Apology Language (from Apology Language)"
    DESCRIPTOR_FROM_APOLOGY_LANGUAGE: 'fldcmyFlWikFNyR53',         // "Descriptor (from Apology Language)"
    STRENGTH_NAME_FROM_STRENGTHS: 'fldm4MrDJsj8BZHRz',             // "Strength Name (from Strengths)"
    DOMAIN_FROM_STRENGTHS: 'fldG84OLoi5HtKagW',                    // "Domain (from Strengths)"
    ASSOCIATED_MEETINGS: 'fld1t3bIXyBxHEh4B',                      // "Associated Meetings"
    MANAGER: 'Manager',                                            // does not exist in schema
    DIRECT_REPORTS: 'Direct Reports',                              // does not exist in schema
    TEAM_MEMBERS: 'fldbpthkjaXy7mU0R',                             // "Team Members"
    ENNEAGRAM: 'fldSQ11YFsWjlkREZ',                                // "Enneagram"
    MBTI: 'fldyjw72Zx7bbbSqQ',                                     // "MBTI"
    CONFLICT_POSTURE: 'fldCD4HvwKE5SXXLE',                         // "Conflict Posture"
    APOLOGY_LANGUAGE: 'fldVEQ4DZuTARM3ST',                         // "Apology Language"
    STRENGTHS: 'fldcQe5diYYsoThxi',                                // "Strengths"
    COMPANY: 'fldUu6I5aaiIhTVj6',                                  // "Company"
    PERSONAL_EMAIL: 'fldsARb1wJcJauPAx',                           // "Personal Email"
    BIRTHDAY: 'flde4V2mmmYv0dMME',                                 // "Birthday"
    WORK_DESK_NUMBER: 'fldZIvMj9ggKNAHwO',                         // "Work Desk Number"
    WORK_CELL_NUMBER: 'fldoMP21FCwAemPEW',                         // "Work Cell Number"
    PERSONAL_CELL_NUMBER: 'fldV3990UGnVEdSQL',                     // "Personal Cell Number"
    DEPARTMENT: 'Department',                                      // does not exist in schema
    START_DATE: 'Start Date',                                      // does not exist in schema
    HIRE_DATE: 'fldQPh2SMs4SXjp6Q',                                // "Hire Date"
    ENGAGEMENT_LEVEL: 'Engagement Level',                          // does not exist in schema
    COACH_NOTES: 'Coach Notes',                                    // does not exist in schema
    INTERNAL_NOTES: 'Internal Notes',                              // does not exist in schema
  },
  COMPANIES: {
    NAME: 'fldl7bZkR5JCKyLHk',                  // "Company Name"
    STATUS: 'fldk33AceBzzND138',                // "Status"
    ORGANIZATION_TYPE: 'fldkxkzOX87KZctuL',     // "Organization Type"
  },
  ENNEAGRAM: {
    NAME: 'fldDHEcTx28Dpnccp',                  // "Name"
  },
  PERSONALITIES_16: {
    NAME: 'fldPBfoiEuRsDFQr9',                  // "Name"
  },
  CONFLICT_POSTURES: {
    NAME: 'fldtdKv50CBpFe7V8',                  // "Conflict Posture"
  },
  APOLOGY_LANGUAGES: {
    NAME: 'fldS441fSkXjaFdO9',                  // "Apology Language"
  },
  STRENGTHS: {
    NAME: 'fldO3GPrkGxC1ldZi',                  // "Strength"
  },
  COACH_PERSON_CONTEXT: {
    COACH: 'fldMidd750nvVaOuD',                 // "Coach"
    PERSON: 'fldgP7Hn2EnOCeEOn',                // "Person"
    QUICK_NOTES: 'fldeCsw5wQ9cJJJte',           // "Quick Notes"
    FAMILY_DETAILS: 'fldICfOOjlBgwXLzI',        // "Family Details"
    RELATIONSHIP_FLAGS: 'fldkaBmcetVEbGD02',    // "Relationship Flags"
    LAST_UPDATED: 'fldV5RnOV6h0IkPkR',          // "Last Updated"
  },
  PERMISSION_PROFILES: {
    PROFILE_NAME: 'fldnGsXftdue5s0Ws',          // "Profile Name"
    NOTES_DEFAULT_VISIBILITY: 'fldoio0Bwxso2736X', // "Notes Default Visibility"
  },
  MESSAGES: {
    MESSAGE_NAME: 'fldRIXITrwYvnBGyL',          // "Message Name"
    SUBJECT: 'fldnUHEAWC8FcR5eZ',               // "Subject"
    TYPE: 'fldWlN8Hm3TaSrK8b',                  // "Type"
    STATUS: 'fld3tCgsq2nnnLYjT',                // "Status"
    AI_GENERATED_MESSAGE_CONTENT: 'fldSvD7C2yybmEeUf',  // "AI Generated Message Content"
    DRAFT_CONTENT: 'fldd7GyTc2CwGKg6z',         // "Draft Content"
    SENT_MESSAGE: 'fldCCnyA3I5OiWdcK',          // "Sent Message"
    SENT_DATE: 'fldl3gImAEAqahxt4',             // "Sent Date"
    CREATED: 'fldFrjFZVlpUm7Abj',               // "Created"
    MEETING: 'Meeting',                         // singleLineText field on Messages — keep as legacy name (lookup-style)
    CLIENT: 'fldyAJpx9JBLeMNj7',                // "Client"
    ASSOCIATED_MEETINGS: 'fldyyn094584CIz6x',   // "Associated Meetings"
    ATTACHMENTS: 'fldxGMUQVcekiQ0Cj',           // "Attachments"
    RECIPIENT_EMAIL_FINAL: 'fld0EeBYZPVu0PH7j', // "Recipient Email (Final)"
    TOOLS_RESOURCES: 'fldkmBgodxSlz4zPT',       // "Tools & Resources"
  },
} as const
