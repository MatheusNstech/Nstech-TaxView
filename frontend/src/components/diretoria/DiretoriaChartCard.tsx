import type { ReactNode } from 'react'

interface DiretoriaChartCardProps {
  title: string
  subtitle?: string
  children: ReactNode
  className?: string
  action?: ReactNode
}

export default function DiretoriaChartCard({
  title,
  subtitle,
  children,
  className = '',
  action,
}: DiretoriaChartCardProps) {
  return (
    <section
      className={['diretoria-card flex flex-col', className]
        .filter(Boolean)
        .join(' ')}
    >
      <header className="mb-4 flex shrink-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold tracking-tight text-[color:var(--color-ink)]">
            {title}
          </h2>
          {subtitle ? (
            <p className="mt-0.5 text-xs text-[color:var(--color-muted)]">
              {subtitle}
            </p>
          ) : null}
        </div>
        {action}
      </header>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
    </section>
  )
}
