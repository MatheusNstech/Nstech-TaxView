import { Columns3, ListTodo, Table2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import FiltersBar from '../components/FiltersBar'
import KanbanBoard from '../components/KanbanBoard'
import NotificationBell from '../components/NotificationBell'
import ObrigacaoDrawer from '../components/ObrigacaoDrawer'
import StatusBadge from '../components/StatusBadge'
import { useAuth } from '../context/AuthContext'
import { apiFetch, buildQuery } from '../lib/api'
import {
  currentCompetenciaMonth,
  formatDate,
  monthToCompetencia,
} from '../lib/format'
import type { FilterValues, Obrigacao, Responsavel, StatusObrigacao } from '../types'

type ViewMode = 'kanban' | 'tabela'

function prazoRef(o: Obrigacao): string | null {
  return o.prazo_fiscal || o.prazo_legal
}

export default function MinhasTarefas() {
  const { hasResponsavel, responsavelNome, isViewer, profileLoading, isAdmin } =
    useAuth()
  const [view, setView] = useState<ViewMode>('kanban')
  const [filters, setFilters] = useState<FilterValues>({
    competencia: currentCompetenciaMonth(),
    bu: '',
    status: '',
    search: '',
    responsavel_id: '',
  })
  const [items, setItems] = useState<Obrigacao[]>([])
  const [responsaveis, setResponsaveis] = useState<Responsavel[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Obrigacao | null>(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await apiFetch<Obrigacao[]>(
        `/api/obrigacoes${buildQuery({
          competencia: monthToCompetencia(filters.competencia),
          bu: filters.bu || undefined,
          status: filters.status || undefined,
          responsavel_id:
            isAdmin && filters.responsavel_id
              ? filters.responsavel_id
              : undefined,
          q: filters.search || undefined,
        })}`,
      )
      setItems(data)
      if (isAdmin) {
        const resps = await apiFetch<Responsavel[]>('/api/responsaveis')
        setResponsaveis(resps.filter((r) => r.ativo))
      } else {
        setResponsaveis([])
      }
    } catch (err) {
      setItems([])
      setError(err instanceof Error ? err.message : 'Erro ao carregar tarefas')
    } finally {
      setLoading(false)
    }
  }, [
    filters.competencia,
    filters.bu,
    filters.status,
    filters.search,
    filters.responsavel_id,
    isAdmin,
  ])

  useEffect(() => {
    if (profileLoading) return
    if (!isAdmin && !hasResponsavel) {
      setItems([])
      setLoading(false)
      return
    }
    void load()
  }, [load, profileLoading, hasResponsavel, isAdmin])

  const bus = useMemo(
    () =>
      Array.from(
        new Set(items.map((i) => i.empresa?.bu).filter(Boolean) as string[]),
      ).sort(),
    [items],
  )

  const handleStatusChange = async (id: string, status: StatusObrigacao) => {
    if (isViewer) {
      setError('Conta somente leitura — não é possível alterar status')
      return
    }
    const previous = items
    setItems((curr) =>
      curr.map((item) => (item.id === id ? { ...item, status } : item)),
    )
    try {
      const updated = await apiFetch<Obrigacao>(`/api/obrigacoes/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      })
      setItems((curr) => curr.map((item) => (item.id === id ? updated : item)))
    } catch (err) {
      setItems(previous)
      setError(err instanceof Error ? err.message : 'Falha ao mover card')
    }
  }

  if (profileLoading) {
    return (
      <div className="glass-panel p-8 text-center text-sm text-[color:var(--color-muted)]">
        Carregando suas tarefas...
      </div>
    )
  }

  if (!isAdmin && !hasResponsavel) {
    return (
      <div className="glass-panel p-8 text-center">
        <ListTodo className="mx-auto mb-3 h-8 w-8 text-brand-500" strokeWidth={1.5} />
        <h1 className="text-xl font-semibold text-[color:var(--color-ink)]">
          Minhas tarefas
        </h1>
        <p className="mt-2 text-sm text-[color:var(--color-muted)]">
          Seu login ainda não está vinculado a um responsável. Peça a um admin para
          vincular em Usuários.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-500/15 text-brand-600">
            <ListTodo className="h-5 w-5" strokeWidth={1.75} />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[color:var(--color-ink)]">
              Minhas tarefas
            </h1>
            <p className="text-sm text-[color:var(--color-muted)]">
              {isViewer
                ? `Modo visualizador · visão de ${responsavelNome}`
                : isAdmin
                  ? 'Visão admin · todas as obrigações'
                  : `${responsavelNome} · obrigações atribuídas a você`}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <NotificationBell />
          <div className="glass-panel flex items-center gap-1 p-1">
            <button
              type="button"
              onClick={() => setView('kanban')}
              className={[
                'inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition',
                view === 'kanban'
                  ? 'bg-brand-500 text-white shadow-sm'
                  : 'text-[color:var(--color-muted)] hover:bg-[color:var(--nav-hover)]',
              ].join(' ')}
            >
              <Columns3 className="h-3.5 w-3.5" strokeWidth={1.75} />
              Kanban
            </button>
            <button
              type="button"
              onClick={() => setView('tabela')}
              className={[
                'inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition',
                view === 'tabela'
                  ? 'bg-brand-500 text-white shadow-sm'
                  : 'text-[color:var(--color-muted)] hover:bg-[color:var(--nav-hover)]',
              ].join(' ')}
            >
              <Table2 className="h-3.5 w-3.5" strokeWidth={1.75} />
              Tabela
            </button>
          </div>
        </div>
      </div>

      <FiltersBar
        filters={filters}
        onChange={setFilters}
        bus={bus}
        responsaveis={isAdmin ? responsaveis : undefined}
        showStatus={view === 'tabela'}
      />

      {error && (
        <p className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>
      )}

      {isViewer && (
        <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Modo visualizador: você pode consultar o Kanban, mas não arrastar nem
          editar obrigações.
        </p>
      )}

      {loading ? (
        view === 'kanban' ? (
          <div className="flex gap-4 overflow-hidden">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="skeleton h-[520px] w-80 shrink-0" />
            ))}
          </div>
        ) : (
          <div className="glass-panel p-8 text-center text-sm text-[color:var(--color-muted)]">
            Carregando...
          </div>
        )
      ) : items.length === 0 ? (
        <div className="glass-panel p-6 text-sm text-[color:var(--color-muted)]">
          Nenhuma obrigação neste filtro.
        </div>
      ) : view === 'kanban' ? (
        <KanbanBoard
          items={items}
          onStatusChange={handleStatusChange}
          onCardClick={(item) => setSelected(item)}
          readOnly={isViewer}
        />
      ) : (
        <div className="card-surface overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[color:var(--color-line)] bg-[color:var(--color-surface)] text-left text-xs font-medium uppercase tracking-wide text-[color:var(--color-muted)]">
                  <th className="px-5 py-3">Empresa</th>
                  <th className="px-5 py-3">Atividade</th>
                  <th className="px-5 py-3">BU</th>
                  <th className="px-5 py-3">Prazo</th>
                  <th className="px-5 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[color:var(--color-line)]">
                {items.map((o) => (
                  <tr
                    key={o.id}
                    className="cursor-pointer hover:bg-brand-500/10"
                    onClick={() => setSelected(o)}
                  >
                    <td className="px-5 py-3 font-medium text-[color:var(--color-ink)]">
                      {o.empresa?.razao_social ?? '—'}
                    </td>
                    <td className="px-5 py-3 text-[color:var(--color-muted)]">
                      {o.atividade?.nome ?? '—'}
                    </td>
                    <td className="px-5 py-3 text-[color:var(--color-muted)]">
                      {o.empresa?.bu ?? '—'}
                    </td>
                    <td className="px-5 py-3 text-[color:var(--color-muted)]">
                      {formatDate(prazoRef(o))}
                    </td>
                    <td className="px-5 py-3">
                      <StatusBadge status={o.status} urgencia={o.urgencia} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ObrigacaoDrawer
        obrigacao={selected}
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        onSaved={(u) => {
          setItems((prev) => prev.map((x) => (x.id === u.id ? u : x)))
          setSelected(u)
        }}
      />
    </div>
  )
}
