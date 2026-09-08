import { ListChecks, Pencil } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import ExportMenu, { marketCallFilename } from '../components/ExportMenu'
import FiltersBar from '../components/FiltersBar'
import NotificationBell from '../components/NotificationBell'
import ObrigacaoDrawer from '../components/ObrigacaoDrawer'
import StatusBadge from '../components/StatusBadge'
import { TableSkeleton } from '../components/ui/PageSkeletons'
import { apiFetch, buildQuery } from '../lib/api'
import {
  currentCompetenciaMonth,
  formatDate,
  monthToCompetencia,
} from '../lib/format'
import type { FilterValues, Obrigacao } from '../types'

export default function Obrigacoes() {
  const [filters, setFilters] = useState<FilterValues>({
    competencia: currentCompetenciaMonth(),
    bu: '',
    status: '',
    search: '',
  })
  const [items, setItems] = useState<Obrigacao[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Obrigacao | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await apiFetch<Obrigacao[]>(
        `/api/obrigacoes${buildQuery({
          competencia: monthToCompetencia(filters.competencia),
          bu: filters.bu || undefined,
          status: filters.status || undefined,
          q: filters.search || undefined,
        })}`,
      )
      setItems(data)
    } catch {
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => {
    void load()
  }, [load])

  const bus = [...new Set(items.map((o) => o.empresa?.bu).filter(Boolean) as string[])].sort()

  const openDrawer = (o: Obrigacao) => {
    setSelected(o)
    setDrawerOpen(true)
  }

  const handleSaved = (updated: Obrigacao) => {
    setItems((prev) => prev.map((o) => (o.id === updated.id ? updated : o)))
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-500/15 text-brand-600">
            <ListChecks className="h-5 w-5" strokeWidth={1.75} />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[color:var(--color-ink)]">
              Obrigações
            </h1>
            <p className="text-sm text-[color:var(--color-muted)]">
              Gerencie entregas fiscais por competência
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <NotificationBell />
          <ExportMenu
            query={buildQuery({
              competencia: monthToCompetencia(filters.competencia),
              bu: filters.bu || undefined,
              status: filters.status || undefined,
              q: filters.search || undefined,
            })}
            pptxFilename={marketCallFilename(filters.competencia)}
          />
        </div>
      </div>

      <FiltersBar filters={filters} onChange={setFilters} bus={bus} />

      <div className="card-surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[color:var(--color-line)] bg-[color:var(--color-surface)] text-left text-xs font-medium uppercase tracking-wide text-[color:var(--color-muted)]">
                <th className="px-5 py-3">Empresa</th>
                <th className="px-5 py-3">CNPJ</th>
                <th className="px-5 py-3">BU</th>
                <th className="px-5 py-3">Atividade</th>
                <th className="px-5 py-3">Responsável</th>
                <th className="px-5 py-3">Prazo fiscal</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[color:var(--color-line)]">
              {loading ? (
                <TableSkeleton asRows rows={8} cols={8} />
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-8 text-center text-[color:var(--color-muted)]">
                    Nenhuma obrigação encontrada
                  </td>
                </tr>
              ) : (
                items.map((o) => (
                  <tr key={o.id} className="hover:bg-brand-500/10">
                    <td className="px-5 py-3 font-medium text-[color:var(--color-ink)]">
                      {o.empresa?.razao_social ?? '—'}
                    </td>
                    <td className="px-5 py-3 font-mono text-xs text-[color:var(--color-muted)]">
                      {o.empresa?.cnpj ?? '—'}
                    </td>
                    <td className="px-5 py-3 text-[color:var(--color-muted)]">
                      {o.empresa?.bu ?? '—'}
                    </td>
                    <td className="px-5 py-3 text-[color:var(--color-muted)]">
                      {o.atividade?.nome ?? '—'}
                    </td>
                    <td className="px-5 py-3 text-[color:var(--color-muted)]">
                      {o.responsavel?.nome ?? '—'}
                    </td>
                    <td className="px-5 py-3 text-[color:var(--color-muted)]">
                      {formatDate(o.prazo_fiscal ?? o.prazo_legal)}
                    </td>
                    <td className="px-5 py-3">
                      <StatusBadge status={o.status} urgencia={o.urgencia} />
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => openDrawer(o)}
                        className="btn-ghost !px-2.5 !py-1.5 text-xs"
                      >
                        <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} />
                        Editar
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ObrigacaoDrawer
        obrigacao={selected}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onSaved={handleSaved}
      />
    </div>
  )
}
