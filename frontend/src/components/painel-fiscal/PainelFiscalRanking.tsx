import { formatMoneyBRL } from '../../lib/format'
import DiretoriaChartCard from '../diretoria/DiretoriaChartCard'

export type RankingItem = {
  empresa: string
  total: number
}

export default function PainelFiscalRanking({
  items,
  onSelect,
}: {
  items: RankingItem[]
  onSelect: (empresa: string) => void
}) {
  const max = items[0]?.total ?? 0

  return (
    <DiretoriaChartCard
      title="Maiores pendências"
    >
      {items.length === 0 ? (
        <p className="flex min-h-[12rem] items-center justify-center text-sm text-[color:var(--color-muted)]">
          Nenhuma pendência neste filtro
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((item, index) => {
            const pct = max > 0 ? (item.total / max) * 100 : 0
            return (
              <li key={item.empresa}>
                <button
                  type="button"
                  className="group w-full rounded-xl px-1 py-0.5 text-left transition hover:bg-[color:var(--nav-hover)]"
                  onClick={() => onSelect(item.empresa)}
                >
                  <div className="mb-1 flex items-baseline justify-between gap-3">
                    <span className="min-w-0 truncate text-sm font-medium text-[color:var(--color-ink)]">
                      <span className="mr-2 tabular-nums text-[color:var(--color-muted)]">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      {item.empresa}
                    </span>
                    <span className="shrink-0 text-sm font-semibold tabular-nums text-brand-700">
                      {formatMoneyBRL(item.total)}
                    </span>
                  </div>
                  <div className="h-1 overflow-hidden rounded-full bg-[color:var(--color-line)]">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-brand-400 to-brand-600 transition-all group-hover:from-brand-500 group-hover:to-brand-700"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </DiretoriaChartCard>
  )
}
