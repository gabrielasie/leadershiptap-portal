import { getAllUsers, getUserById as fetchUserById } from "@/lib/airtable/users";
import type { User } from "@/lib/types";

export async function getUsers(): Promise<User[]> {
  return getAllUsers();
}

export async function getUserById(id: string): Promise<User | null> {
  return fetchUserById(id);
}
