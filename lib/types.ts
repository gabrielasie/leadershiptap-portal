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
  enneagram?: string;
  mbti?: string;
}

export interface Meeting {
  id: string;
  title: string;
  startTime: string; // ISO 8601
  endTime?: string;
  participantEmails: string[];
  coachEmail?: string;
  notes?: string;
  recordingUrl?: string;
  syncedSummary?: string;
}
