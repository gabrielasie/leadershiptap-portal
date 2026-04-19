import type { Task } from '@/lib/types';

const API_BASE = 'https://api.airtable.com/v0';

function getCredentials() {
  const apiKey = process.env.AIRTABLE_API_KEY;
  const baseId = process.env.AIRTABLE_BASE_ID;
  if (!apiKey || !baseId) throw new Error('Missing Airtable credentials');
  return { apiKey, baseId };
}

function mapRecord(record: { id: string; fields: Record<string, unknown> }): Task {
  const name = (record.fields['Task'] as string) ?? '';
  const clientIds = record.fields['Users'];
  return {
    id: record.id,
    name,
    dueDate: (record.fields['Due Date'] as string) || undefined,
    priority: record.fields['Priority'] as Task['priority'],
    status: (record.fields['Status'] as Task['status']) || 'To Do',
    userId: Array.isArray(clientIds) ? (clientIds[0] as string) : undefined,
  };
}

export async function getTasksByUser(userId: string): Promise<Task[]> {
  try {
    const { apiKey, baseId } = getCredentials();
    const seen = new Set<string>();
    const results: Task[] = [];

    // Route 1: expand "Associated Tasks" linked field on the user record.
    // This catches pre-existing Todoist-synced tasks linked to the user.
    const userRes = await fetch(
      `${API_BASE}/${baseId}/Users/${userId}?expand%5B%5D=Associated%20Tasks`,
      { headers: { Authorization: `Bearer ${apiKey}` }, cache: 'no-store' }
    );
    if (userRes.ok) {
      const userData = await userRes.json();
      const linked = userData.fields?.['Associated Tasks'];
      if (Array.isArray(linked)) {
        for (const item of linked) {
          if (item && typeof item === 'object' && 'fields' in item) {
            const task = mapRecord(item as { id: string; fields: Record<string, unknown> });
            if (!seen.has(task.id)) { seen.add(task.id); results.push(task); }
          }
        }
      }
    }

    // Route 2: fetch ALL pages of "Linked Todoist Tasks" and filter client-side.
    // filterByFormula + ARRAYJOIN is unreliable for linked-record fields that
    // store Airtable record IDs — client-side includes() is exact and guaranteed.
    // Portal-created tasks use "Client"; Todoist-synced tasks use "Users 2".
    let offset: string | undefined
    do {
      const url =
        `${API_BASE}/${baseId}/Linked%20Todoist%20Tasks` +
        (offset ? `?offset=${encodeURIComponent(offset)}` : '')
      const tableRes = await fetch(url, {
        headers: { Authorization: `Bearer ${apiKey}` },
        cache: 'no-store',
      })
      if (!tableRes.ok) {
        const errText = await tableRes.text()
        console.warn('[getTasksByUser] Linked Todoist Tasks query failed:', errText)
        break
      }
      const tableData = await tableRes.json()
      offset = tableData.offset  // undefined when last page
      console.log('[getTasksByUser] userId:', userId, '| page records:', tableData.records?.length, '| hasMore:', !!offset)
      for (const rec of (tableData.records ?? [])) {
        const users = rec.fields['Users']
        if (!Array.isArray(users) || !users.includes(userId)) continue
        const task = mapRecord(rec)
        if (!seen.has(task.id)) { seen.add(task.id); results.push(task) }
      }
    } while (offset)
    console.log('[getTasksByUser] matched tasks after all pages:', results.length)

    // Sort by due date asc, nulls last
    results.sort((a, b) => {
      if (!a.dueDate && !b.dueDate) return 0;
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return a.dueDate.localeCompare(b.dueDate);
    });
    return results;
  } catch (err) {
    console.warn('[getTasksByUser] unexpected error:', err);
    return [];
  }
}

export async function getAllOpenTasks(): Promise<Task[]> {
  try {
    const { apiKey, baseId } = getCredentials();
    const res = await fetch(
      `${API_BASE}/${baseId}/Linked%20Todoist%20Tasks`,
      { headers: { Authorization: `Bearer ${apiKey}` }, cache: 'no-store' },
    );
    if (!res.ok) return [];
    const data = await res.json();

    const tasks: Task[] = (data.records ?? [])
      .map(mapRecord)
      .filter((t: Task) => {
        const s = (t.status ?? '').toLowerCase();
        return s !== 'done' && s !== 'completed';
      });

    // Sort by due date asc, nulls last (overdue dates surface first)
    tasks.sort((a, b) => {
      if (!a.dueDate && !b.dueDate) return 0;
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return a.dueDate.localeCompare(b.dueDate);
    });

    return tasks;
  } catch (err) {
    console.warn('[getAllOpenTasks] error:', err);
    return [];
  }
}

export async function createTask(fields: {
  Title: string;
  'Due Date'?: string;
  Priority?: 'Low' | 'Medium' | 'High';
  Status?: string;
  Users?: string[];     // linked record IDs → Users table
}): Promise<void> {
  let apiKey: string, baseId: string;
  try {
    ({ apiKey, baseId } = getCredentials());
  } catch (e) {
    console.error('[createTask] Missing Airtable credentials:', e);
    return;
  }
  try {
    const airtableFields: Record<string, unknown> = { Task: fields.Title }
    if (fields.Users?.length) airtableFields['Users'] = fields.Users
    console.log('[createTask] userId received:', fields.Users?.[0])
    console.log('[createTask] POST body:', JSON.stringify({ fields: airtableFields }, null, 2))
    const res = await fetch(`${API_BASE}/${baseId}/Linked%20Todoist%20Tasks`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fields: airtableFields }),
    })
    const data = await res.json()
    console.log('[createTask] Airtable status:', res.status)
    console.log('[createTask] Airtable response:', JSON.stringify(data, null, 2))
    if (!res.ok) {
      console.error('[createTask] Airtable POST failed — check field names above')
    }
  } catch (e) {
    console.error('[createTask] Unexpected error:', e)
  }
}
