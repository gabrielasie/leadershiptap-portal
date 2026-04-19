'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Camera } from 'lucide-react'
import { updateProfileAction, fetchProfileOptionsAction } from './actions'
import type { UserProfileFields } from '@/lib/airtable/users'
import type { User } from '@/lib/types'

// ── Types ─────────────────────────────────────────────────────────────────────

interface ProfileOption {
  id: string
  name: string
}

interface ProfileOptions {
  companies: ProfileOption[]
  enneagrams: ProfileOption[]
  mbtis: ProfileOption[]
  conflictPostures: ProfileOption[]
  apologyLanguages: ProfileOption[]
  strengths: ProfileOption[]
  coaches: ProfileOption[]
  allUsers: ProfileOption[]
}

interface Props {
  user: User
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getInitials(user: User): string {
  if (user.firstName && user.lastName) return (user.firstName[0] + user.lastName[0]).toUpperCase()
  if (user.fullName) {
    const parts = user.fullName.trim().split(/\s+/)
    return parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : parts[0][0].toUpperCase()
  }
  return user.email[0].toUpperCase()
}

const AVATAR_COLORS = [
  'bg-blue-100 text-blue-700',
  'bg-violet-100 text-violet-700',
  'bg-emerald-100 text-emerald-700',
  'bg-amber-100 text-amber-700',
]
function avatarColor(id: string): string {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}

// ── Layout helpers ────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3 pb-1.5 border-b border-slate-100">
        {title}
      </p>
      {children}
    </div>
  )
}

function Field({ label, children, half }: { label: string; children: React.ReactNode; half?: boolean }) {
  return (
    <div className={half ? '' : 'col-span-2'}>
      <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
      {children}
    </div>
  )
}

const inputCls =
  'w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[hsl(213,70%,30%)] focus:border-[hsl(213,70%,30%)] disabled:bg-slate-50 disabled:text-slate-400'

const selectCls =
  'w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-[hsl(213,70%,30%)] focus:border-[hsl(213,70%,30%)] bg-white disabled:bg-slate-50 disabled:text-slate-400'

function SelectField({
  value,
  onChange,
  options,
  placeholder,
  disabled,
  loading,
}: {
  value: string
  onChange: (v: string) => void
  options: ProfileOption[]
  placeholder: string
  disabled?: boolean
  loading?: boolean
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled || loading}
      className={selectCls}
    >
      <option value="">{loading ? 'Loading…' : placeholder}</option>
      {options.map((o) => (
        <option key={o.id} value={o.id}>{o.name}</option>
      ))}
    </select>
  )
}

const ROLE_OPTIONS = ['Client', 'Team Member', 'Senior Leader', 'Coach', 'Admin']

// ── Main component ────────────────────────────────────────────────────────────

