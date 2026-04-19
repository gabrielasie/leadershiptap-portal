'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { UserPlus, X } from 'lucide-react'
import { createClientAction } from './actions'

interface Coach {
  id: string
  name: string
}

interface Props {
  coaches: Coach[]
}

const ROLE_OPTIONS = ['Client', 'Team Member', 'Senior Leader']

export default function AddClientDialog({ coaches }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [workEmail, setWorkEmail] = useState('')
  const [title, setTitle] = useState('')
  const [role, setRole] = useState('Client')
  const [coachId, setCoachId] = useState('')

  function openDialog() {
    setFirstName('')
    setLastName('')
    setWorkEmail('')
    setTitle('')
    setRole('Client')
    setCoachId('')
    setError('')
    setOpen(true)
  }

  async function handleSave() {
    if (!firstName.trim() || !lastName.trim() || !workEmail.trim()) {
      setError('First name, last name, and work email are required.')
      return
    }
    setError('')
    setSaving(true)
    const result = await createClientAction({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      workEmail: workEmail.trim(),
      title: title.trim() || undefined,
      role: role || undefined,
      coachId: coachId || undefined,
    })
    setSaving(false)
    if (!result.success) {
      setError(result.error ?? 'Failed to create client — please try again.')
      return
    }
    setOpen(false)
    router.refresh()
  }

  return (
    <>
      <button
        onClick={openDialog}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[hsl(213,70%,30%)] text-white text-sm font-medium hover:bg-[hsl(213,70%,25%)] transition-colors"
      >
        <UserPlus className="h-4 w-4" />
        Add Client
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
          />

          {/* Modal */}
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Add New Client</h2>
              <button
                onClick={() => setOpen(false)}
                className="p-1 rounded-md hover:bg-slate-100 text-slate-400"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-700">First Name *</label>
                <input
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Jane"
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[hsl(213,70%,30%)]"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-700">Last Name *</label>
                <input
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Smith"
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[hsl(213,70%,30%)]"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-700">Work Email *</label>
              <input
                type="email"
                value={workEmail}
                onChange={(e) => setWorkEmail(e.target.value)}
                placeholder="jane@company.com"
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[hsl(213,70%,30%)]"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-700">Title</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. VP of Operations"
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[hsl(213,70%,30%)]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-700">Role</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[hsl(213,70%,30%)] bg-white"
                >
                  {ROLE_OPTIONS.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>

              {coaches.length > 0 && (
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-700">Assign Coach</label>
                  <select
                    value={coachId}
                    onChange={(e) => setCoachId(e.target.value)}
                    className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[hsl(213,70%,30%)] bg-white"
                  >
                    <option value="">No coach</option>
                    {coaches.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {error && <p className="text-xs text-rose-600 font-medium">{error}</p>}

            <div className="flex gap-2 pt-1">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 px-4 py-2 bg-[hsl(213,70%,30%)] text-white text-sm font-medium rounded-lg hover:bg-[hsl(213,70%,25%)] disabled:opacity-50 transition-colors"
              >
                {saving ? 'Creating…' : 'Create Client'}
              </button>
              <button
                onClick={() => setOpen(false)}
                className="px-4 py-2 border border-slate-200 text-sm rounded-lg hover:bg-slate-50 transition-colors text-slate-600"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
