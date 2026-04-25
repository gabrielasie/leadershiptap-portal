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

    const searchEmail = email.toLowerCase().trim()

    // ── Step 1: formula lookup (fast, handles most cases) ──────────────────
    const safeEmail = searchEmail.replace(/"/g, '\\"')
    const formula = encodeURIComponent(
      `OR(LOWER({Work Email}) = "${safeEmail}", LOWER({Email}) = "${safeEmail}")`,
    )
    const formulaRes = await fetch(
      `https://api.airtable.com/v0/${baseId}/Users?filterByFormula=${formula}&maxRecords=1`,
      { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' },
    )
    const formulaData = await formulaRes.json()
    let match = (formulaData.records ?? [])[0] as
      | { id: string; fields: Record<string, unknown> }
      | undefined

    if (match) {
      console.log(`[getCurrentUserRecord] found via formula email=${searchEmail} airtableId=${match.id}`)
    } else {
      // ── Step 2: paginated scan fallback (catches records past position 100) ─
      console.warn(`[getCurrentUserRecord] formula returned nothing for ${searchEmail} — falling back to paginated scan`)
      let offset: string | undefined
      scan: do {
        const url = `https://api.airtable.com/v0/${baseId}/Users?pageSize=100${offset ? `&offset=${offset}` : ''}`
        const pageRes = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        })
        const pageData = await pageRes.json()
        for (const r of pageData.records ?? []) {
          const workEmail = ((r.fields['Work Email'] as string) ?? '').toLowerCase().trim()
          const emailField = ((r.fields['Email'] as string) ?? '').toLowerCase().trim()
          if (workEmail === searchEmail || emailField === searchEmail) {
            match = r as { id: string; fields: Record<string, unknown> }
            console.log(`[getCurrentUserRecord] found via paginated scan email=${searchEmail} airtableId=${match.id}`)
            break scan
          }
        }
        offset = pageData.offset as string | undefined
      } while (offset)

      if (!match) {
        console.log(`[getCurrentUserRecord] email=${searchEmail} airtableId=NOT FOUND`)
      }
    }

    if (!match) {
      console.warn('[getCurrentUserRecord] No Airtable record found for:', searchEmail)
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
