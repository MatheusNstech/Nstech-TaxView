import { useCallback, useEffect, useMemo, useState } from 'react'
import AnalyticsSkeleton from '../components/analytics/AnalyticsSkeleton'
import BuStatusMatrix, {
  type BuStatusCounts,
} from '../components/diretoria/BuStatusMatrix'
import DiretoriaChartCard from '../components/diretoria/DiretoriaChartCard'
import DiretoriaDrillModal from '../components/diretoria/DiretoriaDrillModal'
import AnalyticsHeroKpis from '../components/analytics/AnalyticsHeroKpis'
import ServicoVolumeChart from '../components/diretoria/ServicoVolumeChart'
import FiltersBar from '../components/FiltersBar'
import NotificationBell from '../components/NotificationBell'
import ObrigacaoDrawer from '../components/ObrigacaoDrawer'
import TarefaDrawer from '../components/TarefaDrawer'
import { apiFetch, buildQuery } from '../lib/api'
import {
  aggregateByServico,
  isOutrosServico,
  workItemServicoNome,
} from '../lib/diretoriaAggregates'
import { mergeWorkItems } from '../lib/workItems'
import {
  currentCompetenciaMonth,
  monthToCompetencia,
} from '../lib/format'
import type {
  DashboardSummary,
  FilterValues,
  Obrigacao,
  StatusObrigacao,
  Tarefa,
  WorkItem,
} from '../types'

type DrillMode = {
  bu?: string
  status?: StatusObrigacao | ''
  responsavelNome?: string
  atividadeNome?: string
  excludeAtividades?: string[]
  label: string
} | null

function itemBu(item: WorkItem): string {
  if (item.origem === 'obrigacao') {
    return item.obrigacao?.empresa?.bu?.trim() || 'Sem BU'
  }
  return item.tarefa?.empresa?.bu?.trim() || 'Sem BU'
}

