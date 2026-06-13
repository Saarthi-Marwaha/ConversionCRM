/**
 * Instant skeleton while dashboard routes stream in — navigation feels
 * immediate instead of waiting on the server render.
 */
export default function DashboardLoading() {
  return (
    <div className="space-y-5 animate-pulse">
      <div>
        <div className="h-7 w-44 rounded-md bg-gray-200/70" />
        <div className="h-4 w-64 rounded-md bg-gray-100 mt-2" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-24 rounded-lg bg-sky-50" />
        ))}
      </div>
      <div className="card overflow-hidden">
        <div className="h-10 bg-sky-500/80" />
        <div className="divide-y divide-gray-50">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-12 bg-white" />
          ))}
        </div>
      </div>
    </div>
  );
}
