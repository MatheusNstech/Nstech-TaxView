import { formatMoneyBRL } from '../../lib/format'

const toneBar: Record<string, string> = {
  CADIN: 'bg-amber-500',
  PGFN: 'bg-rose-500',
  RFB: 'bg-brand-500',
  TOTAL: 'bg-teal-600',
}

const toneChip: Record<string, string> = {
  CADIN: 'bg-amber-500/15 text-amber-800',
  PGFN: 'bg-rose-500/15 text-rose-700',
  RFB: 'bg-brand-500/15 text-brand-700',
  TOTAL: 'bg-teal-600/15 text-teal-800',
}

export default function PainelFiscalOrgaoCard({
  label,
  count,
  valor,
  totalValor,
  onClick,
}: {
  label: string
  count: number
  valor: number
  totalValor: number
  onClick?: () => void
}) {
  const isTotal = label === 'TOTAL'
  const pct = isTotal
    ? 100
    : totalValor > 0 && valor > 0
      ? Math.min(100, (valor / totalValor) * 100)
      : 0
  const bar = toneBar[label] ?? 'bg-brand-500'
  const chip = toneChip[label] ?? 'bg-brand-500/15 text-brand-700'

  return (
    <button
      type="button"
      onClick={onClick}
      className="kpi-card glass-panel flex w-full cursor-pointer flex-col p-5 text-left transition hover:bg-[color:var(--nav-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--color-muted)]">
          {label}
        </p>
        <span
          className={`rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums ${chip}`}
        >
          {count} emp.
        </span>
      </div>
      <p className="mt-3 text-2xl font-bold tracking-tight tabular-nums text-[color:var(--color-ink)]">
        {formatMoneyBRL(valor)}
      </p>
      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-[color:var(--color-line)]">
        <div
          className={`h-full rounded-full transition-all ${bar}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-1.5 text-[11px] text-[color:var(--color-muted)]">
        {isTotal
          ? 'CADIN + PGFN + RFB · clique para detalhar'
          : `${pct.toFixed(1).replace('.', ',')}% do total · clique para detalhar`}
      </p>
    </button>
  )
}
