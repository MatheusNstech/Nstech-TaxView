interface TableSkeletonProps {
  rows?: number
  cols?: number
  /** When true, renders only <tr> rows for use inside existing <tbody>. */
  asRows?: boolean
  /** Wrap in card-surface + table chrome. Ignored when asRows. */
  framed?: boolean
}

export function TableSkeleton({
  rows = 6,
  cols = 5,
  asRows = false,
  framed = true,
}: TableSkeletonProps) {
  const body = Array.from({ length: rows }).map((_, r) => (
    <tr key={r}>
      {Array.from({ length: cols }).map((_, c) => (
        <td key={c} className="px-5 py-3.5">
          <div
            className={[
              'skeleton h-4',
              c === 0 ? 'w-28' : c === cols - 1 ? 'w-16' : 'w-full max-w-[12rem]',
            ].join(' ')}
          />
        </td>
      ))}
    </tr>
  ))

  if (asRows) return <>{body}</>

  const table = (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-[color:var(--color-line)] bg-[color:var(--color-surface)]">
          {Array.from({ length: cols }).map((_, c) => (
            <th key={c} className="px-5 py-3">
              <div className="skeleton h-3 w-20" />
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-[color:var(--color-line)]">{body}</tbody>
    </table>
  )

  if (!framed) return table

  return <div className="card-surface overflow-hidden">{table}</div>
}

export function KanbanSkeleton({ columns = 4 }: { columns?: number }) {
  return (
    <div className="flex h-[calc(100dvh-11.5rem)] min-h-[22rem] gap-4 overflow-hidden">
      {Array.from({ length: columns }).map((_, i) => (
        <div
          key={i}
          className="glass-panel flex h-full w-80 shrink-0 flex-col overflow-hidden"
        >
          <div className="flex items-center justify-between border-b border-[color:var(--color-line)] px-4 py-3">
            <div className="skeleton h-4 w-24" />
            <div className="skeleton h-6 w-8 rounded-full" />
          </div>
          <div className="flex flex-1 flex-col gap-3 p-3">
            {Array.from({ length: 3 + (i % 2) }).map((_, j) => (
              <div key={j} className="skeleton h-24 w-full rounded-xl" />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

export function CalendarSkeleton() {
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
      <div className="glass-panel p-4">
        <div className="mb-4 flex items-center justify-between">
          <div className="skeleton h-5 w-32" />
          <div className="skeleton h-8 w-24 rounded-xl" />
        </div>
        <div className="mb-2 grid grid-cols-7 gap-1">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="skeleton mx-auto h-3 w-6" />
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: 35 }).map((_, i) => (
            <div key={i} className="skeleton aspect-square w-full rounded-xl" />
          ))}
        </div>
      </div>
      <div className="glass-panel space-y-3 p-4">
        <div className="skeleton h-4 w-40" />
        <div className="skeleton h-9 w-full rounded-xl" />
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton h-14 w-full rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  )
}

export function AuthSkeleton({ fullScreen = true }: { fullScreen?: boolean }) {
  return (
    <div
      className={[
        'flex items-center justify-center page-gradient',
        fullScreen ? 'min-h-screen' : 'min-h-[40vh]',
      ].join(' ')}
    >
      <div className="w-full max-w-md space-y-4 px-4">
        <div className="mx-auto skeleton h-10 w-40 rounded-full" />
        <div className="skeleton h-6 w-48 mx-auto" />
        <div className="glass-panel space-y-4 p-8">
          <div className="skeleton h-5 w-24" />
          <div className="skeleton h-10 w-full rounded-xl" />
          <div className="skeleton h-10 w-full rounded-xl" />
          <div className="skeleton h-10 w-full rounded-xl" />
        </div>
      </div>
    </div>
  )
}
