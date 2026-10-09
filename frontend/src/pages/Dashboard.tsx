import { CalendarPlus, Inbox, Upload } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'
import AnalyticsHeroKpis from '../components/analytics/AnalyticsHeroKpis'
import AnalyticsSkeleton from '../components/analytics/AnalyticsSkeleton'
import ResponsavelCargaCarousel from '../components/analytics/ResponsavelCargaCarousel'
import WorkflowStrip from '../components/analytics/WorkflowStrip'
import BuStatusMatrix, { type BuStatusCounts } from '../components/diretoria/BuStatusMatrix'
import DiretoriaDrillModal from '../components/diretoria/DiretoriaDrillModal'
import ExportMenu, { marketCallFilename } from '../components/ExportMenu'
import FiltersBar from '../components/FiltersBar'
import NotificationBell from '../components/NotificationBell'
import ObrigacaoDrawer from '../components/ObrigacaoDrawer'
import { useAuth } from '../context/AuthContext'
import { apiFetch, buildQuery } from '../lib/api'
import { resolveAvatarUrl } from '../lib/avatars'
import { obrigacaoResponsaveis } from '../lib/responsaveis'
import { workItemFromObrigacao } from '../lib/workItems'
import {
  colunaKanban,
  currentCompetenciaMonth,
  formatCompetencia,
  isItemAtrasado,
  monthToCompetencia,
  nextCompetenciaDate,
  statusLabel,
} from '../lib/format'
import type {
  Atividade,
  DashboardSummary,
  FilterValues,
  GerarCompetenciaResponse,
  Obrigacao,
  Responsavel,
  StatusObrigacao,
} from '../types'

const STATUS_COLORS: Record<string, string> = {
  Pendente: '#64748b',
  Andamento: '#0284c7',
  Revisão: '#d97706',
  Entregue: '#059669',
  Atrasado: '#e11d48',
}

