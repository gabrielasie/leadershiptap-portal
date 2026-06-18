'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Plus } from 'lucide-react'
import {
  addRelationshipAction,
  updateRelationshipAction,
  deleteRelationshipAction,
} from './actions'

export type RelationshipRole = 'coach' | 'coachee' | 'manager' | 'report'

interface Person {
  id: string
  name: string
}

interface AddProps {
  mode: 'add'
  subjectPersonId: string
  subjectName: string
  people: Person[]                  // pool to pick from
  trigger?: React.ReactNode
}

interface EditProps {
  mode: 'edit'
  rcId: string
  subjectPersonId: string
  subjectName: string
  otherPersonId: string   // needed so we can swap Person/Lead when role changes
  otherName: string
  initialRole: RelationshipRole
  initialStartDate?: string
  initialStatus?: 'Active' | 'Inactive' | 'Paused' | 'Ended'
  trigger?: React.ReactNode
}

type Props = AddProps | EditProps

// ── role helpers ──────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<RelationshipRole, string> = {
  coach: 'Coach (someone coaches the subject)',
  coachee: 'Coachee (subject coaches them)',
  manager: 'Manager (subject reports to them)',
  report: 'Direct Report (they report to subject)',
}

function roleToTypeAndDirection(role: RelationshipRole): {
  type: 'coaching' | 'reports_to'
  subjectIs: 'person' | 'lead'
} {
  switch (role) {
    case 'coach':
      return { type: 'coaching', subjectIs: 'person' }
    case 'coachee':
      return { type: 'coaching', subjectIs: 'lead' }
    case 'manager':
      return { type: 'reports_to', subjectIs: 'person' }
    case 'report':
      return { type: 'reports_to', subjectIs: 'lead' }
  }
}

// ── component ─────────────────────────────────────────────────────────────────

