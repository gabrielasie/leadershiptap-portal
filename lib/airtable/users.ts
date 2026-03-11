import base from "./client";
import type { User } from "@/lib/types";
import type { FieldSet } from "airtable";

interface UserFields extends FieldSet {
  "Full Name"?: string;
  "Preferred Name"?: string;
  "First Name"?: string;
  "Last Name"?: string;
  Email: string;
  "Work Email"?: string;
  "Job Title"?: string;
  Role?: string;
  "Company ID"?: string;
  "Company Name"?: string;
  "Avatar URL"?: string;
  Enneagram?: string;
  MBTI?: string;
}

function mapRecord(record: { id: string; fields: UserFields }): User {
  return {
    id: record.id,
    fullName: record.fields["Full Name"],
    preferredName: record.fields["Preferred Name"],
    firstName: record.fields["First Name"],
    lastName: record.fields["Last Name"],
    email: record.fields["Email"] ?? "",
    workEmail: record.fields["Work Email"],
    jobTitle: record.fields["Job Title"],
    role: record.fields["Role"],
    companyId: record.fields["Company ID"],
    companyName: record.fields["Company Name"],
    avatarUrl: record.fields["Avatar URL"],
    enneagram: record.fields["Enneagram"],
    mbti: record.fields["MBTI"],
  };
}

export async function getAllUsers(): Promise<User[]> {
  const records = await base<UserFields>("Users").select().all();
  return records.map(mapRecord);
}

export async function getUserById(id: string): Promise<User | null> {
  try {
    const record = await base<UserFields>("Users").find(id);
    return mapRecord(record);
  } catch {
    return null;
  }
}
