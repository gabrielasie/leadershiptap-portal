import type { Task } from '@/lib/types';

const API_BASE = 'https://api.airtable.com/v0';

function getCredentials() {
  const apiKey = process.env.AIRTABLE_API_KEY;
  const baseId = process.env.AIRTABLE_BASE_ID;
  if (!apiKey || !baseId) throw new Error('Missing Airtable credentials');
  return { apiKey, baseId };
}

function mapRecord(record: { id: string; fields: Record<string, unknown> }): Task {
  const clientIds = record.fields['Client'];
  // Support multiple name field conventions (our Tasks table uses "Title",
  // pre-existing Todoist-linked tasks may use "Name")
  const name = ((record.fields['Title'] ?? record.fields['Name'] ?? '') as string);
  return {
    id: record.id,
    name,
    dueDate: record.fields['Due Date'] as string | undefined,
    priority: record.fields['Priority'] as Task['priority'],
    status: (record.fields['Status'] as Task['status']) ?? 'To Do',
    userId: Array.isArray(clientIds) ? (clientIds[0] as string) : undefined,
  };
}

export async function getTasksByUser(userId: string): Promise<Task[]> {
  try {
    const { apiKey, baseId } = getCredentials();
    console.log('[getTasksByUser] userId:', userId);

    const seen = new Set<string>();
    const results: Task[] = [];

    // Route 1: expand "Associated Tasks" linked field on the user record.
    // This catches pre-existing tasks (e.g. Todoist-synced) that are linked
    // to the user outside of our portal-created Tasks table.
    const userRes = await fetch(
      `${API_BASE}/${baseId}/Users/${userId}?expand%5B%5D=Associated%20Tasks`,
      { headers: { Authorization: `Bearer ${apiKey}` }, cache: 'no-store' }
    );
    if (userRes.ok) {
      const userData = await userRes.json();
      const linked = userData.fields?.['Associated Tasks'];
      console.log('[getTasksByUser] Associated Tasks raw (first 200):', JSON.stringify(linked)?.slice(0, 200));
      if (Array.isArray(linked)) {
        for (const item of linked) {
          if (item && typeof item === 'object' && 'fields' in item) {
            const task = mapRecord(item as { id: string; fields: Record<string, unknown> });
            if (!seen.has(task.id)) { seen.add(task.id); results.push(task); }
          }
        }
      }
    }

    // Route 2: query the Tasks table directly (portal-created tasks use Client field)
    const formula = encodeURIComponent(`FIND("${userId}", ARRAYJOIN({Client}))`);
    const sort = 'sort%5B0%5D%5Bfield%5D=Due%20Date&sort%5B0%5D%5Bdirection%5D=asc';
    const tableRes = await fetch(
      `${API_BASE}/${baseId}/Tasks?filterByFormula=${formula}&${sort}`,
      { headers: { Authorization: `Bearer ${apiKey}` }, cache: 'no-store' }
    );
    if (tableRes.ok) {
      const tableData = await tableRes.json();
      console.log('[getTasksByUser] Tasks table records:', tableData.records?.length ?? 0);
      for (const rec of (tableData.records ?? [])) {
        const task = mapRecord(rec);
        if (!seen.has(task.id)) { seen.add(task.id); results.push(task); }
      }
    } else {
      const errText = await tableRes.text();
      if (!errText.includes('MODEL_NOT_FOUND') && !errText.includes('NOT_FOUND')) {
        console.warn('[getTasksByUser] Tasks table query failed:', errText);
      }
    }

    console.log('[getTasksByUser] total merged tasks:', results.length);
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

export async function createTask(fields: {
  Title: string;
  'Due Date'?: string;   // YYYY-MM-DD
  Priority?: 'Low' | 'Medium' | 'High';
  Status?: string;
  Client?: string[];     // linked record IDs → Users table
}): Promise<void> {
  let apiKey: string, baseId: string;
  try {
    ({ apiKey, baseId } = getCredentials());
  } catch (e) {
    console.error('[createTask] Missing Airtable credentials:', e);
    return;
  }
  try {
    const res = await fetch(`${API_BASE}/${baseId}/Tasks`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fields }),
    });
    if (!res.ok) {
      const text = await res.text();
      console.error('[createTask] Airtable POST failed:', text);
    }
  } catch (e) {
    console.error('[createTask] Unexpected error:', e);
  }
}
