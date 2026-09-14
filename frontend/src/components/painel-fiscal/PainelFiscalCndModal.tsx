import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { formatDate } from '../../lib/format'

export type CndFilter = 'Válida' | 'Pendente'

export type CndModalRow = {
  empresa: string
  status_cnd: string
  cnd: string
  validade_cnd: string | null
  nota_01: string
  nota_02: string
}

export default function PainelFiscalCndModal({
  filter,
  rows,
  onClose,
  onSelectEmpresa,
}: {
  filter: CndFilter
  rows: CndModalRow[]
  onClose: () => void
  onSelectEmpresa: (empresa: string) => void
}) {
  const [search, setSearch] = useState('')
  const title = filter === 'Válida' ? 'CND válidas' : 'CND pendentes'

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const list = q
      ? rows.filter((r) => r.empresa.toLowerCase().includes(q))
      : rows
    return [...list].sort((a, b) => a.empresa.localeCompare(b.empresa, 'pt-BR'))
  }, [rows, search])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
      <div className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-[color:var(--color-line)] bg-white shadow-2xl dark:bg-[color:var(--color-panel)]">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[color:var(--color-line)] px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-[color:var(--color-ink)]">
              {title}
            </h2>
            <p className="mt-0.5 text-xs text-[color:var(--color-muted)]">
              {filtered.length} empresa(s)
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

        <div className="min-h-0 flex-1 overflow-auto p-4">
          {filtered.length === 0 ? (
            <p className="py-10 text-center text-sm text-[color:var(--color-muted)]">
              Nenhuma empresa neste filtro
            </p>
          ) : (
            <ul className="space-y-2">
              {filtered.map((item) => (
                <li key={item.empresa}>
                  <button
                    type="button"
                    className="flex w-full cursor-pointer flex-col gap-2 rounded-2xl border border-[color:var(--color-line)] bg-[color:var(--color-surface)] px-4 py-3 text-left transition hover:bg-brand-50 dark:hover:bg-white/5"
                    onClick={() => onSelectEmpresa(item.empresa)}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <span className="inline-flex min-w-0 items-center gap-1.5 truncate font-semibold text-[color:var(--color-ink)]">
                        <span className="truncate">{item.empresa}</span>
                        {item.nota_01.trim() || item.nota_02.trim() ? (
                          <span className="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
                            obs.
                          </span>
                        ) : null}
                      </span>
                      <span
                        className={
                          filter === 'Válida'
                            ? 'text-xs font-semibold text-emerald-700'
                            : 'text-xs font-semibold text-rose-700'
                        }
                      >
                        {item.status_cnd || filter}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[color:var(--color-muted)]">
                      <span>
                        CND:{' '}
                        <span className="text-[color:var(--color-ink)]">
                          {item.cnd || '—'}
                        </span>
                      </span>
                      <span>
                        Validade:{' '}
                        <span className="text-[color:var(--color-ink)]">
                          {item.validade_cnd
                            ? formatDate(item.validade_cnd)
                            : '—'}
                        </span>
                      </span>
                    </div>
                    {item.nota_01 ? (
                      <p className="text-xs text-[color:var(--color-muted)]">
                        <span className="font-medium text-[color:var(--color-ink)]">
                          Nota 01:
                        </span>{' '}
                        {item.nota_01}
                      </p>
                    ) : null}
                    {item.nota_02 ? (
                      <p className="text-xs text-[color:var(--color-muted)]">
                        <span className="font-medium text-[color:var(--color-ink)]">
                          Nota 02:
                        </span>{' '}
                        {item.nota_02}
                      </p>
                    ) : null}
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
