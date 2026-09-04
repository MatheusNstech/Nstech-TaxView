import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import AnalyticsSkeleton from '../components/analytics/AnalyticsSkeleton'
import BuStatusMatrix, {
  type BuStatusCounts,
} from '../components/diretoria/BuStatusMatrix'
import DiretoriaChartCard from '../components/diretoria/DiretoriaChartCard'
import DiretoriaDrillModal from '../components/diretoria/DiretoriaDrillModal'
import DiretoriaKpiStrip from '../components/diretoria/DiretoriaKpiStrip'
import ServicoVolumeChart from '../components/diretoria/ServicoVolumeChart'
import FiltersBar from '../components/FiltersBar'
import NotificationBell from '../components/NotificationBell'
import ObrigacaoDrawer from '../components/ObrigacaoDrawer'
import { apiFetch, buildQuery } from '../lib/api'
import {
  aggregateByServico,
  isOutrosServico,
} from '../lib/diretoriaAggregates'
import {
  buildDiretoriaRiscos,
  countRiscosByTipo,
} from '../lib/diretoriaRiscos'
import {
  currentCompetenciaMonth,
  formatCompetencia,
  monthToCompetencia,
} from '../lib/format'
import type {
  DashboardSummary,
  FilterValues,
  Obrigacao,
  StatusObrigacao,
} from '../types'

type DrillMode = {
  bu?: string
  status?: StatusObrigacao | ''
  responsavelNome?: string
  atividadeNome?: string
  excludeAtividades?: string[]
  label: string
} | null

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
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Obrigacao | null>(null)
  const [drill, setDrill] = useState<DrillMode>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const q = buildQuery({
        competencia: monthToCompetencia(filters.competencia),
        bu: filters.bu || undefined,
      })
      const [summaryData, list] = await Promise.all([
        apiFetch<DashboardSummary>(`/api/dashboard/summary${q}`),
        apiFetch<Obrigacao[]>(`/api/obrigacoes${q}`),
      ])
      setSummary(summaryData)
      setObrigacoes(list)
    } catch {
      setSummary(null)
      setObrigacoes([])
    } finally {
      setLoading(false)
    }
  }, [filters.competencia, filters.bu])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const bus = useMemo(
    () => (summary ? Object.keys(summary.por_bu).sort() : []),
    [summary],
  )

  const matrixCounts = useMemo(() => {
    const counts: BuStatusCounts = {}
    for (const o of obrigacoes) {
      const bu = o.empresa?.bu?.trim() || 'Sem BU'
      if (!counts[bu]) counts[bu] = {}
      counts[bu][o.status] = (counts[bu][o.status] ?? 0) + 1
    }
    if (summary) {
      for (const bu of Object.keys(summary.por_bu)) {
        if (!counts[bu]) counts[bu] = {}
      }
    }
    return counts
  }, [obrigacoes, summary])

  const servicoAgg = useMemo(
    () => aggregateByServico(obrigacoes, 10),
    [obrigacoes],
  )

  const topServicoNomes = useMemo(
    () =>
      servicoAgg.volume
        .filter((v) => !isOutrosServico(v.nome))
        .map((v) => v.nome),
    [servicoAgg.volume],
  )

  const riscosCount = useMemo(
    () => countRiscosByTipo(buildDiretoriaRiscos(obrigacoes, summary)),
    [obrigacoes, summary],
  )

  const drillList = useMemo(() => {
    if (!drill) return []
    return obrigacoes.filter((o) => {
      const bu = o.empresa?.bu?.trim() || 'Sem BU'
      const atividade = o.atividade?.nome?.trim() || 'Sem tipo de serviço'
      if (drill.bu && bu !== drill.bu) return false
      if (drill.status && o.status !== drill.status) return false
      if (
        drill.responsavelNome &&
        (o.responsavel?.nome ?? '') !== drill.responsavelNome
      ) {
        return false
      }
      if (drill.atividadeNome && atividade !== drill.atividadeNome) return false
      if (drill.excludeAtividades?.length) {
        if (drill.excludeAtividades.includes(atividade)) return false
      }
      return true
    })
  }, [drill, obrigacoes])

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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[color:var(--color-ink)]">
            Visão - Tax
          </h1>
          <p className="text-sm text-[color:var(--color-muted)]">
            Competência{' '}
            {formatCompetencia(monthToCompetencia(filters.competencia))}
            {' · '}indicadores da competência · leitura consolidada
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/diretoria/fechamento"
            className="btn-ghost !py-2 text-xs font-semibold"
          >
            Fechamento da competência
          </Link>
          <Link
            to="/diretoria/pendencias"
            className="btn-ghost !py-2 text-xs font-semibold"
          >
            Pendências críticas
            {riscosCount.total > 0 && (
              <span className="rounded-full bg-[#FF5630]/15 px-1.5 py-0.5 text-[10px] font-bold text-[#B71D18] tabular-nums">
                {riscosCount.total}
              </span>
            )}
          </Link>
          <NotificationBell placement="bottom-right" />
        </div>
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
          <DiretoriaKpiStrip summary={summary} />

          <DiretoriaChartCard
            title="Volume por tipo de serviço"
            subtitle="Distribuição polar das obrigações por atividade"
          >
            <ServicoVolumeChart
              data={servicoAgg.volume}
              onSelect={openDrillServico}
            />
          </DiretoriaChartCard>

          <DiretoriaChartCard
            title="Distribuição por BU e status"
            subtitle="Contagem de obrigações por unidade de negócio"
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
        closeOnEscape={selected == null}
        onClose={() => setDrill(null)}
        onSelect={setSelected}
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
    </div>
  )
}
