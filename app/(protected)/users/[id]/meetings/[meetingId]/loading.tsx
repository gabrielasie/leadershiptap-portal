export default function MeetingDetailLoading() {
  return (
    <div className="p-8 max-w-3xl mx-auto">
      {/* Back link */}
      <div className="h-4 w-28 bg-gray-100 rounded animate-pulse mb-6" />

      {/* Meeting header card */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <div className="h-6 w-64 bg-gray-200 rounded animate-pulse" />
        <div className="h-4 w-48 bg-gray-100 rounded animate-pulse mt-2" />
        {/* Participant chips */}
        <div className="flex gap-2 mt-4">
          <div className="h-6 w-36 bg-gray-100 rounded-full animate-pulse" />
          <div className="h-6 w-28 bg-gray-100 rounded-full animate-pulse" />
        </div>
        <div className="h-3 w-44 bg-gray-100 rounded animate-pulse mt-3" />
      </div>

      {/* Notes section */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <div className="h-3 w-32 bg-gray-200 rounded animate-pulse mb-4" />
        <div className="space-y-2">
          <div className="h-4 w-full bg-gray-100 rounded animate-pulse" />
          <div className="h-4 w-full bg-gray-100 rounded animate-pulse" />
          <div className="h-4 w-3/4 bg-gray-100 rounded animate-pulse" />
        </div>
      </div>

      {/* Follow-up message section */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="h-3 w-40 bg-gray-200 rounded animate-pulse mb-4" />
        <div className="h-9 w-36 bg-gray-100 rounded-lg animate-pulse" />
      </div>
    </div>
  )
}
