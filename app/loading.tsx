export default function Loading() {
  return (
    <div className="min-h-screen bg-background p-4">
      {/* Header skeleton */}
      <div className="h-16 bg-card rounded-lg mb-6 animate-pulse" />

      {/* Filter bar skeleton */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-8 w-20 bg-card rounded-full animate-pulse" />
        ))}
      </div>

      {/* Cards grid skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {[...Array(12)].map((_, i) => (
          <div key={i} className="bg-card rounded-xl p-4 space-y-3 animate-pulse">
            <div className="flex justify-between">
              <div className="h-4 w-24 bg-muted rounded" />
              <div className="h-8 w-8 bg-muted rounded-lg" />
            </div>
            <div className="h-6 w-32 bg-muted rounded" />
            <div className="h-3 w-16 bg-muted rounded" />
            <div className="h-2 w-full bg-muted rounded-full mt-2" />
            <div className="grid grid-cols-3 gap-2 mt-3">
              {[...Array(3)].map((_, j) => (
                <div key={j} className="h-10 bg-muted rounded" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
