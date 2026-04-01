const API_BASE = 'https://api.airtable.com/v0';

function getCredentials() {
  const apiKey = process.env.AIRTABLE_API_KEY;
  const baseId = process.env.AIRTABLE_BASE_ID;
  if (!apiKey || !baseId) throw new Error('Missing Airtable credentials');
  return { apiKey, baseId };
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
