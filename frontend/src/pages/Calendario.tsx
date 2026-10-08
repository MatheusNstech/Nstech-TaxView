import { Building2, Copy, ListFilter, Search } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import GlassMonthPicker from '../components/GlassMonthPicker'
import GlassSelect from '../components/GlassSelect'
import NotificationBell from '../components/NotificationBell'
import ObrigacaoDrawer from '../components/ObrigacaoDrawer'
import StatusBadge from '../components/StatusBadge'
import TarefaDrawer from '../components/TarefaDrawer'
import { CalendarSkeleton } from '../components/ui/PageSkeletons'
import { apiFetch, buildQuery } from '../lib/api'
import { formatDate, formatHorario, statusLabel } from '../lib/format'
import { obrigacaoResponsaveisLabel } from '../lib/responsaveis'
import { workItemFromObrigacao, workItemFromTarefa } from '../lib/workItems'
import { useAuth } from '../context/AuthContext'
import CopiarModal from '../components/CopiarModal'
import EmpresaLogo from '../components/empresas/EmpresaLogo'
import { Pontos, Selos, sinaisDe } from '../components/SinaisItem'
import type {
  CalendarioDia,
  CalendarioResponse,
  Empresa,
  Obrigacao,
  StatusObrigacao,
  Tarefa,
  WorkItem,
} from '../types'

const STATUS_OPTS: StatusObrigacao[] = [
  'PENDENTE',
  'EM_ANDAMENTO',
  'EM_REVISAO',
  'ENTREGA_PARCIAL',
  'ENTREGUE',
  'ATRASADO',
]

function monthBounds(ym: string) {
  const [y, m] = ym.split('-').map(Number)
  const de = `${y}-${String(m).padStart(2, '0')}-01`
  const last = new Date(y, m, 0).getDate()
  const ate = `${y}-${String(m).padStart(2, '0')}-${String(last).padStart(2, '0')}`
  return { de, ate, year: y, month: m, last }
}

function plural(n: number, um: string, varios: string) {
  return `${n} ${n === 1 ? um : varios}`
}

function tooltipDia(d: CalendarioDia): string {
  const partes = [plural(d.total, 'item', 'itens')]
  if (d.atrasadas) partes.push(plural(d.atrasadas, 'atrasado', 'atrasados'))
  if (d.reabertas) partes.push(plural(d.reabertas, 'reaberto', 'reabertos'))
  if (d.tarefas) partes.push(plural(d.tarefas, 'tarefa', 'tarefas'))
  const nomes = d.empresas.map((e) => e.nome).join(', ')
  if (nomes) partes.push(d.mais_empresas ? `${nomes}…` : nomes)
  return partes.join(' · ')
}

function ItemDia({
  empresa,
  titulo,
  detalhe,
  item,
  onOpen,
  onCopiar,
}: {
  empresa: Empresa | null | undefined
  titulo: string
  detalhe: string
  item: Parameters<typeof sinaisDe>[0] & { status: StatusObrigacao; urgencia?: string | null }
  onOpen: () => void
  onCopiar?: () => void
}) {
  const sinais = sinaisDe(item)
  return (
    <div className="group relative flex w-full items-center gap-2.5 rounded-xl border border-[color:var(--color-line)] bg-[color:var(--control-bg)] px-3 py-2 text-sm transition hover:bg-[color:var(--nav-hover)]">
      <button
        type="button"
        onClick={onOpen}
        className="flex min-w-0 flex-1 items-center gap-2.5 text-left after:absolute after:inset-0 after:rounded-xl"
      >
        <EmpresaLogo empresa={empresa} size="sm" />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{titulo}</span>
          <span className="block truncate text-xs text-[color:var(--color-muted)]">{detalhe}</span>
        </span>
      </button>
      <span className="relative flex shrink-0 items-center gap-1.5">
        <Selos sinais={sinais} />
        <StatusBadge status={item.status} urgencia={item.urgencia} />
        {onCopiar && (
          <button
            type="button"
            onClick={onCopiar}
            title="Copiar para outra empresa"
            aria-label="Copiar para outra empresa"
            className="rounded-md p-1 text-[color:var(--color-muted)] opacity-0 transition hover:bg-[color:var(--color-panel)] hover:text-brand-600 focus-visible:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100"
          >
            <Copy className="h-3.5 w-3.5" strokeWidth={2} />
          </button>
        )}
      </span>
    </div>
  )
}

