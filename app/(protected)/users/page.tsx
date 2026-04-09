import { getUsers } from '@/lib/services/usersService'
import { getSessionUser } from '@/lib/auth/getSessionUser'
import PageHeader from '@/components/layout/PageHeader'
import ClientsGrid from './ClientsGrid'

export default async function UsersPage() {
  const sessionUser = await getSessionUser()
  const users = await getUsers(sessionUser)

  return (
    <>
      <PageHeader
        title="Clients"
        description="All active coaching clients"
      />
      <ClientsGrid users={users} />
    </>
  )
}
