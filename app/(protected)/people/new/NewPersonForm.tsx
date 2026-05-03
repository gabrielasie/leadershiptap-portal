'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { X } from 'lucide-react'

interface Person {
  id: string
  name: string
}

interface Props {
  coaches: Person[]
  allUsers: Person[]
  companies: Person[]
}

const NO_COMPANY = '__none__'

// ── PersonPicker ──────────────────────────────────────────────────────────────

function PersonPicker({
  label,
  hint,
  options,
  selected,
  onChange,
  placeholder = 'Search…',
}: {
  label: string
  hint?: string
  options: Person[]
  selected: Person[]
  onChange: (next: Person[]) => void
  placeholder?: string
}) {
  const [query, setQuery] = useState('')
  const [focused, setFocused] = useState(false)

  const selectedIds = new Set(selected.map((p) => p.id))
  const filtered = options
    .filter((o) => !selectedIds.has(o.id))
    .filter((o) =>
      query.trim() ? o.name.toLowerCase().includes(query.toLowerCase()) : true,
    )
    .slice(0, 8)

  const showDropdown = focused && filtered.length > 0

  function add(person: Person) {
    onChange([...selected, person])
    setQuery('')
  }

  function remove(id: string) {
    onChange(selected.filter((p) => p.id !== id))
  }

  return (
    <div className="space-y-2">
      <div>
        <Label>{label}</Label>
        {hint && <p className="text-xs text-slate-400 mt-0.5">{hint}</p>}
      </div>

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((p) => (
            <span
              key={p.id}
              className="inline-flex items-center gap-1 pl-2.5 pr-1.5 py-0.5 rounded-full bg-blue-50 text-blue-800 text-xs font-medium"
            >
              {p.name}
              <button
                type="button"
                onClick={() => remove(p.id)}
                className="text-blue-600 hover:text-blue-900"
                aria-label={`Remove ${p.name}`}
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="relative">
        <Input
          placeholder={placeholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className="text-sm"
          autoComplete="off"
        />
        {showDropdown && (
          <ul className="absolute z-10 mt-1 w-full max-h-48 overflow-y-auto bg-white border border-slate-200 rounded-md shadow-md divide-y divide-slate-50">
            {filtered.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault() // keep input focused so blur doesn't close first
                    add(p)
                  }}
                  className="w-full text-left px-3 py-2 text-sm text-slate-800 hover:bg-slate-50 transition-colors"
                >
                  {p.name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

// ── Summary Preview ───────────────────────────────────────────────────────────

function RelationshipSummary({
  firstName,
  coaches,
  reportsTo,
  directReports,
}: {
  firstName: string
  coaches: Person[]
  reportsTo: Person[]
  directReports: Person[]
}) {
  const name = firstName.trim() || 'This person'
  const rows = [
    ...coaches.map((c) => `${name} is coached by ${c.name}`),
    ...reportsTo.map((m) => `${name} reports to ${m.name}`),
    ...directReports.map((dr) => `${dr.name} reports to ${name}`),
  ]

  if (rows.length === 0) return null

  return (
    <div className="rounded-lg border border-blue-100 bg-blue-50 p-4 space-y-2">
      <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">
        {rows.length} relationship context{rows.length !== 1 ? 's' : ''} will be created
      </p>
      <ul className="space-y-1">
        {rows.map((row, i) => (
          <li key={i} className="text-sm text-blue-900 flex gap-2">
            <span className="text-blue-400 flex-shrink-0">•</span>
            {row}
          </li>
        ))}
      </ul>
    </div>
  )
}

// ── Main Form ─────────────────────────────────────────────────────────────────

export default function NewPersonForm({ coaches, allUsers, companies }: Props) {
  const router = useRouter()

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [jobTitle, setJobTitle] = useState('')
  const [workEmail, setWorkEmail] = useState('')
  const [companyId, setCompanyId] = useState(NO_COMPANY)

  const [selectedCoaches, setSelectedCoaches] = useState<Person[]>([])
  const [reportsTo, setReportsTo] = useState<Person[]>([])
  const [directReports, setDirectReports] = useState<Person[]>([])

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const canSubmit = firstName.trim().length > 0 && !saving

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setSaving(true)
    setError('')

    try {
      const res = await fetch('/api/people', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim() || undefined,
          jobTitle: jobTitle.trim() || undefined,
          workEmail: workEmail.trim() || undefined,
          companyId: companyId !== NO_COMPANY ? companyId : undefined,
          coachIds: selectedCoaches.map((c) => c.id),
          reportsToIds: reportsTo.map((p) => p.id),
          directReportIds: directReports.map((p) => p.id),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Failed to create person — please try again')
        setSaving(false)
        return
      }
      router.push(`/users/${data.id}`)
    } catch {
      setError('Failed to create person — please try again')
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* ── Section 1: Person Details ───────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-widest border-b border-slate-100 pb-2">
          Person Details
        </h2>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="np-first">
              First Name <span className="text-rose-500">*</span>
            </Label>
            <Input
              id="np-first"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="Alex"
              disabled={saving}
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="np-last">Last Name</Label>
            <Input
              id="np-last"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Rivera"
              disabled={saving}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="np-title">Job Title</Label>
          <Input
            id="np-title"
            value={jobTitle}
            onChange={(e) => setJobTitle(e.target.value)}
            placeholder="e.g. VP of Engineering"
            disabled={saving}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="np-email">Work Email</Label>
          <Input
            id="np-email"
            type="email"
            value={workEmail}
            onChange={(e) => setWorkEmail(e.target.value)}
            placeholder="alex@company.com"
            disabled={saving}
          />
        </div>

        {companies.length > 0 && (
          <div className="space-y-1.5">
            <Label htmlFor="np-company">Company</Label>
            <Select value={companyId} onValueChange={setCompanyId} disabled={saving}>
              <SelectTrigger id="np-company">
                <SelectValue placeholder="Select company…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_COMPANY}>No company</SelectItem>
                {companies.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </section>

      {/* ── Section 2: Coaches ──────────────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-widest border-b border-slate-100 pb-2">
          Coaches
        </h2>
        <PersonPicker
          label="Assign coaches"
          hint="Coaching relationship contexts will be created automatically."
          options={coaches}
          selected={selectedCoaches}
          onChange={setSelectedCoaches}
          placeholder="Search coaches…"
        />
      </section>

      {/* ── Section 3: Reports To ───────────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-widest border-b border-slate-100 pb-2">
          Reports To
        </h2>
        <PersonPicker
          label="Who does this person report to?"
          hint="Creates a reports_to relationship context for each manager."
          options={allUsers}
          selected={reportsTo}
          onChange={setReportsTo}
          placeholder="Search people…"
        />
      </section>

      {/* ── Section 4: Direct Reports ───────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-widest border-b border-slate-100 pb-2">
          Direct Reports
        </h2>
        <PersonPicker
          label="Who reports to this person?"
          hint="Creates a reports_to relationship context for each direct report."
          options={allUsers}
          selected={directReports}
          onChange={setDirectReports}
          placeholder="Search people…"
        />
      </section>

      {/* ── Summary Preview ─────────────────────────────────────────────── */}
      <RelationshipSummary
        firstName={firstName}
        coaches={selectedCoaches}
        reportsTo={reportsTo}
        directReports={directReports}
      />

      {/* ── Actions ─────────────────────────────────────────────────────── */}
      {error && <p className="text-sm text-rose-600 font-medium">{error}</p>}

      <div className="flex items-center gap-3 pt-2 border-t border-slate-100">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={saving}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={!canSubmit}>
          {saving ? 'Creating…' : 'Create Person'}
        </Button>
      </div>
    </form>
  )
}
