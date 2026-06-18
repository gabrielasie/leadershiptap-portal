import BackLink from '@/components/BackLink'
import { getCurrentUserRecord } from '@/lib/auth/getCurrentUserRecord'
import { getRelationshipContexts } from '@/lib/airtable/relationships'
import NoteForm from '../NoteForm'

export default async function NewSessionNotePage() {
  const userRecord = await getCurrentUserRecord()

  const contexts = userRecord.airtableId
    ? await getRelationshipContexts(userRecord.airtableId)
    : []

  const clientOptions = contexts.map((ctx) => ({
    id: ctx.personId,
    name: ctx.personName,
  }))

  return (
    <div className="px-4 py-5 md:p-8 max-w-2xl mx-auto space-y-6">

      {/* Back — goes to wherever the user came from. */}
      <BackLink fallbackHref="/dashboard" label="Back" />

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
