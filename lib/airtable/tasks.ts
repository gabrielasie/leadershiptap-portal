import type { Task } from '@/lib/types';

const API_BASE = 'https://api.airtable.com/v0';

function getCredentials() {
  const apiKey = process.env.AIRTABLE_API_KEY;
  const baseId = process.env.AIRTABLE_BASE_ID;
  if (!apiKey || !baseId) throw new Error('Missing Airtable credentials');
  return { apiKey, baseId };
}

function mapTaskRecord(record: { id: string; fields: Record<string, unknown> }): Task {
  return {
    id: record.id,
    name: (record.fields['Title'] as string) || 'Untitled',
    status: (record.fields['Status'] as Task['status']) || 'pending',
    dueDate: (record.fields['Due Date'] as string) || undefined,
    notes: (record.fields['Notes'] as string) || undefined,
    coachName: (record.fields['Coach Name'] as string) || undefined,
    userId: Array.isArray(record.fields['Client'])
      ? (record.fields['Client'] as string[])[0]
      : undefined,
  };
}

// ── Portal tasks (Tasks table) ────────────────────────────────────────────────

export async function getTasksByUser(userId: string): Promise<Task[]> {
  try {
    const { apiKey, baseId } = getCredentials();
    const res = await fetch(`${API_BASE}/${baseId}/Tasks`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: 'no-store',
    });
    if (!res.ok) {
      const text = await res.text();
      console.warn('[getTasksByUser] Tasks query failed:', text);
      return [];
    }
    const data = await res.json();
    console.log('[getTasksByUser] total records fetched:', data.records?.length);

    const tasks: Task[] = [];
    for (const rec of (data.records ?? [])) {
      const client = rec.fields['Client'];
      if (!Array.isArray(client) || !client.includes(userId)) continue;
      tasks.push(mapTaskRecord(rec));
    }

    console.log('[getTasksByUser] matched tasks for userId', userId, ':', tasks.length);

    // Sort by due date asc, nulls last
    tasks.sort((a, b) => {
      if (!a.dueDate && !b.dueDate) return 0;
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return a.dueDate.localeCompare(b.dueDate);
    });

    return tasks;
  } catch (err) {
    console.warn('[getTasksByUser] unexpected error:', err);
    return [];
  }
}

export async function createTask(
  userId: string,
  title: string,
  dueDate?: string,
  notes?: string,
): Promise<string> {
  const { apiKey, baseId } = getCredentials();

  const fields: Record<string, unknown> = {
    Title: title,
    Client: [userId],
    Status: 'pending',
  };
  if (dueDate) fields['Due Date'] = dueDate;
  if (notes) fields['Notes'] = notes;

  console.log('[createTask] POST body:', JSON.stringify({ fields }, null, 2));

  const res = await fetch(`${API_BASE}/${baseId}/Tasks`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fields }),
  });
  const data = await res.json();
  console.log('[createTask] Airtable status:', res.status);
  console.log('[createTask] Airtable response:', JSON.stringify(data, null, 2));
  if (!res.ok) {
    throw new Error(`Airtable POST failed (${res.status}): ${JSON.stringify(data)}`);
  }
  return data.id as string;
}

export async function updateTaskStatus(
  taskId: string,
  status: 'pending' | 'in progress' | 'completed',
): Promise<{ success: true } | { error: string }> {
  try {
    const { apiKey, baseId } = getCredentials();
    const res = await fetch(`${API_BASE}/${baseId}/Tasks/${taskId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fields: { Status: status } }),
    });
    const data = await res.json();
    console.log('[updateTaskStatus] status:', res.status, '| response:', JSON.stringify(data));
    if (!res.ok) {
      return { error: JSON.stringify(data) };
    }
    return { success: true };
  } catch (err) {
    console.error('[updateTaskStatus] error:', err);
    return { error: String(err) };
  }
}

export async function updateTask(
  taskId: string,
  fields: {
    Title?: string
    Status?: 'pending' | 'in progress' | 'completed'
    'Due Date'?: string | null
    Notes?: string
  },
): Promise<{ success: true } | { error: string }> {
  try {
    const { apiKey, baseId } = getCredentials()
    // Strip undefined; keep null (used to clear date fields)
    const clean = Object.fromEntries(
      Object.entries(fields).filter(([, v]) => v !== undefined && v !== '')
    )
    const res = await fetch(`${API_BASE}/${baseId}/Tasks/${taskId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fields: clean }),
    })
    const data = await res.json()
    console.log('[updateTask] status:', res.status, '| response:', JSON.stringify(data))
    if (!res.ok) return { error: JSON.stringify(data) }
    return { success: true }
  } catch (err) {
    console.error('[updateTask] error:', err)
    return { error: String(err) }
  }
}

export async function deleteTask(
  taskId: string,
): Promise<{ success: true } | { error: string }> {
  try {
    const { apiKey, baseId } = getCredentials();
    const res = await fetch(`${API_BASE}/${baseId}/Tasks/${taskId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) {
      const data = await res.json();
      console.error('[deleteTask] Airtable error:', data);
      return { error: JSON.stringify(data) };
    }
    return { success: true };
  } catch (err) {
    console.error('[deleteTask] error:', err);
    return { error: String(err) };
  }
}

// ── Dashboard summary (Tasks table, open only) ────────────────────────────────

export async function getAllOpenTasks(): Promise<Task[]> {
  try {
    const { apiKey, baseId } = getCredentials();
    const res = await fetch(`${API_BASE}/${baseId}/Tasks`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: 'no-store',
    });
    if (!res.ok) return [];
    const data = await res.json();

    return (data.records ?? [])
      .map(mapTaskRecord)
      .filter((t: Task) => t.status !== 'completed');
  } catch (err) {
    console.warn('[getAllOpenTasks] error:', err);
    return [];
  }
}
