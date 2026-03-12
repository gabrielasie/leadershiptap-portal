import { getUsers } from '@/lib/services/usersService'
import UsersList from '@/components/UsersList'

export default async function UsersPage() {
  const users = await getUsers()

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Users</h1>
        <p className="text-gray-500 text-sm mt-1">Your coaching clients</p>
      </div>
      <UsersList users={users} />
    </div>
  )
}
