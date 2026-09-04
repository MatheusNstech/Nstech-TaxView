import { AlertTriangle, CalendarClock, CheckCircle2, Timer } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import AnalyticsSkeleton from '../components/analytics/AnalyticsSkeleton'
import DiretoriaChartCard from '../components/diretoria/DiretoriaChartCard'
import FiltersBar from '../components/FiltersBar'
import NotificationBell from '../components/NotificationBell'
import ObrigacaoDrawer from '../components/ObrigacaoDrawer'
import PersonAvatar from '../components/PersonAvatar'
import { apiFetch, buildQuery } from '../lib/api'
import {
  empresasComExcecao,
  fechamentoStatus,
  fechamentoStatusLabel,
  computeFechamentoKpis,
  matchesFechamentoChip,
  sortFechamentoExcecoes,
  type FechamentoChip,
  type FechamentoStatus,
} from '../lib/diretoriaFechamento'
import {
  currentCompetenciaMonth,
  formatCompetencia,
  formatDate,
  monthToCompetencia,
} from '../lib/format'
import type { DashboardSummary, FilterValues, Obrigacao } from '../types'

const CHIPS: { id: FechamentoChip; label: string }[] = [
  { id: 'excecoes', label: 'Exceções' },
  { id: 'atrasadas', label: 'Atrasadas' },
  { id: 'vence_hoje', label: 'Vence hoje' },
  { id: 'fora_prazo', label: 'Fora do prazo' },
]

function statusTone(status: FechamentoStatus): string {
  if (status === 'atrasado') return 'bg-[#FF5630]/15 text-[#B71D18]'
  if (status === 'fora_prazo') return 'bg-[#FFAB00]/20 text-[#B76E00]'
  if (status === 'revisao') return 'bg-[#826AF9]/15 text-[#3D1FA8]'
  if (status === 'aberto') return 'bg-[#00B8D9]/15 text-[#006C9C]'
  return 'bg-[#00A76F]/15 text-[#007867]'
}

