import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'
import { SERVICO_STATUS_ORDER } from '../../lib/diretoriaAggregates'
import type { DashboardSummary, StatusObrigacao } from '../../types'

interface StatusDonutChartProps {
  summary: DashboardSummary
  onSelect?: (status: StatusObrigacao) => void
}

function valueFor(
  summary: DashboardSummary,
  key: StatusObrigacao,
): number {
  switch (key) {
    case 'PENDENTE':
      return summary.pendente
    case 'EM_ANDAMENTO':
      return summary.em_andamento
    case 'EM_REVISAO':
      return summary.em_revisao
    case 'ENTREGUE':
      return summary.entregue
    case 'ATRASADO':
      return summary.atrasado
    default:
      return 0
  }
}

export default function StatusDonutChart({
  summary,
  onSelect,
}: StatusDonutChartProps) {
  const data = SERVICO_STATUS_ORDER.map((s) => ({
    key: s.key,
    name: s.label,
    value: valueFor(summary, s.key),
    color: s.color,
  })).filter((d) => d.value > 0)

  const total = data.reduce((acc, d) => acc + d.value, 0)

  if (total === 0) {
    return (
      <div className="flex h-[280px] items-center justify-center text-sm text-[color:var(--color-muted)]">
        Sem obrigações na competência
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-[280px] flex-col">
      <div className="relative mx-auto w-full max-w-[280px] flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius="62%"
              outerRadius="88%"
              paddingAngle={2}
              stroke="none"
              cursor={onSelect ? 'pointer' : 'default'}
              onClick={(_, index) => {
                const item = data[index]
                if (item && onSelect) onSelect(item.key)
              }}
              label={({ percent }) =>
                percent && percent >= 0.06
                  ? `${Math.round(percent * 100)}%`
                  : ''
              }
              labelLine={false}
            >
              {data.map((entry) => (
                <Cell key={entry.key} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                background: 'var(--color-panel)',
                border: 'none',
                borderRadius: 12,
                boxShadow: '0 8px 24px rgb(145 158 171 / 0.24)',
                fontSize: 12,
              }}
              formatter={(value, name) => {
                const n = typeof value === 'number' ? value : Number(value) || 0
                const pct = total ? Math.round((n / total) * 100) : 0
                return [`${n} (${pct}%)`, name]
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <p className="text-2xl font-bold tracking-tight text-[color:var(--color-ink)]">
            {total}
          </p>
          <p className="text-[11px] font-medium text-[color:var(--color-muted)]">
            Total
          </p>
        </div>
      </div>
      <ul className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-2">
        {data.map((entry) => (
          <li key={entry.key}>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 text-xs text-[color:var(--color-muted)] transition hover:text-[color:var(--color-ink)]"
              onClick={() => onSelect?.(entry.key)}
            >
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ background: entry.color }}
              />
              {entry.name}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
