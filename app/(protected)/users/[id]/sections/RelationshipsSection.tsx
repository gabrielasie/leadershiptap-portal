import Link from 'next/link'
import { Network, UserCheck, Users as UsersIcon, ChevronRight, Pencil } from 'lucide-react'
import RelationshipDialog from '../RelationshipDialog'
import { SectionHeading } from './helpers'
import type { RelationshipContext } from '@/lib/airtable/relationships'

interface Person {
  id: string
  name: string
}

interface Props {
  subjectPersonId: string
  subjectName: string
  /** All RCs touching this person (where they're Person OR Lead). */
  relationships: RelationshipContext[]
  /** Pool of every user — passed to the Add dialog so the picker is populated. */
  allPeople: Person[]
  /** True for direct coach + admins. Controls whether Add/Edit buttons render. */
  canEdit: boolean
}

interface BucketItem {
  rc: RelationshipContext
  otherPersonId: string
  otherName: string
  role: 'coach' | 'coachee' | 'manager' | 'report'
}

function classifyRelationship(rc: RelationshipContext, subjectId: string): BucketItem | null {
  const subjectIsPerson = rc.personId === subjectId
  const otherPersonId = subjectIsPerson ? rc.leadId : rc.personId
  const otherName = subjectIsPerson ? rc.leadName : rc.personName

  if (rc.relationshipType === 'coaching') {
    return {
      rc,
      otherPersonId,
      otherName,
      role: subjectIsPerson ? 'coach' : 'coachee',
    }
  }
  if (rc.relationshipType === 'reports_to') {
    return {
      rc,
      otherPersonId,
      otherName,
      role: subjectIsPerson ? 'manager' : 'report',
    }
  }
  return null
}

function RelationshipPill({
  item,
  subjectPersonId,
  subjectName,
  canEdit,
}: {
  item: BucketItem
  subjectPersonId: string
  subjectName: string
  canEdit: boolean
}) {
  const initials = item.otherName
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  const isInactive = item.rc.status && item.rc.status !== 'Active'

  return (
    <div
      className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
        isInactive
          ? 'border-slate-100 bg-slate-50 opacity-70'
          : 'border-slate-200 bg-white hover:border-slate-300'
      }`}
    >
      <Link
        href={`/users/${item.otherPersonId}`}
        className="flex items-center gap-3 flex-1 min-w-0 group"
      >
        <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-xs font-semibold flex-shrink-0">
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-slate-900 truncate group-hover:text-[hsl(213,70%,30%)]">
            {item.otherName}
          </p>
          {isInactive && (
            <p className="text-xs text-slate-400">{item.rc.status}</p>
          )}
        </div>
      </Link>
      {canEdit && (
        <RelationshipDialog
          mode="edit"
          rcId={item.rc.id}
          subjectPersonId={subjectPersonId}
          subjectName={subjectName}
          otherPersonId={item.otherPersonId}
          otherName={item.otherName}
          initialRole={item.role}
          initialStartDate={item.rc.startDate}
          initialStatus={item.rc.status as 'Active' | 'Inactive' | 'Paused' | 'Ended'}
          trigger={
            <button
              className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              aria-label="Edit relationship"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          }
        />
      )}
    </div>
  )
}

function RelationshipGroup({
  label,
  icon: Icon,
  items,
  subjectPersonId,
  subjectName,
  canEdit,
  emptyText,
}: {
  label: string
  icon: React.ElementType
  items: BucketItem[]
  subjectPersonId: string
  subjectName: string
  canEdit: boolean
  emptyText: string
}) {
  if (items.length === 0) {
    return (
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2 flex items-center gap-1.5">
          <Icon className="h-3.5 w-3.5" />
          {label}
        </p>
        <p className="text-sm text-slate-300 italic">{emptyText}</p>
      </div>
    )
  }
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2 flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5" />
        {label}
        <span className="ml-1 text-slate-300 font-normal">{items.length}</span>
      </p>
      <div className="space-y-1.5">
        {items.map((item) => (
          <RelationshipPill
            key={item.rc.id}
            item={item}
            subjectPersonId={subjectPersonId}
            subjectName={subjectName}
            canEdit={canEdit}
          />
        ))}
      </div>
    </div>
  )
}

export default function RelationshipsSection({
  subjectPersonId,
  subjectName,
  relationships,
  allPeople,
  canEdit,
}: Props) {
  // Bucket the RCs by role from the subject's perspective.
  const classified = relationships
    .map((rc) => classifyRelationship(rc, subjectPersonId))
    .filter((b): b is BucketItem => b !== null)

  const coaches = classified.filter((b) => b.role === 'coach')
  const coachees = classified.filter((b) => b.role === 'coachee')
  const managers = classified.filter((b) => b.role === 'manager')
  const reports = classified.filter((b) => b.role === 'report')

  return (
    <div className="bg-white rounded-xl shadow-sm p-4 md:p-6">
      <div className="flex items-center justify-between gap-2 mb-5">
        <div className="flex items-center gap-2">
          <Network className="h-5 w-5 text-slate-400" />
          <h2 className="text-lg font-semibold text-slate-900">Relationships</h2>
        </div>
        {canEdit && (
          <RelationshipDialog
            mode="add"
            subjectPersonId={subjectPersonId}
            subjectName={subjectName}
            people={allPeople}
          />
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5">
        <RelationshipGroup
          label="Coaches"
          icon={UserCheck}
          items={coaches}
          subjectPersonId={subjectPersonId}
          subjectName={subjectName}
          canEdit={canEdit}
          emptyText="No coaches"
        />
        <RelationshipGroup
          label="Coachees"
          icon={UserCheck}
          items={coachees}
          subjectPersonId={subjectPersonId}
          subjectName={subjectName}
          canEdit={canEdit}
          emptyText={subjectName.endsWith('s') ? `${subjectName}' coachees will appear here` : `${subjectName}'s coachees will appear here`}
        />
        <RelationshipGroup
          label="Reports to"
          icon={ChevronRight}
          items={managers}
          subjectPersonId={subjectPersonId}
          subjectName={subjectName}
          canEdit={canEdit}
          emptyText="No manager set"
        />
        <RelationshipGroup
          label="Direct reports"
          icon={UsersIcon}
          items={reports}
          subjectPersonId={subjectPersonId}
          subjectName={subjectName}
          canEdit={canEdit}
          emptyText="No direct reports"
        />
      </div>
    </div>
  )
}
