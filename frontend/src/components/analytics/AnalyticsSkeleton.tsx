type AnalyticsSkeletonProps = {
  /** full = first load; charts = keep KPIs/strip, skeleton only panels below */
  variant?: 'full' | 'charts'
}

export default function AnalyticsSkeleton({
  variant = 'full',
}: AnalyticsSkeletonProps) {
  const charts = (
    <>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="glass-panel space-y-4 p-5">
          <div className="skeleton h-4 w-32" />
          <div className="skeleton h-3 w-48" />
          <div className="skeleton mx-auto h-52 w-52 rounded-full" />
          <div className="flex flex-wrap gap-2">
            <div className="skeleton h-7 w-28" />
            <div className="skeleton h-7 w-24" />
          </div>
        </div>
        <div className="skeleton h-[300px] rounded-[1.75rem]" />
      </div>
      <div className="glass-panel space-y-4 p-5">
        <div className="skeleton h-4 w-40" />
        <div className="skeleton h-3 w-56" />
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton h-10 w-full" />
          ))}
        </div>
      </div>
    </>
  )

  if (variant === 'charts') {
    return <div className="space-y-6">{charts}</div>
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton h-28" />
        ))}
      </div>
      <div className="skeleton h-14 rounded-full" />
      {charts}
    </div>
  )
}
