import type { User } from '@/lib/types'
import { formatEastern } from '@/lib/utils/dateFormat'

export function getDisplayName(user: User): string {
  if (user.fullName) return user.fullName
  if (user.firstName || user.lastName)
    return [user.firstName, user.lastName].filter(Boolean).join(' ')
  return user.preferredName ?? user.email
}

export function getInitials(user: User): string {
  const first = user.firstName ?? user.fullName?.split(' ')[0] ?? ''
  const last = user.lastName ?? user.fullName?.split(' ').slice(-1)[0] ?? ''
  return `${first[0] ?? ''}${last[0] ?? ''}`.toUpperCase() || user.email[0].toUpperCase()
}

export function formatMeetingDate(iso: string, timezone: string = 'America/New_York'): string {
  return formatEastern(iso, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }, timezone).replace(',', '').replace(/(\d{4}),/, '$1 at') + ' ET'
}

export function formatMessageDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function formatMeetingDay(iso: string, timezone: string = 'America/New_York'): { weekday: string; day: number; month: string; time: string } {
  return {
    weekday: formatEastern(iso, { weekday: 'short' }, timezone),
    day: parseInt(formatEastern(iso, { day: 'numeric' }, timezone), 10),
    month: formatEastern(iso, { month: 'short' }, timezone),
    time: formatEastern(iso, { hour: 'numeric', minute: '2-digit', hour12: true }, timezone) + ' ET',
  }
}

export function relativeDays(iso: string): string {
  const now = new Date()
  const target = new Date(iso)
  const nowDay = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
  const targetDay = Date.UTC(target.getFullYear(), target.getMonth(), target.getDate())
  const diff = Math.round((targetDay - nowDay) / 86_400_000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  if (diff === -1) return 'Yesterday'
  if (diff > 0) return `In ${diff} days`
  return `${-diff} days ago`
}

export function SectionHeading({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <Icon className="h-5 w-5 text-slate-400" />
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
    </div>
  )
}

// Server-safe expandable descriptor using native <details>/<summary>
export function DescriptorText({ text, maxChars = 200 }: { text: string; maxChars?: number }) {
  if (text.length <= maxChars) {
    return <p className="text-sm text-slate-600 leading-relaxed mt-1">{text}</p>
  }
  return (
    <details className="mt-1 group">
      <summary className="list-none cursor-pointer">
        <p className="text-sm text-slate-600 leading-relaxed inline">
          {text.slice(0, maxChars)}…{' '}
        </p>
        <span className="text-xs text-[hsl(213,70%,30%)] group-open:hidden">read more</span>
      </summary>
      <p className="text-sm text-slate-600 leading-relaxed mt-1">{text}</p>
    </details>
  )
}

// Never show raw Airtable record IDs to the user
export function isRecordId(v: string) {
  return /^rec[A-Za-z0-9]{8,}$/.test(v)
}

// Returns true only if the field has at least one line of real content
export function hasRealContent(val: string | undefined): boolean {
  if (!val || !val.trim()) return false
  return val.split('\n').some((line) => {
    const t = line.trim()
    if (!t || t === '?') return false
    if (/^[^:]{1,30}:\s*\??$/.test(t)) return false
    return true
  })
}
