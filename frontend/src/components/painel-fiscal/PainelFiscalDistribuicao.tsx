import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'
import { formatMoneyBRL } from '../../lib/format'
import DiretoriaChartCard from '../diretoria/DiretoriaChartCard'

export type DistribuicaoItem = {
  key: string
  name: string
  value: number
  color: string
}

export default function PainelFiscalDistribuicao({
  data,
  total,
}: {
  data: DistribuicaoItem[]
  total: number
}) {
  const visible = data.filter((d) => d.value > 0)
  const top = visible.reduce<(DistribuicaoItem & { pct: number }) | null>(
    (best, item) => {
      const pct = total > 0 ? (item.value / total) * 100 : 0
      if (!best || pct > best.pct) return { ...item, pct }
      return best
    },
    null,
  )

  return (
    <DiretoriaChartCard title="Composição R$">
      <div className="relative mt-1 h-48">
        {visible.length === 0 ? (
          <p className="flex h-full items-center justify-center text-sm text-[color:var(--color-muted)]">
            Sem valores neste filtro
          </p>
        ) : (
          <>
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <p className="text-2xl font-bold tracking-tight text-[color:var(--color-ink)]">
                  {top
                    ? `${top.pct.toFixed(1).replace('.', ',')}%`
                    : '—'}
                </p>
                <p className="text-[11px] font-medium text-[color:var(--color-muted)]">
                  {top?.name ?? 'total'}
                </p>
              </div>
            </div>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <defs>
                  <filter
                    id="painelFiscalDonutShadow"
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
                  nameKey="name"
                  innerRadius={48}
                  outerRadius={72}
                  paddingAngle={4}
                  cornerRadius={6}
                  stroke="#ffffff"
                  strokeWidth={3}
                  style={{ filter: 'url(#painelFiscalDonutShadow)' }}
                >
                  {visible.map((entry) => (
                    <Cell key={entry.key} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) => [
                    formatMoneyBRL(Number(value ?? 0)),
                    'Valor',
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

      <div className="mt-3 flex flex-wrap gap-2">
        {data.map((d) => (
          <span key={d.key} className="glass-chip shadow-sm">
            <span
              className="h-2.5 w-2.5 rounded-full shadow-sm"
              style={{ background: d.color }}
            />
            {d.name} · {formatMoneyBRL(d.value)}
          </span>
        ))}
      </div>
    </DiretoriaChartCard>
  )
}
