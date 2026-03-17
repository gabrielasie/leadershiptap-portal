export default function UsersLoading() {
  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="h-8 w-24 bg-gray-200 rounded-lg animate-pulse" />
        <div className="h-4 w-40 bg-gray-100 rounded mt-2 animate-pulse" />
      </div>

      {/* Search bar skeleton */}
      <div className="h-9 w-80 bg-gray-100 rounded-lg animate-pulse" />

      {/* Card grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-start gap-4">
              {/* Avatar */}
              <div className="w-12 h-12 rounded-full bg-gray-200 animate-pulse flex-shrink-0" />
              {/* Text lines */}
              <div className="flex-1 space-y-2 pt-1">
                <div className="h-4 w-32 bg-gray-200 rounded animate-pulse" />
                <div className="h-3 w-24 bg-gray-100 rounded animate-pulse" />
                <div className="h-3 w-36 bg-gray-100 rounded animate-pulse" />
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <div className="h-3 w-20 bg-gray-100 rounded animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
