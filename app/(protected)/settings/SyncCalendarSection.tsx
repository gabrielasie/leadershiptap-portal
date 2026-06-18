'use client'

import { useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { toast } from 'sonner'

export default function SyncCalendarSection() {
  const [syncing, setSyncing] = useState(false)

  async function handleSync() {
    setSyncing(true)
    try {
      const res = await fetch('/api/calendar/sync', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Sync failed')
        return
      }
      const { synced, coaches, errors } = data as {
        synced: number
        coaches: string[]
        errors: string[]
      }
      if (errors.length > 0) {
        toast.warning(
          `Synced ${synced} event${synced === 1 ? '' : 's'} with ${errors.length} error${errors.length === 1 ? '' : 's'}`,
        )
      } else {
        toast.success(
          `Synced ${synced} event${synced === 1 ? '' : 's'} across ${coaches.length} calendar${coaches.length === 1 ? '' : 's'}`,
        )
      }
    } catch {
      toast.error('Sync failed — check your connection')
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm text-slate-700 font-medium">Calendar Sync</p>
        <p className="text-xs text-slate-400 mt-0.5">
          Pulls all @leadershiptap.com calendars from Microsoft 365
        </p>
      </div>
      <button
        onClick={handleSync}
        disabled={syncing}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[hsl(213,70%,30%)] text-white hover:bg-[hsl(213,70%,25%)] disabled:opacity-50 transition-colors"
      >
        <RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} />
        {syncing ? 'Syncing…' : 'Sync Now'}
      </button>
    </div>
  )
}
