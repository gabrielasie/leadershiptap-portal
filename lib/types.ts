export interface Company {
  id: string;
  name: string;
  domain?: string;
}

export interface User {
  id: string;
  fullName?: string;
  preferredName?: string;
  firstName?: string;
  lastName?: string;
  email: string;
  workEmail?: string;
  jobTitle?: string;
  role?: string;
  companyId?: string;
  companyName?: string;
  avatarUrl?: string;
  profilePhoto?: string;    // Airtable "Profile Photo" attachment (first URL)
  timeAtCompany?: string;   // text field
  coachIds?: string[];      // linked record IDs → Coach(es)
  teamLeadIds?: string[];   // linked record IDs → Team Lead(s)

  // Coaching context
  quickNotes?: string;
  familyDetails?: string;

  // Personality & Strengths (lookup fields — read only)
  enneagramType?: string;            // "Enneagram Type (from Enneagram)"
  enneagramDescriptor?: string;      // "Descriptor (from Enneagram)"
  mbtiType?: string;                 // "MBTI (from MBTI)" or similar lookup
  mbtiDescriptor?: string;           // "Descriptor (from MBTI)"
  conflictPosture?: string;
  conflictPostureDescriptor?: string;
  apologyLanguage?: string;
  apologyLanguageDescriptor?: string;
  strengths?: Array<{ name: string; domain?: string }>;

  // Org / Team
  managerIds?: string[];       // linked record IDs — first element is the manager
  directReportIds?: string[];  // linked record IDs — all direct reports
  teamMemberIds?: string[];    // linked record IDs — team members

  // Session count via linked record field (avoids email matching)
  associatedMeetingIds?: string[]   // "Associated Meetings" linked field → Portal Calendar Events

  // Raw linked record IDs — used by edit forms to pre-select current values
  enneagramIds?: string[]
  mbtiIds?: string[]
  conflictPostureIds?: string[]
  apologyLanguageIds?: string[]
  strengthIds?: string[]
  companyLinkedIds?: string[]   // from the "Company" linked field

  // Extra contact fields
  personalEmail?: string        // "Personal Email"
  birthday?: string             // "Birthday"
  workDeskNumber?: string       // "Work Desk Number"
  workCellNumber?: string       // "Work Cell Number"
  personalCellNumber?: string   // "Personal Cell Number"

  // Legacy / misc
  enneagram?: string;
  mbti?: string;
  department?: string;
  title?: string;        // maps to Airtable "Title" (distinct from "Job Title")
  startDate?: string;
  hireDate?: string;
  engagementLevel?: string;
  coachNotes?: string;
}

export interface Meeting {
  id: string;
  providerEventId?: string; // "Provider Event ID" — stable external calendar ID
  title: string;
  startTime: string; // ISO 8601
  endTime?: string;
  timezone?: string; // IANA timezone from the calendar event (e.g. "America/New_York")
  senderEmail?: string;
  participantEmails: string[];
  notes?: string;
  sessionStatus?: string | null;
  actionItems?: string | null;
  // Set during calendar sync when a participant matches a known Relationship Context
  clientName?: string;
  relationshipContextId?: string;
}

export interface Note {
  id: string;
  body: string;
  createdAt: string;
  subjectPersonId: string;
  authorPersonId?: string;
  relationshipContextId?: string;
  meetingId?: string;
  noteType?: string;
  visibility?: string;
}

export type TaskStatus = 'Not Started' | 'In Progress' | 'Complete' | 'Cancelled'

export interface Task {
  id: string;
  name: string;
  status: TaskStatus;
  dueDate?: string;
  description?: string;
  taskType?: 'personal_reminder' | 'assignment';
  visibility?: 'private_to_author' | 'shared_with_target';
  assignedToPersonId?: string;   // first linked Assigned To Person
  createdByPersonId?: string;    // first linked Created By Person
  relationshipContextId?: string;
  meetingId?: string;
}

export interface Message {
  id: string;
  messageName: string;
  subject?: string;
  body?: string;
  status: 'Pending' | 'Sent';
  created?: string;
  sentAt?: string;
  meetingId?: string; // first linked Calendar Events record ID
  userIds?: string[];  // linked Users record IDs
}
