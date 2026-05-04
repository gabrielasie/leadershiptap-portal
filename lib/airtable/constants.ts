export const TABLES = {
  PEOPLE: 'Users',
  ORGANIZATIONS: 'Companies',
  ORG_MEMBERSHIPS: 'Organization Memberships',
  PERMISSION_PROFILES: 'Permission Profiles',
  RELATIONSHIP_CONTEXTS: 'Relationship Contexts',
  PORTAL_ACCOUNTS: 'Portal Accounts',  // future
  MEETINGS: 'Meetings',                // was: Portal Calendar Events
  NOTES: 'Notes',                      // was: Session Notes
  TASKS: 'Tasks',
  COACH_SESSION: 'Coach Session',
  COACH_PERSON_CONTEXT: 'Coach-Person Context',
} as const

export const FIELDS = {
  RELATIONSHIP_CONTEXTS: {
    PERSON: 'Person',                  // was: Client
    LEAD: 'Lead',                      // was: Coach
    ORG: 'Organization',
    PERMISSION_PROFILE: 'Permission Profile',
    TYPE: 'Relationship Type',
    STATUS: 'Status',
    START_DATE: 'Start Date',
    END_DATE: 'End Date',
    CREATED_BY: 'Created By',
  },
  MEETINGS: {
    TITLE: 'Meeting Title',            // was: Subject
    REL_CONTEXT: 'Associated Relationship Context',
    START: 'Start Time',               // was: Start
    END: 'End Time',                   // was: End
    STATUS: 'Meeting Status',
    PROVIDER: 'Calendar Provider',
    PROVIDER_EVENT_ID: 'Provider Event ID',
    ICAL_UID: 'iCal UID',
    OWNER_EMAIL: 'Calendar Owner Email', // was: Calendar Owner
    OWNER_PERSON: 'Calendar Owner Person',
    CLIENT_NAME: 'Client Name',
    TIMEZONE: 'Timezone',
  },
  NOTES: {
    BODY: 'Body',                      // was: Content
    REL_CONTEXT: 'Relationship Context',
    MEETING: 'Meeting',
    AUTHOR: 'Author Person',           // was: Coach
    SUBJECT: 'Subject Person',         // was: Client
    NOTE_TYPE: 'Note Type',
    VISIBILITY: 'Visibility',
  },
  TASKS: {
    TITLE: 'Task Title',               // was: Title
    TYPE: 'Task Type',
    REL_CONTEXT: 'Relationship Context',
    MEETING: 'Associated Meeting',
    ASSIGNED_TO: 'Assigned To Person', // was: Assigned To
    CREATED_BY: 'Created By Person',
    VISIBILITY: 'Visibility',
    DESCRIPTION: 'Description',        // was: Notes
    STATUS: 'Status',
    DUE_DATE: 'Due Date',
  },
  COACH_SESSION: {
    COACH: 'Coach',
    CALENDAR_EVENT: 'Calendar Event',
    FOCAL_PERSON: 'Focal Person',
    SESSION_NOTES: 'Session Notes',
    ACTION_ITEMS: 'Action Items',
    LAST_UPDATED: 'Last Updated',
  },
  COACH_PERSON_CONTEXT: {
    COACH: 'Coach',
    PERSON: 'Person',
    QUICK_NOTES: 'Quick Notes',
    FAMILY_DETAILS: 'Family Details',
    RELATIONSHIP_FLAGS: 'Relationship Flags',
    LAST_UPDATED: 'Last Updated',
  },
} as const
