import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CalendarClock, UserRound } from 'lucide-react'
import DiretoriaChartCard from '../components/diretoria/DiretoriaChartCard'
import FiltersBar from '../components/FiltersBar'
import NotificationBell from '../components/NotificationBell'
import ObrigacaoDrawer from '../components/ObrigacaoDrawer'
import TarefaDrawer from '../components/TarefaDrawer'
import PersonAvatar from '../components/PersonAvatar'
import StatusBadge from '../components/StatusBadge'
import { TableSkeleton } from '../components/ui/PageSkeletons'
import { apiFetch, buildQuery } from '../lib/api'
import {
  buildDiretoriaRiscos,
  countRiscosByTipo,
  type DiretoriaRisco,
  type DiretoriaRiscoTipo,
} from '../lib/diretoriaRiscos'
import {
  currentCompetenciaMonth,
  formatCompetencia,
  formatDate,
  formatHorario,
  monthToCompetencia,
} from '../lib/format'
import type { DashboardSummary, FilterValues, Obrigacao, Tarefa } from '../types'

type TabFilter = 'todas' | DiretoriaRiscoTipo

const TABS: { id: TabFilter; label: string }[] = [
  { id: 'todas', label: 'Todas' },
  { id: 'atrasado', label: 'Atrasadas' },
  { id: 'vence_7d', label: 'Vence em 7 dias' },
  { id: 'sobrecarga', label: 'Sobrecarga' },
]

function tipoLabel(tipo: DiretoriaRiscoTipo): string {
  if (tipo === 'atrasado') return 'Atrasada'
  if (tipo === 'vence_7d') return 'Vence em 7 dias'
  return 'Sobrecarga'
}

function tipoTone(tipo: DiretoriaRiscoTipo): string {
  if (tipo === 'atrasado') return 'bg-[#FF5630]/15 text-[#B71D18]'
  if (tipo === 'vence_7d') return 'bg-[#FFAB00]/20 text-[#B76E00]'
  return 'bg-[#00B8D9]/15 text-[#006C9C]'
}

function TipoIcon({ tipo }: { tipo: DiretoriaRiscoTipo }) {
  if (tipo === 'atrasado') return <AlertTriangle className="h-3.5 w-3.5" />
  if (tipo === 'vence_7d') return <CalendarClock className="h-3.5 w-3.5" />
  return <UserRound className="h-3.5 w-3.5" />
}

