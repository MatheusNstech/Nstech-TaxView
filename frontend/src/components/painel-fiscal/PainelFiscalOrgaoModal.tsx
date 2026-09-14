import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { formatMoneyBRL } from '../../lib/format'

export type OrgaoModalKey = 'CADIN' | 'PGFN' | 'RFB' | 'TOTAL'

export type OrgaoModalRow = {
  empresa: string
  cadin: number
  pgfn: number
  rfb: number
  total: number
  orgaoValor: number
  hasObservacao?: boolean
}

function ObsBadge() {
  return (
    <span className="ml-1.5 inline-flex shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
      obs.
    </span>
  )
}

export default function PainelFiscalOrgaoModal({
  orgao,
  totalValor,
  rows,
  onClose,
  onSelectEmpresa,
}: {
  orgao: OrgaoModalKey
  totalValor: number
  rows: OrgaoModalRow[]
  onClose: () => void
  onSelectEmpresa: (empresa: string) => void
}) {
  const [search, setSearch] = useState('')
  const isTotal = orgao === 'TOTAL'

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const list = q
      ? rows.filter((r) => r.empresa.toLowerCase().includes(q))
      : rows
    return [...list].sort((a, b) =>
      isTotal ? b.total - a.total : b.orgaoValor - a.orgaoValor,
    )
  }, [rows, search, isTotal])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
      <div className="flex max-h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-[color:var(--color-line)] bg-white shadow-2xl dark:bg-[color:var(--color-panel)]">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[color:var(--color-line)] px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-[color:var(--color-ink)]">
              {orgao}
            </h2>
            <p className="mt-0.5 text-xs text-[color:var(--color-muted)]">
              {filtered.length} empresa(s) · {formatMoneyBRL(totalValor)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <label className="relative block min-w-[12rem] max-w-xs flex-1">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--color-muted)]"
                strokeWidth={1.75}
              />
              <input
                className="glass-input w-full py-2 pl-9 pr-3 text-sm"
                placeholder="Buscar empresa…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Buscar empresa"
              />
            </label>
            <button type="button" className="btn-ghost shrink-0" onClick={onClose}>
              Fechar
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto bg-white p-4 dark:bg-[color:var(--color-panel)]">
          {filtered.length === 0 ? (
            <p className="py-10 text-center text-sm text-[color:var(--color-muted)]">
              Nenhuma empresa neste filtro
            </p>
          ) : isTotal ? (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="sticky top-0 z-[1] bg-white dark:bg-[color:var(--color-panel)]">
                  <tr className="border-b border-[color:var(--color-line)] text-xs uppercase tracking-wide text-[color:var(--color-muted)]">
                    <th className="px-3 py-2.5 font-semibold">Empresa</th>
                    <th className="px-3 py-2.5 font-semibold">CADIN</th>
                    <th className="px-3 py-2.5 font-semibold">PGFN</th>
                    <th className="px-3 py-2.5 font-semibold">RFB</th>
                    <th className="px-3 py-2.5 font-semibold">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((item) => (
                    <tr
                      key={item.empresa}
                      className="cursor-pointer border-b border-[color:var(--color-line)] transition hover:bg-brand-50"
                      onClick={() => onSelectEmpresa(item.empresa)}
                    >
                      <td className="px-3 py-2.5 font-medium text-[color:var(--color-ink)]">
                        <span className="inline-flex items-center">
                          {item.empresa}
                          {item.hasObservacao ? <ObsBadge /> : null}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 tabular-nums">
                        {formatMoneyBRL(item.cadin)}
                      </td>
                      <td className="px-3 py-2.5 tabular-nums">
                        {formatMoneyBRL(item.pgfn)}
                      </td>
                      <td className="px-3 py-2.5 tabular-nums">
                        {formatMoneyBRL(item.rfb)}
                      </td>
                      <td className="px-3 py-2.5 font-semibold tabular-nums text-[color:var(--color-ink)]">
                        {formatMoneyBRL(item.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <ul className="space-y-2">
              {filtered.map((item) => (
                <li key={item.empresa}>
                  <button
                    type="button"
                    className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-2xl border border-[color:var(--color-line)] bg-[color:var(--color-surface)] px-4 py-3 text-left transition hover:bg-brand-50"
                    onClick={() => onSelectEmpresa(item.empresa)}
                  >
                    <span className="inline-flex min-w-0 items-center truncate font-medium text-[color:var(--color-ink)]">
                      <span className="truncate">{item.empresa}</span>
                      {item.hasObservacao ? <ObsBadge /> : null}
                    </span>
                    <span className="shrink-0 text-sm font-semibold tabular-nums text-[color:var(--color-ink)]">
                      {formatMoneyBRL(item.orgaoValor)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
