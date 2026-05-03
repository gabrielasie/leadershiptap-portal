import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createUserRecord } from '@/lib/airtable/users'
import { generateRelationshipRows } from '@/lib/airtable/relationships'

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

  try {
    const newPersonId = await createUserRecord({
      'First Name': firstName.trim(),
      ...(lastName?.trim() ? { 'Last Name': lastName.trim() } : {}),
      ...(jobTitle?.trim() ? { 'Job Title': jobTitle.trim() } : {}),
      ...(workEmail?.trim() ? { 'Work Email': workEmail.trim() } : {}),
      ...(companyId ? { 'Company': [companyId] } : {}),
      ...(coachIds.length > 0 ? { 'Coach': coachIds } : {}),
      'Role': 'client',
    })

    await generateRelationshipRows({
      newPersonId,
      coaches: coachIds.length > 0 ? coachIds : undefined,
      reportsTo: reportsToIds.length > 0 ? reportsToIds : undefined,
      directReports: directReportIds.length > 0 ? directReportIds : undefined,
    })

    return NextResponse.json({ id: newPersonId })
  } catch (err) {
    console.error('[POST /api/people] error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to create person' },
      { status: 500 },
    )
  }
}
