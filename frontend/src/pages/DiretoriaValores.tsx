import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ArrowDownLeft,
  ArrowUpRight,
  Building2,
  Receipt,
  Wallet,
  TrendingDown,
  TrendingUp,
} from 'lucide-react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import GlassMonthPicker from '../components/GlassMonthPicker'
import GlassSelect from '../components/GlassSelect'
import NotificationBell from '../components/NotificationBell'
import { TableSkeleton } from '../components/ui/PageSkeletons'
import { apiFetch, buildQuery } from '../lib/api'
import {
  currentCompetenciaMonth,
  formatCompetencia,
  formatMoneyBRL,
  monthToCompetencia,
} from '../lib/format'
import {
  buildFaturamentoSeries,
  deltaPercent,
  groupEmpresas,
  metricsForEmpresaMonth,
  previousCompetenciaIso,
  type ValorRow,
} from '../lib/valoresMetrics'

function DeltaBadge({ value }: { value: number | null }) {
  if (value == null || !Number.isFinite(value)) return null
  const up = value >= 0
  const Icon = up ? TrendingUp : TrendingDown
  return (
    <span
      className={[
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold',
        up
          ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
          : 'bg-rose-500/15 text-rose-600 dark:text-rose-400',
      ].join(' ')}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {up ? '+' : ''}
      {value.toFixed(1)}%
    </span>
  )
}