export default function Calendario() {
  const now = new Date()
  const [ym, setYm] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
  )
  const [data, setData] = useState<CalendarioResponse | null>(null)
  const [tarefasMes, setTarefasMes] = useState<Tarefa[]>([])
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [selected, setSelected] = useState<Obrigacao | null>(null)
  const [selectedTarefa, setSelectedTarefa] = useState<Tarefa | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [busca, setBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState<StatusObrigacao | ''>('')
  const [filtroBu, setFiltroBu] = useState('')
  const [copiando, setCopiando] = useState<WorkItem | null>(null)
  const { canWrite, isAdmin } = useAuth()

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true)
    setLoadError('')
    const { de, ate } = monthBounds(ym)
    try {
      const qs = buildQuery({
        de,
        ate,
        detalhe_dia: selectedDay ?? undefined,
      })
      const cal = await apiFetch<CalendarioResponse>(`/api/obrigacoes/calendario${qs}`)
      setData(cal)
      setTarefasMes(cal.tarefas ?? [])
    } catch (err) {
      setData({ dias: [], detalhe: [] })
      setTarefasMes([])
      setLoadError(err instanceof Error ? err.message : 'Erro ao carregar o calendário')
    } finally {
      setLoading(false)
    }
  }, [ym, selectedDay])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    setBusca('')
    setFiltroStatus('')
    setFiltroBu('')
  }, [selectedDay])

  const byDate = useMemo(() => {
    const map = new Map<string, CalendarioDia>()
    for (const d of data?.dias ?? []) map.set(d.data.slice(0, 10), d)
    return map
  }, [data])

  const { year, month, last } = monthBounds(ym)
  const firstWeekday = new Date(year, month - 1, 1).getDay()
  const cells: (number | null)[] = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: last }, (_, i) => i + 1),
  ]

  const maxTotal = Math.max(1, ...[...byDate.values()].map((v) => v.total))

  const detalhe = data?.detalhe ?? []
  const tarefasDoDia = useMemo(() => {
    if (!selectedDay) return []
    return tarefasMes.filter((t) => t.prazo?.slice(0, 10) === selectedDay)
  }, [tarefasMes, selectedDay])

  const busDoDia = useMemo(() => {
    const set = new Set<string>()
    for (const o of detalhe) {
      const bu = o.empresa?.bu?.trim()
      if (bu) set.add(bu)
    }
    for (const t of tarefasDoDia) {
      const bu = t.empresa?.bu?.trim()
      if (bu) set.add(bu)
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'))
  }, [detalhe, tarefasDoDia])

  const detalheFiltrado = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return detalhe.filter((o) => {
      if (filtroStatus && o.status !== filtroStatus) return false
      if (filtroBu && (o.empresa?.bu ?? '') !== filtroBu) return false
      if (!q) return true
      const hay = [o.atividade?.nome, o.empresa?.razao_social, obrigacaoResponsaveisLabel(o)]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return hay.includes(q)
    })
  }, [detalhe, busca, filtroStatus, filtroBu])

  const tarefasFiltradas = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return tarefasDoDia
      .filter((t) => {
        if (filtroStatus && t.status !== filtroStatus) return false
        if (filtroBu && (t.empresa?.bu ?? '') !== filtroBu) return false
        if (!q) return true
        const hay = [t.titulo, t.empresa?.razao_social, t.responsavel?.nome]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        return hay.includes(q)
      })
      .sort((a, b) => {
        const ha = a.hora_inicio ?? '99:99'
        const hb = b.hora_inicio ?? '99:99'
        return ha.localeCompare(hb) || a.titulo.localeCompare(b.titulo)
      })
  }, [tarefasDoDia, busca, filtroStatus, filtroBu])

  const totalDia = detalhe.length + tarefasDoDia.length
  const totalFiltrado = detalheFiltrado.length + tarefasFiltradas.length
  const hasFiltro = Boolean(busca.trim() || filtroStatus || filtroBu)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[color:var(--color-ink)]">
            Calendário
          </h1>
          <p className="text-sm text-[color:var(--color-muted)]">
            Heatmap de vencimentos no mês
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <NotificationBell />
          <GlassMonthPicker
            className="w-[9.5rem] shrink-0"
            align="right"
            ariaLabel="Mês do calendário"
            shortcutValue={`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`}
            shortcutLabel="Este mês"
            value={ym}
            onChange={(next) => {
              setYm(next)
              setSelectedDay(null)
              setBusca('')
              setFiltroStatus('')
              setFiltroBu('')
            }}
          />
        </div>
      </div>
      {loadError && (
        <p className="rounded-xl bg-rose-50/90 px-3 py-2 text-sm text-rose-700">
          {loadError}
        </p>
      )}

      {loading ? (
        <CalendarSkeleton />
      ) : (
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="glass-panel h-fit p-4">
          <div className="mb-2 grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase text-[color:var(--color-muted)]">
            {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((d) => (
              <div key={d}>{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((day, idx) => {
              if (!day) return <div key={`e-${idx}`} className="aspect-square" />
              const key = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
              const info = byDate.get(key)
              const intensity = info ? info.total / maxTotal : 0
              const hasAtraso = Boolean(info?.atrasadas)
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelectedDay(key)}
                  title={info ? tooltipDia(info) : undefined}
                  className={[
                    'flex aspect-square min-w-0 flex-col rounded-xl border p-1.5 text-left text-xs transition hover:border-brand-500/50',
                    selectedDay === key
                      ? 'border-brand-500 ring-2 ring-brand-500/30'
                      : 'border-[color:var(--color-line)]',
                  ].join(' ')}
                  style={{
                    backgroundColor: info
                      ? hasAtraso
                        ? `rgba(244, 63, 94, ${0.06 + intensity * 0.2})`
                        : `rgba(255, 107, 0, ${0.05 + intensity * 0.18})`
                      : 'var(--control-bg)',
                  }}
                >
                  <span className="flex w-full items-baseline justify-between gap-1">
                    <span className="font-semibold text-[color:var(--color-ink)]">{day}</span>
                    {info && (
                      <span className="text-[10px] font-semibold tabular-nums text-[color:var(--color-muted)]">
                        {info.total}
                      </span>
                    )}
                  </span>
                  {info && (
                    <>
                      <span className="mt-auto hidden items-center sm:flex">
                        {info.empresas.map((e, i) => (
                          <span
                            key={e.id}
                            className={`rounded-md ring-2 ring-[color:var(--color-panel)] ${i > 0 ? '-ml-1.5' : ''}`}
                          >
                            <EmpresaLogo empresa={e} size="xs" />
                          </span>
                        ))}
                        {info.mais_empresas > 0 && (
                          <span className="ml-1 text-[9px] font-semibold text-[color:var(--color-muted)]">
                            +{info.mais_empresas}
                          </span>
                        )}
                      </span>
                      <Pontos
                        className="mt-auto pt-1 sm:mt-1 sm:pt-0"
                        contagem={{
                          atrasadas: info.atrasadas,
                          reabertas: info.reabertas,
                          tarefas: info.tarefas,
                        }}
                      />
                    </>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        <div className="glass-panel flex min-h-[18rem] flex-col overflow-visible p-4 lg:h-0 lg:min-h-full">
          <div className="relative z-20 shrink-0 space-y-2.5">
            <h2 className="text-sm font-semibold text-[color:var(--color-ink)]">
              {selectedDay
                ? `Vencimentos em ${formatDate(selectedDay)}`
                : 'Selecione um dia'}
            </h2>
            {selectedDay && (
              <>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[color:var(--color-muted)]" />
                  <input
                    type="search"
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    placeholder="Empresa ou serviço..."
                    className="glass-control"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <GlassSelect
                    ariaLabel="Filtrar por status"
                    icon={ListFilter}
                    value={filtroStatus}
                    onChange={(v) => setFiltroStatus(v as StatusObrigacao | '')}
                    options={[
                      { value: '', label: 'Todos status' },
                      ...STATUS_OPTS.map((s) => ({
                        value: s,
                        label: statusLabel(s),
                      })),
                    ]}
                  />
                  <GlassSelect
                    ariaLabel="Filtrar por BU"
                    icon={Building2}
                    value={filtroBu}
                    onChange={setFiltroBu}
                    options={[
                      { value: '', label: 'Todas as BUs' },
                      ...busDoDia.map((bu) => ({ value: bu, label: bu })),
                    ]}
                  />
                </div>
                <p className="text-[11px] text-[color:var(--color-muted)]">
                  {hasFiltro
                    ? `${totalFiltrado} de ${totalDia}`
                    : `${totalDia} item(ns)`}
                  {hasFiltro && (
                    <>
                      {' · '}
                      <button
                        type="button"
                        className="font-semibold text-brand-600 hover:underline"
                        onClick={() => {
                          setBusca('')
                          setFiltroStatus('')
                          setFiltroBu('')
                        }}
                      >
                        Limpar
                      </button>
                    </>
                  )}
                </p>
              </>
            )}
          </div>
          <div
            className={[
              'mt-3 min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain pr-1',
              '[scrollbar-width:thin]',
              '[scrollbar-color:#cbd5e1_transparent]',
              '[&::-webkit-scrollbar]:w-1.5',
              '[&::-webkit-scrollbar-track]:bg-transparent',
              '[&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300',
            ].join(' ')}
          >
            {!selectedDay && (
              <p className="text-sm text-[color:var(--color-muted)]">
                Clique em um dia do calendário para ver as obrigações.
              </p>
            )}
            {selectedDay && totalFiltrado === 0 && (
              <p className="text-sm text-[color:var(--color-muted)]">
                {totalDia === 0
                  ? 'Nenhum vencimento neste dia.'
                  : 'Nenhum resultado com esses filtros.'}
              </p>
            )}
            {tarefasFiltradas.map((t) => {
              const horario = formatHorario(t.hora_inicio, t.hora_fim)
              return (
                <ItemDia
                  key={`tarefa:${t.id}`}
                  empresa={t.empresa}
                  titulo={t.titulo}
                  detalhe={`${horario ? `${horario} · ` : ''}${t.empresa?.razao_social ?? 'Fechamento'}`}
                  item={{ ...t, origem: 'tarefa', entregaOriginal: t.entrega_original }}
                  onOpen={() => {
                    setSelected(null)
                    setSelectedTarefa(t)
                  }}
                  onCopiar={canWrite ? () => setCopiando(workItemFromTarefa(t)) : undefined}
                />
              )
            })}
            {detalheFiltrado.map((o) => (
              <ItemDia
                key={o.id}
                empresa={o.empresa}
                titulo={o.atividade?.nome ?? '—'}
                detalhe={o.empresa?.razao_social ?? ''}
                item={{ ...o, origem: 'obrigacao', entregaOriginal: o.entrega_original }}
                onOpen={() => {
                  setSelectedTarefa(null)
                  setSelected(o)
                }}
                onCopiar={isAdmin ? () => setCopiando(workItemFromObrigacao(o)) : undefined}
              />
            ))}
          </div>
        </div>
      </div>
      )}

      <ObrigacaoDrawer
        obrigacao={selected}
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        onSaved={(u) => {
          setSelected(u)
          void load({ silent: true })
        }}
      />
      <TarefaDrawer
        tarefa={selectedTarefa}
        open={Boolean(selectedTarefa)}
        onClose={() => setSelectedTarefa(null)}
        onSaved={(u) => {
          setTarefasMes((prev) => {
            const idx = prev.findIndex((t) => t.id === u.id)
            if (idx < 0) return [u, ...prev]
            const next = prev.slice()
            next[idx] = { ...prev[idx], ...u }
            return next
          })
          setSelectedTarefa(null)
          void load({ silent: true })
        }}
        onDeleted={(id) => {
          setTarefasMes((prev) => prev.filter((t) => t.id !== id))
          setSelectedTarefa(null)
          void load({ silent: true })
        }}
      />
      <CopiarModal
        item={copiando}
        onClose={() => setCopiando(null)}
        onCopiado={() => void load({ silent: true })}
      />
    </div>
  )
}
