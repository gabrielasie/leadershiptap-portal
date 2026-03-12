'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Search, Users } from 'lucide-react'
import type { User } from '@/lib/types'

function displayName(user: User): string {
  if (user.fullName) return user.fullName
  if (user.firstName || user.lastName)
    return [user.firstName, user.lastName].filter(Boolean).join(' ')
  if (user.preferredName) return user.preferredName
  return user.email
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

interface UsersListProps {
  users: User[]
}

export default function UsersList({ users }: UsersListProps) {
  const [query, setQuery] = useState('')

  const filtered = query.trim()
    ? users.filter((u) => {
        const q = query.toLowerCase()
        return (
          displayName(u).toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          (u.companyName ?? '').toLowerCase().includes(q)
        )
      })
    : users

  return (
    <div>
      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search by name, company, or email…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search users"
          className="pl-9 pr-4 py-2 w-full max-w-sm rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        />
      </div>

      {/* Grid or empty state */}
      {filtered.length === 0 ? (
        <div className="mt-16 flex flex-col items-center justify-center text-center">
          <Users className="h-12 w-12 text-gray-300 mb-3" />
          <p className="text-gray-500 text-sm font-medium">
            {query ? `No users match "${query}"` : 'No users found'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
          {filtered.map((user) => (
            <Link key={user.id} href={`/users/${user.id}`} className="block group">
              <div className="bg-white rounded-xl border border-gray-200 p-5 hover:border-indigo-300 hover:shadow-md transition-all duration-200">
                <div className="flex items-start gap-4">
                  {/* Avatar */}
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold text-sm flex-shrink-0 ${avatarColor(user)}`}
                  >
                    {initials(user)}
                  </div>
                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-gray-900 truncate">{displayName(user)}</p>
                    <p className="text-sm text-gray-500 truncate">{user.companyName || '—'}</p>
                    <p className="text-xs text-gray-400 truncate mt-1">{user.email}</p>
                  </div>
                </div>
                <div className="mt-4 flex justify-end">
                  <span className="text-xs text-indigo-600 font-medium group-hover:underline">
                    View Profile →
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Count */}
      <p className="text-sm text-gray-400 mt-6">
        {filtered.length} of {users.length} users
      </p>
    </div>
  )
}
