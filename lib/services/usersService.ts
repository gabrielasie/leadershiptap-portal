import { getAllUsers, getUserById as fetchUserById } from "@/lib/airtable/users";
import type { SessionUser } from "@/lib/auth/getSessionUser";
import type { User } from "@/lib/types";

export async function getUsers(sessionUser?: SessionUser | null): Promise<User[]> {
  return getAllUsers(sessionUser ?? undefined);
}

export async function getUserById(id: string): Promise<User | null> {
  return fetchUserById(id);
}
