import { Search, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { StatusObrigacao, WorkItem } from '../../types'
import { formatDate, statusLabel } from '../../lib/format'
import { workItemServicoNome } from '../../lib/diretoriaAggregates'
import PersonAvatar from '../PersonAvatar'
import StatusBadge from '../StatusBadge'

interface DiretoriaDrillModalProps {
  open: boolean
  title: string
  items: WorkItem[]
  closeOnEscape?: boolean
  onClose: () => void
  onSelect: (item: WorkItem) => void
}

const STATUS_OPTS: StatusObrigacao[] = [
  'PENDENTE',
  'EM_ANDAMENTO',
  'EM_REVISAO',
  'ENTREGUE',
  'ATRASADO',
]

const selectClass =
  'h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-700 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20'

function itemEmpresa(item: WorkItem): string {
  if (item.origem === 'obrigacao') {
    return item.obrigacao?.empresa?.razao_social ?? '—'
  }
  return item.tarefa?.empresa?.razao_social ?? item.title
}

function itemBu(item: WorkItem): string {
  if (item.origem === 'obrigacao') {
    return item.obrigacao?.empresa?.bu ?? '—'
  }
  return item.tarefa?.empresa?.bu ?? '—'
}

function itemFoto(item: WorkItem): string | null {
  if (item.origem === 'obrigacao') {
    return item.obrigacao?.responsavel?.foto_url ?? null
  }
  return item.tarefa?.responsavel?.foto_url ?? null
}

export default function DiretoriaDrillModal({
  open,
  title,
  items,
  closeOnEscape = true,
  onClose,
  onSelect,
}: DiretoriaDrillModalProps) {
  const [search, setSearch] = useState('')
  const [bu, setBu] = useState('')
  const [responsavel, setResponsavel] = useState('')
  const [status, setStatus] = useState<StatusObrigacao | ''>('')

  useEffect(() => {
    if (!open || !closeOnEscape) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, closeOnEscape, onClose])

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    setSearch('')
    setBu('')
    setResponsavel('')
    setStatus('')
  }, [open, title])

  const bus = useMemo(() => {
    const set = new Set<string>()
    for (const item of items) {
      const v = itemBu(item)
      if (v && v !== '—') set.add(v)
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'))
  }, [items])

  const responsaveis = useMemo(() => {
    const set = new Set<string>()
    for (const item of items) {
      const v = item.responsavelNome?.trim()
      if (v) set.add(v)
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'))
  }, [items])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return items.filter((item) => {
      if (bu && itemBu(item) !== bu) return false
      if (responsavel && (item.responsavelNome ?? '') !== responsavel) return false
      if (status && item.status !== status) return false
      if (!q) return true
      const hay = [
        item.title,
        item.subtitle,
        workItemServicoNome(item),
        item.responsavelNome,
        itemEmpresa(item),
        itemBu(item),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return hay.includes(q)
    })
  }, [items, search, bu, responsavel, status])

  const hasFilters = Boolean(search.trim() || bu || responsavel || status)

  if (!open) return null

  const sameServico =
    items.length > 0 &&
    items.every(
      (item) => workItemServicoNome(item) === workItemServicoNome(items[0]),
    )

  const colSpan = sameServico ? 5 : 6

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-3 sm:p-6">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/40"
        aria-label="Fechar detalhamento"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="diretoria-drill-title"
        className="relative z-10 flex max-h-[min(88vh,760px)] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-[0_24px_64px_rgb(15_23_42_/_0.28)] ring-1 ring-slate-200"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div className="min-w-0">
            <h2
              id="diretoria-drill-title"
              className="text-base font-semibold leading-snug text-slate-900"
            >
              Detalhamento · {title}
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              {hasFilters
                ? `${filtered.length} de ${items.length} item(ns)`
                : `${items.length} item(ns)`}
              {' · '}
              clique para ver detalhes
            </p>
          </div>
          <button
            type="button"
            className="shrink-0 rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
            aria-label="Fechar"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-slate-100 bg-slate-50/80 px-5 py-3">
          <div className="relative min-w-[10rem] flex-1 basis-[12rem]">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar empresa, serviço, tarefa..."
              className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-8 pr-3 text-xs text-slate-700 outline-none placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
            />
          </div>
          <select
            value={bu}
            onChange={(e) => setBu(e.target.value)}
            className={`${selectClass} min-w-[7.5rem]`}
            aria-label="Filtrar por BU"
          >
            <option value="">Todas as BUs</option>
            {bus.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
          <select
            value={responsavel}
            onChange={(e) => setResponsavel(e.target.value)}
            className={`${selectClass} min-w-[9rem]`}
            aria-label="Filtrar por responsável"
          >
            <option value="">Todos responsáveis</option>
            {responsaveis.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as StatusObrigacao | '')}
            className={`${selectClass} min-w-[8rem]`}
            aria-label="Filtrar por status"
          >
            <option value="">Todos status</option>
            {STATUS_OPTS.map((s) => (
              <option key={s} value={s}>
                {statusLabel(s)}
              </option>
            ))}
          </select>
          {hasFilters && (
            <button
              type="button"
              className="h-9 rounded-lg px-2.5 text-xs font-medium text-slate-500 transition hover:bg-white hover:text-slate-800"
              onClick={() => {
                setSearch('')
                setBu('')
                setResponsavel('')
                setStatus('')
              }}
            >
              Limpar
            </button>
          )}
        </div>

        <div
          className={[
            'min-h-0 flex-1 overflow-x-auto overflow-y-auto overscroll-contain',
            '[scrollbar-width:thin]',
            '[scrollbar-color:#cbd5e1_transparent]',
            '[&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar]:h-1.5',
            '[&::-webkit-scrollbar-track]:bg-transparent',
            '[&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300',
            '[&::-webkit-scrollbar-thumb:hover]:bg-slate-400',
          ].join(' ')}
        >
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead className="sticky top-0 z-[1]">
              <tr className="bg-slate-50 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                {!sameServico && (
                  <th className="whitespace-nowrap px-5 py-3">Tipo de serviço</th>
                )}
                <th className="whitespace-nowrap px-5 py-3">Empresa / título</th>
                <th className="whitespace-nowrap px-5 py-3">BU</th>
                <th className="whitespace-nowrap px-5 py-3">Responsável</th>
                <th className="whitespace-nowrap px-5 py-3">Prazo</th>
                <th className="whitespace-nowrap px-5 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={colSpan}
                    className="px-5 py-14 text-center text-slate-500"
                  >
                    {items.length === 0
                      ? 'Nenhum item neste recorte'
                      : 'Nenhum resultado com esses filtros'}
                  </td>
                </tr>
              ) : (
                filtered.map((item) => (
                  <tr
                    key={item.key}
                    className="cursor-pointer border-t border-slate-100 transition hover:bg-slate-50"
                    onClick={() => onSelect(item)}
                  >
                    {!sameServico && (
                      <td className="max-w-[12rem] truncate px-5 py-3.5 font-medium text-slate-800">
                        {workItemServicoNome(item)}
                      </td>
                    )}
                    <td className="max-w-[16rem] truncate px-5 py-3.5 text-slate-700">
                      {item.origem === 'tarefa' ? item.title : itemEmpresa(item)}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3.5 text-slate-600">
                      {itemBu(item)}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3.5 text-slate-700">
                      {item.responsavelNome ? (
                        <span className="inline-flex items-center gap-2">
                          <PersonAvatar
                            nome={item.responsavelNome}
                            fotoUrl={itemFoto(item)}
                          />
                          <span>{item.responsavelNome}</span>
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3.5 tabular-nums text-slate-600">
                      {formatDate(item.prazo)}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3.5">
                      <StatusBadge status={item.status} urgencia={item.urgencia} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          <div className="h-3" aria-hidden />
        </div>
      </div>
    </div>
  )
}
