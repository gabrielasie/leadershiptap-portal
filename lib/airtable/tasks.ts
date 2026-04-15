import type { Task } from '@/lib/types';

const API_BASE = 'https://api.airtable.com/v0';

function getCredentials() {
  const apiKey = process.env.AIRTABLE_API_KEY;
  const baseId = process.env.AIRTABLE_BASE_ID;
  if (!apiKey || !baseId) throw new Error('Missing Airtable credentials');
  return { apiKey, baseId };
}

function mapRecord(record: { id: string; fields: Record<string, unknown> }): Task {
  // "Linked Todoist Tasks" uses "Task" as the name field and "Users 2" as the user link.
  // Legacy fallback for any portal-created records that use "Title" or "Name".
  const name = ((record.fields['Task'] ?? record.fields['Title'] ?? record.fields['Name'] ?? '') as string);
  const clientIds = record.fields['Users 2'] ?? record.fields['Client'];
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

    // Route 2: fetch all "Linked Todoist Tasks" and filter client-side.
    // filterByFormula + ARRAYJOIN is unreliable for linked-record fields that
    // store Airtable record IDs — client-side includes() is exact and guaranteed.
    const tableRes = await fetch(
      `${API_BASE}/${baseId}/Linked%20Todoist%20Tasks`,
      { headers: { Authorization: `Bearer ${apiKey}` }, cache: 'no-store' }
    );
    if (tableRes.ok) {
      const tableData = await tableRes.json();
      console.log('[Tasks] Raw records count:', tableData.records?.length);
      tableData.records?.forEach((r: { id: string; fields: Record<string, unknown> }) => {
        console.log('  id:', r.id, '| fields:', JSON.stringify(r.fields));
      });
      console.log('[Tasks] Filtering for userId:', userId);
      for (const rec of (tableData.records ?? [])) {
        const users2 = rec.fields['Users 2'];
        if (!Array.isArray(users2) || !users2.includes(userId)) continue;
        const task = mapRecord(rec);
        if (!seen.has(task.id)) { seen.add(task.id); results.push(task); }
      }
    } else {
      const errText = await tableRes.text();
      console.warn('[getTasksByUser] Linked Todoist Tasks query failed:', errText);
    }

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
  'Due Date'?: string;   // YYYY-MM-DD (not stored — Linked Todoist Tasks has no due date field)
  Priority?: 'Low' | 'Medium' | 'High';  // not stored — no field in current table
  Status?: string;
  Client?: string[];     // linked record IDs → Users table (mapped to "Users 2")
}): Promise<void> {
  let apiKey: string, baseId: string;
  try {
    ({ apiKey, baseId } = getCredentials());
  } catch (e) {
    console.error('[createTask] Missing Airtable credentials:', e);
    return;
  }
  try {
    // The portal uses "Linked Todoist Tasks" — field names differ from portal schema.
    // "Task" = name, "Users 2" = linked user. Due date and priority have no column yet.
    const airtableFields: Record<string, unknown> = { Task: fields.Title };
    if (fields.Client?.length) airtableFields['Users 2'] = fields.Client;
    const res = await fetch(`${API_BASE}/${baseId}/Linked%20Todoist%20Tasks`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fields: airtableFields }),
    });
    if (!res.ok) {
      const text = await res.text();
      console.error('[createTask] Airtable POST failed:', text);
    }
  } catch (e) {
    console.error('[createTask] Unexpected error:', e);
  }
}
