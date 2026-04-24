'use client'

import { useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { useViewMode } from '@/app/context/ViewModeContext'

export default function SyncCalendarButton() {
  const { isAdminView } = useViewMode()
  const [syncing, setSyncing] = useState(false)

  if (!isAdminView) return null

  async function handleSync() {
    setSyncing(true)
    try {
      const res = await fetch('/api/calendar/sync', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Sync failed')
        return
      }
      const { synced, errors } = data as { synced: number; errors: string[] }
      if (errors.length > 0) {
        toast.warning(`Synced ${synced} events with ${errors.length} error${errors.length === 1 ? '' : 's'}`)
      } else {
        toast.success(`Synced ${synced} calendar event${synced === 1 ? '' : 's'}`)
      }
    } catch {
      toast.error('Sync failed — check your connection')
    } finally {
      setSyncing(false)
    }
  }

  return (
    <button
      onClick={handleSync}
      disabled={syncing}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-800 disabled:opacity-50 transition-colors shadow-sm"
    >
      <RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} />
      {syncing ? 'Syncing…' : 'Sync Calendar'}
    </button>
  )
}