export default function DiretoriaPendencias() {
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
  const [tab, setTab] = useState<TabFilter>('todas')
  const [selected, setSelected] = useState<Obrigacao | null>(null)
  const [selectedTarefa, setSelectedTarefa] = useState<Tarefa | null>(null)
  const [expandedResp, setExpandedResp] = useState<string | null>(null)

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

  const bus = useMemo(
    () => (summary ? Object.keys(summary.por_bu).sort() : []),
    [summary],
  )

  const riscos = useMemo(
    () => buildDiretoriaRiscos(obrigacoes, summary, new Date(), tarefas),
    [obrigacoes, summary, tarefas],
  )

  const counts = useMemo(() => countRiscosByTipo(riscos), [riscos])

  const filtered = useMemo(() => {
    if (tab === 'todas') return riscos
    return riscos.filter((r) => r.tipo === tab)
  }, [riscos, tab])

  const obrigacoesDoResponsavel = useCallback(
    (nome: string) =>
      obrigacoes.filter((o) => (o.responsavel?.nome ?? '') === nome),
    [obrigacoes],
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[color:var(--color-ink)]">
            Pendências críticas
          </h1>
          <p className="text-sm text-[color:var(--color-muted)]">
            Competência{' '}
            {formatCompetencia(monthToCompetencia(filters.competencia))}
            {' · '}atrasadas, vencimento em 7 dias e sobrecarga de capacidade
          </p>
        </div>
        <NotificationBell placement="bottom-right" />
      </div>

      <FiltersBar
        filters={filters}
        onChange={setFilters}
        bus={bus}
        showStatus={false}
        showSearch={false}
      />

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => {
          const n =
            t.id === 'todas'
              ? counts.total
              : t.id === 'atrasado'
                ? counts.atrasado
                : t.id === 'vence_7d'
                  ? counts.vence_7d
                  : counts.sobrecarga
          const active = tab === t.id
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={[
                'inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-semibold transition',
                active
                  ? 'bg-[color:var(--color-ink)] text-[color:var(--color-panel)]'
                  : 'bg-[color:var(--nav-hover)] text-[color:var(--color-muted)] hover:text-[color:var(--color-ink)]',
              ].join(' ')}
            >
              {t.label}
              <span
                className={[
                  'rounded-full px-1.5 py-0.5 text-[10px] tabular-nums',
                  active
                    ? 'bg-white/20'
                    : 'bg-[color:var(--color-panel)] text-[color:var(--color-ink)]',
                ].join(' ')}
              >
                {n}
              </span>
            </button>
          )
        })}
      </div>

      <DiretoriaChartCard
        title={
          tab === 'todas'
            ? 'Todas as pendências'
            : TABS.find((t) => t.id === tab)?.label ?? 'Pendências'
        }
        subtitle={
          loading ? undefined : `${filtered.length} registro(s) no recorte`
        }
      >
        {loading ? (
          <TableSkeleton rows={8} cols={7} framed={false} />
        ) : filtered.length === 0 ? (
          <p className="py-10 text-center text-sm text-[color:var(--color-muted)]">
            Nenhuma pendência neste filtro
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="border-b border-[color:var(--color-line)] text-left text-[10px] font-semibold uppercase tracking-wide text-[color:var(--color-muted)]">
                  <th className="px-2 py-3">Tipo</th>
                  <th className="px-2 py-3">Serviço / responsável</th>
                  <th className="px-2 py-3">Empresa</th>
                  <th className="px-2 py-3">BU</th>
                  <th className="px-2 py-3">Prazo</th>
                  <th className="px-2 py-3">Referência</th>
                  <th className="px-2 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[color:var(--color-line)]">
                {filtered.map((r) => (
                  <RiscoRows
                    key={r.id}
                    risco={r}
                    expanded={expandedResp === r.responsavelNome}
                    onToggleExpand={() =>
                      setExpandedResp((cur) =>
                        cur === r.responsavelNome ? null : (r.responsavelNome ?? null),
                      )
                    }
                    filhos={
                      r.tipo === 'sobrecarga' && r.responsavelNome
                        ? obrigacoesDoResponsavel(r.responsavelNome)
                        : []
                    }
                    onSelectObrigacao={setSelected}
                    onSelectTarefa={setSelectedTarefa}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DiretoriaChartCard>

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

function RiscoRows({
  risco,
  expanded,
  onToggleExpand,
  filhos,
  onSelectObrigacao,
  onSelectTarefa,
}: {
  risco: DiretoriaRisco
  expanded: boolean
  onToggleExpand: () => void
  filhos: Obrigacao[]
  onSelectObrigacao: (o: Obrigacao) => void
  onSelectTarefa: (t: Tarefa) => void
}) {
  const o = risco.obrigacao
  const t = risco.tarefa
  const isSobrecarga = risco.tipo === 'sobrecarga'
  const respNome =
    o?.responsavel?.nome ?? t?.responsavel?.nome ?? risco.responsavelNome

  return (
    <>
      <tr
        className={[
          'transition hover:bg-[color:var(--nav-hover)]',
          o || t || isSobrecarga ? 'cursor-pointer' : '',
        ].join(' ')}
        onClick={() => {
          if (o) onSelectObrigacao(o)
          else if (t) onSelectTarefa(t)
          else if (isSobrecarga) onToggleExpand()
        }}
      >
        <td className="px-2 py-3">
          <span
            className={[
              'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold',
              tipoTone(risco.tipo),
            ].join(' ')}
          >
            <TipoIcon tipo={risco.tipo} />
            {tipoLabel(risco.tipo)}
          </span>
        </td>
        <td className="px-2 py-3">
          <div className="flex items-start gap-2.5">
            {respNome && (
              <PersonAvatar
                nome={respNome}
                fotoUrl={o?.responsavel?.foto_url ?? t?.responsavel?.foto_url}
                className="mt-0.5"
              />
            )}
            <div className="min-w-0">
              <p className="font-semibold text-[color:var(--color-ink)]">
                {risco.titulo}
              </p>
              <p className="text-xs text-[color:var(--color-muted)]">
                {isSobrecarga
                  ? `${filhos.length} obrigação(ões) · clique para expandir`
                  : (respNome ?? '—')}
              </p>
            </div>
          </div>
        </td>
        <td className="px-2 py-3 text-[color:var(--color-muted)]">
          {o?.empresa?.razao_social ?? t?.empresa?.razao_social ?? '—'}
        </td>
        <td className="px-2 py-3">
          {o?.empresa?.bu ?? t?.empresa?.bu ?? '—'}
        </td>
        <td className="px-2 py-3 tabular-nums">
          {o
            ? formatDate(o.prazo_fiscal ?? o.prazo_legal)
            : t
              ? `${formatDate(t.prazo)}${
                  formatHorario(t.hora_inicio, t.hora_fim)
                    ? ` · ${formatHorario(t.hora_inicio, t.hora_fim)}`
                    : ''
                }`
              : '—'}
        </td>
        <td className="px-2 py-3 text-xs font-semibold tabular-nums">
          {risco.tipo === 'atrasado' && risco.diasRef != null
            ? `${risco.diasRef}d atraso`
            : risco.tipo === 'vence_7d' && risco.diasRef != null
              ? `${risco.diasRef}d restantes`
              : risco.tipo === 'sobrecarga' && risco.excesso != null
                ? `+${risco.excesso} acima`
                : '—'}
        </td>
        <td className="px-2 py-3">
          {o ? (
            <StatusBadge status={o.status} urgencia={o.urgencia} />
          ) : t ? (
            <StatusBadge status={t.status} urgencia={t.urgencia} />
          ) : (
            <span className="text-xs text-[color:var(--color-muted)]">—</span>
          )}
        </td>
      </tr>
      {isSobrecarga && expanded &&
        filhos.map((filho) => (
          <tr
            key={filho.id}
            className="cursor-pointer bg-[color:var(--nav-hover)]/50 hover:bg-[color:var(--nav-hover)]"
            onClick={() => onSelectObrigacao(filho)}
          >
            <td className="px-2 py-2.5 pl-8 text-[10px] text-[color:var(--color-muted)]">
              —
            </td>
            <td className="px-2 py-2.5 text-sm font-medium">
              {filho.atividade?.nome ?? '—'}
            </td>
            <td className="px-2 py-2.5 text-sm text-[color:var(--color-muted)]">
              {filho.empresa?.razao_social ?? '—'}
            </td>
            <td className="px-2 py-2.5 text-sm">{filho.empresa?.bu ?? '—'}</td>
            <td className="px-2 py-2.5 text-sm tabular-nums">
              {formatDate(filho.prazo_fiscal ?? filho.prazo_legal)}
            </td>
            <td className="px-2 py-2.5 text-xs text-[color:var(--color-muted)]">
              —
            </td>
            <td className="px-2 py-2.5">
              <StatusBadge status={filho.status} urgencia={filho.urgencia} />
            </td>
          </tr>
        ))}
    </>
  )
}
