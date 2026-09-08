import { Columns3, ListTodo, Plus, Table2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import FiltersBar from '../components/FiltersBar'
import KanbanBoard from '../components/KanbanBoard'
import MotivoAtrasoModal from '../components/MotivoAtrasoModal'
import NovaTarefaModal from '../components/NovaTarefaModal'
import NotificationBell from '../components/NotificationBell'
import ObrigacaoDrawer from '../components/ObrigacaoDrawer'
import StatusBadge from '../components/StatusBadge'
import TarefaDrawer from '../components/TarefaDrawer'
import { KanbanSkeleton, TableSkeleton } from '../components/ui/PageSkeletons'
import { useAuth } from '../context/AuthContext'
import { apiFetch, buildQuery } from '../lib/api'
import {
  currentCompetenciaMonth,
  formatDate,
  formatHorario,
  monthToCompetencia,
} from '../lib/format'
import { mergeWorkItems } from '../lib/workItems'
import type {
  Empresa,
  FilterValues,
  Obrigacao,
  Responsavel,
  StatusObrigacao,
  Tarefa,
  WorkItem,
} from '../types'

type ViewMode = 'kanban' | 'tabela'

function todayIsoLocal(): string {
  const today = new Date()
  return [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, '0'),
    String(today.getDate()).padStart(2, '0'),
  ].join('-')
}

function isLateWorkItem(item: WorkItem): boolean {
  if (item.status === 'ATRASADO' || item.urgencia === 'atrasado') return true
  const prazo = item.prazo?.slice(0, 10)
  if (!prazo) return false
  return prazo < todayIsoLocal()
}

