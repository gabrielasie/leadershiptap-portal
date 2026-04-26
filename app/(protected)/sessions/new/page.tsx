import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { getCurrentUserRecord } from '@/lib/auth/getCurrentUserRecord'
import { getClientsByRelationship } from '@/lib/services/usersService'
import NoteForm from '../NoteForm'
import type { User } from '@/lib/types'

function getDisplayName(user: User): string {
  if (user.fullName) return user.fullName
  if (user.firstName || user.lastName)
    return [user.firstName, user.lastName].filter(Boolean).join(' ')
  return user.preferredName ?? user.email
}

export default async function NewSessionNotePage() {
  const userRecord = await getCurrentUserRecord()

  const clients = userRecord.airtableId
    ? await getClientsByRelationship(userRecord.airtableId)
    : []

  const clientOptions = clients.map((u) => ({
    id: u.id,
    name: getDisplayName(u),
  }))

  return (
    <div className="px-4 py-5 md:p-8 max-w-2xl mx-auto space-y-6">

      {/* Back */}
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Dashboard
      </Link>

      <div className="bg-white rounded-xl shadow-sm p-5">
        <h1 className="text-xl font-bold text-slate-900 mb-1">Log a Note</h1>
        <p className="text-sm text-slate-400 mb-6">
          Record a coaching observation not tied to a specific session.
        </p>

        <NoteForm
          clients={clientOptions}
          redirectTo="/dashboard"
        />
      </div>

    </div>
  )
}
