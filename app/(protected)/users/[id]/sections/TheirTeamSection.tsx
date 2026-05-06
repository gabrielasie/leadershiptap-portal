import Link from 'next/link'
import { Users, ChevronRight } from 'lucide-react'
import type { DirectReport } from '@/lib/airtable/relationships'

interface Props {
  directReports: DirectReport[]
  nextTrail: string
  canDrillDeeper: boolean
}

export default function TheirTeamSection({ directReports, nextTrail, canDrillDeeper }: Props) {
  if (directReports.length === 0) return null

  return (
    <div id="their-team" className="bg-white rounded-xl shadow-sm p-4 md:p-6">
      <div className="flex items-center gap-2 mb-4">
        <Users className="h-5 w-5 text-slate-400" />
        <h2 className="text-lg font-semibold text-slate-900">
          Their Team ({directReports.length})
        </h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {directReports.map((report) => {
          const reportInitials = report.name
            .split(/\s+/)
            .map((w) => w[0])
            .join('')
            .toUpperCase()
            .slice(0, 2)

          if (!canDrillDeeper) {
            return (
              <div
                key={report.personId}
                className="flex items-center gap-3 p-3 rounded-lg border border-slate-100 bg-slate-50"
              >
                {report.photoUrl ? (
                  <img
                    src={report.photoUrl}
                    alt={report.name}
                    className="w-9 h-9 rounded-full object-cover flex-shrink-0"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center text-xs font-semibold flex-shrink-0 select-none">
                    {reportInitials}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-900 truncate">{report.name}</p>
                  {report.title && (
                    <p className="text-xs text-slate-500 truncate">{report.title}</p>
                  )}
                </div>
                <span className="text-[10px] text-slate-400 flex-shrink-0">View in org chart</span>
              </div>
            )
          }

          return (
            <Link
              key={report.personId}
              href={`/users/${report.personId}?trail=${nextTrail}`}
              className="flex items-center gap-3 p-3 rounded-lg border border-slate-100 hover:border-slate-200 hover:bg-slate-50 transition-colors group"
            >
              {report.photoUrl ? (
                <img
                  src={report.photoUrl}
                  alt={report.name}
                  className="w-9 h-9 rounded-full object-cover flex-shrink-0"
                />
              ) : (
                <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center text-xs font-semibold flex-shrink-0 select-none">
                  {reportInitials}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-900 truncate">{report.name}</p>
                {report.title && (
                  <p className="text-xs text-slate-500 truncate">{report.title}</p>
                )}
              </div>
              <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-slate-500 flex-shrink-0 transition-colors" />
            </Link>
          )
        })}
      </div>
    </div>
  )
}