export default function DiretoriaFechamento() {
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
  const [chip, setChip] = useState<FechamentoChip>('excecoes')
  const [empresaFocus, setEmpresaFocus] = useState<string | null>(null)
  const [selected, setSelected] = useState<Obrigacao | null>(null)

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

  const scoped = useMemo(() => {
    const q = filters.search.trim().toLowerCase()
    if (!q) return obrigacoes
    return obrigacoes.filter((o) => {
      const hay = [
        o.empresa?.razao_social,
        o.atividade?.nome,
        o.responsavel?.nome,
        o.empresa?.bu,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return hay.includes(q)
    })
  }, [obrigacoes, filters.search])

  const kpis = useMemo(() => computeFechamentoKpis(scoped), [scoped])

  const ranking = useMemo(() => empresasComExcecao(scoped, new Date(), 8), [scoped])

  const visible = useMemo(() => {
    const list = scoped.filter((o) => {
      if (!matchesFechamentoChip(o, chip)) return false
      if (
        empresaFocus &&
        (o.empresa?.razao_social?.trim() || 'Sem empresa') !== empresaFocus
      ) {
        return false
      }
      return true
    })
    return sortFechamentoExcecoes(list)
  }, [scoped, chip, empresaFocus])

  const chipCounts = useMemo(
    () => ({
      excecoes: scoped.filter((o) => matchesFechamentoChip(o, 'excecoes')).length,
      atrasadas: kpis.atrasadas,
      vence_hoje: kpis.venceHoje,
      fora_prazo: kpis.foraPrazo,
    }),
    [scoped, kpis],
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[color:var(--color-ink)]">
            Fechamento da competência
          </h1>
          <p className="text-sm text-[color:var(--color-muted)]">
            Competência{' '}
            {formatCompetencia(monthToCompetencia(filters.competencia))}
            {' · '}só o que foge do prazo — leitura consolidada
          </p>
        </div>
        <NotificationBell placement="bottom-right" />
      </div>

      <FiltersBar
        filters={filters}
        onChange={(next) => {
          setFilters(next)
          setEmpresaFocus(null)
        }}
        bus={bus}
        showStatus={false}
        showSearch
      />

      {loading && !summary ? (
        <AnalyticsSkeleton variant="full" />
      ) : summary ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              label="% no prazo"
              value={kpis.percentualNoPrazo}
              suffix="%"
              hint={`${kpis.total} obrigações`}
              icon={CheckCircle2}
              tone="emerald"
            />
            <KpiCard
              label="Atrasadas"
              value={kpis.atrasadas}
              icon={AlertTriangle}
              tone="rose"
            />
            <KpiCard
              label="Vence hoje"
              value={kpis.venceHoje}
              icon={CalendarClock}
              tone="amber"
            />
            <KpiCard
              label="Entregue fora do prazo"
              value={kpis.foraPrazo}
              icon={Timer}
              tone="orange"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {CHIPS.map((c) => {
              const active = chip === c.id
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setChip(c.id)}
                  className={[
                    'inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-semibold transition',
                    active
                      ? 'bg-[color:var(--color-ink)] text-[color:var(--color-panel)]'
                      : 'bg-[color:var(--nav-hover)] text-[color:var(--color-muted)] hover:text-[color:var(--color-ink)]',
                  ].join(' ')}
                >
                  {c.label}
                  <span
                    className={[
                      'rounded-full px-1.5 py-0.5 text-[10px] tabular-nums',
                      active
                        ? 'bg-white/20'
                        : 'bg-[color:var(--color-panel)] text-[color:var(--color-ink)]',
                    ].join(' ')}
                  >
                    {chipCounts[c.id]}
                  </span>
                </button>
              )
            })}
          </div>

          <div className="grid min-h-[22rem] gap-4 xl:h-[calc(100dvh-22rem)] xl:min-h-[22rem] xl:grid-cols-[minmax(0,18rem)_1fr]">
            <DiretoriaChartCard
              className="h-full min-h-0 overflow-hidden"
              title="Empresas com exceção"
              subtitle="Até 8, por atraso e entrega tardia"
            >
              {ranking.length === 0 ? (
                <p className="py-8 text-center text-sm text-[color:var(--color-muted)]">
                  Nenhuma empresa com atraso ou entrega fora do prazo
                </p>
              ) : (
                <ul
                  className={[
                    'h-full min-h-0 divide-y divide-[color:var(--color-line)] overflow-y-auto overscroll-contain',
                    '[scrollbar-width:thin]',
                    '[scrollbar-color:#cbd5e1_transparent]',
                    '[&::-webkit-scrollbar]:w-1.5',
                    '[&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300',
                  ].join(' ')}
                >
                  {ranking.map((row) => {
                    const active = empresaFocus === row.nome
                    return (
                      <li key={row.nome}>
                        <button
                          type="button"
                          onClick={() =>
                            setEmpresaFocus((cur) =>
                              cur === row.nome ? null : row.nome,
                            )
                          }
                          className={[
                            'flex w-full items-start justify-between gap-2 px-1 py-2.5 text-left text-sm transition',
                            active
                              ? 'bg-[color:var(--nav-hover)]'
                              : 'hover:bg-[color:var(--nav-hover)]',
                          ].join(' ')}
                        >
                          <span className="min-w-0 truncate font-medium text-[color:var(--color-ink)]">
                            {row.nome}
                          </span>
                          <span className="shrink-0 text-[11px] tabular-nums text-[color:var(--color-muted)]">
                            {row.atrasado > 0 && (
                              <span className="text-[#B71D18]">
                                {row.atrasado} atraso
                              </span>
                            )}
                            {row.atrasado > 0 && row.fora_prazo > 0 && ' · '}
                            {row.fora_prazo > 0 && (
                              <span className="text-[#B76E00]">
                                {row.fora_prazo} fora
                              </span>
                            )}
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </DiretoriaChartCard>

            <DiretoriaChartCard
              className="h-full min-h-0 overflow-hidden"
              title={
                empresaFocus
                  ? `Exceções · ${empresaFocus}`
                  : CHIPS.find((c) => c.id === chip)?.label ?? 'Exceções'
              }
              subtitle={`${visible.length} obrigação(ões) · clique para detalhes`}
              action={
                empresaFocus ? (
                  <button
                    type="button"
                    className="btn-ghost !py-1 text-xs"
                    onClick={() => setEmpresaFocus(null)}
                  >
                    Todas as empresas
                  </button>
                ) : null
              }
            >
              {visible.length === 0 ? (
                <p className="py-10 text-center text-sm text-[color:var(--color-muted)]">
                  Nenhuma obrigação neste recorte
                </p>
              ) : (
                <div
                  className={[
                    'h-full min-h-0 overflow-auto overscroll-contain',
                    '[scrollbar-width:thin]',
                    '[scrollbar-color:#cbd5e1_transparent]',
                    '[&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar]:h-1.5',
                    '[&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300',
                  ].join(' ')}
                >
                  <table className="w-full min-w-[640px] border-collapse text-sm">
                    <thead className="sticky top-0 z-[1] bg-[color:var(--color-panel)]">
                      <tr className="border-b border-[color:var(--color-line)] text-left text-[10px] font-semibold uppercase tracking-wide text-[color:var(--color-muted)]">
                        <th className="px-2 py-3">Fechamento</th>
                        <th className="px-2 py-3">Empresa</th>
                        <th className="px-2 py-3">Tipo de serviço</th>
                        <th className="px-2 py-3">Responsável</th>
                        <th className="px-2 py-3">Prazo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[color:var(--color-line)]">
                      {visible.map((o) => {
                        const st = fechamentoStatus(o)
                        return (
                          <tr
                            key={o.id}
                            className="cursor-pointer hover:bg-[color:var(--nav-hover)]"
                            onClick={() => setSelected(o)}
                          >
                            <td className="px-2 py-3">
                              <span
                                className={[
                                  'inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold',
                                  statusTone(st),
                                ].join(' ')}
                              >
                                {fechamentoStatusLabel(st)}
                              </span>
                            </td>
                            <td className="max-w-[14rem] truncate px-2 py-3 font-medium">
                              {o.empresa?.razao_social ?? '—'}
                            </td>
                            <td className="max-w-[12rem] truncate px-2 py-3 text-[color:var(--color-muted)]">
                              {o.atividade?.nome ?? '—'}
                            </td>
                            <td className="whitespace-nowrap px-2 py-3">
                              {o.responsavel?.nome ? (
                                <span className="inline-flex items-center gap-2">
                                  <PersonAvatar
                                    nome={o.responsavel.nome}
                                    fotoUrl={o.responsavel.foto_url}
                                  />
                                  {o.responsavel.nome}
                                </span>
                              ) : (
                                '—'
                              )}
                            </td>
                            <td className="whitespace-nowrap px-2 py-3 tabular-nums">
                              {formatDate(o.prazo_fiscal ?? o.prazo_legal)}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </DiretoriaChartCard>
          </div>
        </>
      ) : (
        <p className="text-sm text-[color:var(--color-muted)]">
          Não foi possível carregar o resumo.
        </p>
      )}

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

function KpiCard({
  label,
  value,
  suffix,
  hint,
  icon: Icon,
  tone,
}: {
  label: string
  value: number
  suffix?: string
  hint?: string
  icon: typeof CheckCircle2
  tone: 'emerald' | 'rose' | 'amber' | 'orange'
}) {
  const tones = {
    emerald: {
      card: 'bg-emerald-500/10 dark:bg-emerald-400/10',
      icon: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
      value: 'text-emerald-900 dark:text-emerald-100',
    },
    rose: {
      card: 'bg-rose-500/10 dark:bg-rose-400/10',
      icon: 'bg-rose-500/15 text-rose-700 dark:text-rose-300',
      value: 'text-rose-900 dark:text-rose-100',
    },
    amber: {
      card: 'bg-amber-500/10 dark:bg-amber-400/10',
      icon: 'bg-amber-500/15 text-amber-800 dark:text-amber-200',
      value: 'text-amber-950 dark:text-amber-100',
    },
    orange: {
      card: 'bg-orange-500/10 dark:bg-orange-400/10',
      icon: 'bg-orange-500/15 text-orange-800 dark:text-orange-200',
      value: 'text-orange-950 dark:text-orange-100',
    },
  }[tone]

  return (
    <div className={['diretoria-kpi', tones.card].join(' ')}>
      <div
        className={[
          'mb-4 flex h-9 w-9 items-center justify-center rounded-full',
          tones.icon,
        ].join(' ')}
      >
        <Icon className="h-4 w-4" strokeWidth={1.75} />
      </div>
      <p
        className={[
          'text-[1.5rem] font-bold leading-none tracking-tight tabular-nums',
          tones.value,
        ].join(' ')}
      >
        {value}
        {suffix ?? ''}
      </p>
      <p className="mt-1.5 text-xs font-medium text-[color:var(--color-muted)]">
        {label}
        {hint ? ` · ${hint}` : ''}
      </p>
    </div>
  )
}
