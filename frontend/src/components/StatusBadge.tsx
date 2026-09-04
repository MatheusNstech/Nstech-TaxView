import type { StatusObrigacao } from '../types'
import { statusLabel, urgenciaLabel } from '../lib/format'

const statusStyles: Record<StatusObrigacao, string> = {
  PENDENTE:
    'bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-500/20 dark:text-slate-200 dark:ring-slate-500/30',
  EM_ANDAMENTO:
    'bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-500/20 dark:text-sky-200 dark:ring-sky-500/30',
  EM_REVISAO:
    'bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-500/20 dark:text-amber-200 dark:ring-amber-500/30',
  ENTREGUE:
    'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-200 dark:ring-emerald-500/30',
  ATRASADO:
    'bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-500/20 dark:text-rose-200 dark:ring-rose-500/30',
}

const urgenciaStyles: Record<string, string> = {
  ok: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200',
  urgente: 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200',
  atrasado: 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-200',
  neutro: 'bg-slate-100 text-slate-600 dark:bg-slate-500/20 dark:text-slate-300',
}

interface StatusBadgeProps {
  status: StatusObrigacao | string
  urgencia?: string | null
  showUrgencia?: boolean
}

export default function StatusBadge({
  status,
  urgencia,
  showUrgencia = false,
}: StatusBadgeProps) {
  const statusKey = status as StatusObrigacao
  const statusClass =
    statusStyles[statusKey] ??
    'bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-500/20 dark:text-slate-200 dark:ring-slate-500/30'

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span
        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${statusClass}`}
      >
        {statusLabel(status)}
      </span>
      {showUrgencia && urgencia && (
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${urgenciaStyles[urgencia] ?? urgenciaStyles.neutro}`}
        >
          {urgenciaLabel(urgencia)}
        </span>
      )}
    </div>
  )
}
