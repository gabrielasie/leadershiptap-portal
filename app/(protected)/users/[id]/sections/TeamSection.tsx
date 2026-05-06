import Link from 'next/link'
import { Network, ChevronRight } from 'lucide-react'
import AddTeamMemberDialog from '../AddTeamMemberDialog'
import { getDisplayName, getInitials } from './helpers'
import type { User } from '@/lib/types'
import type { DirectReport } from '@/lib/airtable/relationships'

function OrgPersonLink({ user }: { user: User }) {
  return (
    <Link
      href={`/users/${user.id}`}
      className="flex items-center gap-3 p-3 rounded-lg border border-slate-100 hover:border-slate-200 hover:bg-slate-50 transition-colors group"
    >
      {(user.profilePhoto ?? user.avatarUrl) ? (
        <img
          src={(user.profilePhoto ?? user.avatarUrl)!}
          alt={getDisplayName(user)}
          className="w-8 h-8 rounded-full object-cover flex-shrink-0"
        />
      ) : (
        <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center text-xs font-semibold flex-shrink-0 select-none">
          {getInitials(user)}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-slate-900 truncate">{getDisplayName(user)}</p>
        {(user.title ?? user.jobTitle) && (
          <p className="text-xs text-slate-400 truncate">{user.title ?? user.jobTitle}</p>
        )}
      </div>
      <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-slate-500 flex-shrink-0 transition-colors" />
    </Link>
  )
}

interface Props {
  userId: string
  manager: User | null
  directReports: DirectReport[]
  teamMembers: User[]
  teamMemberIdList: string[]
  userCanWrite: boolean
}

export default function TeamSection({
  userId,
  manager,
  directReports,
  teamMembers,
  teamMemberIdList,
  userCanWrite,
}: Props) {
  const hasManager = !!manager
  const hasDirectReports = directReports.length > 0
  const hasTeamMembers = teamMembers.length > 0
  const hasAnyTeam = hasManager || hasDirectReports || hasTeamMembers

  // Hide the entire section for read-only users with nothing to show.
  if (!hasAnyTeam && !userCanWrite) return null

  return (
    <div className="bg-white rounded-xl shadow-sm p-4 md:p-6">
      <div className="flex items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2">
          <Network className="h-5 w-5 text-slate-400" />
          <h2 className="text-lg font-semibold text-slate-900">Team</h2>
        </div>
        {userCanWrite && (
          <AddTeamMemberDialog
            leaderId={userId}
            existingMemberIds={teamMemberIdList}
          />
        )}
      </div>

      {!hasAnyTeam ? (
        <p className="text-sm text-slate-400">
          No team relationships yet. Use Add Team Member above, or capture a Reports To
          relationship via the New Person flow.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">

          {hasManager && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
                Manager
              </p>
              <OrgPersonLink user={manager} />
            </div>
          )}

          {hasDirectReports && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
                Direct Reports
              </p>
              <p className="text-sm text-slate-600">
                {directReports.length} direct report{directReports.length !== 1 ? 's' : ''}{' '}
                <a href="#their-team" className="text-[hsl(213,70%,30%)] hover:underline text-xs font-medium">
                  View below
                </a>
              </p>
            </div>
          )}

          {hasTeamMembers && (
            <div className="sm:col-span-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
                Team Members ({teamMembers.length})
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {teamMembers.map((member) => (
                  <OrgPersonLink key={member.id} user={member} />
                ))}
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  )
}
