'use client'

import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import type { MouseEvent } from 'react'

interface Props {
  /** Where to go if there's no in-app referrer (deep link, new tab, etc.). */
  fallbackHref: string
  /** Label shown next to the arrow. Defaults to "Back". */
  label?: string
  className?: string
}

/**
 * Back navigation that respects browser history.
 *
 * If the previous page was on this site, use router.back() so the user lands
 * where they actually came from (dashboard, sessions explorer, etc.). If they
 * deep-linked into this page or opened it in a new tab, fall back to the
 * provided href.
 */
export default function BackLink({ fallbackHref, label = 'Back', className }: Props) {
  const router = useRouter()

  function handleClick(e: MouseEvent<HTMLAnchorElement>) {
    e.preventDefault()
    if (typeof window === 'undefined') {
      router.push(fallbackHref)
      return
    }
    // Use back() when the previous entry is from this origin AND there's a
    // meaningful history to go back to. Otherwise navigate to the fallback.
    const sameOriginReferrer =
      document.referrer && new URL(document.referrer).origin === window.location.origin
    if (sameOriginReferrer && window.history.length > 1) {
      router.back()
    } else {
      router.push(fallbackHref)
    }
  }

  return (
    <a
      href={fallbackHref}
      onClick={handleClick}
      className={
        className ??
        'inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors'
      }
    >
      <ArrowLeft className="h-4 w-4" />
      {label}
    </a>
  )
}
