import { redirect } from 'next/navigation'
import { getCurrentUserRecord } from '@/lib/auth/getCurrentUserRecord'
import { getAllRelationshipContexts } from '@/lib/airtable/relationships'

function StatusBadge({ status }: { status: string }) {
  if (status === 'Active')
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
        Active
      </span>
    )
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500">
      {status || 'Unknown'}
    </span>
  )
}

export default async function AdminRelationshipsPage() {
  const userRecord = await getCurrentUserRecord()
  if (userRecord.role !== 'admin') redirect('/dashboard')

  const contexts = await getAllRelationshipContexts()

  // Sort: Active first, then by relationship type
  const sorted = [...contexts].sort((a, b) => {
    if (a.status === 'Active' && b.status !== 'Active') return -1
    if (a.status !== 'Active' && b.status === 'Active') return 1
    return (a.relationshipType ?? '').localeCompare(b.relationshipType ?? '')
  })

  const activeCount = contexts.filter((c) => c.status === 'Active').length

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Relationship Contexts</h1>
        <p className="text-sm text-slate-500 mt-1">
          {activeCount} active · {contexts.length} total
        </p>
      </div>

      {contexts.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
          <p className="text-sm text-slate-400">No relationship contexts found in Airtable.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Lead</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Person</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Type</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Since</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sorted.map((ctx) => {
                const startDate = ctx.startDate
                  ? new Date(ctx.startDate + 'T12:00:00').toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })
                  : '—'

                return (
                  <tr key={ctx.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-900">{ctx.leadName}</td>
                    <td className="px-4 py-3 text-slate-700">{ctx.personName}</td>
                    <td className="px-4 py-3 text-slate-600 capitalize">
                      {ctx.relationshipType?.replace(/_/g, ' ') || '—'}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={ctx.status} />
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{startDate}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
