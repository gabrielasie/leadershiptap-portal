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

  // Legacy / misc
  enneagram?: string;
  mbti?: string;
  department?: string;
  title?: string;        // maps to Airtable "Title" (distinct from "Job Title")
  startDate?: string;
  engagementLevel?: string;
  coachNotes?: string;
}

export interface Meeting {
  id: string;
  title: string;
  startTime: string; // ISO 8601
  endTime?: string;
  senderEmail?: string;
  participantEmails: string[];
  notes?: string;
}

export interface Note {
  id: string;
  content: string;
  date: string;         // YYYY-MM-DD
  userId: string;       // first linked Users record ID
}

export interface Task {
  id: string;
  name: string;
  dueDate?: string;    // YYYY-MM-DD
  priority?: 'Low' | 'Medium' | 'High';
  status?: 'To Do' | 'In Progress' | 'Done';
  userId?: string;     // first linked Users record ID
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
