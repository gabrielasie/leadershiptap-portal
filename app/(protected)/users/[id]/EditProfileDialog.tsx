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
}

export default function EditProfileDialog({ userId, initialValues }: Props) {
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
      // Reset to latest saved values each time the dialog opens
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

    // Only send fields that differ from the saved values
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

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <button className="text-xs font-medium text-[hsl(213,70%,30%)] hover:underline">
          Edit Profile
        </button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Profile</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

          <div className="space-y-1.5">
            <Label htmlFor="quickNotes">Quick Notes</Label>
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

          <p className="text-xs text-slate-400">
            Full name, email, personality data, and start date are managed in Airtable.
          </p>
        </div>

        <DialogFooter>
          {errorMsg && (
            <p className="text-xs font-medium text-rose-600 mr-auto self-center">{errorMsg}</p>
          )}
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isPending}
          >
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
