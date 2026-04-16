'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useUser, useClerk } from '@clerk/nextjs'
import { Users, LayoutDashboard, Settings, LogOut } from 'lucide-react'

const navItems = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', enabled: true },
  { href: '/users', icon: Users, label: 'Clients', enabled: true },
  { href: '/settings', icon: Settings, label: 'Settings', enabled: false },
]

export default function Sidebar() {
  const pathname = usePathname()
  const { user } = useUser()
  const { signOut } = useClerk()

  return (
    <>
    {/* ── Mobile bottom navigation bar ── */}
    <nav className="flex md:hidden fixed bottom-0 inset-x-0 z-50 bg-white border-t border-slate-200 h-16">
      <div className="flex w-full items-stretch">
        {navItems.map(({ href, icon: Icon, label, enabled }) => {
          const active = enabled && pathname.startsWith(href)
          if (!enabled) {
            return (
              <div
                key={href}
                className="flex flex-1 flex-col items-center justify-center gap-0.5 text-slate-300 cursor-not-allowed select-none"
                title="Coming soon"
              >
                <Icon className="h-5 w-5" />
                <span className="text-[10px] font-medium">{label}</span>
              </div>
            )
          }
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-1 flex-col items-center justify-center gap-0.5 transition-colors ${
                active
                  ? 'text-[hsl(213,70%,30%)]'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <Icon className="h-5 w-5" />
              <span className="text-[10px] font-medium">{label}</span>
            </Link>
          )
        })}
        <button
          onClick={() => signOut({ redirectUrl: '/sign-in' })}
          className="flex flex-1 flex-col items-center justify-center gap-0.5 text-slate-500 hover:text-slate-900 transition-colors"
        >
          <LogOut className="h-5 w-5" />
          <span className="text-[10px] font-medium">Sign out</span>
        </button>
      </div>
    </nav>

    {/* ── Desktop sidebar ── */}
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
                className="flex items-center gap-3 pl-[9px] pr-3 py-2 min-h-[48px] rounded-lg border-l-[3px] border-transparent text-base text-slate-400 cursor-not-allowed select-none"
                title="Coming soon"
              >
                <Icon className="h-5 w-5 flex-shrink-0" />
                {label}
              </div>
            )
          }
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 pl-[9px] pr-3 py-2 min-h-[48px] rounded-lg border-l-[3px] text-base transition-colors ${
                active
                  ? 'border-[hsl(213,70%,30%)] bg-[hsl(213,60%,94%)] text-[hsl(213,70%,30%)] font-medium'
                  : 'border-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Icon className="h-5 w-5 flex-shrink-0" />
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
          className="flex w-full items-center gap-3 px-3 py-2 min-h-[48px] rounded-lg text-base text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors"
        >
          <LogOut className="h-5 w-5 flex-shrink-0" />
          Sign out
        </button>
      </div>
    </aside>
    </>
  )
}
