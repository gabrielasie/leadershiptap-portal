import { getUsers } from '@/lib/services/usersService'
import UsersList from '@/components/UsersList'

export default async function UsersPage() {
  const users = await getUsers()

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Users</h1>
        <p className="text-muted-foreground text-sm mt-1">
          All registered users in the portal
        </p>
      </div>
      <UsersList users={users} />
    </div>
  )
}
