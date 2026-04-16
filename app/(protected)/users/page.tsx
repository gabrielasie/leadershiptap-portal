import { getUsers } from '@/lib/services/usersService'
import { getSessionUser } from '@/lib/auth/getSessionUser'
import { getCurrentUserRecord } from '@/lib/auth/getCurrentUserRecord'
import PageHeader from '@/components/layout/PageHeader'
import ClientsGrid from './ClientsGrid'

export default async function UsersPage() {
  const [sessionUser, userRecord] = await Promise.all([
    getSessionUser(),
    getCurrentUserRecord(),
  ])
  const users = await getUsers(sessionUser)

  console.log('[ClientsPage] role:', userRecord.role, '— airtableId:', userRecord.airtableId, '— showing:', users.length, 'clients')

  return (
    <>
      <PageHeader
        title="Clients"
        description={
          process.env.NODE_ENV === 'development'
            ? `${userRecord.role} view · ${users.length} client${users.length !== 1 ? 's' : ''}`
            : 'All active coaching clients'
        }
      />
      <ClientsGrid users={users} />
    </>
  )
}
