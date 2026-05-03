import type { Task, TaskStatus } from '@/lib/types'
import { TABLES, FIELDS } from '@/lib/airtable/constants'
import { getRelationshipContext } from '@/lib/airtable/relationships'

const API_BASE = 'https://api.airtable.com/v0'
const TABLE = encodeURIComponent(TABLES.TASKS)

function getCredentials() {
  const apiKey = process.env.AIRTABLE_API_KEY
  const baseId = process.env.AIRTABLE_BASE_ID
  if (!apiKey || !baseId) throw new Error('Missing Airtable credentials')
  return { apiKey, baseId }
}

type AirtableRecord = { id: string; fields: Record<string, unknown> }

const OPEN_STATUSES: TaskStatus[] = ['Not Started', 'In Progress']

function mapTaskRecord(r: AirtableRecord): Task {
  const assignedIds = r.fields[FIELDS.TASKS.ASSIGNED_TO]
  const createdIds = r.fields[FIELDS.TASKS.CREATED_BY]
  const ctxIds = r.fields[FIELDS.TASKS.REL_CONTEXT]
  const meetingIds = r.fields[FIELDS.TASKS.MEETING]
  return {
    id: r.id,
    name: (r.fields[FIELDS.TASKS.TITLE] as string) || 'Untitled',
    status: ((r.fields[FIELDS.TASKS.STATUS] as string) || 'Not Started') as TaskStatus,
    dueDate: (r.fields[FIELDS.TASKS.DUE_DATE] as string) || undefined,
    description: (r.fields[FIELDS.TASKS.DESCRIPTION] as string) || undefined,
    taskType: (r.fields[FIELDS.TASKS.TYPE] as Task['taskType']) || undefined,
    visibility: (r.fields[FIELDS.TASKS.VISIBILITY] as Task['visibility']) || undefined,
    assignedToPersonId: Array.isArray(assignedIds) ? (assignedIds[0] as string) : undefined,
    createdByPersonId: Array.isArray(createdIds) ? (createdIds[0] as string) : undefined,
    relationshipContextId: Array.isArray(ctxIds) ? (ctxIds[0] as string) : undefined,
    meetingId: Array.isArray(meetingIds) ? (meetingIds[0] as string) : undefined,
  }
}

function sortByDueDate(tasks: Task[]): Task[] {
  return tasks.sort((a, b) => {
    if (!a.dueDate && !b.dueDate) return 0
    if (!a.dueDate) return 1
    if (!b.dueDate) return -1
    return a.dueDate.localeCompare(b.dueDate)
  })
}

/**
 * Fetch open tasks authored by or assigned to a person.
 * JS-filtered because Assigned To Person and Created By Person are linked fields.
 */
export async function getTasks(personAirtableId: string): Promise<Task[]> {
  try {
    const { apiKey, baseId } = getCredentials()
    const res = await fetch(
      `${API_BASE}/${baseId}/${TABLE}?maxRecords=500`,
      { headers: { Authorization: `Bearer ${apiKey}` }, cache: 'no-store' },
    )
    if (!res.ok) {
      console.warn('[getTasks] query failed:', await res.text())
      return []
    }
    const data = await res.json()
    const tasks = (data.records ?? [])
      .filter((r: AirtableRecord) => {
        const assigned = r.fields[FIELDS.TASKS.ASSIGNED_TO]
        const created = r.fields[FIELDS.TASKS.CREATED_BY]
        const isInvolved =
          (Array.isArray(assigned) && (assigned as string[]).includes(personAirtableId)) ||
          (Array.isArray(created) && (created as string[]).includes(personAirtableId))
        const status = r.fields[FIELDS.TASKS.STATUS] as string
        const isOpen = OPEN_STATUSES.includes(status as TaskStatus)
        return isInvolved && isOpen
      })
      .map(mapTaskRecord)
    return sortByDueDate(tasks)
  } catch (err) {
    console.warn('[getTasks] unexpected error:', err)
    return []
  }
}

/**
 * Fetch tasks assigned to a specific person — for the user profile page.
 * Returns open tasks only.
 */
export async function getTasksByUser(userId: string): Promise<Task[]> {
  try {
    const { apiKey, baseId } = getCredentials()
    const res = await fetch(
      `${API_BASE}/${baseId}/${TABLE}?maxRecords=500`,
      { headers: { Authorization: `Bearer ${apiKey}` }, cache: 'no-store' },
    )
    if (!res.ok) {
      console.warn('[getTasksByUser] query failed:', await res.text())
      return []
    }
    const data = await res.json()
    const tasks = (data.records ?? [])
      .filter((r: AirtableRecord) => {
        const assigned = r.fields[FIELDS.TASKS.ASSIGNED_TO]
        return Array.isArray(assigned) && (assigned as string[]).includes(userId)
      })
      .map(mapTaskRecord)
    return sortByDueDate(tasks)
  } catch (err) {
    console.warn('[getTasksByUser] unexpected error:', err)
    return []
  }
}

/**
 * Fetch all non-completed/non-cancelled tasks — for admin dashboard and user list.
 */
