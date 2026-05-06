import type { Task, TaskStatus } from '@/lib/types'
import { TABLES, FIELDS } from '@/lib/airtable/constants'

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

function firstLinkedId(val: unknown): string | undefined {
  return Array.isArray(val) && val.length > 0 ? (val[0] as string) : undefined
}

function mapTaskRecord(r: AirtableRecord): Task {
  const rawStatus = ((r.fields[FIELDS.TASKS.STATUS] as string) ?? '').trim().toLowerCase()
  const status: TaskStatus =
    rawStatus === 'complete' || rawStatus === 'completed' ? 'Complete' :
    rawStatus === 'in progress' ? 'In Progress' :
    rawStatus === 'cancelled' ? 'Cancelled' :
    'Not Started'

  const createdById = firstLinkedId(r.fields[FIELDS.TASKS.CREATED_BY_PERSON])
  const assignedToId = firstLinkedId(r.fields[FIELDS.TASKS.ASSIGNED_TO_PERSON])
  const isSelf = !assignedToId || assignedToId === createdById
  const rawTaskType = (r.fields[FIELDS.TASKS.TASK_TYPE] as string | undefined)?.toLowerCase().trim()
  const taskType: Task['taskType'] =
    rawTaskType === 'assignment' ? 'assignment' :
    rawTaskType === 'personal_reminder' ? 'personal_reminder' :
    isSelf ? 'personal_reminder' : 'assignment'

  const rawVisibility = (r.fields[FIELDS.TASKS.VISIBILITY] as string | undefined)?.toLowerCase().trim()
  const visibility: Task['visibility'] =
    rawVisibility === 'shared_with_target' ? 'shared_with_target' :
    rawVisibility === 'private_to_author' ? 'private_to_author' :
    taskType === 'assignment' ? 'shared_with_target' : 'private_to_author'

  return {
    id: r.id,
    title: (r.fields[FIELDS.TASKS.TITLE] as string) || 'Untitled',
    status,
    dueDate: (r.fields[FIELDS.TASKS.DUE_DATE] as string) || undefined,
    clientId: firstLinkedId(r.fields[FIELDS.TASKS.CLIENT]),
    notes: (r.fields[FIELDS.TASKS.NOTES] as string) || undefined,
    relationshipContextId: firstLinkedId(r.fields[FIELDS.TASKS.RELATIONSHIP_CONTEXT]),
    createdByPersonId: createdById,
    assignedToPersonId: assignedToId,
    taskType,
    visibility,
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

// ── Read functions ────────────────────────────────────────────────────────────

/**
 * Fetch open tasks for a person — returns tasks where:
 * Client OR Created By Person OR Assigned To Person contains personAirtableId
 * AND Status is open.
 * JS-filtered because linked fields can't be filtered by ID in Airtable formulas.
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
      .map(mapTaskRecord)
      .filter((t: Task) => {
        const isInvolved =
          t.clientId === personAirtableId ||
          t.createdByPersonId === personAirtableId ||
          t.assignedToPersonId === personAirtableId
        return isInvolved && OPEN_STATUSES.includes(t.status)
      })
    return sortByDueDate(tasks)
  } catch (err) {
    console.warn('[getTasks] unexpected error:', err)
    return []
  }
}

/**
 * Fetch tasks for a specific person (client profile page).
 * Returns all tasks (any status) where Client = userId.
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
      .map(mapTaskRecord)
      .filter((t: Task) => t.clientId === userId || t.assignedToPersonId === userId)
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

// ── Write functions ───────────────────────────────────────────────────────────

export interface CreateTaskData {
  title: string
  notes?: string
  dueDate?: string
  clientId?: string
  createdByPersonId: string
  assignedToPersonId?: string
  relationshipContextId?: string
}

/**
 * Create a task. Auto-determines Task Type and Visibility based on assignment.
 * Auto-resolves Relationship Context if clientId + createdByPersonId are provided.
 */
export async function createTask(data: CreateTaskData): Promise<string> {
  const { apiKey, baseId } = getCredentials()

  const isSelf = !data.assignedToPersonId || data.assignedToPersonId === data.createdByPersonId
  const taskType = isSelf ? 'personal_reminder' : 'assignment'
  const visibility = isSelf ? 'private_to_author' : 'shared_with_target'

  // Auto-resolve Relationship Context if not provided
  let rcId = data.relationshipContextId
  if (!rcId && data.clientId && data.createdByPersonId) {
    try {
      const { getRelationshipContext } = await import('@/lib/airtable/relationships')
      const ctx = await getRelationshipContext(data.createdByPersonId, data.clientId)
      rcId = ctx?.id
    } catch {
      // Non-critical — proceed without RC
    }
  }

  const fields: Record<string, unknown> = {
    [FIELDS.TASKS.TITLE]: data.title,
    [FIELDS.TASKS.STATUS]: 'Not Started',
    [FIELDS.TASKS.TASK_TYPE]: taskType,
    [FIELDS.TASKS.VISIBILITY]: visibility,
    [FIELDS.TASKS.CREATED_BY_PERSON]: [data.createdByPersonId],
  }
  if (data.notes) fields[FIELDS.TASKS.NOTES] = data.notes
  if (data.dueDate) fields[FIELDS.TASKS.DUE_DATE] = data.dueDate
  if (data.clientId) fields[FIELDS.TASKS.CLIENT] = [data.clientId]
  if (data.assignedToPersonId) fields[FIELDS.TASKS.ASSIGNED_TO_PERSON] = [data.assignedToPersonId]
  if (rcId) fields[FIELDS.TASKS.RELATIONSHIP_CONTEXT] = [rcId]

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
  notes?: string
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
    if (data.notes !== undefined) writeFields[FIELDS.TASKS.NOTES] = data.notes
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
