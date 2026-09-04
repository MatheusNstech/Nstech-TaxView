import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Layers,
  type LucideIcon,
} from 'lucide-react'
import type { DashboardSummary } from '../../types'

interface DiretoriaKpiStripProps {
  summary: DashboardSummary
}

const kpis: {
  key: keyof DashboardSummary
  label: string
  icon: LucideIcon
  cardClass: string
  iconClass: string
  valueClass: string
  suffix?: string
}[] = [
  {
    key: 'total',
    label: 'Total de obrigações',
    icon: Layers,
    cardClass: 'bg-sky-500/10 dark:bg-sky-400/10',
    iconClass: 'bg-sky-500/15 text-sky-700 dark:text-sky-300',
    valueClass: 'text-sky-900 dark:text-sky-100',
  },
  {
    key: 'percentual_entregue',
    label: '% entregue',
    icon: CheckCircle2,
    cardClass: 'bg-emerald-500/10 dark:bg-emerald-400/10',
    iconClass: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
    valueClass: 'text-emerald-900 dark:text-emerald-100',
    suffix: '%',
  },
  {
    key: 'atrasado',
    label: 'Atrasadas',
    icon: AlertTriangle,
    cardClass: 'bg-rose-500/10 dark:bg-rose-400/10',
    iconClass: 'bg-rose-500/15 text-rose-700 dark:text-rose-300',
    valueClass: 'text-rose-900 dark:text-rose-100',
  },
  {
    key: 'vence_em_7_dias',
    label: 'Vencimento em 7 dias',
    icon: CalendarClock,
    cardClass: 'bg-amber-500/10 dark:bg-amber-400/10',
    iconClass: 'bg-amber-500/15 text-amber-800 dark:text-amber-200',
    valueClass: 'text-amber-950 dark:text-amber-100',
  },
]

export default function DiretoriaKpiStrip({ summary }: DiretoriaKpiStripProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {kpis.map((item) => {
        const Icon = item.icon
        const raw = summary[item.key] as number
        return (
          <div
            key={item.key}
            className={['diretoria-kpi', item.cardClass].join(' ')}
          >
            <div
              className={[
                'mb-6 flex h-12 w-12 items-center justify-center rounded-full',
                item.iconClass,
              ].join(' ')}
            >
              <Icon className="h-6 w-6" strokeWidth={1.75} />
            </div>
            <p
              className={[
                'text-[1.75rem] font-bold leading-none tracking-tight',
                item.valueClass,
              ].join(' ')}
            >
              {raw}
              {item.suffix ?? ''}
            </p>
            <p className="mt-2 text-sm font-medium text-[color:var(--color-muted)]">
              {item.label}
            </p>
          </div>
        )
      })}
    </div>
  )
}
