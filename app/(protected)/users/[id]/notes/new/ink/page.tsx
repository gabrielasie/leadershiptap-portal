import { notFound } from 'next/navigation'
import { getUserById } from '@/lib/services/usersService'
import InkNoteComposer from './InkNoteComposer'

interface Props {
  params: Promise<{ id: string }>
}

function getDisplayName(user: {
  fullName?: string | null
  firstName?: string | null
  lastName?: string | null
  preferredName?: string | null
  email: string
}): string {
  if (user.fullName) return user.fullName
  if (user.firstName || user.lastName)
    return [user.firstName, user.lastName].filter(Boolean).join(' ')
  return user.preferredName ?? user.email
}

export default async function InkNotePage({ params }: Props) {
  const { id } = await params
  const user = await getUserById(id)
  if (!user) notFound()

  return (
    <InkNoteComposer
      subjectPersonId={id}
      subjectName={getDisplayName(user)}
    />
  )
}
