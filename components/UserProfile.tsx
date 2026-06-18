import Link from 'next/link'
import type { User } from '@/lib/types'

function displayName(user: User): string {
  if (user.fullName) return user.fullName
  if (user.firstName || user.lastName)
    return [user.firstName, user.lastName].filter(Boolean).join(' ')
  return user.preferredName ?? user.email
}

const AVATAR_COLORS = [
  'bg-indigo-500',
  'bg-violet-500',
  'bg-sky-500',
  'bg-emerald-500',
  'bg-amber-500',
  'bg-rose-500',
  'bg-teal-500',
  'bg-orange-500',
]

function avatarColor(user: User): string {
  const name = displayName(user)
  const idx = name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % AVATAR_COLORS.length
  return AVATAR_COLORS[idx]
}

function initials(user: User): string {
  const first = user.firstName ?? user.fullName?.split(' ')[0] ?? ''
  const last = user.lastName ?? user.fullName?.split(' ').slice(-1)[0] ?? ''
  return `${first[0] ?? ''}${last[0] ?? ''}`.toUpperCase() || user.email[0].toUpperCase()
}

interface UserProfileProps {
  user: User
}

export default function UserProfile({ user }: UserProfileProps) {
  const name = displayName(user)
  const contactEmail = user.workEmail ?? user.email
  const color = avatarColor(user)
  const initStr = initials(user)

  return (
    <div>
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link href="/users" className="hover:text-gray-700 transition-colors">
          Users
        </Link>
        <span>/</span>
        <span className="text-gray-900">{name}</span>
      </nav>

      {/* Profile header card */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <div className="flex items-start gap-5">
          {/* Large avatar */}
          <div
            className={`w-20 h-20 rounded-full flex items-center justify-center text-white text-2xl font-bold flex-shrink-0 ${color}`}
          >
            {initStr}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'var(--font-plus-jakarta-sans)' }}>{name}</h1>
            {user.jobTitle && (
              <p className="text-gray-500 mt-0.5">{user.jobTitle}</p>
            )}
            <div className="flex items-center gap-4 mt-2 text-sm text-gray-500 flex-wrap">
              {user.companyName && <span>{user.companyName}</span>}
              <span>{contactEmail}</span>
            </div>
            {(user.enneagram || user.mbti) && (
              <div className="flex gap-2 mt-3 flex-wrap">
                {user.enneagram && (
                  <span className="px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-xs font-medium">
                    Enneagram {user.enneagram}
                  </span>
                )}
                {user.mbti && (
                  <span className="px-2.5 py-0.5 rounded-full bg-violet-50 text-violet-700 text-xs font-medium">
                    {user.mbti}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
