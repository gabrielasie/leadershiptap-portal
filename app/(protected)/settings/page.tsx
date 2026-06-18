import { currentUser } from '@clerk/nextjs/server'
import { getCurrentUserRecord } from '@/lib/auth/getCurrentUserRecord'
import ManageAccountButton from './ManageAccountButton'
import SyncCalendarSection from './SyncCalendarSection'

const ROLE_BADGE: Record<string, string> = {
  admin:   'bg-purple-100 text-purple-700',
  coach:   'bg-blue-100 text-blue-700',
  client:  'bg-slate-100 text-slate-600',
  unknown: 'bg-slate-100 text-slate-500',
}

export default async function SettingsPage() {
  const [user, userRecord] = await Promise.all([
    currentUser(),
    getCurrentUserRecord(),
  ])

  const rawBaseId = process.env.AIRTABLE_BASE_ID ?? ''
  const maskedBaseId = rawBaseId
    ? rawBaseId.slice(0, 8) + '••••••••'
    : '(not set)'

  return (
    <div className="max-w-2xl mx-auto px-4 md:px-6 py-8">
      <h1 className="text-2xl font-bold text-slate-900 mb-8">Settings</h1>

      {/* ── My Account ─────────────────────────────────────────────────── */}
      <section className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
        <h2 className="text-base font-semibold text-slate-900 mb-4">My Account</h2>
        <div className="flex items-center gap-4">
          {user?.imageUrl ? (
            <img
              src={user.imageUrl}
              alt="Profile photo"
              className="w-16 h-16 rounded-full object-cover flex-shrink-0"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-slate-200 flex items-center justify-center text-xl font-semibold text-slate-500 flex-shrink-0">
              {(user?.firstName ?? user?.emailAddresses[0]?.emailAddress ?? '?')[0].toUpperCase()}
            </div>
          )}
          <div>
            <p className="font-semibold text-slate-900 text-base">
              {[user?.firstName, user?.lastName].filter(Boolean).join(' ') || '—'}
            </p>
            <p className="text-sm text-slate-500 mt-0.5">
              {user?.emailAddresses[0]?.emailAddress ?? '—'}
            </p>
          </div>
        </div>

        {/* Access level row */}
        <div className="mt-4 pt-4 border-t border-slate-100 space-y-2 text-sm">
          <div className="flex justify-between items-center">
            <span className="text-slate-500">Access Level</span>
            <span className={`font-medium px-2.5 py-0.5 rounded-full text-xs capitalize ${ROLE_BADGE[userRecord.role] ?? ROLE_BADGE.unknown}`}>
              {userRecord.role}
            </span>
          </div>
          {userRecord.airtableId && (
            <div className="flex justify-between items-center">
              <span className="text-slate-500">Airtable Record</span>
              <code className="font-mono text-xs text-slate-400">
                {userRecord.airtableId.slice(0, 10)}…
              </code>
            </div>
          )}
        </div>

        <ManageAccountButton />
      </section>

      {/* ── Portal Info ─────────────────────────────────────────────────── */}
      <section className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
        <h2 className="text-base font-semibold text-slate-900 mb-4">Portal</h2>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between items-center">
            <span className="text-slate-500">Version</span>
            <span className="font-medium text-slate-900">v1.0 — April 2026</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-500">Airtable</span>
            <span className="flex items-center gap-2 font-medium text-slate-900">
              <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
              Connected
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-500">Hosting</span>
            <a
              href="https://portal-leadershiptap.com"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-[hsl(213,70%,30%)] hover:underline"
            >
              portal-leadershiptap.com ↗
            </a>
          </div>
        </div>
      </section>

      {/* ── Airtable Connection ─────────────────────────────────────────── */}
      <section className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
        <h2 className="text-base font-semibold text-slate-900 mb-4">Airtable Connection</h2>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between items-center">
            <span className="text-slate-500">Base ID</span>
            <code className="font-mono text-xs bg-slate-100 text-slate-700 px-2 py-1 rounded">
              {maskedBaseId}
            </code>
          </div>
          <p className="text-xs text-slate-400">
            Data syncs in real-time with Airtable. Changes made here are reflected
            immediately in your Airtable base.
          </p>
        </div>
      </section>

      {/* ── Calendar Sync ───────────────────────────────────────────────── */}
      <section className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
        <h2 className="text-base font-semibold text-slate-900 mb-4">Calendar</h2>
        <SyncCalendarSection />
      </section>

      {/* ── Help & Support ──────────────────────────────────────────────── */}
      <section className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="text-base font-semibold text-slate-900 mb-4">Help &amp; Support</h2>
        <div className="space-y-3 text-sm">
          <a
            href="mailto:gsierock@nd.edu"
            className="flex items-center justify-between text-slate-700 hover:text-[hsl(213,70%,30%)] transition-colors"
          >
            <span>Report a bug</span>
            <span className="text-slate-400">→</span>
          </a>
          <a
            href="mailto:gsierock@nd.edu?subject=LeadershipTap%20Portal%20Support"
            className="flex items-center justify-between text-slate-700 hover:text-[hsl(213,70%,30%)] transition-colors"
          >
            <span>Contact support</span>
            <span className="text-slate-400">→</span>
          </a>
        </div>
      </section>
    </div>
  )
}
