import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { formatMoneyBRL } from '../../lib/format'
import type { PerdcompSummary } from '../../types'

export function statusColor(status: string): string {
  const key = status.toLocaleLowerCase('pt-BR')
  if (key.startsWith('indeferid')) return '#E11D48'
  if (key.startsWith('intima') || key.includes('pend')) return '#F59E0B'
  if (key.startsWith('deferid') || key.startsWith('encerrad')) return '#10B981'
  if (key.includes('análise') || key.includes('analise')) return '#0EA5E9'
  if (key === 'sem status') return '#94A3B8'
  return '#FF3D03'
}

function compactMoney(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1000) return `${(v / 1000).toFixed(0)}k`
  return String(v)
}

export default function PerdcompStatusChart({
  data,
}: {
  data: PerdcompSummary['por_status']
}) {
  if (data.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-[color:var(--color-muted)]">
        Sem processos
      </p>
    )
  }

  const height = Math.max(160, data.length * 56)

  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 4, right: 16, left: 0, bottom: 0 }}
        >
          <CartesianGrid
            strokeDasharray="4 6"
            stroke="rgb(145 158 171 / 0.25)"
            horizontal={false}
          />
          <XAxis
            type="number"
            tick={{ fill: 'var(--color-muted)', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={compactMoney}
          />
          <YAxis
            type="category"
            dataKey="status"
            width={130}
            tick={{ fill: 'var(--color-ink)', fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            cursor={{ fill: 'rgb(145 158 171 / 0.08)' }}
            formatter={(value, _name, item) => {
              const qtd = (item?.payload as { quantidade?: number })?.quantidade ?? 0
              return [
                `${formatMoneyBRL(Number(value))} · ${qtd} ${qtd === 1 ? 'processo' : 'processos'}`,
                'Valor pedido',
              ]
            }}
            contentStyle={{
              borderRadius: 12,
              border: '1px solid var(--color-line)',
              background: 'var(--color-panel)',
            }}
          />
          <Bar dataKey="valor" radius={[0, 8, 8, 0]} barSize={22}>
            {data.map((d) => (
              <Cell key={d.status} fill={statusColor(d.status)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