export default function RelationshipDialog(props: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form state — initialized per mode
  const [otherPersonId, setOtherPersonId] = useState<string>('')
  const [role, setRole] = useState<RelationshipRole>(
    props.mode === 'edit' ? props.initialRole : 'coachee',
  )
  const [startDate, setStartDate] = useState<string>(
    props.mode === 'edit' ? (props.initialStartDate ?? '') : '',
  )
  const [status, setStatus] = useState<'Active' | 'Inactive' | 'Paused' | 'Ended'>(
    props.mode === 'edit' ? (props.initialStatus ?? 'Active') : 'Active',
  )

  function handleOpen() {
    if (props.mode === 'add') {
      setOtherPersonId('')
      setRole('coachee')
      setStartDate('')
      setStatus('Active')
    } else {
      setRole(props.initialRole)
      setStartDate(props.initialStartDate ?? '')
      setStatus(props.initialStatus ?? 'Active')
    }
    setError(null)
    setOpen(true)
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      if (props.mode === 'add') {
        if (!otherPersonId) {
          setError('Pick a person.')
          setSaving(false)
          return
        }
        const { type, subjectIs } = roleToTypeAndDirection(role)
        const result = await addRelationshipAction({
          subjectPersonId: props.subjectPersonId,
          otherPersonId,
          type,
          role: subjectIs === 'person' ? 'subject_is_person' : 'subject_is_lead',
          startDate: startDate || undefined,
        })
        if (!result.success) {
          setError(result.error ?? 'Failed to add relationship.')
          setSaving(false)
          return
        }
        toast.success('Relationship added')
      } else {
        // Recompute Person/Lead from the new role so direction changes
        // (e.g. coachee → coach, manager → report) actually move the pill
        // into the right bucket on the profile. Patching `type` alone won't
        // do it because both ends of each pair share the same type.
        const { type, subjectIs } = roleToTypeAndDirection(role)
        const personId =
          subjectIs === 'person' ? props.subjectPersonId : props.otherPersonId
        const leadId =
          subjectIs === 'person' ? props.otherPersonId : props.subjectPersonId
        const result = await updateRelationshipAction({
          rcId: props.rcId,
          subjectPersonId: props.subjectPersonId,
          fields: {
            type,
            status,
            startDate: startDate || null,
            personId,
            leadId,
          },
        })
        if (!result.success) {
          setError(result.error ?? 'Failed to update relationship.')
          setSaving(false)
          return
        }
        toast.success('Relationship updated')
      }
      setOpen(false)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (props.mode !== 'edit') return
    if (!confirm('Remove this relationship? Notes and meetings already linked to it stay; only the relationship row is removed.')) return
    setSaving(true)
    try {
      const result = await deleteRelationshipAction({
        rcId: props.rcId,
        subjectPersonId: props.subjectPersonId,
      })
      if (!result.success) {
        setError(result.error ?? 'Failed to remove.')
        setSaving(false)
        return
      }
      toast.success('Relationship removed')
      setOpen(false)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  const triggerEl = props.trigger ?? (
    <Button variant="outline" size="sm" onClick={handleOpen}>
      <Plus className="h-4 w-4" />
      Add Relationship
    </Button>
  )

  return (
    <>
      {props.trigger ? (
        <span onClick={handleOpen}>{props.trigger}</span>
      ) : (
        triggerEl
      )}

      <Dialog open={open} onOpenChange={(v) => { if (!v && !saving) setOpen(false) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {props.mode === 'add' ? 'Add Relationship' : 'Edit Relationship'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Person picker (add mode only) */}
            {props.mode === 'add' ? (
              <div className="space-y-1.5">
                <Label htmlFor="rel-person">
                  Other person <span className="text-destructive">*</span>
                </Label>
                <Select value={otherPersonId} onValueChange={setOtherPersonId} disabled={saving}>
                  <SelectTrigger id="rel-person">
                    <SelectValue placeholder="Select a person…" />
                  </SelectTrigger>
                  <SelectContent>
                    {props.people
                      .filter((p) => p.id !== props.subjectPersonId)
                      .map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label>Other person</Label>
                <p className="text-sm font-medium text-slate-700">{props.otherName}</p>
              </div>
            )}

            {/* Role */}
            <div className="space-y-1.5">
              <Label htmlFor="rel-role">Relationship</Label>
              <Select value={role} onValueChange={(v) => setRole(v as RelationshipRole)} disabled={saving}>
                <SelectTrigger id="rel-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="coach">{ROLE_LABELS.coach}</SelectItem>
                  <SelectItem value="coachee">{ROLE_LABELS.coachee}</SelectItem>
                  <SelectItem value="manager">{ROLE_LABELS.manager}</SelectItem>
                  <SelectItem value="report">{ROLE_LABELS.report}</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-400">
                {role === 'coach' && `Someone coaches ${props.subjectName}.`}
                {role === 'coachee' && `${props.subjectName} coaches this person.`}
                {role === 'manager' && `${props.subjectName} reports to this person.`}
                {role === 'report' && `This person reports to ${props.subjectName}.`}
              </p>
            </div>

            {/* Status (edit mode only) */}
            {props.mode === 'edit' && (
              <div className="space-y-1.5">
                <Label htmlFor="rel-status">Status</Label>
                <Select
                  value={status}
                  onValueChange={(v) => setStatus(v as 'Active' | 'Inactive' | 'Paused' | 'Ended')}
                  disabled={saving}
                >
                  <SelectTrigger id="rel-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Paused">Paused</SelectItem>
                    <SelectItem value="Inactive">Inactive</SelectItem>
                    <SelectItem value="Ended">Ended</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Start date */}
            <div className="space-y-1.5">
              <Label htmlFor="rel-start">Start date</Label>
              <Input
                id="rel-start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                disabled={saving}
              />
            </div>
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}

          <DialogFooter className="gap-2 sm:gap-0">
            {props.mode === 'edit' && (
              <Button variant="outline" onClick={handleDelete} disabled={saving} className="mr-auto text-rose-600 hover:text-rose-700">
                Remove
              </Button>
            )}
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : props.mode === 'add' ? 'Add' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