export default function Diretoria() {
  const [filters, setFilters] = useState<FilterValues>({
    competencia: currentCompetenciaMonth(),
    bu: '',
    status: '',
    search: '',
    responsavel_id: '',
  })
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [obrigacoes, setObrigacoes] = useState<Obrigacao[]>([])
  const [tarefas, setTarefas] = useState<Tarefa[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Obrigacao | null>(null)
  const [selectedTarefa, setSelectedTarefa] = useState<Tarefa | null>(null)
  const [drill, setDrill] = useState<DrillMode>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const q = buildQuery({
        competencia: monthToCompetencia(filters.competencia),
        bu: filters.bu || undefined,
      })
      const [summaryData, list, tarList] = await Promise.all([
        apiFetch<DashboardSummary>(`/api/dashboard/summary${q}`),
        apiFetch<Obrigacao[]>(`/api/obrigacoes${q}`),
        apiFetch<Tarefa[]>(`/api/tarefas${q}`),
      ])
      setSummary(summaryData)
      setObrigacoes(list)
      setTarefas(tarList)
    } catch {
      setSummary(null)
      setObrigacoes([])
      setTarefas([])
    } finally {
      setLoading(false)
    }
  }, [filters.competencia, filters.bu])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const workItems = useMemo(
    () => mergeWorkItems(obrigacoes, tarefas),
    [obrigacoes, tarefas],
  )

  const bus = useMemo(
    () => (summary ? Object.keys(summary.por_bu).sort() : []),
    [summary],
  )

  const matrixCounts = useMemo(() => {
    const counts: BuStatusCounts = {}
    for (const item of workItems) {
      const bu = itemBu(item)
      if (!counts[bu]) counts[bu] = {}
      counts[bu][item.status] = (counts[bu][item.status] ?? 0) + 1
    }
    if (summary) {
      for (const bu of Object.keys(summary.por_bu)) {
        if (!counts[bu]) counts[bu] = {}
      }
    }
    return counts
  }, [workItems, summary])

  const servicoAgg = useMemo(
    () => aggregateByServico(workItems, 10),
    [workItems],
  )

  const topServicoNomes = useMemo(
    () =>
      servicoAgg.volume
        .filter((v) => !isOutrosServico(v.nome))
        .map((v) => v.nome),
    [servicoAgg.volume],
  )

  const drillList = useMemo(() => {
    if (!drill) return []
    return workItems.filter((item) => {
      const bu = itemBu(item)
      const atividade = workItemServicoNome(item)
      if (drill.bu && bu !== drill.bu) return false
      if (drill.status && item.status !== drill.status) return false
      if (
        drill.responsavelNome &&
        (item.responsavelNome ?? '') !== drill.responsavelNome
      ) {
        return false
      }
      if (drill.atividadeNome && atividade !== drill.atividadeNome) return false
      if (drill.excludeAtividades?.length) {
        if (drill.excludeAtividades.includes(atividade)) return false
      }
      return true
    })
  }, [drill, workItems])

  const openDrillBu = (bu: string, status: StatusObrigacao | null) => {
    setDrill({
      bu,
      status: status ?? '',
      label: status ? `${bu} · ${status.replace(/_/g, ' ')}` : `BU ${bu}`,
    })
  }

  const openDrillServico = (nome: string) => {
    if (isOutrosServico(nome)) {
      setDrill({
        label: 'Tipo de serviço · Outros',
        excludeAtividades: topServicoNomes,
      })
      return
    }
    setDrill({
      atividadeNome: nome,
      label: `Tipo de serviço · ${nome}`,
    })
  }

  const openItem = (item: WorkItem) => {
    if (item.origem === 'tarefa' && item.tarefa) {
      setSelectedTarefa(item.tarefa)
      return
    }
    if (item.obrigacao) setSelected(item.obrigacao)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[color:var(--color-ink)]">
            Visão - Tax
          </h1>
        </div>
        <NotificationBell placement="bottom-right" />
      </div>

      <FiltersBar
        filters={filters}
        onChange={(next) => {
          setFilters(next)
          setDrill(null)
        }}
        bus={bus}
        showStatus={false}
        showSearch={false}
      />

      {loading && !summary ? (
        <AnalyticsSkeleton variant="full" />
      ) : summary ? (
        <>
          <AnalyticsHeroKpis summary={summary} />

          <DiretoriaChartCard
            title="Volume por tipo de serviço"
            subtitle="Distribuição polar das obrigações e tarefas por atividade"
          >
            <ServicoVolumeChart
              data={servicoAgg.volume}
              onSelect={openDrillServico}
            />
          </DiretoriaChartCard>

          <DiretoriaChartCard
            title="Distribuição por BU e status"
            subtitle="Contagem de obrigações e tarefas por unidade de negócio"
          >
            <BuStatusMatrix counts={matrixCounts} onCellClick={openDrillBu} />
          </DiretoriaChartCard>
        </>
      ) : (
        <p className="text-sm text-[color:var(--color-muted)]">
          Não foi possível carregar o resumo.
        </p>
      )}

      <DiretoriaDrillModal
        open={drill != null}
        title={drill?.label ?? ''}
        items={drillList}
        closeOnEscape={selected == null && selectedTarefa == null}
        onClose={() => setDrill(null)}
        onSelect={openItem}
      />

      <ObrigacaoDrawer
        obrigacao={selected}
        open={selected != null}
        onClose={() => setSelected(null)}
        onSaved={() => {
          setSelected(null)
          void loadData()
        }}
      />

      <TarefaDrawer
        tarefa={selectedTarefa}
        open={selectedTarefa != null}
        onClose={() => setSelectedTarefa(null)}
        onSaved={() => {
          setSelectedTarefa(null)
          void loadData()
        }}
        onDeleted={() => {
          setSelectedTarefa(null)
          void loadData()
        }}
        readOnly
      />
    </div>
  )
}
