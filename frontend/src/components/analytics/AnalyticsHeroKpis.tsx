import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Layers,
  type LucideIcon,
} from 'lucide-react'
import type { DashboardSummary } from '../../types'

interface AnalyticsHeroKpisProps {
  summary: DashboardSummary
}

const heroes: {
  key: keyof DashboardSummary
  label: string
  icon: LucideIcon
  valueClass: string
  iconWrap: string
  suffix?: string
}[] = [
  {
    key: 'total',
    label: 'Total',
    icon: Layers,
    valueClass: 'text-[color:var(--color-ink)]',
    iconWrap: 'bg-brand-500/15 text-brand-600',
  },
  {
    key: 'percentual_entregue',
    label: '% Entregue',
    icon: CheckCircle2,
    valueClass: 'text-emerald-700',
    iconWrap: 'bg-emerald-500/15 text-emerald-700',
    suffix: '%',
  },
  {
    key: 'atrasado',
    label: 'Atrasadas',
    icon: AlertTriangle,
    valueClass: 'text-rose-700',
    iconWrap: 'bg-rose-500/15 text-rose-700',
  },
  {
    key: 'vence_em_7_dias',
    label: 'Vence em 7 dias',
    icon: CalendarClock,
    valueClass: 'text-brand-700',
    iconWrap: 'bg-brand-500/15 text-brand-700',
  },
]

export default function AnalyticsHeroKpis({ summary }: AnalyticsHeroKpisProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {heroes.map((item) => {
        const Icon = item.icon
        const raw = summary[item.key] as number
        return (
          <div key={item.key} className="kpi-card glass-panel p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--color-muted)]">
                  {item.label}
                </p>
                <p className={`mt-2 text-3xl font-bold tracking-tight ${item.valueClass}`}>
                  {raw}
                  {item.suffix ?? ''}
                </p>
              </div>
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-2xl ${item.iconWrap}`}
              >
                <Icon className="h-5 w-5" strokeWidth={1.75} />
              </div>
            </div>
            {item.key === 'percentual_entregue' && (
              <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-[color:var(--color-line)]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-brand-400 to-brand-500 transition-all"
                  style={{ width: `${Math.min(raw, 100)}%` }}
                />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