export async function getAllOpenTasks(): Promise<Task[]> {
  try {
    const { apiKey, baseId } = getCredentials()
    const res = await fetch(
      `${API_BASE}/${baseId}/${TABLE}?maxRecords=500`,
      { headers: { Authorization: `Bearer ${apiKey}` }, cache: 'no-store' },
    )
    if (!res.ok) return []
    const data = await res.json()
    return (data.records ?? [])
      .map(mapTaskRecord)
      .filter((t: Task) => OPEN_STATUSES.includes(t.status))
  } catch (err) {
    console.warn('[getAllOpenTasks] error:', err)
    return []
  }
}

export interface CreateTaskData {
  title: string
  description?: string
  dueDate?: string
  createdByPersonId: string
  assignedToPersonId: string
  relationshipContextId?: string  // auto-resolved if omitted
  meetingId?: string
}

/**
 * Create a task. Auto-determines Task Type and Visibility from the assignee:
 * - self-assign → personal_reminder + private_to_author
 * - other person → assignment + shared_with_target
 * Resolves Relationship Context automatically if not provided.
 */
export async function createTask(data: CreateTaskData): Promise<string> {
  const { apiKey, baseId } = getCredentials()

  const isSelf = data.assignedToPersonId === data.createdByPersonId
  const taskType: Task['taskType'] = isSelf ? 'personal_reminder' : 'assignment'
  const visibility: Task['visibility'] = isSelf ? 'private_to_author' : 'shared_with_target'

  // Resolve relationship context
  let relationshipContextId = data.relationshipContextId
  if (!relationshipContextId && !isSelf) {
    // Try coaching relationship (lead=creator, person=assignee)
    const ctx = await getRelationshipContext(data.createdByPersonId, data.assignedToPersonId)
      ?? await getRelationshipContext(data.assignedToPersonId, data.createdByPersonId)
    if (ctx) {
      relationshipContextId = ctx.id
    } else {
      console.warn(
        '[createTask] No relationship context found for pair — task created without context',
        { createdBy: data.createdByPersonId, assignedTo: data.assignedToPersonId },
      )
    }
  }

  const fields: Record<string, unknown> = {
    [FIELDS.TASKS.TITLE]: data.title,
    [FIELDS.TASKS.STATUS]: 'Not Started',
    [FIELDS.TASKS.TYPE]: taskType,
    [FIELDS.TASKS.VISIBILITY]: visibility,
    [FIELDS.TASKS.ASSIGNED_TO]: [data.assignedToPersonId],
    [FIELDS.TASKS.CREATED_BY]: [data.createdByPersonId],
  }
  if (data.description) fields[FIELDS.TASKS.DESCRIPTION] = data.description
  if (data.dueDate) fields[FIELDS.TASKS.DUE_DATE] = data.dueDate
  if (relationshipContextId) fields[FIELDS.TASKS.REL_CONTEXT] = [relationshipContextId]
  if (data.meetingId) fields[FIELDS.TASKS.MEETING] = [data.meetingId]

  const res = await fetch(`${API_BASE}/${baseId}/${TABLE}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields }),
  })
  const result = await res.json()
  if (!res.ok) {
    throw new Error(`Tasks POST failed (${res.status}): ${JSON.stringify(result)}`)
  }
  return result.id as string
}

export interface UpdateTaskData {
  title?: string
  status?: TaskStatus
  dueDate?: string | null
  description?: string
}

export async function updateTask(
  taskId: string,
  data: UpdateTaskData,
): Promise<{ success: true } | { error: string }> {
  try {
    const { apiKey, baseId } = getCredentials()
    const writeFields: Record<string, unknown> = {}
    if (data.title !== undefined) writeFields[FIELDS.TASKS.TITLE] = data.title
    if (data.status !== undefined) writeFields[FIELDS.TASKS.STATUS] = data.status
    if (data.dueDate !== undefined) writeFields[FIELDS.TASKS.DUE_DATE] = data.dueDate
    if (data.description !== undefined) writeFields[FIELDS.TASKS.DESCRIPTION] = data.description
    if (Object.keys(writeFields).length === 0) return { success: true }

    const res = await fetch(`${API_BASE}/${baseId}/${TABLE}/${taskId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: writeFields }),
    })
    if (!res.ok) return { error: JSON.stringify(await res.json()) }
    return { success: true }
  } catch (err) {
    return { error: String(err) }
  }
}

export async function updateTaskStatus(
  taskId: string,
  status: TaskStatus,
): Promise<{ success: true } | { error: string }> {
  return updateTask(taskId, { status })
}

export async function deleteTask(
  taskId: string,
): Promise<{ success: true } | { error: string }> {
  try {
    const { apiKey, baseId } = getCredentials()
    const res = await fetch(`${API_BASE}/${baseId}/${TABLE}/${taskId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${apiKey}` },
    })
    if (!res.ok) {
      return { error: JSON.stringify(await res.json()) }
    }
    return { success: true }
  } catch (err) {
    return { error: String(err) }
  }
}
