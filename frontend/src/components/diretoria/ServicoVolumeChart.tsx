import { Sector } from 'recharts'
import {
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'
import {
  DIRETORIA_POLAR_COLORS,
  type ServicoVolumeItem,
} from '../../lib/diretoriaAggregates'

interface ServicoVolumeChartProps {
  data: ServicoVolumeItem[]
  onSelect?: (nome: string) => void
}

type RoseProps = {
  cx?: number
  cy?: number
  startAngle?: number
  endAngle?: number
  fill?: string
  payload?: ServicoVolumeItem & { angle: number }
  maxTotal?: number
  onSelect?: (nome: string) => void
}

function RoseSector(props: RoseProps) {
  const {
    cx = 0,
    cy = 0,
    startAngle = 0,
    endAngle = 0,
    fill,
    payload,
    maxTotal = 1,
    onSelect,
  } = props
  const total = payload?.total ?? 0
  const outerRadius = 48 + (total / Math.max(maxTotal, 1)) * 92
  const innerRadius = 28

  return (
    <Sector
      cx={cx}
      cy={cy}
      innerRadius={innerRadius}
      outerRadius={outerRadius}
      startAngle={startAngle}
      endAngle={endAngle}
      fill={fill}
      stroke="var(--color-panel)"
      strokeWidth={2}
      style={{ cursor: onSelect ? 'pointer' : 'default', outline: 'none' }}
      onClick={() => {
        if (payload?.nome && onSelect) onSelect(payload.nome)
      }}
    />
  )
}

export default function ServicoVolumeChart({
  data,
  onSelect,
}: ServicoVolumeChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-[300px] items-center justify-center text-sm text-[color:var(--color-muted)]">
        Sem obrigações na competência
      </div>
    )
  }

  const maxTotal = Math.max(...data.map((d) => d.total), 1)
  const totalObrigações = data.reduce((acc, d) => acc + d.total, 0)
  const chartData = data.map((d, i) => ({
    ...d,
    angle: 1,
    fill: DIRETORIA_POLAR_COLORS[i % DIRETORIA_POLAR_COLORS.length],
  }))

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr] lg:items-center">
        <div className="mx-auto h-[280px] w-full max-w-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                dataKey="angle"
                nameKey="nome"
                cx="50%"
                cy="50%"
                startAngle={90}
                endAngle={-270}
                paddingAngle={1.5}
                isAnimationActive
                shape={(props) => (
                  <RoseSector
                    {...props}
                    maxTotal={maxTotal}
                    onSelect={onSelect}
                  />
                )}
              />
              <Tooltip
                contentStyle={{
                  background: 'var(--color-panel)',
                  border: 'none',
                  borderRadius: 12,
                  boxShadow: '0 8px 24px rgb(145 158 171 / 0.24)',
                  fontSize: 12,
                }}
                formatter={(_value, _name, item) => {
                  const payload = item?.payload as ServicoVolumeItem | undefined
                  return [payload?.total ?? 0, payload?.nome ?? 'Obrigações']
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <ul className="grid grid-cols-1 gap-x-4 gap-y-2.5 sm:grid-cols-2">
          {chartData.map((entry) => (
            <li key={entry.nome}>
              <button
                type="button"
                onClick={() => onSelect?.(entry.nome)}
                className="flex w-full items-center gap-2 rounded-lg px-1 py-0.5 text-left text-sm transition hover:bg-[color:var(--nav-hover)]"
              >
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ background: entry.fill }}
                />
                <span className="min-w-0 flex-1 truncate text-[color:var(--color-ink)]">
                  {entry.nome}
                </span>
                <span className="shrink-0 tabular-nums text-[color:var(--color-muted)]">
                  ({entry.total})
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="grid grid-cols-2 gap-4 border-t border-dashed border-[color:var(--color-line)] pt-4">
        <div>
          <p className="text-xs text-[color:var(--color-muted)]">
            Tipos de serviço
          </p>
          <p className="mt-1 text-xl font-bold tracking-tight text-[color:var(--color-ink)]">
            {data.length}
          </p>
        </div>
        <div>
          <p className="text-xs text-[color:var(--color-muted)]">Obrigações</p>
          <p className="mt-1 text-xl font-bold tracking-tight text-[color:var(--color-ink)]">
            {totalObrigações}
          </p>
        </div>
      </div>
    </div>
  )
}
