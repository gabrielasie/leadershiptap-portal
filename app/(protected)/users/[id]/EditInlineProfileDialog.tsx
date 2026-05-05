'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil } from 'lucide-react'

interface Props {
  userId: string
  currentTitle: string
  currentInternalNotes: string
}

export default function EditInlineProfileDialog({
  userId,
  currentTitle,
  currentInternalNotes,
}: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState(currentTitle)
  const [internalNotes, setInternalNotes] = useState(currentInternalNotes)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function handleOpen() {
    setTitle(currentTitle)
    setInternalNotes(currentInternalNotes)
    setError('')
    setOpen(true)
  }

  function handleClose() {
    if (saving) return
    setOpen(false)
  }

  async function handleSave() {
    setSaving(true)
    setError('')

    // Only send changed fields
    const body: Record<string, string> = {}
    if (title !== currentTitle) body.title = title
    if (internalNotes !== currentInternalNotes) body.internalNotes = internalNotes

    if (Object.keys(body).length === 0) {
      setOpen(false)
      setSaving(false)
      return
    }

    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? 'Failed to save — please try again')
        setSaving(false)
        return
      }
      setSaving(false)
      setOpen(false)
      router.refresh()
    } catch {
      setError('Failed to save — please try again')
      setSaving(false)
    }
  }

  return (
    <>
      <button
        onClick={handleOpen}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-[hsl(213,70%,30%)] hover:underline"
      >
        <Pencil className="h-3.5 w-3.5" />
        Edit Profile
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={handleClose} />

          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-lg font-semibold text-slate-900">Edit Profile</h2>
              <button
                onClick={handleClose}
                className="text-slate-400 hover:text-slate-600 text-2xl leading-none w-8 h-8 flex items-center justify-center rounded hover:bg-slate-100"
              >
                &times;
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Title
                </label>
                <input
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[hsl(213,70%,30%)] focus:border-[hsl(213,70%,30%)] disabled:bg-slate-50"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. VP of Operations"
                  disabled={saving}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Coaching Context
                </label>
                <textarea
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[hsl(213,70%,30%)] focus:border-[hsl(213,70%,30%)] disabled:bg-slate-50 resize-none"
                  rows={5}
                  value={internalNotes}
                  onChange={(e) => setInternalNotes(e.target.value)}
                  placeholder="Internal coaching notes about this client..."
                  disabled={saving}
                />
                <p className="text-xs text-slate-400 mt-1">
                  Only visible to coaches with an active relationship context.
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center gap-3 px-6 py-4 border-t border-slate-100">
              {error && (
                <p className="text-xs font-medium text-rose-600 mr-auto">{error}</p>
              )}
              <div className="ml-auto flex items-center gap-3">
                <button
                  onClick={handleClose}
                  disabled={saving}
                  className="px-4 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors text-slate-600 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-4 py-2 text-sm bg-[hsl(213,70%,30%)] text-white rounded-lg hover:bg-[hsl(213,70%,25%)] disabled:opacity-50 transition-colors font-medium"
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