export default function MinhasTarefas() {
  const {
    hasResponsavel,
    responsavelNome,
    responsavelId,
    isViewer,
    profileLoading,
    isAdmin,
    canWrite,
  } = useAuth()
  const [view, setView] = useState<ViewMode>('kanban')
  const [filters, setFilters] = useState<FilterValues>({
    competencia: currentCompetenciaMonth(),
    bu: '',
    status: '',
    search: '',
    responsavel_id: '',
  })
  const [obrigacoes, setObrigacoes] = useState<Obrigacao[]>([])
  const [tarefas, setTarefas] = useState<Tarefa[]>([])
  const [responsaveis, setResponsaveis] = useState<Responsavel[]>([])
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedObrigacao, setSelectedObrigacao] = useState<Obrigacao | null>(
    null,
  )
  const [selectedTarefa, setSelectedTarefa] = useState<Tarefa | null>(null)
  const [pendingLateDelivery, setPendingLateDelivery] = useState<WorkItem | null>(
    null,
  )
  const [lateSubmitting, setLateSubmitting] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [error, setError] = useState('')

  const competenciaIso = monthToCompetencia(filters.competencia)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const q = buildQuery({
        competencia: competenciaIso,
        bu: filters.bu || undefined,
        status: filters.status || undefined,
        responsavel_id:
          isAdmin && filters.responsavel_id
            ? filters.responsavel_id
            : undefined,
        q: filters.search || undefined,
      })
      const [obrData, tarData] = await Promise.all([
        apiFetch<Obrigacao[]>(`/api/obrigacoes${q}`),
        apiFetch<Tarefa[]>(`/api/tarefas${q}`),
      ])
      setObrigacoes(obrData)
      setTarefas(tarData)
      if (isAdmin) {
        const resps = await apiFetch<Responsavel[]>('/api/responsaveis')
        setResponsaveis(resps.filter((r) => r.ativo))
      } else {
        setResponsaveis([])
      }
      if (canWrite) {
        const emps = await apiFetch<Empresa[]>('/api/empresas')
        setEmpresas(emps.filter((e) => e.ativa))
      }
    } catch (err) {
      setObrigacoes([])
      setTarefas([])
      setError(err instanceof Error ? err.message : 'Erro ao carregar tarefas')
    } finally {
      setLoading(false)
    }
  }, [
    competenciaIso,
    filters.bu,
    filters.status,
    filters.search,
    filters.responsavel_id,
    isAdmin,
    canWrite,
  ])

  useEffect(() => {
    if (profileLoading) return
    if (!isAdmin && !hasResponsavel) {
      setObrigacoes([])
      setTarefas([])
      setLoading(false)
      return
    }
    void load()
  }, [load, profileLoading, hasResponsavel, isAdmin])

  const workItems = useMemo(
    () => mergeWorkItems(obrigacoes, tarefas),
    [obrigacoes, tarefas],
  )

  const bus = useMemo(
    () =>
      Array.from(
        new Set(
          [
            ...obrigacoes.map((i) => i.empresa?.bu),
            ...tarefas.map((i) => i.empresa?.bu),
          ].filter(Boolean) as string[],
        ),
      ).sort(),
    [obrigacoes, tarefas],
  )

  const handleStatusChange = async (item: WorkItem, status: StatusObrigacao) => {
    if (isViewer || !canWrite) {
      setError('Conta somente leitura — não é possível alterar status')
      return
    }

    if (status === 'ENTREGUE' && isLateWorkItem(item)) {
      setPendingLateDelivery(item)
      return
    }

    if (item.origem === 'obrigacao') {
      const previous = obrigacoes
      setObrigacoes((curr) =>
        curr.map((o) => (o.id === item.id ? { ...o, status } : o)),
      )
      try {
        const updated = await apiFetch<Obrigacao>(`/api/obrigacoes/${item.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ status }),
        })
        setObrigacoes((curr) =>
          curr.map((o) => (o.id === item.id ? updated : o)),
        )
      } catch (err) {
        setObrigacoes(previous)
        setError(err instanceof Error ? err.message : 'Falha ao mover card')
      }
      return
    }

    const previous = tarefas
    setTarefas((curr) =>
      curr.map((t) => (t.id === item.id ? { ...t, status } : t)),
    )
    try {
      const updated = await apiFetch<Tarefa>(`/api/tarefas/${item.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      })
      setTarefas((curr) => curr.map((t) => (t.id === item.id ? updated : t)))
    } catch (err) {
      setTarefas(previous)
      setError(err instanceof Error ? err.message : 'Falha ao mover card')
    }
  }

  const confirmLateDelivery = async (motivo: string) => {
    const item = pendingLateDelivery
    if (!item) return
    setLateSubmitting(true)
    setError('')
    try {
      if (item.origem === 'obrigacao') {
        const updated = await apiFetch<Obrigacao>(`/api/obrigacoes/${item.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            status: 'ENTREGUE',
            motivo_atraso: motivo,
            data_entrega: todayIsoLocal(),
          }),
        })
        setObrigacoes((curr) =>
          curr.map((o) => (o.id === item.id ? updated : o)),
        )
      } else {
        const updated = await apiFetch<Tarefa>(`/api/tarefas/${item.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            status: 'ENTREGUE',
            motivo_atraso: motivo,
          }),
        })
        setTarefas((curr) => curr.map((t) => (t.id === item.id ? updated : t)))
      }
      setPendingLateDelivery(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao confirmar entrega')
    } finally {
      setLateSubmitting(false)
    }
  }

  const openItem = (item: WorkItem) => {
    if (item.origem === 'obrigacao' && item.obrigacao) {
      setSelectedTarefa(null)
      setSelectedObrigacao(item.obrigacao)
      return
    }
    if (item.tarefa) {
      setSelectedObrigacao(null)
      setSelectedTarefa(item.tarefa)
    }
  }

  if (profileLoading) {
    return (
      <div className="space-y-6">
        <div className="skeleton h-8 w-48" />
        <KanbanSkeleton />
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
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[color:var(--color-ink)]">
            Minhas tarefas
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canWrite ? (
            <button
              type="button"
              className="btn-primary !py-2"
              onClick={() => setCreateOpen(true)}
            >
              <Plus className="h-4 w-4" strokeWidth={1.75} />
              Nova tarefa
            </button>
          ) : null}
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
      />

      {error && (
        <p className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>
      )}

      {isViewer && (
        <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Modo visualizador: você pode consultar o Kanban, mas não arrastar nem
          editar tarefas.
        </p>
      )}

      {loading ? (
        view === 'kanban' ? (
          <KanbanSkeleton />
        ) : (
          <TableSkeleton rows={8} cols={5} />
        )
      ) : workItems.length === 0 ? (
        <div className="glass-panel p-6 text-sm text-[color:var(--color-muted)]">
          Nenhuma tarefa neste filtro.
          {canWrite ? (
            <>
              {' '}
              <button
                type="button"
                className="font-semibold text-brand-600 hover:underline"
                onClick={() => setCreateOpen(true)}
              >
                Criar a primeira
              </button>
            </>
          ) : null}
        </div>
      ) : view === 'kanban' ? (
        <KanbanBoard
          items={workItems}
          onStatusChange={handleStatusChange}
          onCardClick={openItem}
          readOnly={!canWrite}
        />
      ) : (
        <div className="card-surface overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[color:var(--color-line)] bg-[color:var(--color-surface)] text-left text-xs font-medium uppercase tracking-wide text-[color:var(--color-muted)]">
                  <th className="px-5 py-3">Tipo</th>
                  <th className="px-5 py-3">Título</th>
                  <th className="px-5 py-3">Detalhe</th>
                  <th className="px-5 py-3">Prazo</th>
                  <th className="px-5 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[color:var(--color-line)]">
                {workItems.map((item) => (
                  <tr
                    key={item.key}
                    className="cursor-pointer hover:bg-brand-500/10"
                    onClick={() => openItem(item)}
                  >
                    <td className="px-5 py-3 text-[color:var(--color-muted)]">
                      {item.origem === 'tarefa' ? 'Tarefa' : 'Obrigação'}
                    </td>
                    <td className="px-5 py-3 font-medium text-[color:var(--color-ink)]">
                      {item.title}
                    </td>
                    <td className="px-5 py-3 text-[color:var(--color-muted)]">
                      {item.subtitle}
                    </td>
                    <td className="px-5 py-3 text-[color:var(--color-muted)]">
                      {formatDate(item.prazo)}
                      {formatHorario(item.horaInicio, item.horaFim)
                        ? ` · ${formatHorario(item.horaInicio, item.horaFim)}`
                        : ''}
                    </td>
                    <td className="px-5 py-3">
                      <StatusBadge status={item.status} urgencia={item.urgencia} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ObrigacaoDrawer
        obrigacao={selectedObrigacao}
        open={Boolean(selectedObrigacao)}
        onClose={() => setSelectedObrigacao(null)}
        onSaved={(u) => {
          setObrigacoes((prev) => prev.map((x) => (x.id === u.id ? u : x)))
          setSelectedObrigacao(u)
        }}
      />

      <TarefaDrawer
        tarefa={selectedTarefa}
        open={Boolean(selectedTarefa)}
        onClose={() => setSelectedTarefa(null)}
        readOnly={!canWrite}
        onSaved={(u) => {
          setTarefas((prev) => prev.map((x) => (x.id === u.id ? u : x)))
          setSelectedTarefa(u)
        }}
        onDeleted={(id) => {
          setTarefas((prev) => prev.filter((x) => x.id !== id))
          setSelectedTarefa(null)
        }}
      />

      <MotivoAtrasoModal
        open={Boolean(pendingLateDelivery)}
        title={pendingLateDelivery?.title ?? ''}
        subtitle={pendingLateDelivery?.subtitle}
        submitting={lateSubmitting}
        onCancel={() => {
          if (lateSubmitting) return
          setPendingLateDelivery(null)
        }}
        onConfirm={confirmLateDelivery}
      />

      <NovaTarefaModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(t) => setTarefas((prev) => [t, ...prev])}
        defaultCompetencia={competenciaIso}
        defaultResponsavelId={responsavelId}
        empresas={empresas}
        responsaveis={responsaveis}
        allowPickResponsavel={isAdmin}
      />
    </div>
  )
}
