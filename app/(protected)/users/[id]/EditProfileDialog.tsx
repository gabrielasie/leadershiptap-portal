'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { updateProfileAction } from './actions'
import type { UserProfileFields } from '@/lib/airtable/users'

interface Props {
  userId: string
  initialValues: {
    preferredName: string
    quickNotes: string
    familyDetails: string
    timeAtCompany: string
    title: string
  }
  readOnly: {
    fullName: string
    email: string
    startDate: string
    enneagramType: string
    enneagramDescriptor: string
    mbtiType: string
    mbtiDescriptor: string
    conflictPostureDescriptor: string
    apologyLanguageDescriptor: string
  }
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mt-5 mb-3 first:mt-0">
      {children}
    </p>
  )
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="text-sm text-slate-700 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 min-h-[36px]">
        {value || <span className="text-slate-300 italic">—</span>}
      </p>
    </div>
  )
}

export default function EditProfileDialog({ userId, initialValues, readOnly }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [errorMsg, setErrorMsg] = useState('')

  const [preferredName, setPreferredName] = useState(initialValues.preferredName)
  const [quickNotes, setQuickNotes] = useState(initialValues.quickNotes)
  const [familyDetails, setFamilyDetails] = useState(initialValues.familyDetails)
  const [timeAtCompany, setTimeAtCompany] = useState(initialValues.timeAtCompany)
  const [title, setTitle] = useState(initialValues.title)

  function handleOpenChange(next: boolean) {
    if (next) {
      setPreferredName(initialValues.preferredName)
      setQuickNotes(initialValues.quickNotes)
      setFamilyDetails(initialValues.familyDetails)
      setTimeAtCompany(initialValues.timeAtCompany)
      setTitle(initialValues.title)
      setErrorMsg('')
    }
    setOpen(next)
  }

  function handleSave() {
    setErrorMsg('')

    const changed: UserProfileFields = {}
    if (preferredName !== initialValues.preferredName) changed['Preferred Name'] = preferredName
    if (quickNotes !== initialValues.quickNotes) changed['Quick Notes'] = quickNotes
    if (familyDetails !== initialValues.familyDetails) changed['Family Details'] = familyDetails
    if (timeAtCompany !== initialValues.timeAtCompany) changed['Time at Company'] = timeAtCompany
    if (title !== initialValues.title) changed['Title'] = title

    if (Object.keys(changed).length === 0) {
      setOpen(false)
      return
    }

    startTransition(async () => {
      const result = await updateProfileAction(userId, changed)
      if ('error' in result) {
        setErrorMsg(result.error)
        return
      }
      setOpen(false)
      router.refresh()
    })
  }

  // Build personality display strings
  const enneagramDisplay = [readOnly.enneagramType, readOnly.enneagramDescriptor]
    .filter(Boolean).join(' · ') || ''
  const mbtiDisplay = [readOnly.mbtiType, readOnly.mbtiDescriptor]
    .filter(Boolean).join(' · ') || ''

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <button className="text-xs font-medium text-[hsl(213,70%,30%)] hover:underline">
          Edit Profile
        </button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-lg flex flex-col max-h-[90vh]">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>Edit Profile</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-1 -mr-1">
          {/* ── Basic Info (read-only) ──────────────────────────────── */}
          <SectionLabel>Basic Info</SectionLabel>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <ReadOnlyField label="Full Name" value={readOnly.fullName} />
            <ReadOnlyField label="Email" value={readOnly.email} />
            {readOnly.startDate && (
              <ReadOnlyField label="Start Date" value={readOnly.startDate} />
            )}
          </div>

          {/* ── Coaching Context (editable) ────────────────────────── */}
          <SectionLabel>Coaching Context</SectionLabel>
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="preferredName">Preferred Name</Label>
                <Input
                  id="preferredName"
                  value={preferredName}
                  onChange={(e) => setPreferredName(e.target.value)}
                  placeholder="e.g. Alex"
                  disabled={isPending}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Senior Manager"
                  disabled={isPending}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="timeAtCompany">Time at Company</Label>
              <Input
                id="timeAtCompany"
                value={timeAtCompany}
                onChange={(e) => setTimeAtCompany(e.target.value)}
                placeholder="e.g. 3 years"
                disabled={isPending}
              />
            </div>
          </div>

          {/* ── Personal Context (editable) ────────────────────────── */}
          <SectionLabel>Personal Context</SectionLabel>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="quickNotes">Quick Context</Label>
              <Textarea
                id="quickNotes"
                value={quickNotes}
                onChange={(e) => setQuickNotes(e.target.value)}
                placeholder="Short context notes about this client…"
                rows={3}
                disabled={isPending}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="familyDetails">Family Details</Label>
              <Textarea
                id="familyDetails"
                value={familyDetails}
                onChange={(e) => setFamilyDetails(e.target.value)}
                placeholder="Family context relevant to coaching…"
                rows={3}
                disabled={isPending}
              />
            </div>
          </div>

          {/* ── Personality (read-only) ────────────────────────────── */}
          {(enneagramDisplay || mbtiDisplay || readOnly.conflictPostureDescriptor || readOnly.apologyLanguageDescriptor) && (
            <>
              <SectionLabel>Personality</SectionLabel>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {enneagramDisplay && (
                  <ReadOnlyField label="Enneagram" value={enneagramDisplay} />
                )}
                {mbtiDisplay && (
                  <ReadOnlyField label="MBTI" value={mbtiDisplay} />
                )}
                {readOnly.conflictPostureDescriptor && (
                  <ReadOnlyField label="Conflict Posture" value={readOnly.conflictPostureDescriptor} />
                )}
                {readOnly.apologyLanguageDescriptor && (
                  <ReadOnlyField label="Apology Language" value={readOnly.apologyLanguageDescriptor} />
                )}
              </div>
              <p className="text-xs text-slate-400 mt-2">Updated directly in Airtable.</p>
            </>
          )}

          <div className="pb-2" />
        </div>

        <DialogFooter className="flex-shrink-0 border-t border-slate-100 pt-4 mt-2">
          {errorMsg && (
            <p className="text-xs font-medium text-rose-600 mr-auto self-center">{errorMsg}</p>
          )}
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isPending}>
            {isPending ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
