export default function UserDetailLoading() {
  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">

      {/* Back link skeleton */}
      <div className="h-4 w-32 bg-slate-200 animate-pulse rounded" />

      {/* Profile card */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-start gap-5">
          <div className="w-16 h-16 rounded-full bg-slate-200 animate-pulse flex-shrink-0" />
          <div className="flex-1 space-y-2 pt-1">
            <div className="h-7 w-48 bg-slate-200 animate-pulse rounded" />
            <div className="h-4 w-36 bg-slate-200 animate-pulse rounded" />
            <div className="h-3 w-28 bg-slate-200 animate-pulse rounded" />
            <div className="h-3 w-44 bg-slate-200 animate-pulse rounded" />
          </div>
        </div>
        {/* Badge row */}
        <div className="flex gap-2 mt-5 pt-5 border-t border-slate-100">
          <div className="h-5 w-24 bg-slate-200 animate-pulse rounded-full" />
          <div className="h-5 w-16 bg-slate-200 animate-pulse rounded-full" />
        </div>
      </div>

      {/* Meetings section */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        {/* Heading */}
        <div className="flex items-center gap-2 mb-4">
          <div className="w-5 h-5 bg-slate-200 animate-pulse rounded" />
          <div className="h-5 w-24 bg-slate-200 animate-pulse rounded" />
        </div>
        {/* Sub-label */}
        <div className="h-3 w-20 bg-slate-200 animate-pulse rounded mb-3" />
        {/* Meeting rows */}
        <div className="rounded-lg border border-slate-100 overflow-hidden mb-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-slate-100 last:border-0">
              <div className="flex-1 space-y-1.5">
                <div className="h-4 w-2/3 bg-slate-200 animate-pulse rounded" />
                <div className="h-3 w-1/2 bg-slate-200 animate-pulse rounded" />
              </div>
              <div className="w-4 h-4 bg-slate-200 animate-pulse rounded flex-shrink-0" />
            </div>
          ))}
        </div>
        {/* Past sub-label */}
        <div className="h-3 w-12 bg-slate-200 animate-pulse rounded mb-3" />
        <div className="rounded-lg border border-slate-100 overflow-hidden">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-slate-100 last:border-0">
              <div className="flex-1 space-y-1.5">
                <div className="h-4 w-3/5 bg-slate-200 animate-pulse rounded" />
                <div className="h-3 w-2/5 bg-slate-200 animate-pulse rounded" />
              </div>
              <div className="w-4 h-4 bg-slate-200 animate-pulse rounded flex-shrink-0" />
            </div>
          ))}
        </div>
      </div>

      {/* Notes & Transcripts section */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-5 h-5 bg-slate-200 animate-pulse rounded" />
          <div className="h-5 w-36 bg-slate-200 animate-pulse rounded" />
        </div>
        <div className="rounded-lg border-2 border-dashed border-slate-200 bg-slate-50 px-6 py-8">
          <div className="h-3 w-3/4 bg-slate-200 animate-pulse rounded mx-auto" />
        </div>
      </div>

      {/* Messages & Follow-ups section */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 bg-slate-200 animate-pulse rounded" />
            <div className="h-5 w-44 bg-slate-200 animate-pulse rounded" />
          </div>
          <div className="h-7 w-36 bg-slate-200 animate-pulse rounded-lg" />
        </div>
        <div className="rounded-lg border border-slate-100 overflow-hidden">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="flex items-start gap-3 px-4 py-3 border-b border-slate-100 last:border-0">
              <div className="flex-1 space-y-1.5">
                <div className="h-4 w-1/2 bg-slate-200 animate-pulse rounded" />
                <div className="h-3 w-24 bg-slate-200 animate-pulse rounded" />
                <div className="h-3 w-full bg-slate-200 animate-pulse rounded" />
              </div>
              <div className="h-5 w-14 bg-slate-200 animate-pulse rounded-full flex-shrink-0" />
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}
