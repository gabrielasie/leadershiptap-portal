import BackLink from '@/components/BackLink'
import { getUserById } from '@/lib/services/usersService'
import { getUserMessages } from '@/lib/services/messagesService'
import PageHeader from '@/components/layout/PageHeader'
import NewMessageForm from './NewMessageForm'

interface Props {
  params: Promise<{ id: string }>
}

export default async function NewMessagePage({ params }: Props) {
  const { id } = await params
  const user = await getUserById(id)

  const clientName = user?.fullName
    ?? (user ? [user.firstName, user.lastName].filter(Boolean).join(' ') : null)
    ?? user?.email
    ?? 'Client'

  // Pre-fill from the most recent Pending draft if one exists
  const messages = await getUserMessages(id)
  const latestDraft = messages.find((m) => m.status === 'Pending')
  const defaultSubject = latestDraft?.subject ?? `Follow-up: ${clientName}`
  const defaultBody = latestDraft?.body ?? ''

  return (
    <>
      <PageHeader
        title="New Follow-up Draft"
        description={`Drafting a message for ${clientName}`}
      />

      <div className="p-8 max-w-2xl mx-auto">
        <div className="mb-6">
          <BackLink fallbackHref={`/users/${id}`} label={`Back to ${clientName}`} />
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6">
          {latestDraft && (
            <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-5">
              Pre-filled from your most recent pending draft. Saving will create a new record.
            </p>
          )}
          <NewMessageForm
            userId={id}
            defaultSubject={defaultSubject}
            defaultBody={defaultBody}
          />
        </div>
      </div>
    </>
  )
}
