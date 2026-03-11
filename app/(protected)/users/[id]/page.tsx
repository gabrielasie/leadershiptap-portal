import { getUserById } from '@/lib/services/usersService'
import { getMeetingsForUser } from '@/lib/services/meetingsService'
import UserProfile from '@/components/UserProfile'
import MeetingsSection from '@/components/MeetingsSection'

interface Props {
  params: Promise<{ id: string }>
}

export default async function UserDetailPage({ params }: Props) {
  const { id } = await params
  const user = await getUserById(id)

  if (!user) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <p className="text-muted-foreground">User not found.</p>
      </div>
    )
  }

  const contactEmail = user.workEmail ?? user.email
  const { upcoming, past } = await getMeetingsForUser(contactEmail)

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <UserProfile user={user} />
      <MeetingsSection upcoming={upcoming} past={past} />
    </div>
  )
}