export default function Dashboard() {
  const { isAdmin } = useAuth()
  const [filters, setFilters] = useState<FilterValues>({
    competencia: currentCompetenciaMonth(),
    bu: '',
    status: '',
    search: '',
    responsavel_id: '',
    atividade_id: '',
  })
  const [atividades, setAtividades] = useState<Atividade[]>([])
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [obrigacoes, setObrigacoes] = useState<Obrigacao[]>([])
  const [responsaveis, setResponsaveis] = useState<Responsavel[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [message, setMessage] = useState('')
  const [drill, setDrill] = useState<{ bu: string; status: StatusObrigacao | null } | null>(null)
  const [selected, setSelected] = useState<Obrigacao | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [summaryData, obrigacoesData] = await Promise.all([
        apiFetch<DashboardSummary>(
          `/api/dashboard/summary${buildQuery({
            competencia: monthToCompetencia(filters.competencia),
            bu: filters.bu || undefined,
            responsavel_id:
              isAdmin && filters.responsavel_id
                ? filters.responsavel_id
                : undefined,
            atividade_id: filters.atividade_id || undefined,
          })}`,
        ),
        apiFetch<Obrigacao[]>(
          `/api/obrigacoes${buildQuery({
            competencia: monthToCompetencia(filters.competencia),
            bu: filters.bu || undefined,
            status: filters.status || undefined,
            responsavel_id:
              isAdmin && filters.responsavel_id
                ? filters.responsavel_id
                : undefined,
            q: filters.search || undefined,
            atividade_id: filters.atividade_id || undefined,
          })}`,
        ),
      ])
      setSummary(summaryData)
      setObrigacoes(obrigacoesData)
      if (isAdmin) {
        const resps = await apiFetch<Responsavel[]>('/api/responsaveis')
        setResponsaveis(resps.filter((r) => r.ativo))
      } else {
        setResponsaveis([])
      }
    } catch {
      setSummary(null)
      setObrigacoes([])
    } finally {
      setLoading(false)
    }
  }, [
    filters.competencia,
    filters.bu,
    filters.status,
    filters.search,
    filters.responsavel_id,
    filters.atividade_id,
    isAdmin,
  ])

  useEffect(() => {
    void loadData()
  }, [loadData])

  useEffect(() => {
    apiFetch<Atividade[]>('/api/atividades')
      .then((rows) => setAtividades(rows.filter((a) => a.ativa)))
      .catch(() => setAtividades([]))
  }, [])

  const handleGerar = async () => {
    setGenerating(true)
    setMessage('')
    try {
      const result = await apiFetch<GerarCompetenciaResponse>(
        '/api/obrigacoes/gerar',
        {
          method: 'POST',
          body: JSON.stringify({
            competencia_destino: nextCompetenciaDate(filters.competencia),
            competencia_origem: monthToCompetencia(filters.competencia),
          }),
        },
      )
      setMessage(
        `Competência ${formatCompetencia(result.competencia_destino)}: ${result.criadas} criadas, ${result.ignoradas} ignoradas.`,
      )
      void loadData()
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Erro ao gerar competência')
    } finally {
      setGenerating(false)
    }
  }

  const exportQuery = buildQuery({
    competencia: monthToCompetencia(filters.competencia),
    bu: filters.bu || undefined,
    status: filters.status || undefined,
    responsavel_id: filters.responsavel_id || undefined,
    q: filters.search || undefined,
    atividade_id: filters.atividade_id || undefined,
  })

  const bus = summary ? Object.keys(summary.por_bu).sort() : []

  const chartResp = useMemo(() => {
    if (!summary) return []

    const byResp = new Map<
      string,
      { total: number; atividades: Map<string, number> }
    >()

    for (const o of obrigacoes) {
      const atividade = o.atividade?.nome ?? 'Sem atividade'
      const nomes = obrigacaoResponsaveis(o).map((r) => r.nome)
      for (const nome of nomes.length > 0 ? nomes : ['Sem responsável']) {
        const bucket = byResp.get(nome) ?? {
          total: 0,
          atividades: new Map<string, number>(),
        }
        bucket.total += 1
        bucket.atividades.set(atividade, (bucket.atividades.get(atividade) ?? 0) + 1)
        byResp.set(nome, bucket)
      }
    }

    // Garante quem veio só do summary também aparece
    for (const [nome, total] of Object.entries(summary.por_responsavel)) {
      if (!byResp.has(nome)) {
        byResp.set(nome, { total, atividades: new Map() })
      }
    }

    return Array.from(byResp.entries())
      .map(([nome, data]) => {
        const match = responsaveis.find(
          (r) => r.nome.toLowerCase() === nome.toLowerCase(),
        )
        return {
          id: match?.id,
          nome,
          total: data.total,
          capacidadeMax:
            match?.capacidade_max ??
            summary.capacidade_por_responsavel?.[nome] ??
            null,
          fotoUrl: resolveAvatarUrl(nome, match?.foto_url),
          atividades: Array.from(data.atividades.entries())
            .map(([atividade, quantidade]) => ({ nome: atividade, quantidade }))
            .sort((a, b) => b.quantidade - a.quantidade),
        }
      })
      .sort((a, b) => b.total - a.total)
  }, [summary, obrigacoes, responsaveis])

  const buCounts = useMemo(() => {
    const counts: BuStatusCounts = {}
    const empty = () => ({ status: {}, atrasados: {} })
    for (const o of obrigacoes) {
      const cell = (counts[o.empresa?.bu?.trim() || 'Sem BU'] ??= empty())
      const col = colunaKanban(o.status)
      cell.status[col] = (cell.status[col] ?? 0) + 1
      if (isItemAtrasado(o)) cell.atrasados[col] = (cell.atrasados[col] ?? 0) + 1
    }
    for (const bu of Object.keys(summary?.por_bu ?? {})) {
      counts[bu] ??= empty()
    }
    return counts
  }, [summary, obrigacoes])

  const drillItems = useMemo(() => {
    if (!drill) return []
    return obrigacoes
      .filter(
        (o) =>
          (o.empresa?.bu?.trim() || 'Sem BU') === drill.bu &&
          (!drill.status || colunaKanban(o.status) === drill.status),
      )
      .map(workItemFromObrigacao)
  }, [drill, obrigacoes])

  const pieData = useMemo(() => {
    if (!summary) return []
    return [
      { name: 'Pendente', value: summary.pendente },
      { name: 'Andamento', value: summary.em_andamento },
      { name: 'Revisão', value: summary.em_revisao },
      { name: 'Entregue', value: summary.entregue },
      { name: 'Atrasado', value: summary.atrasado },
    ].filter((d) => d.value > 0)
  }, [summary])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight text-[color:var(--color-ink)]">
          Analytics
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <NotificationBell placement="bottom-right" />
          <ExportMenu
            query={exportQuery}
            pptxFilename={marketCallFilename(filters.competencia)}
          />
          {isAdmin && (
            <>
              <button
                type="button"
                onClick={() => void handleGerar()}
                disabled={generating}
                className="btn-primary"
              >
                <CalendarPlus className="h-4 w-4" strokeWidth={1.75} />
                {generating ? 'Gerando...' : 'Gerar próxima competência'}
              </button>
            </>
          )}
        </div>
      </div>

      {message && (
        <p className="glass-panel px-4 py-3 text-sm text-brand-800">
          {message}
        </p>
      )}

      <FiltersBar
        filters={filters}
        onChange={setFilters}
        bus={bus}
        responsaveis={isAdmin ? responsaveis : undefined}
        atividades={atividades}
      />

      {loading && !summary ? (
        <AnalyticsSkeleton variant="full" />
      ) : summary ? (
        <>
          {summary.total === 0 && !loading && (
            <div className="glass-panel flex flex-col items-start gap-3 p-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-700">
                  <Inbox className="h-5 w-5" strokeWidth={1.75} />
                </div>
                <div>
                  <p className="font-semibold text-[color:var(--color-ink)]">
                    Nenhuma obrigação nesta competência
                  </p>
                  <p className="text-sm text-[color:var(--color-muted)]">
                    Os dados do CSV estão em <strong>Ago/2026</strong> — ajuste o
                    filtro ou importe um arquivo.
                  </p>
                </div>
              </div>
              <Link to="/importacao" className="btn-primary shrink-0">
                <Upload className="h-4 w-4" strokeWidth={1.75} />
                Ir para Importação
              </Link>
            </div>
          )}

          <div
            className={
              loading
                ? 'space-y-6 opacity-60 transition-opacity duration-200'
                : 'space-y-6 transition-opacity duration-200'
            }
          >
            <AnalyticsHeroKpis summary={summary} />
          </div>

          <WorkflowStrip
            summary={summary}
            activeStatus={filters.status}
            onSelect={(status) =>
              setFilters((prev) => ({ ...prev, status: status as string }))
            }
          />

          {loading ? (
            <AnalyticsSkeleton variant="charts" />
          ) : (            <>
              <div className="grid gap-6 lg:grid-cols-2">
                <div className="glass-panel flex flex-col p-5">
                  <div className="mb-1 flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold text-[color:var(--color-ink)]">
                        Mix de status
                      </h3>
                      <p className="text-xs text-[color:var(--color-muted)]">
                        Distribuição do workflow na competência
                      </p>
                    </div>
                    {summary.total > 0 && (
                      <span className="glass-chip tabular-nums text-brand-700">
                        {summary.total} total
                      </span>
                    )}
                  </div>

                  <div className="relative mt-2 h-64">
                    {pieData.length === 0 ? (
                      <p className="flex h-full items-center justify-center text-sm text-[color:var(--color-muted)]">
                        Sem dados
                      </p>
                    ) : (
                      <>
                        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                          <div className="text-center">
                            <p className="text-3xl font-bold tracking-tight text-[color:var(--color-ink)]">
                              {summary.percentual_entregue}%
                            </p>
                            <p className="text-[11px] font-medium text-[color:var(--color-muted)]">
                              entregue
                            </p>
                          </div>
                        </div>
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <defs>
                              <filter
                                id="donutShadow"
                                x="-20%"
                                y="-20%"
                                width="140%"
                                height="140%"
                              >
                                <feDropShadow
                                  dx="0"
                                  dy="6"
                                  stdDeviation="8"
                                  floodColor="rgb(33 43 54)"
                                  floodOpacity="0.14"
                                />
                              </filter>
                            </defs>
                            <Pie
                              data={pieData}
                              dataKey="value"
                              nameKey="name"
                              innerRadius={62}
                              outerRadius={92}
                              paddingAngle={4}
                              cornerRadius={6}
                              stroke="#ffffff"
                              strokeWidth={3}
                              style={{ filter: 'url(#donutShadow)' }}
                            >
                              {pieData.map((entry) => (
                                <Cell
                                  key={entry.name}
                                  fill={STATUS_COLORS[entry.name] ?? '#94a3b8'}
                                />
                              ))}
                            </Pie>
                            <Tooltip
                              formatter={(value) => [`${value as number}`, 'Qtd']}
                              contentStyle={{
                                borderRadius: 14,
                                border: '1px solid var(--glass-border)',
                                background: 'var(--glass-bg-strong)',
                                color: 'var(--color-ink)',
                                backdropFilter: 'blur(16px)',
                                boxShadow:
                                  '0 12px 28px -14px var(--glass-shadow)',
                                fontSize: 12,
                              }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </>
                    )}
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {pieData.map((d) => (
                      <span key={d.name} className="glass-chip shadow-sm">
                        <span
                          className="h-2.5 w-2.5 rounded-full shadow-sm"
                          style={{ background: STATUS_COLORS[d.name] }}
                        />
                        {d.name} · {d.value}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="min-h-[300px]">
                  <ResponsavelCargaCarousel items={chartResp} />
                </div>
              </div>

              <div className="glass-panel p-5">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-[color:var(--color-ink)]">
                      Distribuição por BU e status
                    </h3>
                    <p className="text-xs text-[color:var(--color-muted)]">
                      Contagem de obrigações por unidade de negócio. Clique para ver os itens.
                    </p>
                  </div>
                  {Object.keys(buCounts).length > 0 && (
                    <span className="glass-chip tabular-nums text-brand-700">
                      {Object.keys(buCounts).length} BUs
                    </span>
                  )}
                </div>
                <BuStatusMatrix
                  counts={buCounts}
                  onCellClick={(bu, status) => setDrill({ bu, status })}
                />
              </div>
            </>
          )}
        </>
      ) : (
        <p className="py-12 text-center text-[color:var(--color-muted)]">
          Não foi possível carregar o resumo.
        </p>
      )}

      <DiretoriaDrillModal
        open={drill != null}
        title={
          drill ? (drill.status ? `${drill.bu} · ${statusLabel(drill.status)}` : `BU ${drill.bu}`) : ''
        }
        items={drillItems}
        closeOnEscape={selected == null}
        onClose={() => setDrill(null)}
        onSelect={(item) => item.obrigacao && setSelected(item.obrigacao)}
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
