import { Fragment, useMemo, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { formatMoneyBRL } from '../../lib/format'

export type OrgaoCategoria = 'CADIN' | 'PGFN' | 'RFB'

export type ObservacaoNota = {
  orgaos: OrgaoCategoria[]
  tipo: '01' | '02'
  texto: string
}

export type ObservacaoRow = {
  empresa: string
  notas: ObservacaoNota[]
  total: number
  cadin: number
  pgfn: number
  rfb: number
  categorias: OrgaoCategoria[]
}

const CATEGORIA_STYLE: Record<OrgaoCategoria, string> = {
  CADIN:
    'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
  PGFN: 'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200',
  RFB: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200',
}

const VALOR_STYLE: Record<OrgaoCategoria, string> = {
  CADIN: 'text-amber-700 dark:text-amber-300',
  PGFN: 'text-violet-700 dark:text-violet-300',
  RFB: 'text-sky-700 dark:text-sky-300',
}

const PREVIEW_MAX = 120
const ORGAO_ORDER: OrgaoCategoria[] = ['CADIN', 'PGFN', 'RFB']

function orgaoBucket(orgao: string): OrgaoCategoria | null {
  const key = (orgao || '').trim().toUpperCase()
  if (key.includes('CADIN')) return 'CADIN'
  if (key.includes('PGFN')) return 'PGFN'
  if (key === 'RFB') return 'RFB'
  return null
}

function normalizeTexto(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ')
}

function categoriasFromItem(item: {
  cadin: number
  pgfn: number
  rfb: number
}): OrgaoCategoria[] {
  const cats: OrgaoCategoria[] = []
  if (item.cadin > 0) cats.push('CADIN')
  if (item.pgfn > 0) cats.push('PGFN')
  if (item.rfb > 0) cats.push('RFB')
  return cats
}

function valorPorCategoria(item: ObservacaoRow, cat: OrgaoCategoria): number {
  if (cat === 'CADIN') return item.cadin
  if (cat === 'PGFN') return item.pgfn
  return item.rfb
}

function sortOrgaos(orgaos: OrgaoCategoria[]): OrgaoCategoria[] {
  return ORGAO_ORDER.filter((o) => orgaos.includes(o))
}

function notaPrincipal(notas: ObservacaoNota[]): ObservacaoNota {
  return notas.find((n) => n.tipo === '01') ?? notas[0]
}

function needsExpand(notas: ObservacaoNota[]): boolean {
  if (notas.length > 1) return true
  const first = notas[0]
  return Boolean(first && first.texto.length > PREVIEW_MAX)
}

function collectNotas(
  rows: {
    orgao?: string | null
    nota_01?: string | null
    nota_02?: string | null
  }[],
): ObservacaoNota[] {
  const map = new Map<string, ObservacaoNota>()

  const push = (tipo: '01' | '02', raw: string, orgao: OrgaoCategoria | null) => {
    const texto = normalizeTexto(raw)
    if (!texto) return
    const key = `${tipo}|${texto.toLowerCase()}`
    const current = map.get(key)
    if (current) {
      if (orgao && !current.orgaos.includes(orgao)) {
        current.orgaos = sortOrgaos([...current.orgaos, orgao])
      }
      return
    }
    map.set(key, {
      tipo,
      texto,
      orgaos: orgao ? [orgao] : [],
    })
  }

  for (const row of rows) {
    const orgao = orgaoBucket(String(row.orgao || ''))
    push('01', row.nota_01 ?? '', orgao)
    push('02', row.nota_02 ?? '', orgao)
  }

  return [...map.values()].sort((a, b) => {
    if (a.tipo !== b.tipo) return a.tipo.localeCompare(b.tipo)
    return a.texto.localeCompare(b.texto, 'pt-BR')
  })
}

export function buildObservacoesFromPivot(
  items: {
    empresa: string
    total: number
    cadin: number
    pgfn: number
    rfb: number
    rows: {
      orgao?: string | null
      nota_01?: string | null
      nota_02?: string | null
    }[]
  }[],
): ObservacaoRow[] {
  const out: ObservacaoRow[] = []
  for (const item of items) {
    const notas = collectNotas(item.rows)
    if (notas.length === 0) continue
    if (item.total <= 0) continue
    out.push({
      empresa: item.empresa,
      notas,
      total: item.total,
      cadin: item.cadin,
      pgfn: item.pgfn,
      rfb: item.rfb,
      categorias: categoriasFromItem(item),
    })
  }
  return out.sort(
    (a, b) => b.total - a.total || a.empresa.localeCompare(b.empresa, 'pt-BR'),
  )
}

function NotaChips({ nota }: { nota: ObservacaoNota }) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600 dark:bg-white/10 dark:text-slate-300">
        Nota {nota.tipo}
      </span>
      {nota.orgaos.map((orgao) => (
        <span
          key={orgao}
          className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${CATEGORIA_STYLE[orgao]}`}
        >
          {orgao}
        </span>
      ))}
    </div>
  )
}

export default function PainelFiscalObservacoesPanel({
  rows,
  onSelectEmpresa,
}: {
  rows: ObservacaoRow[]
  onSelectEmpresa: (empresa: string) => void
}) {
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(
      (r) =>
        r.empresa.toLowerCase().includes(q) ||
        r.categorias.some((c) => c.toLowerCase().includes(q)) ||
        r.notas.some(
          (n) =>
            n.texto.toLowerCase().includes(q) ||
            n.orgaos.some((o) => o.toLowerCase().includes(q)),
        ),
    )
  }, [rows, search])

  const toggleExpand = (empresa: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(empresa)) next.delete(empresa)
      else next.add(empresa)
      return next
    })
  }

  return (
    <div
      className="glass-panel overflow-hidden !rounded-3xl"
      id="painel-fiscal-observacoes"
    >
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[color:var(--color-line)] px-5 py-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-[color:var(--color-ink)]">
              Com observação
            </h2>
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold tabular-nums text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
              {rows.length}
            </span>
          </div>
          <p className="mt-1 text-xs text-[color:var(--color-muted)]">
            Recurso, retificação ou nota — não implica obrigação de pagar.
          </p>
        </div>
        <label className="relative block w-full max-w-xs">
          <input
            className="glass-input w-full py-2 px-3 text-sm"
            placeholder="Buscar empresa, órgão ou nota…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Buscar empresa, órgão ou nota"
          />
        </label>
      </div>

      <div className="max-h-[28rem] overflow-auto">
        {filtered.length === 0 ? (
          <p className="py-12 text-center text-sm text-[color:var(--color-muted)]">
            Nenhuma observação neste filtro
          </p>
        ) : (
          <table className="min-w-full text-left text-sm">
            <thead className="sticky top-0 z-[1] bg-white dark:bg-[color:var(--color-panel)]">
              <tr className="border-b border-[color:var(--color-line)] text-[11px] uppercase tracking-wide text-[color:var(--color-muted)]">
                <th className="w-8 px-3 py-3 font-semibold" aria-label="Expandir" />
                <th className="px-5 py-3 font-semibold">Empresa</th>
                <th className="px-5 py-3 font-semibold">Órgão</th>
                <th className="px-5 py-3 text-right font-semibold">Valor</th>
                <th className="px-5 py-3 font-semibold">Observação</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => {
                const principal = notaPrincipal(item.notas)
                const canExpand = needsExpand(item.notas)
                const isOpen = expanded.has(item.empresa)
                const extraCount = Math.max(0, item.notas.length - 1)
                const detailId = `obs-detail-${item.empresa}`

                return (
                  <Fragment key={item.empresa}>
                    <tr
                      className="cursor-pointer border-b border-[color:var(--color-line)] transition hover:bg-brand-50 dark:hover:bg-white/5"
                      onClick={() => onSelectEmpresa(item.empresa)}
                    >
                      <td className="px-2 py-3 align-middle">
                        {canExpand ? (
                          <button
                            type="button"
                            className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-[color:var(--color-muted)] transition hover:bg-[color:var(--nav-hover)] hover:text-[color:var(--color-ink)]"
                            aria-expanded={isOpen}
                            aria-controls={detailId}
                            aria-label={
                              isOpen
                                ? `Recolher observações de ${item.empresa}`
                                : `Expandir observações de ${item.empresa}`
                            }
                            onClick={(e) => {
                              e.stopPropagation()
                              toggleExpand(item.empresa)
                            }}
                          >
                            <ChevronDown
                              className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                              strokeWidth={1.75}
                            />
                          </button>
                        ) : (
                          <span className="inline-block h-7 w-7" />
                        )}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3 align-middle">
                        <span className="font-semibold text-[color:var(--color-ink)]">
                          {item.empresa}
                        </span>
                      </td>
                      <td className="px-5 py-3 align-middle">
                        {item.categorias.length === 0 ? (
                          <span className="text-xs text-[color:var(--color-muted)]">
                            —
                          </span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {item.categorias.map((cat) => (
                              <span
                                key={cat}
                                className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${CATEGORIA_STYLE[cat]}`}
                              >
                                {cat}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3 text-right align-middle tabular-nums">
                        {item.categorias.length === 0 ? (
                          <span className="font-semibold text-[color:var(--color-ink)]">
                            {formatMoneyBRL(item.total)}
                          </span>
                        ) : item.categorias.length === 1 ? (
                          <span
                            className={`font-semibold ${VALOR_STYLE[item.categorias[0]]}`}
                          >
                            {formatMoneyBRL(
                              valorPorCategoria(item, item.categorias[0]),
                            )}
                          </span>
                        ) : (
                          <div className="flex flex-col items-end gap-0.5">
                            {item.categorias.map((cat) => (
                              <span
                                key={cat}
                                className={`text-xs font-semibold ${VALOR_STYLE[cat]}`}
                              >
                                <span className="mr-1.5 font-medium opacity-70">
                                  {cat}
                                </span>
                                {formatMoneyBRL(valorPorCategoria(item, cat))}
                              </span>
                            ))}
                            <span className="mt-0.5 border-t border-[color:var(--color-line)] pt-0.5 text-sm font-bold text-[color:var(--color-ink)]">
                              {formatMoneyBRL(item.total)}
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="max-w-xl px-5 py-3 align-middle">
                        <div className="flex flex-col gap-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <NotaChips nota={principal} />
                            {extraCount > 0 ? (
                              <button
                                type="button"
                                className="text-[11px] font-semibold text-brand-600 hover:underline"
                                aria-expanded={isOpen}
                                aria-controls={detailId}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  toggleExpand(item.empresa)
                                }}
                              >
                                +{extraCount}{' '}
                                {extraCount === 1 ? 'nota' : 'notas'}
                              </button>
                            ) : principal.texto.length > PREVIEW_MAX ? (
                              <button
                                type="button"
                                className="text-[11px] font-semibold text-brand-600 hover:underline"
                                aria-expanded={isOpen}
                                aria-controls={detailId}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  toggleExpand(item.empresa)
                                }}
                              >
                                {isOpen ? 'ocultar' : 'ver completa'}
                              </button>
                            ) : null}
                          </div>
                          <p className="line-clamp-1 text-sm text-[color:var(--color-muted)]">
                            {principal.texto}
                          </p>
                        </div>
                      </td>
                    </tr>
                    {canExpand && isOpen ? (
                      <tr
                        id={detailId}
                        className="border-b border-[color:var(--color-line)] bg-[color:var(--color-surface)]"
                      >
                        <td colSpan={5} className="px-5 py-3">
                          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[color:var(--color-muted)]">
                            Observações de {item.empresa}
                          </p>
                          <ul className="space-y-3">
                            {item.notas.map((nota) => (
                              <li
                                key={`${nota.tipo}|${nota.texto}`}
                                className="rounded-2xl border border-[color:var(--color-line)] bg-white px-4 py-3 dark:bg-[color:var(--color-panel)]"
                              >
                                <NotaChips nota={nota} />
                                <p className="mt-2 text-sm leading-relaxed text-[color:var(--color-ink)]">
                                  {nota.texto}
                                </p>
                              </li>
                            ))}
                          </ul>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
