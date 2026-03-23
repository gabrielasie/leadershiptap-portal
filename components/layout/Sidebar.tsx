'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useUser, useClerk } from '@clerk/nextjs'
import { Users, LayoutDashboard, Settings, LogOut } from 'lucide-react'

const navItems = [
  { href: '/users', icon: Users, label: 'Clients', enabled: true },
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', enabled: false },
  { href: '/settings', icon: Settings, label: 'Settings', enabled: false },
]

export default function Sidebar() {
  const pathname = usePathname()
  const { user } = useUser()
  const { signOut } = useClerk()

  return (
    <aside className="hidden md:flex fixed inset-y-0 left-0 w-60 flex-col bg-slate-50 border-r border-slate-200 z-40">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-slate-200">
        <Link href="/users" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-[hsl(213,70%,30%)] flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
            L
          </div>
          <span
            className="font-bold text-[hsl(213,70%,30%)] text-base leading-tight"
            style={{ fontFamily: 'var(--font-plus-jakarta-sans)' }}
          >
            LeadershipTap
          </span>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {navItems.map(({ href, icon: Icon, label, enabled }) => {
          const active = enabled && pathname.startsWith(href)
          if (!enabled) {
            return (
              <div
                key={href}
                className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-400 cursor-not-allowed select-none"
                title="Coming soon"
              >
                <Icon className="h-4 w-4 flex-shrink-0" />
                {label}
              </div>
            )
          }
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                active
                  ? 'bg-[hsl(213,60%,94%)] text-[hsl(213,70%,30%)] font-medium'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Bottom: user + sign out */}
      <div className="px-3 py-4 border-t border-slate-200 space-y-1">
        {user && (
          <div className="flex items-center gap-3 px-3 py-2 rounded-lg">
            {user.imageUrl ? (
              <img
                src={user.imageUrl}
                alt={user.fullName ?? 'User avatar'}
                className="w-7 h-7 rounded-full object-cover flex-shrink-0"
              />
            ) : (
              <div className="w-7 h-7 rounded-full bg-slate-300 flex items-center justify-center text-xs font-medium text-slate-600 flex-shrink-0">
                {(user.fullName ?? user.primaryEmailAddress?.emailAddress ?? '?')[0].toUpperCase()}
              </div>
            )}
            <span className="text-sm text-slate-700 truncate">
              {user.fullName ?? user.primaryEmailAddress?.emailAddress}
            </span>
          </div>
        )}
        <button
          onClick={() => signOut({ redirectUrl: '/sign-in' })}
          className="flex w-full items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors"
        >
          <LogOut className="h-4 w-4 flex-shrink-0" />
          Sign out
        </button>
      </div>
    </aside>
  )
}