function MetricTile({
  title,
  value,
  delta,
  tone,
}: {
  title: string
  value: number | null
  delta: number | null
  tone: 'fat' | 'iss' | 'pis' | 'cofins'
}) {
  const Icon =
    tone === 'fat'
      ? Wallet
      : tone === 'iss'
        ? Receipt
        : tone === 'pis'
          ? ArrowDownLeft
          : ArrowUpRight
  const iconClass =
    tone === 'fat'
      ? 'bg-brand-500/15 text-brand-600'
      : tone === 'iss'
        ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
        : tone === 'pis'
          ? 'bg-sky-500/15 text-sky-600 dark:text-sky-400'
          : 'bg-amber-500/15 text-amber-700 dark:text-amber-400'

  return (
    <div className="diretoria-card flex min-h-[7.5rem] flex-col justify-between gap-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm text-[color:var(--color-muted)]">{title}</p>
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${iconClass}`}
        >
          <Icon className="h-4 w-4" aria-hidden />
        </span>
      </div>
      <div>
        <p className="text-xl font-bold tracking-tight text-[color:var(--color-ink)] sm:text-2xl">
          {value != null ? formatMoneyBRL(value) : '—'}
        </p>
        <div className="mt-1.5">
          <DeltaBadge value={delta} />
        </div>
      </div>
    </div>
  )
}

function FaturamentoChart({
  data,
  loading,
}: {
  data: { label: string; faturamento: number }[]
  loading: boolean
}) {
  if (loading && data.length === 0) {
    return (
      <div className="flex h-full min-h-[12rem] items-center justify-center text-sm text-[color:var(--color-muted)]">
        Carregando histórico…
      </div>
    )
  }
  if (data.length === 0) {
    return (
      <div className="flex h-full min-h-[12rem] items-center justify-center text-sm text-[color:var(--color-muted)]">
        Sem histórico para esta empresa.
      </div>
    )
  }

  return (
    <div className="h-full min-h-[12rem] w-full flex-1">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="fatFillSplit" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#FF3D03" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#FF3D03" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="4 6"
            stroke="rgb(145 158 171 / 0.25)"
            vertical={false}
          />
          <XAxis
            dataKey="label"
            tick={{ fill: 'var(--color-muted)', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: 'var(--color-muted)', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={56}
            tickFormatter={(v: number) =>
              v >= 1_000_000
                ? `${(v / 1_000_000).toFixed(1)}M`
                : v >= 1000
                  ? `${(v / 1000).toFixed(0)}k`
                  : String(v)
            }
          />
          <Tooltip
            formatter={(value) => [
              formatMoneyBRL(Number(value)),
              'Faturamento',
            ]}
            contentStyle={{
              borderRadius: 12,
              border: '1px solid var(--color-line)',
              background: 'var(--color-panel)',
            }}
          />
          <Area
            type="monotone"
            dataKey="faturamento"
            stroke="#FF3D03"
            strokeWidth={3}
            fill="url(#fatFillSplit)"
            dot={{ r: 3, fill: '#FF3D03', strokeWidth: 0 }}
            activeDot={{ r: 5 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

export default function DiretoriaValores() {
  const [competencia, setCompetencia] = useState(currentCompetenciaMonth)
  const [empresaCnpj, setEmpresaCnpj] = useState('')
  const [monthRows, setMonthRows] = useState<ValorRow[]>([])
  const [historyRows, setHistoryRows] = useState<ValorRow[]>([])
  const [loading, setLoading] = useState(true)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [error, setError] = useState('')

  const competenciaIso = monthToCompetencia(competencia)

  const loadMonth = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const q = buildQuery({
        competencia: competenciaIso,
        limit: '200',
      })
      const data = await apiFetch<ValorRow[]>(`/api/valores${q}`)
      setMonthRows(data)
    } catch (err) {
      setMonthRows([])
      setError(err instanceof Error ? err.message : 'Falha ao carregar valores')
    } finally {
      setLoading(false)
    }
  }, [competenciaIso])

  useEffect(() => {
    void loadMonth()
  }, [loadMonth])

  const empresas = useMemo(() => groupEmpresas(monthRows), [monthRows])

  useEffect(() => {
    if (empresas.length === 0) {
      setEmpresaCnpj('')
      return
    }
    if (!empresas.some((e) => e.cnpj === empresaCnpj)) {
      setEmpresaCnpj(empresas[0].cnpj)
    }
  }, [empresas, empresaCnpj])

  useEffect(() => {
    if (!empresaCnpj) {
      setHistoryRows([])
      return
    }
    let cancelled = false
    setHistoryLoading(true)
    void (async () => {
      try {
        const q = buildQuery({
          empresa_cnpj: empresaCnpj,
          limit: '200',
        })
        const data = await apiFetch<ValorRow[]>(`/api/valores${q}`)
        if (!cancelled) setHistoryRows(data)
      } catch {
        if (!cancelled) setHistoryRows([])
      } finally {
        if (!cancelled) setHistoryLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [empresaCnpj])

  const empresa = empresas.find((e) => e.cnpj === empresaCnpj) ?? null
  const metrics = useMemo(
    () =>
      empresaCnpj
        ? metricsForEmpresaMonth(monthRows, empresaCnpj, competenciaIso)
        : null,
    [monthRows, empresaCnpj, competenciaIso],
  )

  const prevIso = previousCompetenciaIso(competenciaIso)
  const prevMetrics = useMemo(
    () =>
      empresaCnpj
        ? metricsForEmpresaMonth(historyRows, empresaCnpj, prevIso)
        : null,
    [historyRows, empresaCnpj, prevIso],
  )

  const chartData = useMemo(
    () =>
      empresaCnpj ? buildFaturamentoSeries(historyRows, empresaCnpj, 12) : [],
    [historyRows, empresaCnpj],
  )

  const issValue = metrics?.issRecolher ?? metrics?.erpIss ?? null
  const fatDelta = deltaPercent(
    metrics?.faturamento ?? null,
    prevMetrics?.faturamento ?? null,
  )
  const issDelta = deltaPercent(
    issValue,
    prevMetrics?.issRecolher ?? prevMetrics?.erpIss ?? null,
  )
  const pisDelta = deltaPercent(metrics?.pis ?? null, prevMetrics?.pis ?? null)
  const cofinsDelta = deltaPercent(
    metrics?.cofins ?? null,
    prevMetrics?.cofins ?? null,
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight text-[color:var(--color-ink)]">
          Valores
        </h1>
        <NotificationBell />
      </div>

      <div className="glass-panel sticky top-3 z-20 flex flex-wrap items-center gap-2 px-3 py-2">
        <GlassMonthPicker
          className="w-[8.25rem] shrink-0"
          value={competencia}
          onChange={setCompetencia}
        />
        <GlassSelect
          className="w-[11.5rem] shrink-0"
          icon={Building2}
          ariaLabel="Empresa"
          value={empresaCnpj}
          onChange={setEmpresaCnpj}
          placeholder="Empresa"
          options={empresas.map((e) => ({
            value: e.cnpj,
            label: e.alias,
          }))}
        />
        <span className="ml-auto glass-chip text-xs text-[color:var(--color-muted)]">
          {empresas.length} {empresas.length === 1 ? 'empresa' : 'empresas'}
        </span>
      </div>

      {error ? (
        <p className="text-sm text-rose-600">{error}</p>
      ) : null}

      {loading ? (
        <TableSkeleton />
      ) : empresas.length === 0 ? (
        <div className="glass-panel p-8 text-center text-sm text-[color:var(--color-muted)]">
          Nenhum valor para {formatCompetencia(competenciaIso)}.
        </div>
      ) : !empresa || !metrics ? (
        <div className="glass-panel p-8 text-center text-sm text-[color:var(--color-muted)]">
          Selecione uma empresa.
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:items-stretch">
          <section className="diretoria-card flex min-h-[22rem] flex-col gap-4">
            <div>
              <p className="text-sm font-medium text-[color:var(--color-muted)]">
                Faturamento
              </p>
              <p className="mt-1 text-3xl font-bold tracking-tight text-[color:var(--color-ink)] sm:text-4xl">
                {metrics.faturamento != null
                  ? formatMoneyBRL(metrics.faturamento)
                  : '—'}
              </p>
              <div className="mt-2">
                <DeltaBadge value={fatDelta} />
              </div>
            </div>
            <FaturamentoChart data={chartData} loading={historyLoading} />
          </section>

          <div className="grid grid-cols-2 gap-4">
            <MetricTile
              title="Faturamento"
              value={metrics.faturamento}
              delta={fatDelta}
              tone="fat"
            />
            <MetricTile
              title="ISS a recolher"
              value={issValue}
              delta={issDelta}
              tone="iss"
            />
            <MetricTile
              title="PIS"
              value={metrics.pis}
              delta={pisDelta}
              tone="pis"
            />
            <MetricTile
              title="COFINS"
              value={metrics.cofins}
              delta={cofinsDelta}
              tone="cofins"
            />
          </div>
        </div>
      )}
    </div>
  )
}
