'use client'

import { useEffect, useState } from 'react'
import Sidebar from './Sidebar'

const STORAGE_KEY = 'sidebar:collapsed'

/**
 * Wraps the protected app shell so the sidebar can collapse to a 64px rail
 * (icon-only) and the main content reclaims the space.
 *
 * Persistence:
 *   - User preference is stored in localStorage under "sidebar:collapsed".
 *   - On first visit (no stored value) we default to collapsed when the
 *     viewport is below the lg breakpoint (1024px), which makes iPad portrait
 *     (≈768–834px) and small laptops feel less cramped while keeping the full
 *     sidebar on real desktops.
 *
 * Hydration note: the first paint always renders expanded (since localStorage
 * isn't available on the server). The effect below applies the persisted /
 * media-query default in a single layout pass — visible as at most a 1-frame
 * shift on first load. A flash-blocking inline script would be the next step
 * if that becomes objectionable.
 */
export default function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null
    if (stored === '1') {
      setCollapsed(true)
      return
    }
    if (stored === '0') {
      setCollapsed(false)
      return
    }
    // No stored preference — default based on viewport size.
    if (typeof window !== 'undefined' && window.matchMedia('(max-width: 1023px)').matches) {
      setCollapsed(true)
    }
  }, [])

  function toggle() {
    setCollapsed((prev) => {
      const next = !prev
      try {
        localStorage.setItem(STORAGE_KEY, next ? '1' : '0')
      } catch {
        // Storage may be unavailable (Safari private mode, etc.). State still
        // applies for the session.
      }
      return next
    })
  }

  return (
    <div className="flex h-screen">
      <Sidebar collapsed={collapsed} onToggle={toggle} />
      <main
        className={`flex-1 overflow-y-auto overflow-x-hidden bg-slate-100 pb-20 md:pb-0 transition-[margin-left] duration-200 ${
          collapsed ? 'md:ml-16' : 'md:ml-60'
        }`}
      >
        {children}
      </main>
    </div>
  )
}
