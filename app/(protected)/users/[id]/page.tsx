import { getUserById } from '@/lib/services/usersService'
import { getMeetingsForUser } from '@/lib/services/meetingsService'
import { getUserMessages } from '@/lib/services/messagesService'
import UserProfile from '@/components/UserProfile'
import MeetingsSection from '@/components/MeetingsSection'
import MessageHistory from '@/components/MessageHistory'

interface Props {
  params: Promise<{ id: string }>
}

export default async function UserDetailPage({ params }: Props) {
  const { id } = await params
  const user = await getUserById(id)

  if (!user) {
    return (
      <div className="p-8 max-w-5xl mx-auto">
        <p className="text-gray-500">User not found.</p>
      </div>
    )
  }

  const contactEmail = user.workEmail ?? user.email
  const [{ upcoming, past }, messages] = await Promise.all([
    getMeetingsForUser(contactEmail),
    getUserMessages(id),
  ])

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      <UserProfile user={user} />
      <MeetingsSection upcoming={upcoming} past={past} userId={id} />
      <MessageHistory messages={messages} userId={id} />
    </div>
  )
}
