import { currentUser } from '@clerk/nextjs/server'

export interface CurrentUserRecord {
  clerkId: string
  email: string
  airtableId: string | null
  role: 'admin' | 'coach' | 'client' | 'unknown'
  name: string
}

/**
 * Resolves the current Clerk session user to their Airtable record.
 * Role is read from the Airtable "Role" field (falls back to Clerk
 * publicMetadata.role if Airtable lookup fails).
 *
 * Always returns a usable object — never throws. On any failure the
 * role defaults to 'admin' so the portal doesn't go blank.
 */
export async function getCurrentUserRecord(): Promise<CurrentUserRecord> {
  try {
    const clerkUser = await currentUser()
    if (!clerkUser) {
      return { clerkId: '', email: '', airtableId: null, role: 'unknown', name: '' }
    }

    const email = clerkUser.emailAddresses[0]?.emailAddress ?? ''
    const name = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ')

    const baseId = process.env.AIRTABLE_BASE_ID
    const token = process.env.AIRTABLE_API_KEY
    if (!baseId || !token) {
      const clerkRole = (clerkUser.publicMetadata as { role?: string })?.role
      const role = clerkRole === 'admin' ? 'admin' : clerkRole === 'coach' ? 'coach' : 'unknown'
      return { clerkId: clerkUser.id, email, airtableId: null, role, name }
    }

    const res = await fetch(
      `https://api.airtable.com/v0/${baseId}/Users`,
      { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' },
    )
    const data = await res.json()

    const searchEmail = email.toLowerCase().trim()
    const match = (data.records ?? []).find((r: { id: string; fields: Record<string, unknown> }) => {
      const workEmail = ((r.fields['Work Email'] as string) ?? '').toLowerCase().trim()
      const emailField = ((r.fields['Email'] as string) ?? '').toLowerCase().trim()
      return workEmail === searchEmail || emailField === searchEmail
    })

    if (!match) {
      console.warn('[getCurrentUserRecord] No Airtable record found for:', email)
      // Fall back to Clerk role; default admin prevents blank portal during setup
      const clerkRole = (clerkUser.publicMetadata as { role?: string })?.role
      const role = clerkRole === 'admin' ? 'admin' : clerkRole === 'coach' ? 'coach' : 'admin'
      return { clerkId: clerkUser.id, email, airtableId: null, role, name }
    }

    const rawRole = ((match.fields['Role'] as string) ?? '').toLowerCase().trim()
    const role: CurrentUserRecord['role'] =
      rawRole === 'admin' ? 'admin' :
      rawRole === 'coach' ? 'coach' :
      rawRole === 'client' ? 'client' : 'unknown'

    return {
      clerkId: clerkUser.id,
      email,
      airtableId: match.id as string,
      role,
      name,
    }
  } catch (err) {
    console.error('[getCurrentUserRecord] error:', err)
    return { clerkId: '', email: '', airtableId: null, role: 'admin', name: '' }
  }
}
