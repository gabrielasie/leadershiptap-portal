function Pulse({ className }: { className: string }) {
  return <div className={`animate-pulse bg-slate-100 rounded ${className}`} />
}

export default function ProfileLoading() {
  return (
    <div className="px-4 py-5 md:p-8 max-w-5xl mx-auto space-y-6">

      {/* Back link */}
      <Pulse className="h-4 w-28" />

      {/* Profile card */}
      <div className="bg-white rounded-xl shadow-sm p-4 md:p-6">
        <div className="flex flex-col sm:flex-row items-start gap-4 sm:gap-5">
          <Pulse className="w-16 h-16 rounded-full flex-shrink-0" />
          <div className="min-w-0 flex-1 space-y-2.5">
            <Pulse className="h-7 w-48" />
            <Pulse className="h-4 w-36" />
            <Pulse className="h-4 w-44" />
            <Pulse className="h-3 w-52" />
          </div>
        </div>
        <div className="flex flex-wrap gap-2 mt-5 pt-5 border-t border-slate-100">
          <Pulse className="h-5 w-20 rounded-full" />
          <Pulse className="h-5 w-16 rounded-full" />
          <Pulse className="h-5 w-14 rounded-full" />
        </div>
      </div>

      {/* Most Recent Session */}
      <div className="bg-white rounded-xl shadow-sm p-4 md:p-6">
        <div className="border-l-4 border-blue-600 bg-blue-50/40 rounded-r-xl p-5 space-y-3">
          <Pulse className="h-3 w-32" />
          <Pulse className="h-5 w-56" />
          <div className="bg-white/80 rounded-lg border border-blue-100 p-4 space-y-2">
            <Pulse className="h-3 w-24" />
            <Pulse className="h-4 w-full" />
            <Pulse className="h-4 w-3/4" />
          </div>
        </div>
      </div>

      {/* Coaching Context */}
      <div className="bg-white rounded-xl shadow-sm p-4 md:p-6">
        <div className="flex items-center gap-2 mb-4">
          <Pulse className="h-5 w-5 rounded" />
          <Pulse className="h-5 w-36" />
        </div>
        <div className="space-y-2">
          <Pulse className="h-4 w-full" />
          <Pulse className="h-4 w-5/6" />
          <Pulse className="h-4 w-2/3" />
        </div>
      </div>

      {/* Team */}
      <div className="bg-white rounded-xl shadow-sm p-4 md:p-6">
        <div className="flex items-center gap-2 mb-4">
          <Pulse className="h-5 w-5 rounded" />
          <Pulse className="h-5 w-16" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Pulse className="h-3 w-16" />
            <div className="flex items-center gap-3 p-3 border border-slate-100 rounded-lg">
              <Pulse className="w-8 h-8 rounded-full flex-shrink-0" />
              <div className="flex-1 space-y-1">
                <Pulse className="h-4 w-28" />
                <Pulse className="h-3 w-20" />
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <Pulse className="h-3 w-24" />
            <Pulse className="h-4 w-32" />
          </div>
        </div>
      </div>

      {/* Meetings */}
      <div className="bg-white rounded-xl shadow-sm p-4 md:p-6">
        <div className="flex items-center gap-2 mb-5">
          <Pulse className="h-5 w-5 rounded" />
          <Pulse className="h-5 w-24" />
        </div>
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="flex items-start gap-4 p-4 rounded-xl border border-slate-200">
              <Pulse className="w-12 h-14 rounded-lg flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <Pulse className="h-4 w-40" />
                <Pulse className="h-3 w-28" />
                <Pulse className="h-5 w-20 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Messages */}
      <div className="bg-white rounded-xl shadow-sm p-4 md:p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Pulse className="h-5 w-5 rounded" />
            <Pulse className="h-5 w-44" />
          </div>
        </div>
        <div className="rounded-lg border border-slate-100 overflow-hidden">
          {[1, 2].map((i) => (
            <div key={i} className="flex items-start gap-3 px-4 py-3 border-b border-slate-100 last:border-0">
              <div className="flex-1 space-y-1.5">
                <Pulse className="h-4 w-1/2" />
                <Pulse className="h-3 w-24" />
              </div>
              <Pulse className="h-5 w-14 rounded-full flex-shrink-0" />
            </div>
          ))}
        </div>
      </div>

      {/* Tasks */}
      <div className="bg-white rounded-xl shadow-sm p-4 md:p-6">
        <div className="flex items-center gap-2 mb-4">
          <Pulse className="h-5 w-5 rounded" />
          <Pulse className="h-5 w-16" />
        </div>
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3 px-3 py-2.5 border border-slate-100 rounded-lg">
              <Pulse className="w-5 h-5 rounded-full flex-shrink-0" />
              <div className="flex-1 space-y-1">
                <Pulse className="h-4 w-40" />
                <Pulse className="h-3 w-24" />
              </div>
              <Pulse className="h-5 w-16 rounded-full" />
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}
