import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

export interface BuLineSeriesPoint {
  status: string
  [bu: string]: string | number
}

interface BuRankingPanelProps {
  data: BuLineSeriesPoint[]
  bus: string[]
}

const BU_COLORS = [
  '#FF6B00',
  '#0EA5E9',
  '#8B5CF6',
  '#10B981',
  '#F59E0B',
  '#EC4899',
  '#64748B',
  '#14B8A6',
]

export default function BuRankingPanel({ data, bus }: BuRankingPanelProps) {
  if (data.length === 0 || bus.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-[color:var(--color-muted)]">
        Sem dados
      </p>
    )
  }

  return (
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 12, right: 16, left: 0, bottom: 4 }}>
          <CartesianGrid
            strokeDasharray="4 6"
            stroke="rgb(229 231 235 / 0.8)"
            vertical={false}
          />
          <XAxis
            dataKey="status"
            tick={{ fontSize: 12, fill: '#637381' }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fontSize: 11, fill: '#637381' }}
            tickLine={false}
            axisLine={false}
            width={36}
          />
          <Tooltip
            cursor={{ stroke: '#FF8A3D', strokeWidth: 1, strokeDasharray: '4 4' }}
            contentStyle={{
              borderRadius: 14,
              border: '1px solid rgb(255 255 255 / 0.7)',
              background: 'rgb(255 255 255 / 0.92)',
              backdropFilter: 'blur(16px)',
              boxShadow: '0 12px 28px -14px rgb(33 43 54 / 0.25)',
              fontSize: 12,
            }}
          />
          <Legend
            verticalAlign="bottom"
            height={36}
            iconType="circle"
            wrapperStyle={{ fontSize: 12, color: '#637381', paddingTop: 8 }}
          />
          {bus.map((bu, index) => (
            <Line
              key={bu}
              type="monotone"
              dataKey={bu}
              name={bu}
              stroke={BU_COLORS[index % BU_COLORS.length]}
              strokeWidth={2.5}
              dot={{
                r: 4,
                fill: '#ffffff',
                stroke: BU_COLORS[index % BU_COLORS.length],
                strokeWidth: 2,
              }}
              activeDot={{ r: 6 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
