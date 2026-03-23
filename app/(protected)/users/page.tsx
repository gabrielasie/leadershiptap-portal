import { getUsers } from '@/lib/services/usersService'
import PageHeader from '@/components/layout/PageHeader'
import ClientsGrid from './ClientsGrid'

export default async function UsersPage() {
  const users = await getUsers()

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
