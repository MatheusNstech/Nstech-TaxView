import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertOctagon,
  Building2,
  CheckCircle2,
  Plus,
  Search,
  Tags,
  Wallet,
  XCircle,
  type LucideIcon,
} from 'lucide-react'
import GlassSelect from '../components/GlassSelect'
import NotificationBell from '../components/NotificationBell'
import DiretoriaChartCard from '../components/diretoria/DiretoriaChartCard'
import PerdcompDrawer from '../components/perdcomp/PerdcompDrawer'
import PerdcompPrazoChip from '../components/perdcomp/PerdcompPrazoChip'
import PerdcompStatusChart, {
  PerdcompStatusPill,
} from '../components/perdcomp/PerdcompStatusChart'
import { TableSkeleton } from '../components/ui/PageSkeletons'
import { useAuth } from '../context/AuthContext'
import { apiFetch } from '../lib/api'
import { formatDate, formatMoneyBRL } from '../lib/format'
import type { PerdcompProcesso, PerdcompSummary } from '../types'

function KpiCard({
  title,
  value,
  hint,
  icon: Icon,
  tone,
}: {
  title: string
  value: string
  hint?: string
  icon: LucideIcon
  tone: 'brand' | 'slate' | 'rose' | 'alert' | 'emerald'
}) {
  const iconClass = {
    brand: 'bg-brand-500/15 text-brand-600',
    emerald: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
    slate: 'bg-slate-500/10 text-slate-600 dark:text-slate-300',
    rose: 'bg-rose-500/15 text-rose-600 dark:text-rose-400',
    alert: 'bg-rose-600 text-white',
  }[tone]

  return (
    <div
      className={[
        'diretoria-card flex min-h-[7rem] flex-col justify-between gap-3',
        tone === 'alert' ? 'ring-1 ring-rose-500/40' : '',
      ].join(' ')}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm text-[color:var(--color-muted)]">{title}</p>
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${iconClass}`}
        >
          <Icon className="h-4 w-4" aria-hidden />
        </span>
      </div>
      <div>
        <p
          className={[
            'text-2xl font-bold tracking-tight',
            tone === 'alert' ? 'text-rose-600' : 'text-[color:var(--color-ink)]',
          ].join(' ')}
        >
          {value}
        </p>
        {hint ? (
          <p className="mt-1 text-xs text-[color:var(--color-muted)]">{hint}</p>
        ) : null}
      </div>
    </div>
  )
}

type Situacao = 'aberto' | 'entregue' | 'todos'

const SITUACOES: { id: Situacao; label: string }[] = [
  { id: 'aberto', label: 'Em aberto' },
  { id: 'entregue', label: 'Entregues' },
  { id: 'todos', label: 'Todos' },
]

export default function DiretoriaPerdcomp() {
  const { painelFiscalEditor } = useAuth()
  const [summary, setSummary] = useState<PerdcompSummary | null>(null)
  const [rows, setRows] = useState<PerdcompProcesso[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [statusFiltro, setStatusFiltro] = useState('')
  const [empresaFiltro, setEmpresaFiltro] = useState('')
  const [busca, setBusca] = useState('')
  const [situacao, setSituacao] = useState<Situacao>('aberto')
  const [drawer, setDrawer] = useState<{
    mode: 'view' | 'edit' | 'create'
    processo: PerdcompProcesso | null
  } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [s, list] = await Promise.all([
        apiFetch<PerdcompSummary>('/api/perdcomp/summary'),
        apiFetch<PerdcompProcesso[]>('/api/perdcomp'),
      ])
      setSummary(s)
      setRows(list)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar PER/DCOMP')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const statusOptions = useMemo(
    () => (summary?.por_status ?? []).map((s) => s.status),
    [summary],
  )
  const empresaOptions = useMemo(
    () => (summary?.por_empresa ?? []).map((e) => e.empresa),
    [summary],
  )

  const filtered = useMemo(() => {
    const q = busca.trim().toLocaleLowerCase('pt-BR')
    return rows.filter((r) => {
      if (situacao === 'aberto' && r.entregue_em) return false
      if (situacao === 'entregue' && !r.entregue_em) return false
      if (statusFiltro && (r.status || 'Sem status') !== statusFiltro) return false
      if (empresaFiltro && r.empresa !== empresaFiltro) return false
      if (!q) return true
      return [r.perdcomp, r.processo, r.empresa, r.tributo_credito, r.observacoes]
        .join(' ')
        .toLocaleLowerCase('pt-BR')
        .includes(q)
    })
  }, [rows, statusFiltro, empresaFiltro, busca, situacao])

  const proximosPrazos = useMemo(
    () =>
      rows
        .filter((r) => r.data_limite && !r.entregue_em)
        .sort((a, b) => (a.data_limite ?? '').localeCompare(b.data_limite ?? '')),
    [rows],
  )

  const pctEntregue =
    summary && summary.valor_total > 0
      ? Math.round((summary.valor_entregue / summary.valor_total) * 100)
      : 0
  const contagem = {
    aberto: rows.filter((r) => !r.entregue_em).length,
    entregue: rows.filter((r) => r.entregue_em).length,
    todos: rows.length,
  }

  const openRow = (processo: PerdcompProcesso) =>
    setDrawer({ mode: painelFiscalEditor ? 'edit' : 'view', processo })

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight text-[color:var(--color-ink)]">
          PER/DCOMP
        </h1>
        <div className="flex items-center gap-2">
          {painelFiscalEditor ? (
            <button
              type="button"
              className="btn-primary"
              onClick={() => setDrawer({ mode: 'create', processo: null })}
            >
              <Plus className="h-4 w-4" />
              Novo processo
            </button>
          ) : null}
          <NotificationBell placement="bottom-right" />
        </div>
      </div>

      {error ? <p className="text-sm text-rose-600">{error}</p> : null}

      {loading && !summary ? (
        <TableSkeleton />
      ) : summary ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              title="Valor em aberto"
              value={formatMoneyBRL(summary.valor_aberto)}
              hint={`${summary.processos_abertos} ${summary.processos_abertos === 1 ? 'processo' : 'processos'} · de ${formatMoneyBRL(summary.valor_total)} pedidos`}
              icon={Wallet}
              tone="brand"
            />
            <KpiCard
              title="Entregue"
              value={formatMoneyBRL(summary.valor_entregue)}
              hint={
                summary.processos_entregues > 0
                  ? `${summary.processos_entregues} de ${summary.total_processos} processos · ${pctEntregue}% do valor`
                  : 'Nenhum processo entregue ainda'
              }
              icon={CheckCircle2}
              tone="emerald"
            />
            <KpiCard
              title="Valor indeferido"
              value={formatMoneyBRL(summary.valor_indeferido)}
              hint={
                summary.valor_total > 0
                  ? `Em aberto · ${((summary.valor_indeferido / summary.valor_total) * 100).toFixed(0)}% do total pedido`
                  : undefined
              }
              icon={XCircle}
              tone="rose"
            />
            <KpiCard
              title="Prazos vencidos"
              value={String(summary.prazos.vencidos)}
              hint={
                summary.prazos.vence_30d > 0
                  ? `${summary.prazos.vence_30d} vencem nos próximos 30 dias`
                  : 'Nenhum prazo nos próximos 30 dias'
              }
              icon={AlertOctagon}
              tone={summary.prazos.vencidos > 0 ? 'alert' : 'slate'}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <DiretoriaChartCard title="Valor pedido por status">
              <PerdcompStatusChart data={summary.por_status} />
            </DiretoriaChartCard>
            <DiretoriaChartCard title="Próximos prazos">
              {proximosPrazos.length === 0 ? (
                <p className="py-10 text-center text-sm text-[color:var(--color-muted)]">
                  Nenhum prazo cadastrado
                </p>
              ) : (
                <ul className="max-h-[17rem] divide-y divide-[color:var(--color-line)] overflow-y-auto pr-1 [scrollbar-width:thin]">
                  {proximosPrazos.map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => openRow(p)}
                        className="flex w-full items-center justify-between gap-3 py-2.5 text-left transition hover:opacity-80"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-[color:var(--color-ink)]">
                            {p.empresa || '—'}
                          </p>
                          <p className="truncate text-xs text-[color:var(--color-muted)]">
                            {formatDate(p.data_limite)} · {p.tributo_credito || '—'}
                          </p>
                        </div>
                        <PerdcompPrazoChip
                          situacao={p.prazo_situacao}
                          dias={p.dias_para_prazo}
                        />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </DiretoriaChartCard>
          </div>

          <div className="glass-panel sticky top-3 z-20 flex flex-wrap items-center gap-2 px-3 py-2">
            <div
              role="group"
              aria-label="Situação"
              className="flex shrink-0 items-center gap-1 rounded-xl bg-[color:var(--color-surface)] p-1"
            >
              {SITUACOES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  aria-pressed={situacao === s.id}
                  onClick={() => setSituacao(s.id)}
                  className={[
                    'rounded-lg px-3 py-1.5 text-xs font-semibold transition',
                    situacao === s.id
                      ? 'bg-brand-500 text-white shadow-sm'
                      : 'text-[color:var(--color-muted)] hover:text-[color:var(--color-ink)]',
                  ].join(' ')}
                >
                  {s.label} · {contagem[s.id]}
                </button>
              ))}
            </div>
            <GlassSelect
              className="w-[12rem] shrink-0"
              icon={Tags}
              ariaLabel="Status"
              value={statusFiltro}
              onChange={setStatusFiltro}
              options={[
                { value: '', label: 'Todos os status' },
                ...statusOptions.map((s) => ({ value: s, label: s })),
              ]}
            />
            <GlassSelect
              className="w-[14rem] shrink-0"
              icon={Building2}
              ariaLabel="Empresa"
              value={empresaFiltro}
              onChange={setEmpresaFiltro}
              options={[
                { value: '', label: 'Todas as empresas' },
                ...empresaOptions.map((e) => ({ value: e, label: e })),
              ]}
            />
            <label className="relative min-w-[12rem] flex-1">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--color-muted)]"
                aria-hidden
              />
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar PER/DCOMP, processo, tributo..."
                className="glass-input pl-9"
                aria-label="Buscar"
              />
            </label>
            <span className="glass-chip text-xs text-[color:var(--color-muted)]">
              {filtered.length} de {rows.length}
            </span>
          </div>

          <div className="glass-panel overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-[color:var(--color-line)] bg-[color:var(--color-panel)] text-[11px] font-semibold uppercase tracking-wide text-[color:var(--color-muted)]">
                  <tr>
                    <th className="px-4 py-3">Empresa</th>
                    <th className="px-4 py-3">Tributo / Crédito</th>
                    <th className="px-4 py-3 text-right">Valor</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Data limite</th>
                    <th className="px-4 py-3">Prazo</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-4 py-8 text-center text-sm text-[color:var(--color-muted)]"
                      >
                        {situacao === 'aberto' && contagem.aberto === 0
                          ? 'Todos os processos foram entregues.'
                          : 'Nenhum processo com esses filtros.'}
                      </td>
                    </tr>
                  ) : (
                    filtered.map((r) => (
                      <tr
                        key={r.id}
                        onClick={() => openRow(r)}
                        className={[
                          'cursor-pointer border-b border-[color:var(--color-line)] transition last:border-0 hover:bg-[color:var(--nav-hover)]',
                          r.entregue_em ? 'opacity-70' : '',
                        ].join(' ')}
                      >
                        <td className="px-4 py-3">
                          <div className="font-medium text-[color:var(--color-ink)]">
                            {r.empresa || '—'}
                          </div>
                          <div className="mt-0.5 font-mono text-[11px] text-[color:var(--color-muted)]">
                            {r.perdcomp}
                          </div>
                        </td>
                        <td className="max-w-xs px-4 py-3 text-[color:var(--color-ink)]">
                          <div className="truncate">{r.tributo_credito || '—'}</div>
                          <div className="mt-0.5 truncate text-xs text-[color:var(--color-muted)]">
                            {r.periodo}
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right font-medium text-[color:var(--color-ink)]">
                          {formatMoneyBRL(r.valor_pedido)}
                        </td>
                        <td className="px-4 py-3">
                          <PerdcompStatusPill status={r.status} />
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-[color:var(--color-muted)]">
                          {formatDate(r.data_limite)}
                          {r.entregue_em ? (
                            <div className="mt-0.5 text-[11px] text-emerald-700 dark:text-emerald-300">
                              Entregue em {formatDate(r.entregue_em)}
                            </div>
                          ) : null}
                        </td>
                        <td className="px-4 py-3">
                          <PerdcompPrazoChip
                            situacao={r.prazo_situacao}
                            dias={r.dias_para_prazo}
                          />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : null}

      <PerdcompDrawer
        open={drawer !== null}
        mode={drawer?.mode ?? 'view'}
        processo={drawer?.processo ?? null}
        statusOptions={statusOptions}
        onClose={() => setDrawer(null)}
        onSaved={() => void load()}
        onDeleted={() => void load()}
      />
    </div>
  )
}
