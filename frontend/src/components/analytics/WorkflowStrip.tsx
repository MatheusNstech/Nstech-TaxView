import type { DashboardSummary, StatusObrigacao } from '../../types'

interface WorkflowStripProps {
  summary: DashboardSummary
  activeStatus: string
  onSelect: (status: StatusObrigacao | '') => void
}

const steps: {
  key: keyof DashboardSummary
  status: StatusObrigacao | ''
  label: string
  active: string
  idle: string
}[] = [
  {
    key: 'pendente',
    status: 'PENDENTE',
    label: 'Pendente',
    active: 'bg-slate-700 text-white dark:bg-slate-500',
    idle: 'text-slate-700 hover:bg-slate-500/10 dark:text-slate-200',
  },
  {
    key: 'em_andamento',
    status: 'EM_ANDAMENTO',
    label: 'Andamento',
    active: 'bg-sky-600 text-white',
    idle: 'text-sky-800 hover:bg-sky-500/10 dark:text-sky-200',
  },
  {
    key: 'em_revisao',
    status: 'EM_REVISAO',
    label: 'Revisão',
    active: 'bg-amber-600 text-white',
    idle: 'text-amber-900 hover:bg-amber-500/10 dark:text-amber-200',
  },
  {
    key: 'entregue',
    status: 'ENTREGUE',
    label: 'Entregue',
    active: 'bg-emerald-600 text-white',
    idle: 'text-emerald-800 hover:bg-emerald-500/10 dark:text-emerald-200',
  },
]

export default function WorkflowStrip({
  summary,
  activeStatus,
  onSelect,
}: WorkflowStripProps) {
  return (
    <div className="glass-panel flex flex-wrap gap-2 p-3">
      {steps.map((step) => {
        const isActive = activeStatus === step.status
        return (
          <button
            key={step.key}
            type="button"
            onClick={() => onSelect(isActive ? '' : step.status)}
            className={[
              'inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-all',
              isActive ? step.active : `glass-chip !shadow-none ${step.idle}`,
            ].join(' ')}
          >
            <span>{step.label}</span>
            <span
              className={[
                'rounded-full px-2 py-0.5 text-xs font-bold',
                isActive
                  ? 'bg-white/20'
                  : 'bg-[color:var(--color-surface)] text-[color:var(--color-ink)]',
              ].join(' ')}
            >
              {summary[step.key] as number}
            </span>
          </button>
        )
      })}
    </div>
  )
}
