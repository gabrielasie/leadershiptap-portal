import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createUserRecord } from '@/lib/airtable/users'
import { generateRelationshipRows } from '@/lib/airtable/relationships'
import { TABLES } from '@/lib/airtable/constants'

const API_BASE = 'https://api.airtable.com/v0'

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const {
    firstName,
    lastName,
    jobTitle,
    workEmail,
    companyId,
    coachIds = [],
    reportsToIds = [],
    directReportIds = [],
  } = body

  if (!firstName?.trim()) {
    return NextResponse.json({ error: 'First name is required' }, { status: 400 })
  }
  if (!lastName?.trim()) {
    return NextResponse.json({ error: 'Last name is required' }, { status: 400 })
  }

  try {
    // 1. Create Users record
    const newPersonId = await createUserRecord({
      'First Name': firstName.trim(),
      'Last Name': lastName.trim(),
      ...(jobTitle?.trim() ? { 'Job Title': jobTitle.trim() } : {}),
      ...(workEmail?.trim() ? { 'Work Email': workEmail.trim() } : {}),
      ...(companyId ? { 'Company': [companyId] } : {}),
      ...(coachIds.length > 0 ? { 'Coach': coachIds } : {}),
      'Role': 'client',
    })

    // 2. Create Organization Membership if company selected
    if (companyId) {
      try {
        const apiKey = process.env.AIRTABLE_API_KEY
        const baseId = process.env.AIRTABLE_BASE_ID
        if (apiKey && baseId) {
          await fetch(
            `${API_BASE}/${baseId}/${encodeURIComponent(TABLES.ORG_MEMBERSHIPS)}`,
            {
              method: 'POST',
              headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({
                fields: {
                  'Person': [newPersonId],
                  'Organization': [companyId],
                  'Status': 'Active',
                },
              }),
            },
          )
        }
      } catch (err) {
        // Non-critical — log and continue
        console.warn('[POST /api/people] Org membership creation failed:', err)
      }
    }

    // 3. Generate Relationship Context rows
    const rcCount =
      (coachIds.length > 0 ? coachIds.length : 0) +
      (reportsToIds.length > 0 ? reportsToIds.length : 0) +
      (directReportIds.length > 0 ? directReportIds.length : 0)

    if (rcCount > 0) {
      await generateRelationshipRows({
        newPersonId,
        coaches: coachIds.length > 0 ? coachIds : undefined,
        reportsTo: reportsToIds.length > 0 ? reportsToIds : undefined,
        directReports: directReportIds.length > 0 ? directReportIds : undefined,
      })
    }

    return NextResponse.json({
      id: newPersonId,
      relationshipContextsCreated: rcCount,
    })
  } catch (err) {
    console.error('[POST /api/people] error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to create person' },
      { status: 500 },
    )
  }
}
