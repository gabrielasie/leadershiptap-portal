import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getCurrentUserRecord } from '@/lib/auth/getCurrentUserRecord'
import { getPermissionLevel } from '@/lib/auth/permissions'

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { clientAirtableId } = (await req.json()) as { clientAirtableId?: string }
  if (!clientAirtableId) {
    return NextResponse.json({ error: 'clientAirtableId required' }, { status: 400 })
  }

  const userRecord = await getCurrentUserRecord()
  const level = await getPermissionLevel(
    userRecord.airtableId,
    userRecord.role,
    clientAirtableId,
  )

  return NextResponse.json({ permissionLevel: level })
}
