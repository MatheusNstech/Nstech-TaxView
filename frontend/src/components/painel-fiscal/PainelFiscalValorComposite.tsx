import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'
import { formatMoneyBRL } from '../../lib/format'
import type { OrgaoModalKey } from './PainelFiscalOrgaoModal'

const ORGAOS: {
  key: Exclude<OrgaoModalKey, 'TOTAL'>
  label: string
  color: string
  accent: string
}[] = [
  {
    key: 'PGFN',
    label: 'PGFN',
    color: '#7c3aed',
    accent: 'text-violet-700',
  },
  {
    key: 'CADIN',
    label: 'CADIN',
    color: '#f59e0b',
    accent: 'text-amber-700',
  },
  {
    key: 'RFB',
    label: 'RFB',
    color: '#ff3d03',
    accent: 'text-brand-700',
  },
]

function formatPct(pct: number): string {
  return `${pct.toFixed(1).replace('.', ',')}%`
}

export default function PainelFiscalValorComposite({
  totalValor,
  porOrgao,
  onSelect,
}: {
  totalValor: number
  porOrgao: Record<string, number>
  onSelect: (orgao: OrgaoModalKey) => void
}) {
  const slices = ORGAOS.map((item) => {
    const value = Number(porOrgao[item.key] ?? 0)
    const pct = totalValor > 0 ? (value / totalValor) * 100 : 0
    return { ...item, value, pct }
  })
  const visible = slices.filter((s) => s.value > 0)
  const top = visible.reduce<(typeof visible)[number] | null>((best, item) => {
    if (!best || item.pct > best.pct) return item
    return best
  }, null)

  return (
    <div className="glass-panel overflow-hidden !rounded-3xl p-0 lg:grid lg:grid-cols-2">
      <div className="flex flex-col justify-center gap-5 border-b border-[color:var(--color-line)] bg-gradient-to-br from-white via-[#f8f9fb] to-[#eef1f4] p-6 lg:border-b-0 lg:border-r dark:from-[color:var(--color-panel)] dark:via-[#1a2028] dark:to-[#151b22]">
        <button
          type="button"
          onClick={() => onSelect('TOTAL')}
          className="cursor-pointer text-left transition hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--color-muted)]">
            Valor total
          </p>
          <p className="mt-3 text-3xl font-bold tracking-tight tabular-nums text-brand-600 sm:text-4xl">
            {formatMoneyBRL(totalValor)}
          </p>
          <p className="mt-2 text-xs text-[color:var(--color-muted)]">
            Ver detalhes
          </p>
        </button>

        <ul className="space-y-2.5">
          {slices.map((item) => (
            <li key={item.key}>
              <button
                type="button"
                onClick={() => onSelect(item.key)}
                className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-2xl border border-[color:var(--color-line)] bg-white px-4 py-3 text-left shadow-sm transition hover:bg-brand-50 dark:bg-[color:var(--color-panel)] dark:hover:bg-white/10"
              >
                <span className="flex min-w-0 items-center gap-2.5">
                  <span
                    className="h-3 w-3 shrink-0 rounded-full ring-2 ring-white shadow-sm"
                    style={{ background: item.color }}
                  />
                  <span
                    className={`text-sm font-bold uppercase tracking-wide ${item.accent}`}
                  >
                    {item.label}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span
                    className={`block text-lg font-bold tabular-nums tracking-tight sm:text-xl ${item.accent}`}
                  >
                    {formatMoneyBRL(item.value)}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-col justify-center gap-4 p-5 sm:p-6">
        <p className="text-sm font-semibold text-[color:var(--color-ink)]">
          Composição por órgão
        </p>

        <div className="relative mx-auto h-52 w-full max-w-xs sm:h-56">
          {visible.length === 0 ? (
            <p className="flex h-full items-center justify-center text-sm text-[color:var(--color-muted)]">
              Sem valores neste filtro
            </p>
          ) : (
            <>
              <div className="pointer-events-none absolute inset-0 z-[1] flex items-center justify-center">
                <div className="text-center">
                  <p className="text-2xl font-bold tracking-tight text-[color:var(--color-ink)]">
                    {top ? formatPct(top.pct) : '—'}
                  </p>
                  <p className="text-[11px] font-medium text-[color:var(--color-muted)]">
                    {top?.label ?? 'total'}
                  </p>
                </div>
              </div>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <defs>
                    <filter
                      id="painelFiscalValorDonutShadow"
                      x="-20%"
                      y="-20%"
                      width="140%"
                      height="140%"
                    >
                      <feDropShadow
                        dx="0"
                        dy="6"
                        stdDeviation="8"
                        floodColor="rgb(33 43 54)"
                        floodOpacity="0.14"
                      />
                    </filter>
                  </defs>
                  <Pie
                    data={visible}
                    dataKey="value"
                    nameKey="label"
                    innerRadius={56}
                    outerRadius={84}
                    paddingAngle={4}
                    cornerRadius={6}
                    stroke="#ffffff"
                    strokeWidth={3}
                    style={{ filter: 'url(#painelFiscalValorDonutShadow)' }}
                    cursor="pointer"
                    onClick={(_, index) => {
                      const slice = visible[index]
                      if (slice) onSelect(slice.key)
                    }}
                  >
                    {visible.map((entry) => (
                      <Cell key={entry.key} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value, name) => [
                      formatMoneyBRL(Number(value ?? 0)),
                      String(name ?? ''),
                    ]}
                    contentStyle={{
                      borderRadius: 14,
                      border: '1px solid var(--glass-border)',
                      background: 'var(--glass-bg-strong)',
                      color: 'var(--color-ink)',
                      backdropFilter: 'blur(16px)',
                      boxShadow: '0 12px 28px -14px var(--glass-shadow)',
                      fontSize: 12,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </>
          )}
        </div>

        <div className="flex flex-wrap justify-center gap-2">
          {slices.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => onSelect(item.key)}
              className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-[color:var(--color-line)] bg-[color:var(--color-surface)] px-3 py-1.5 text-left transition hover:bg-brand-50 dark:hover:bg-white/10"
            >
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: item.color }}
              />
              <span className="text-xs font-bold uppercase tracking-wide text-[color:var(--color-ink)]">
                {item.label}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
