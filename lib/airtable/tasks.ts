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
  return {
    id: record.id,
    name: (record.fields['Name'] as string) ?? '',
    dueDate: record.fields['Due Date'] as string | undefined,
    priority: record.fields['Priority'] as Task['priority'],
    status: (record.fields['Status'] as Task['status']) ?? 'To Do',
    userId: Array.isArray(clientIds) ? (clientIds[0] as string) : undefined,
  };
}

export async function getTasksByUser(userId: string): Promise<Task[]> {
  const { apiKey, baseId } = getCredentials();
  const formula = encodeURIComponent(`FIND("${userId}", ARRAYJOIN({Client}))`);
  const sort = 'sort%5B0%5D%5Bfield%5D=Due%20Date&sort%5B0%5D%5Bdirection%5D=asc';
  const res = await fetch(
    `${API_BASE}/${baseId}/Tasks?filterByFormula=${formula}&${sort}`,
    {
      headers: { Authorization: `Bearer ${apiKey}` },
      next: { revalidate: 60 },
    }
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Airtable GET failed: ${text}`);
  }
  const data = await res.json();
  return (data.records ?? []).map(mapRecord);
}

export async function createTask(fields: {
  Name: string;
  'Due Date'?: string;   // YYYY-MM-DD
  Priority?: 'Low' | 'Medium' | 'High';
  Client?: string[];     // linked record IDs → Users table
}): Promise<void> {
  const { apiKey, baseId } = getCredentials();
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
    throw new Error(`Airtable POST failed: ${text}`);
  }
}
