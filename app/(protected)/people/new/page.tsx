import { getAllUsers, fetchProfileOptions } from '@/lib/airtable/users'
import PageHeader from '@/components/layout/PageHeader'
import NewPersonForm from './NewPersonForm'

export default async function NewPersonPage() {
  const allUsers = await getAllUsers()
  const { coaches, companies, allUsers: allUserOptions } = await fetchProfileOptions(allUsers)

  return (
    <>
      <PageHeader
        title="Add Person"
        description="Relationship context rows are created automatically based on the selections below."
      />
      <div className="max-w-2xl mx-auto py-6 px-4">
        <NewPersonForm
          coaches={coaches}
          allUsers={allUserOptions}
          companies={companies}
        />
      </div>
    </>
  )
}
