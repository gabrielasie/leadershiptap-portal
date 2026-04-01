'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import type { User } from '@/lib/types'

function getInitials(user: User): string {
  if (user.firstName && user.lastName) {
    return (user.firstName[0] + user.lastName[0]).toUpperCase()
  }
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
  'bg-rose-100 text-rose-700',
  'bg-cyan-100 text-cyan-700',
]

function avatarColor(id: string): string {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]
}

export default function ClientsGrid({ users }: { users: User[] }) {
  const [query, setQuery] = useState('')

  const filtered = query.trim()
    ? users.filter((u) => {
        const q = query.toLowerCase()
        return (
          (u.fullName ?? '').toLowerCase().includes(q) ||
          (u.companyName ?? '').toLowerCase().includes(q)
        )
      })
    : users

  return (
    <div className="p-4 md:p-8 space-y-6">
      {/* Search */}
      <div className="w-full max-w-sm">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or company..."
          className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-[hsl(213,70%,30%)]/30 focus:border-[hsl(213,70%,30%)]"
        />
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <p className="text-sm text-slate-500">
          {users.length === 0 ? 'No clients yet.' : 'No clients found matching your search.'}
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((user) => (
            <Link
              key={user.id}
              href={`/users/${user.id}`}
              className="flex items-center gap-4 bg-white rounded-lg shadow-sm p-4 hover:shadow-md transition-shadow"
            >
              {/* Avatar */}
              {user.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={user.fullName ?? user.email}
                  className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                />
              ) : (
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0 ${avatarColor(user.id)}`}
                >
                  {getInitials(user)}
                </div>
              )}

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-900 truncate">
                  {user.fullName ?? user.email}
                </p>
                {user.companyName && (
                  <p className="text-sm text-slate-500 truncate">{user.companyName}</p>
                )}
                {(user.jobTitle ?? user.role) && (
                  <p className="text-sm text-slate-400 truncate">{user.jobTitle ?? user.role}</p>
                )}
              </div>

              <ChevronRight className="h-4 w-4 text-slate-300 flex-shrink-0" />
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
