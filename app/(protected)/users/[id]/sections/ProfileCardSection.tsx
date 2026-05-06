import { Mail, Clock, UserCheck } from 'lucide-react'
import EditProfileDialog from '../EditProfileDialog'
import { getDisplayName, getInitials, isRecordId } from './helpers'
import type { User } from '@/lib/types'
import type { CoachPersonContext } from '@/lib/airtable/coachPersonContext'

interface Props {
  user: User
  name: string
  initials: string
  contactEmail: string
  displayTitle?: string
  showPreferredName: boolean
  badges: Array<{ label: string; className: string }>
  coach: User | null
  teamLead: User | null
  coachContext: CoachPersonContext | null
  userCanWrite: boolean
}

export default function ProfileCardSection({
  user,
  name,
  initials,
  contactEmail,
  displayTitle,
  showPreferredName,
  badges,
  coach,
  teamLead,
  coachContext,
  userCanWrite,
}: Props) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-4 md:p-6">
      {userCanWrite && (
        <div className="flex items-start justify-between gap-2 mb-4 sm:mb-0">
          <span />
          <div className="flex items-center gap-3">
            <EditProfileDialog user={user} coachContext={coachContext} />
          </div>
        </div>
      )}
      <div className="flex flex-col sm:flex-row items-start gap-4 sm:gap-5">
        {(user.profilePhoto ?? user.avatarUrl) ? (
          <img
            src={(user.profilePhoto ?? user.avatarUrl)!}
            alt={name}
            className="w-16 h-16 rounded-full object-cover flex-shrink-0"
          />
        ) : (
          <div className="w-16 h-16 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center text-2xl font-bold flex-shrink-0 select-none">
            {initials}
          </div>
        )}

        <div className="min-w-0 flex-1">
          <h1
            className="text-2xl font-bold text-slate-900 leading-tight"
            style={{ fontFamily: 'var(--font-plus-jakarta-sans)' }}
          >
            {name}
          </h1>
          {showPreferredName && (
            <p className="text-sm text-slate-400 mt-0.5">Goes by &ldquo;{user.preferredName}&rdquo;</p>
          )}
          {displayTitle && (
            <p className="text-base text-slate-500 mt-0.5">{displayTitle}</p>
          )}
          {user.companyName && (
            <p className="text-sm text-slate-400 mt-0.5">{user.companyName}</p>
          )}
          {contactEmail && (
            <p className="flex items-center gap-1.5 text-sm text-slate-400 mt-1">
              <Mail className="h-3.5 w-3.5 flex-shrink-0" />
              {contactEmail}
            </p>
          )}

          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1.5">
            {user.timeAtCompany && (
              <span className="flex items-center gap-1.5 text-xs text-slate-500">
                <Clock className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                {user.timeAtCompany}
              </span>
            )}
            {coach && (
              <span className="flex items-center gap-1.5 text-xs text-slate-500">
                <UserCheck className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                Coach: {getDisplayName(coach)}
              </span>
            )}
            {teamLead && (
              <span className="flex items-center gap-1.5 text-xs text-slate-500">
                <UserCheck className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                Team Lead: {getDisplayName(teamLead)}
              </span>
            )}
          </div>
        </div>
      </div>

      {badges.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-5 pt-5 border-t border-slate-100">
          {badges.map((b) => (
            <span key={b.label} className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${b.className}`}>
              {b.label}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
