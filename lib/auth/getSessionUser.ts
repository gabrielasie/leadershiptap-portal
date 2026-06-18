import { currentUser } from '@clerk/nextjs/server'

// Role that controls portal visibility — stored in Clerk publicMetadata.role
// See PERMISSIONS.md for the full model and implementation roadmap.
export type PortalRole = 'admin' | 'coach'

export interface SessionUser {
  clerkId: string
  email: string          // Clerk primary email — used to scope coach queries
  role: PortalRole
  airtableUserId?: string // optional: resolved later when needed
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const user = await currentUser()
  if (!user) return null

  const email = user.primaryEmailAddress?.emailAddress ?? ''

  // Role lives in Clerk publicMetadata, set via Clerk Dashboard.
  // Absent or unrecognised values default to 'coach' (least privilege).
  const rawRole = (user.publicMetadata as { role?: string })?.role
  const role: PortalRole = rawRole === 'admin' ? 'admin' : 'coach'

  return {
    clerkId: user.id,
    email,
    role,
    // airtableUserId not resolved here — add when needed for linked-record scoping
  }
}
