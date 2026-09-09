import { formatMoneyBRL } from '../../lib/format'
import type { OrgaoModalKey } from './PainelFiscalOrgaoModal'

const BARRAS: {
  key: Exclude<OrgaoModalKey, 'TOTAL'>
  label: string
  barClass: string
}[] = [
  { key: 'CADIN', label: 'CADIN', barClass: 'bg-amber-500' },
  { key: 'PGFN', label: 'PGFN', barClass: 'bg-rose-500' },
  { key: 'RFB', label: 'RFB', barClass: 'bg-brand-500' },
]

export default function PainelFiscalValorComposite({
  totalValor,
  porOrgao,
  onSelect,
}: {
  totalValor: number
  porOrgao: Record<string, number>
  onSelect: (orgao: OrgaoModalKey) => void
}) {
  return (
    <div className="glass-panel overflow-hidden !rounded-3xl p-0 lg:grid lg:grid-cols-5">
      <button
        type="button"
        onClick={() => onSelect('TOTAL')}
        className="flex cursor-pointer flex-col justify-between border-b border-[color:var(--color-line)] bg-gradient-to-br from-white via-[#f8f9fb] to-[#eef1f4] p-6 text-left transition hover:to-[#e8ecf0] lg:col-span-2 lg:min-h-[14rem] lg:border-b-0 lg:border-r dark:from-[color:var(--color-panel)] dark:via-[#1a2028] dark:to-[#151b22]"
      >
        <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--color-muted)]">
          Valor total
        </p>
        <p className="mt-8 text-4xl font-bold tracking-tight tabular-nums text-brand-600 xl:text-5xl">
          {formatMoneyBRL(totalValor)}
        </p>
        <p className="mt-4 text-xs text-[color:var(--color-muted)]">
          CADIN + PGFN + RFB · clique para detalhar
        </p>
      </button>

      <div className="flex flex-col justify-center gap-5 p-6 lg:col-span-3 lg:px-8">
        <p className="text-base font-semibold text-[color:var(--color-ink)]">
          Por órgão
        </p>
        <div className="space-y-5">
          {BARRAS.map((item) => {
            const valor = porOrgao[item.key] ?? 0
            const pct =
              totalValor > 0 ? Math.min(100, (valor / totalValor) * 100) : 0
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => onSelect(item.key)}
                className="block w-full cursor-pointer space-y-2 text-left transition hover:opacity-90"
              >
                <div className="flex items-end justify-between gap-4">
                  <span className="text-sm font-semibold uppercase tracking-wide text-[color:var(--color-muted)]">
                    {item.label}
                  </span>
                  <span className="text-lg font-bold tabular-nums text-[color:var(--color-ink)] xl:text-xl">
                    {formatMoneyBRL(valor)}
                  </span>
                </div>
                <div className="h-3.5 overflow-hidden rounded-full bg-[color:var(--color-line)] p-0.5">
                  <div
                    className={`h-full min-w-0 rounded-full transition-all ${item.barClass}`}
                    style={{
                      width: valor > 0 ? `${Math.max(pct, 2)}%` : '0%',
                    }}
                  />
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
