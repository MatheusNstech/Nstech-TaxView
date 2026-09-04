import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  SERVICO_STATUS_ORDER,
  type ServicoStatusRow,
} from '../../lib/diretoriaAggregates'

interface ServicoStatusChartProps {
  data: ServicoStatusRow[]
  onSelect?: (nome: string) => void
}

function DotLegend({
  payload,
}: {
  payload?: Array<{ value?: string; color?: string }>
}) {
  if (!payload?.length) return null
  return (
    <ul className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-2">
      {payload.map((entry) => (
        <li
          key={String(entry.value)}
          className="inline-flex items-center gap-1.5 text-xs text-[color:var(--color-muted)]"
        >
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ background: entry.color }}
          />
          {entry.value}
        </li>
      ))}
    </ul>
  )
}

export default function ServicoStatusChart({
  data,
  onSelect,
}: ServicoStatusChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-[280px] items-center justify-center text-sm text-[color:var(--color-muted)]">
        Sem obrigações na competência
      </div>
    )
  }

  const chartHeight = Math.max(260, data.length * 44)

  return (
    <div style={{ width: '100%', height: chartHeight + 36 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          layout="vertical"
          data={data}
          margin={{ top: 8, right: 12, left: 4, bottom: 4 }}
          barCategoryGap="32%"
        >
          <CartesianGrid
            strokeDasharray="3 3"
            horizontal={false}
            stroke="var(--color-line)"
            strokeOpacity={0.6}
          />
          <XAxis
            type="number"
            allowDecimals={false}
            axisLine={false}
            tickLine={false}
            tick={{ fill: 'var(--color-muted)', fontSize: 11 }}
          />
          <YAxis
            type="category"
            dataKey="nome"
            width={132}
            axisLine={false}
            tickLine={false}
            tick={{ fill: 'var(--color-ink)', fontSize: 12, fontWeight: 500 }}
          />
          <Tooltip
            cursor={{ fill: 'var(--nav-hover)', radius: 8 }}
            contentStyle={{
              background: 'var(--color-panel)',
              border: 'none',
              borderRadius: 12,
              boxShadow: '0 8px 24px rgb(145 158 171 / 0.24)',
              fontSize: 12,
            }}
          />
          <Legend content={<DotLegend />} />
          {SERVICO_STATUS_ORDER.map((s, idx) => (
            <Bar
              key={s.key}
              dataKey={s.label}
              stackId="status"
              fill={s.color}
              barSize={16}
              radius={
                idx === SERVICO_STATUS_ORDER.length - 1
                  ? [0, 10, 10, 0]
                  : [0, 0, 0, 0]
              }
              cursor={onSelect ? 'pointer' : 'default'}
              onClick={(entry) => {
                const nome = (entry as { nome?: string })?.nome
                if (nome && onSelect) onSelect(nome)
              }}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
