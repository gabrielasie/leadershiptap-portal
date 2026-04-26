'use client'

import { useState, useEffect } from 'react'

export type PermissionLevel = 'internal_admin' | 'coach_owner' | 'read_only'

/**
 * Returns the current user's permission level relative to a specific client.
 * Fetches from /api/permissions on mount.
 *
 * Use this in client components that need to conditionally show write actions.
 * In server components, prefer calling getPermissionLevel() directly.
 */
export function usePermission(clientAirtableId: string | null | undefined) {
  const [level, setLevel] = useState<PermissionLevel | null>(null)

  useEffect(() => {
    if (!clientAirtableId) {
      setLevel('read_only')
      return
    }
    fetch('/api/permissions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientAirtableId }),
    })
      .then((r) => r.json())
      .then((d: { permissionLevel?: PermissionLevel }) =>
        setLevel(d.permissionLevel ?? 'read_only'),
      )
      .catch(() => setLevel('read_only'))
  }, [clientAirtableId])

  return {
    level,
    canWrite: level === 'internal_admin' || level === 'coach_owner',
    loading: level === null,
  }
}