export default function EditProfileDialog({ user }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'uploading' | 'saving' | ''>('')
  const [errorMsg, setErrorMsg] = useState('')
  const [saved, setSaved] = useState(false)

  const [options, setOptions] = useState<ProfileOptions | null>(null)
  const [optionsLoading, setOptionsLoading] = useState(false)

  // ── Photo ────────────────────────────────────────────────────────────────────
  const fileRef = useRef<HTMLInputElement>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const blobUrlRef = useRef<string | null>(null)

  // ── Basic Info ───────────────────────────────────────────────────────────────
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [preferredName, setPreferredName] = useState('')
  const [title, setTitle] = useState('')
  const [workEmail, setWorkEmail] = useState('')
  const [personalEmail, setPersonalEmail] = useState('')
  const [hireDate, setHireDate] = useState('')
  const [birthday, setBirthday] = useState('')
  const [workDeskNumber, setWorkDeskNumber] = useState('')
  const [workCellNumber, setWorkCellNumber] = useState('')
  const [personalCellNumber, setPersonalCellNumber] = useState('')

  // ── Organization ─────────────────────────────────────────────────────────────
  const [companyId, setCompanyId] = useState('')
  const [role, setRole] = useState('')
  const [coachId, setCoachId] = useState('')
  const [teamLeadId, setTeamLeadId] = useState('')

  // ── Coaching Context ─────────────────────────────────────────────────────────
  const [quickNotes, setQuickNotes] = useState('')
  const [familyDetails, setFamilyDetails] = useState('')

  // ── Personality ──────────────────────────────────────────────────────────────
  const [enneagramId, setEnneagramId] = useState('')
  const [mbtiId, setMbtiId] = useState('')
  const [conflictPostureId, setConflictPostureId] = useState('')
  const [apologyLanguageId, setApologyLanguageId] = useState('')
  const [selectedStrengthIds, setSelectedStrengthIds] = useState<string[]>([])
  const [strengthSearch, setStrengthSearch] = useState('')

  // ── Reset form ───────────────────────────────────────────────────────────────

  function resetForm() {
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current)
      blobUrlRef.current = null
    }
    setPhotoPreview(null)
    setSelectedFile(null)
    setFirstName(user.firstName ?? '')
    setLastName(user.lastName ?? '')
    setPreferredName(user.preferredName ?? '')
    setTitle(user.title ?? user.jobTitle ?? '')
    setWorkEmail(user.workEmail ?? '')
    setPersonalEmail(user.personalEmail ?? '')
    setHireDate(user.hireDate ?? '')
    setBirthday(user.birthday ?? '')
    setWorkDeskNumber(user.workDeskNumber ?? '')
    setWorkCellNumber(user.workCellNumber ?? '')
    setPersonalCellNumber(user.personalCellNumber ?? '')
    setCompanyId(user.companyLinkedIds?.[0] ?? '')
    setRole(user.role ?? '')
    setCoachId(user.coachIds?.[0] ?? '')
    setTeamLeadId(user.teamLeadIds?.[0] ?? '')
    setQuickNotes(user.quickNotes ?? '')
    setFamilyDetails(user.familyDetails ?? '')
    setEnneagramId(user.enneagramIds?.[0] ?? '')
    setMbtiId(user.mbtiIds?.[0] ?? '')
    setConflictPostureId(user.conflictPostureIds?.[0] ?? '')
    setApologyLanguageId(user.apologyLanguageIds?.[0] ?? '')
    setSelectedStrengthIds(user.strengthIds ?? [])
    setStrengthSearch('')
    setErrorMsg('')
    setSaved(false)
  }

  // ── Open ─────────────────────────────────────────────────────────────────────

  async function handleOpen() {
    resetForm()
    setOpen(true)
    if (!options) {
      setOptionsLoading(true)
      try {
        const data = await fetchProfileOptionsAction()
        setOptions(data)
      } catch (e) {
        console.error('[EditProfileDialog] fetchProfileOptionsAction failed:', e)
      } finally {
        setOptionsLoading(false)
      }
    }
  }

  useEffect(() => { setOptions(null) }, [user.id])

  // ── Photo picker ─────────────────────────────────────────────────────────────

  function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    // Revoke previous blob URL to avoid memory leaks
    if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current)
    const url = URL.createObjectURL(file)
    blobUrlRef.current = url
    setPhotoPreview(url)
    setSelectedFile(file)
    // Reset input so the same file can be re-selected if needed
    e.target.value = ''
  }

  // ── Save ─────────────────────────────────────────────────────────────────────

  async function handleSave() {
    setErrorMsg('')
    setSaved(false)
    setSaving(true)

    // ── Phase 1: upload photo if a new file was selected ─────────────────────
    if (selectedFile) {
      setSaveStatus('uploading')
      console.log('[EditProfile] Uploading photo for userId:', user.id, '| starts with rec:', user.id?.startsWith('rec'))
      const fd = new FormData()
      fd.append('file', selectedFile)
      fd.append('userId', user.id)
      try {
        const uploadRes = await fetch('/api/upload-photo', { method: 'POST', body: fd })
        const photoResult = await uploadRes.json()
        if (!photoResult.success) {
          setErrorMsg(`Photo upload failed: ${photoResult.error}`)
        } else {
          setSelectedFile(null)
        }
      } catch (err) {
        setErrorMsg(`Photo upload error: ${String(err)}`)
      }
    }

    // ── Phase 2: PATCH changed profile fields ─────────────────────────────────
    setSaveStatus('saving')

    const patch: UserProfileFields = {}

    // Text / date fields — only include if changed
    if (firstName !== (user.firstName ?? '')) patch['First Name'] = firstName
    if (lastName !== (user.lastName ?? '')) patch['Last Name'] = lastName
    if (preferredName !== (user.preferredName ?? '')) patch['Preferred Name'] = preferredName
    if (title !== (user.title ?? user.jobTitle ?? '')) patch['Title'] = title
    if (workEmail !== (user.workEmail ?? '')) patch['Work Email'] = workEmail
    if (personalEmail !== (user.personalEmail ?? '')) patch['Personal Email'] = personalEmail
    if (hireDate !== (user.hireDate ?? '')) patch['Hire Date'] = hireDate
    if (birthday !== (user.birthday ?? '')) patch['Birthday'] = birthday
    if (workDeskNumber !== (user.workDeskNumber ?? '')) patch['Work Desk Number'] = workDeskNumber
    if (workCellNumber !== (user.workCellNumber ?? '')) patch['Work Cell Number'] = workCellNumber
    if (personalCellNumber !== (user.personalCellNumber ?? '')) patch['Personal Cell Number'] = personalCellNumber
    if (quickNotes !== (user.quickNotes ?? '')) patch['Quick Notes'] = quickNotes
    if (familyDetails !== (user.familyDetails ?? '')) patch['Family Details'] = familyDetails
    if (role !== (user.role ?? '')) patch['Role'] = role

    // Linked single-record fields — only if changed and non-empty
    if (companyId && companyId !== (user.companyLinkedIds?.[0] ?? '')) patch['Company'] = [companyId]
    if (coachId && coachId !== (user.coachIds?.[0] ?? '')) patch['Coach'] = [coachId]
    if (teamLeadId && teamLeadId !== (user.teamLeadIds?.[0] ?? '')) patch['Team Lead'] = [teamLeadId]
    if (enneagramId && enneagramId !== (user.enneagramIds?.[0] ?? '')) patch['Enneagram'] = [enneagramId]
    if (mbtiId && mbtiId !== (user.mbtiIds?.[0] ?? '')) patch['MBTI'] = [mbtiId]
    if (conflictPostureId && conflictPostureId !== (user.conflictPostureIds?.[0] ?? '')) patch['Conflict Posture'] = [conflictPostureId]
    if (apologyLanguageId && apologyLanguageId !== (user.apologyLanguageIds?.[0] ?? '')) patch['Apology Language'] = [apologyLanguageId]

    // Strengths — include if changed and non-empty
    const origStrengths = [...(user.strengthIds ?? [])].sort().join(',')
    const newStrengths = [...selectedStrengthIds].sort().join(',')
    if (selectedStrengthIds.length > 0 && newStrengths !== origStrengths) {
      patch['Strengths'] = selectedStrengthIds
    }

    if (Object.keys(patch).length > 0) {
      console.log('[EditProfileDialog] Patch being sent:', JSON.stringify(patch, null, 2))
      const result = await updateProfileAction(user.id, patch)
      if ('error' in result) {
        setSaving(false)
        setSaveStatus('')
        // Append to any existing photo error rather than overwriting it
        setErrorMsg((prev) => (prev ? `${prev}\n${result.error}` : result.error))
        return
      }
    }

    setSaving(false)
    setSaveStatus('')
    setSaved(true)
    router.refresh()
    setTimeout(() => setOpen(false), 1500)
  }

  // ── Strength toggle ──────────────────────────────────────────────────────────

  function toggleStrength(id: string) {
    setSelectedStrengthIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id)
      if (prev.length >= 5) return prev
      return [...prev, id]
    })
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  const currentPhoto = photoPreview ?? user.profilePhoto ?? user.avatarUrl ?? null

  return (
    <>
      <button
        onClick={handleOpen}
        className="text-xs font-medium text-[hsl(213,70%,30%)] hover:underline"
      >
        Edit Profile
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />

          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[85vh]">

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
              <h2 className="text-lg font-semibold text-slate-900">Edit Profile</h2>
              <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600 text-2xl leading-none w-8 h-8 flex items-center justify-center rounded hover:bg-slate-100">
                ×
              </button>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto px-6 py-5">

              {/* ── Section 1: Profile Photo ────────────────────────────── */}
              <Section title="Profile Photo">
                <div className="flex items-center gap-4">
                  {currentPhoto ? (
                    <img src={currentPhoto} alt="Profile" className="w-20 h-20 rounded-full object-cover flex-shrink-0 ring-2 ring-slate-100" />
                  ) : (
                    <div className={`w-20 h-20 rounded-full flex items-center justify-center text-xl font-semibold flex-shrink-0 ${avatarColor(user.id)}`}>
                      {getInitials(user)}
                    </div>
                  )}
                  <div>
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      <Camera className="h-4 w-4 text-slate-400" />
                      {photoPreview ? 'Change Photo' : 'Upload Photo'}
                    </button>
                    <p className="text-xs text-slate-400 mt-1.5">JPG, PNG or WebP · Max 5 MB</p>
                    <input ref={fileRef} type="file" accept=".jpg,.jpeg,.png,.webp" onChange={handlePhotoSelect} className="hidden" />
                  </div>
                </div>
              </Section>

              {/* ── Section 2: Basic Info ───────────────────────────────── */}
              <Section title="Basic Info">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="First Name" half><input className={inputCls} value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Jane" disabled={saving} /></Field>
                  <Field label="Last Name" half><input className={inputCls} value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Smith" disabled={saving} /></Field>
                  <Field label="Preferred Name" half><input className={inputCls} value={preferredName} onChange={(e) => setPreferredName(e.target.value)} placeholder="e.g. Jay" disabled={saving} /></Field>
                  <Field label="Title / Job Title" half><input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="VP of Operations" disabled={saving} /></Field>
                  <Field label="Work Email" half><input className={inputCls} type="email" value={workEmail} onChange={(e) => setWorkEmail(e.target.value)} placeholder="jane@company.com" disabled={saving} /></Field>
                  <Field label="Personal Email" half><input className={inputCls} type="email" value={personalEmail} onChange={(e) => setPersonalEmail(e.target.value)} placeholder="jane@gmail.com" disabled={saving} /></Field>
                  <Field label="Hire Date" half><input className={inputCls} type="date" value={hireDate} onChange={(e) => setHireDate(e.target.value)} disabled={saving} /></Field>
                  <Field label="Birthday" half><input className={inputCls} type="date" value={birthday} onChange={(e) => setBirthday(e.target.value)} disabled={saving} /></Field>
                  <Field label="Work Desk Number" half><input className={inputCls} value={workDeskNumber} onChange={(e) => setWorkDeskNumber(e.target.value)} placeholder="ext. 1234" disabled={saving} /></Field>
                  <Field label="Work Cell Number" half><input className={inputCls} value={workCellNumber} onChange={(e) => setWorkCellNumber(e.target.value)} placeholder="+1 555 000 0000" disabled={saving} /></Field>
                  <Field label="Personal Cell Number" half><input className={inputCls} value={personalCellNumber} onChange={(e) => setPersonalCellNumber(e.target.value)} placeholder="+1 555 000 0000" disabled={saving} /></Field>
                </div>
              </Section>

              {/* ── Section 3: Organization ─────────────────────────────── */}
              <Section title="Organization">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Company" half>
                    <SelectField value={companyId} onChange={setCompanyId} options={options?.companies ?? []} placeholder="Select company…" disabled={saving} loading={optionsLoading} />
                  </Field>
                  <Field label="Role" half>
                    <select value={role} onChange={(e) => setRole(e.target.value)} disabled={saving} className={selectCls}>
                      <option value="">Select role…</option>
                      {ROLE_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </Field>
                  <Field label="Coach" half>
                    <SelectField value={coachId} onChange={setCoachId} options={options?.coaches ?? []} placeholder="Select coach…" disabled={saving} loading={optionsLoading} />
                  </Field>
                  <Field label="Team Lead" half>
                    <SelectField value={teamLeadId} onChange={setTeamLeadId} options={options?.allUsers ?? []} placeholder="Select team lead…" disabled={saving} loading={optionsLoading} />
                  </Field>
                </div>
              </Section>

              {/* ── Section 4: Coaching Context ─────────────────────────── */}
              <Section title="Coaching Context">
                <div className="space-y-3">
                  <Field label="Quick Context Notes">
                    <textarea className={`${inputCls} resize-none`} rows={3} value={quickNotes} onChange={(e) => setQuickNotes(e.target.value)} placeholder="Short context notes about this client…" disabled={saving} />
                  </Field>
                  <Field label="Family Details">
                    <textarea className={`${inputCls} resize-none`} rows={3} value={familyDetails} onChange={(e) => setFamilyDetails(e.target.value)} placeholder="Family context relevant to coaching…" disabled={saving} />
                  </Field>
                </div>
              </Section>

              {/* ── Section 5: Personality & Strengths ──────────────────── */}
              <Section title="Personality & Strengths">
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <Field label="Enneagram" half>
                    <SelectField value={enneagramId} onChange={setEnneagramId} options={options?.enneagrams ?? []} placeholder="Select type…" disabled={saving} loading={optionsLoading} />
                  </Field>
                  <Field label="MBTI" half>
                    <SelectField value={mbtiId} onChange={setMbtiId} options={options?.mbtis ?? []} placeholder="Select type…" disabled={saving} loading={optionsLoading} />
                  </Field>
                  <Field label="Conflict Posture" half>
                    <SelectField value={conflictPostureId} onChange={setConflictPostureId} options={options?.conflictPostures ?? []} placeholder="Select posture…" disabled={saving} loading={optionsLoading} />
                  </Field>
                  <Field label="Apology Language" half>
                    <SelectField value={apologyLanguageId} onChange={setApologyLanguageId} options={options?.apologyLanguages ?? []} placeholder="Select language…" disabled={saving} loading={optionsLoading} />
                  </Field>
                </div>

                <Field label={`Strengths (${selectedStrengthIds.length}/5 selected)`}>
                  {optionsLoading ? (
                    <p className="text-xs text-slate-400 py-2">Loading strengths…</p>
                  ) : (options?.strengths.length ?? 0) > 0 ? (
                    <div>
                      <input
                        className={`${inputCls} mb-2`}
                        placeholder="Filter strengths…"
                        value={strengthSearch}
                        onChange={(e) => setStrengthSearch(e.target.value)}
                      />
                      <div className="border border-slate-200 rounded-md divide-y divide-slate-100 max-h-48 overflow-y-auto">
                        {(options?.strengths ?? [])
                          .filter((s) => !strengthSearch || s.name.toLowerCase().includes(strengthSearch.toLowerCase()))
                          .map((s) => {
                            const checked = selectedStrengthIds.includes(s.id)
                            const atLimit = !checked && selectedStrengthIds.length >= 5
                            return (
                              <label
                                key={s.id}
                                className={`flex items-center gap-2.5 px-3 py-2 text-sm select-none ${atLimit ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer hover:bg-slate-50'}`}
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  disabled={atLimit || saving}
                                  onChange={() => toggleStrength(s.id)}
                                  className="rounded border-slate-300"
                                />
                                {s.name}
                              </label>
                            )
                          })}
                      </div>
                      {selectedStrengthIds.length >= 5 && (
                        <p className="text-xs text-amber-600 mt-1.5">Maximum of 5 strengths selected.</p>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 italic py-2">No strengths data available.</p>
                  )}
                </Field>
              </Section>

            </div>

            {/* Footer */}
            <div className="flex items-center gap-3 px-6 py-4 border-t border-slate-100 flex-shrink-0">
              <div className="mr-auto min-w-0">
                {saved && <p className="text-xs font-medium text-emerald-600">Profile updated ✓</p>}
                {errorMsg && <p className="text-xs font-medium text-rose-600 line-clamp-2">{errorMsg}</p>}
              </div>
              <button onClick={() => setOpen(false)} disabled={saving} className="px-4 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors text-slate-600 disabled:opacity-50">
                Cancel
              </button>
              <button onClick={handleSave} disabled={saving} className="px-4 py-2 text-sm bg-[hsl(213,70%,30%)] text-white rounded-lg hover:bg-[hsl(213,70%,25%)] disabled:opacity-50 transition-colors font-medium min-w-[130px]">
                {saveStatus === 'uploading' ? 'Uploading photo…' : saveStatus === 'saving' ? 'Saving profile…' : 'Save Changes'}
              </button>
            </div>

          </div>
        </div>
      )}
    </>
  )
}
