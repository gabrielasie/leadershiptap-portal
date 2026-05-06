import { Clock, CheckSquare, Users } from 'lucide-react'

function Pulse({ className }: { className: string }) {
  return <div className={`animate-pulse bg-slate-100 rounded ${className}`} />
}

export function ComingUpNextSkeleton() {
  return (
    <div>
      {/* Coming Up Next card */}
      <div className="bg-[hsl(213,60%,97%)] border border-[hsl(213,50%,88%)] rounded-xl p-5 mb-4 md:mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Clock className="h-4 w-4 text-[hsl(213,70%,45%)]" />
          <span className="text-xs font-semibold uppercase tracking-wide text-[hsl(213,70%,45%)]">
            Coming Up Next
          </span>
        </div>
        <div className="flex items-start gap-4">
          <Pulse className="w-12 h-12 rounded-full flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <Pulse className="h-4 w-32" />
            <Pulse className="h-5 w-48" />
            <Pulse className="h-3 w-28" />
          </div>
        </div>
      </div>

      {/* Upcoming This Week placeholder */}
      <div className="bg-white rounded-xl shadow-sm p-4 md:p-6">
        <div className="flex items-center gap-2 mb-5">
          <Pulse className="h-5 w-5 rounded" />
          <Pulse className="h-5 w-40" />
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3 p-3 border border-slate-100 rounded-lg">
              <Pulse className="w-10 h-12 rounded-lg flex-shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Pulse className="h-4 w-36" />
                <Pulse className="h-3 w-24" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function TasksSkeleton() {
  return (
    <div className="mb-4 md:mb-6 bg-white rounded-xl shadow-sm p-4 md:p-6">
      <div className="flex items-center gap-2 mb-4">
        <CheckSquare className="h-5 w-5 text-slate-400" />
        <span className="text-lg font-semibold text-slate-900">Open Tasks</span>
      </div>
      <div className="divide-y divide-slate-100">
        {[1, 2, 3].map((i) => (
          <div key={i} className="py-3 flex items-center gap-3">
            <Pulse className="w-5 h-5 rounded-full flex-shrink-0" />
            <div className="flex-1 space-y-1.5">
              <Pulse className="h-4 w-48" />
              <Pulse className="h-3 w-24" />
            </div>
            <Pulse className="h-5 w-16 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  )
}

export function ClientsSkeleton() {
  return (
    <div className="bg-white rounded-xl shadow-sm p-4 md:p-6">
      <div className="flex items-center gap-2 mb-4">
        <Users className="h-5 w-5 text-slate-400" />
        <span className="text-lg font-semibold text-slate-900">Your Clients</span>
      </div>
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center gap-3 p-3 border border-slate-100 rounded-lg">
            <Pulse className="w-10 h-10 rounded-full flex-shrink-0" />
            <div className="flex-1 space-y-1.5">
              <Pulse className="h-4 w-32" />
              <Pulse className="h-3 w-48" />
            </div>
            <Pulse className="h-4 w-4 rounded" />
          </div>
        ))}
      </div>
    </div>
  )
}
