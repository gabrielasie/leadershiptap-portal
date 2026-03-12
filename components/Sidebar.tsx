'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Users } from 'lucide-react'
import { UserButton } from '@clerk/nextjs'

export default function Sidebar() {
  const pathname = usePathname()

  const isActive = (href: string) => pathname.startsWith(href)

  return (
    <div className="fixed inset-y-0 left-0 w-60 bg-white border-r border-gray-200 shadow-sm flex flex-col z-40">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-gray-100">
        <Link href="/users" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
            L
          </div>
          <span className="font-bold text-gray-900 text-sm">LeadershipTap</span>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        <Link
          href="/users"
          className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
            isActive('/users')
              ? 'bg-indigo-50 text-indigo-700 font-medium'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <Users className="h-4 w-4 flex-shrink-0" />
          Users
        </Link>
      </nav>

      {/* Bottom: User button */}
      <div className="px-3 py-4 border-t border-gray-100">
        <div className="flex items-center gap-2 px-3 py-2">
          <UserButton />
        </div>
      </div>
    </div>
  )
}
