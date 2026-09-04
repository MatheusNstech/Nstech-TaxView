import { Building2, ListFilter, Search } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import GlassMonthPicker from '../components/GlassMonthPicker'
import GlassSelect from '../components/GlassSelect'
import NotificationBell from '../components/NotificationBell'
import ObrigacaoDrawer from '../components/ObrigacaoDrawer'
import StatusBadge from '../components/StatusBadge'
import { apiFetch, buildQuery } from '../lib/api'
import { formatDate, statusLabel } from '../lib/format'
import type { CalendarioResponse, Obrigacao, StatusObrigacao } from '../types'

const STATUS_OPTS: StatusObrigacao[] = [
  'PENDENTE',
  'EM_ANDAMENTO',
  'EM_REVISAO',
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

export default function Calendario() {
  const now = new Date()
  const [ym, setYm] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
  )
  const [data, setData] = useState<CalendarioResponse | null>(null)
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [selected, setSelected] = useState<Obrigacao | null>(null)
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState<StatusObrigacao | ''>('')
  const [filtroBu, setFiltroBu] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const { de, ate } = monthBounds(ym)
    try {
      const qs = buildQuery({
        de,
        ate,
        detalhe_dia: selectedDay ?? undefined,
      })
      setData(await apiFetch<CalendarioResponse>(`/api/obrigacoes/calendario${qs}`))
    } catch {
      setData({ dias: [], detalhe: [] })
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
    const map = new Map<string, { total: number; atrasadas: number }>()
    for (const d of data?.dias ?? []) {
      map.set(d.data.slice(0, 10), { total: d.total, atrasadas: d.atrasadas })
    }
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

  const busDoDia = useMemo(() => {
    const set = new Set<string>()
    for (const o of detalhe) {
      const bu = o.empresa?.bu?.trim()
      if (bu) set.add(bu)
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'))
  }, [detalhe])

  const detalheFiltrado = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return detalhe.filter((o) => {
      if (filtroStatus && o.status !== filtroStatus) return false
      if (filtroBu && (o.empresa?.bu ?? '') !== filtroBu) return false
      if (!q) return true
      const hay = [o.atividade?.nome, o.empresa?.razao_social, o.responsavel?.nome]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return hay.includes(q)
    })
  }, [detalhe, busca, filtroStatus, filtroBu])

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
                  className={[
                    'aspect-square rounded-xl border text-xs transition',
                    selectedDay === key
                      ? 'border-brand-500 ring-2 ring-brand-500/30'
                      : 'border-[color:var(--color-line)]',
                  ].join(' ')}
                  style={{
                    backgroundColor: info
                      ? hasAtraso
                        ? `rgba(244, 63, 94, ${0.15 + intensity * 0.45})`
                        : `rgba(255, 107, 0, ${0.12 + intensity * 0.4})`
                      : 'var(--control-bg)',
                  }}
                >
                  <span className="font-semibold text-[color:var(--color-ink)]">{day}</span>
                  {info && (
                    <span className="mt-0.5 block text-[10px] text-[color:var(--color-muted)]">
                      {info.total}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
          {loading && (
            <p className="mt-3 text-xs text-[color:var(--color-muted)]">Carregando...</p>
          )}
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
                    ? `${detalheFiltrado.length} de ${detalhe.length}`
                    : `${detalhe.length} obrigação(ões)`}
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
            {selectedDay && detalheFiltrado.length === 0 && (
              <p className="text-sm text-[color:var(--color-muted)]">
                {detalhe.length === 0
                  ? 'Nenhum vencimento neste dia.'
                  : 'Nenhum resultado com esses filtros.'}
              </p>
            )}
            {detalheFiltrado.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => setSelected(o)}
                className="flex w-full items-center justify-between gap-2 rounded-xl border border-[color:var(--color-line)] bg-[color:var(--control-bg)] px-3 py-2 text-left text-sm transition hover:bg-[color:var(--nav-hover)]"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{o.atividade?.nome}</p>
                  <p className="truncate text-xs text-[color:var(--color-muted)]">
                    {o.empresa?.razao_social}
                  </p>
                </div>
                <StatusBadge status={o.status} urgencia={o.urgencia} />
              </button>
            ))}
          </div>
        </div>
      </div>

      <ObrigacaoDrawer
        obrigacao={selected}
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        onSaved={(u) => {
          setSelected(u)
          void load()
        }}
      />
    </div>
  )
}
