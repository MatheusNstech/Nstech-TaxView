import { AlertTriangle } from 'lucide-react'
import type { StatusObrigacao } from '../../types'

const STATUS_ORDER: { key: StatusObrigacao; label: string; cell: string }[] = [
  {
    key: 'PENDENTE',
    label: 'Pendente',
    cell: 'bg-[#919EAB]/16 text-[#637381] dark:text-[#C4CDD5]',
  },
  {
    key: 'EM_ANDAMENTO',
    label: 'Andamento',
    cell: 'bg-[#00B8D9]/16 text-[#006C9C] dark:text-[#61F3F3]',
  },
  {
    key: 'EM_REVISAO',
    label: 'Revisão',
    cell: 'bg-[#FFAB00]/20 text-[#B76E00] dark:text-[#FFD666]',
  },
  {
    key: 'ENTREGUE',
    label: 'Entregue',
    cell: 'bg-[#00A76F]/16 text-[#007867] dark:text-[#5BE49B]',
  },
]

/** Por BU: itens por coluna do Kanban e quantos deles estão com prazo vencido. */
export type BuStatusCounts = Record<
  string,
  {
    status: Partial<Record<StatusObrigacao, number>>
    atrasados: Partial<Record<StatusObrigacao, number>>
  }
>

interface BuStatusMatrixProps {
  counts: BuStatusCounts
  onCellClick?: (bu: string, status: StatusObrigacao | null) => void
}

export default function BuStatusMatrix({
  counts,
  onCellClick,
}: BuStatusMatrixProps) {
  const bus = Object.keys(counts).sort((a, b) => a.localeCompare(b, 'pt-BR'))

  if (bus.length === 0) {
    return (
      <div className="flex min-h-[180px] items-center justify-center text-sm text-[color:var(--color-muted)]">
        Sem dados por BU
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-[color:var(--color-line)] text-left text-[10px] font-semibold uppercase tracking-wide text-[color:var(--color-muted)]">
            <th className="px-2 py-3">BU</th>
            {STATUS_ORDER.map((s) => (
              <th key={s.key} className="px-2 py-3 text-center">
                {s.label}
              </th>
            ))}
            <th className="px-2 py-3 text-center">Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[color:var(--color-line)]">
          {bus.map((bu) => {
            const row = counts[bu]?.status ?? {}
            const late = counts[bu]?.atrasados ?? {}
            const total = STATUS_ORDER.reduce(
              (acc, s) => acc + (row[s.key] ?? 0),
              0,
            )
            const totalLate = STATUS_ORDER.reduce(
              (acc, s) => acc + (late[s.key] ?? 0),
              0,
            )
            return (
              <tr key={bu} className="hover:bg-[color:var(--nav-hover)]">
                <td className="px-2 py-2.5">
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 font-semibold text-[color:var(--color-ink)] hover:opacity-80"
                    onClick={() => onCellClick?.(bu, null)}
                    title={totalLate > 0 ? `${totalLate} item(ns) com prazo vencido` : undefined}
                  >
                    <span
                      className={[
                        'h-2 w-2 shrink-0 rounded-full',
                        totalLate > 0 ? 'bg-[#FF5630] shadow-[0_0_0_3px_rgb(255_86_48_/_0.15)]' : 'bg-transparent',
                      ].join(' ')}
                      aria-hidden
                    />
                    {bu}
                  </button>
                </td>
                {STATUS_ORDER.map((s) => {
                  const n = row[s.key] ?? 0
                  const atrasados = late[s.key] ?? 0
                  return (
                    <td key={s.key} className="px-1.5 py-2 text-center">
                      <button
                        type="button"
                        disabled={n === 0}
                        onClick={() => onCellClick?.(bu, s.key)}
                        title={
                          atrasados > 0
                            ? `${n} em ${s.label.toLowerCase()}, ${atrasados} com prazo vencido`
                            : undefined
                        }
                        className={[
                          'inline-flex items-stretch overflow-hidden rounded-full text-xs font-bold tabular-nums',
                          'origin-center transition duration-150 ease-out',
                          n === 0
                            ? 'cursor-default text-[color:var(--color-muted)] opacity-35'
                            : [
                                atrasados > 0 ? 'ring-1 ring-[#FF5630]/35' : '',
                                'cursor-pointer hover:z-10 hover:scale-105 hover:shadow-md hover:shadow-black/10',
                                'active:scale-95',
                              ].join(' '),
                        ].join(' ')}
                      >
                        <span
                          className={[
                            'inline-flex min-w-[2.5rem] items-center justify-center px-2.5 py-1',
                            n === 0 ? '' : s.cell,
                          ].join(' ')}
                        >
                          {n}
                        </span>
                        {atrasados > 0 && (
                          <span className="inline-flex items-center gap-1 border-l border-[#FF5630]/25 bg-[#FF5630]/14 py-1 pr-2.5 pl-2 text-[#B71D18] dark:text-[#FFAC82]">
                            <AlertTriangle className="h-3 w-3" strokeWidth={2.25} />
                            {atrasados}
                          </span>
                        )}
                      </button>
                    </td>
                  )
                })}
                <td className="px-2 py-2.5 text-center">
                  <div className="inline-flex items-center gap-2">
                    <span className="text-xs font-bold tabular-nums text-[color:var(--color-ink)]">
                      {total}
                    </span>
                    {totalLate > 0 && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#FF5630]/12 px-2 py-0.5 text-[10px] font-semibold text-[#B71D18] dark:text-[#FFAC82]">
                        <AlertTriangle className="h-2.5 w-2.5" strokeWidth={2.25} />
                        {totalLate} em atraso
                      </span>
                    )}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
