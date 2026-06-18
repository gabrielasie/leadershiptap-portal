import { CheckSquare } from 'lucide-react'
import { getUsers, getClientsByRelationship, getPortalCoaches } from '@/lib/services/usersService'
import { getTasks } from '@/lib/airtable/tasks'
import { getSessionUser } from '@/lib/auth/getSessionUser'
import DashboardTaskItem, { type DashboardTask } from '../DashboardTaskItem'
import AddTaskDashboardDialog from '../AddTaskDashboardDialog'
import type { CurrentUserRecord } from '@/lib/auth/getCurrentUserRecord'
import type { User } from '@/lib/types'

function getDisplayName(user: User): string {
  if (user.fullName) return user.fullName
  if (user.firstName || user.lastName)
    return [user.firstName, user.lastName].filter(Boolean).join(' ')
  return user.preferredName ?? user.email
}

interface Props {
  userRecord: CurrentUserRecord
}

export default async function OpenTasksRegion({ userRecord }: Props) {
  const isAdmin = userRecord.role === 'admin'
  const sessionUser = await getSessionUser()

  const [rawOpenTasks, users, coachUsers] = await Promise.all([
    userRecord.airtableId ? getTasks(userRecord.airtableId) : Promise.resolve([]),
    isAdmin || !userRecord.airtableId
      ? getUsers(sessionUser)
      : getClientsByRelationship(userRecord.airtableId),
    getPortalCoaches(userRecord.airtableId ?? undefined),
  ])

  const idToUser = new Map(users.map((u) => [u.id, u]))
  const openTasks: DashboardTask[] = rawOpenTasks.map((task) => {
    const assignedUser = task.assignedToPersonId ? (idToUser.get(task.assignedToPersonId) ?? null) : null
    return {
      id: task.id,
      title: task.title,
      status: task.status,
      dueDate: task.dueDate ?? null,
      notes: task.notes ?? null,
      assignedToPersonId: task.assignedToPersonId ?? null,
      assignedToName: assignedUser ? getDisplayName(assignedUser) : null,
      createdByPersonId: task.createdByPersonId ?? null,
      taskType: task.taskType ?? null,
    }
  })

  const clientsForActions = users.map((u) => ({ id: u.id, name: getDisplayName(u) }))
  const coachesForActions = coachUsers.map((u) => ({ id: u.id, name: getDisplayName(u) }))

  return (
    <div className="mb-4 md:mb-6 bg-white rounded-xl shadow-sm p-4 md:p-6">
      <div className="flex items-center gap-2 mb-4">
        <CheckSquare className="h-5 w-5 text-slate-400" />
        <h2 className="text-lg font-semibold text-slate-900">Open Tasks</h2>
        {openTasks.length > 0 && (
          <span className="ml-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-semibold">
            {openTasks.length}
          </span>
        )}
        <div className="ml-auto">
          <AddTaskDashboardDialog clients={clientsForActions} coaches={coachesForActions} />
        </div>
      </div>
      {openTasks.length === 0 ? (
        <p className="text-sm text-slate-400">No open tasks. Use the button above to add one.</p>
      ) : (
        <div className="divide-y divide-slate-100">
          {openTasks.map((task) => (
            <DashboardTaskItem key={task.id} task={task} />
          ))}
        </div>
      )}
    </div>
  )
}
