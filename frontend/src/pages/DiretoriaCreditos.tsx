import {
  Fragment,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react'
import {
  Banknote,
  Building2,
  CalendarDays,
  ChevronDown,
  ClipboardList,
  Download,
  FileSpreadsheet,
  FileText,
  Percent,
  Plus,
  Search,
  TrendingUp,
  Upload,
  Wallet,
  X,
  type LucideIcon,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import GlassDatePicker from '../components/GlassDatePicker'
import GlassMonthPicker from '../components/GlassMonthPicker'
import GlassSelect from '../components/GlassSelect'
import NotificationBell from '../components/NotificationBell'
import DiretoriaChartCard from '../components/diretoria/DiretoriaChartCard'
import { TableSkeleton } from '../components/ui/PageSkeletons'
import { useAuth } from '../context/AuthContext'
import { ApiError, apiDownload, apiFetch, apiUpload } from '../lib/api'
import {
  currentCompetenciaMonth,
  formatCompetencia,
  formatDate,
  formatMoneyBRL,
} from '../lib/format'

function formatCnpj(value: string | null | undefined): string {
  const d = (value || '').replace(/\D/g, '')
  if (d.length !== 14) return value || '—'
  return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
}
import type {
  CreditoCadastro,
  CreditoCompensacao,
  CreditoStatus,
  CreditosDashboard,
  CreditosImportResult,
  Empresa,
} from '../types'

type TabId = 'consolidada' | 'compensacoes' | 'selic' | `${number}`

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
  tone: 'brand' | 'slate' | 'rose' | 'emerald'
}) {
  const iconClass = {
    brand: 'bg-brand-500/15 text-brand-600',
    emerald: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
    slate: 'bg-slate-500/10 text-slate-600 dark:text-slate-300',
    rose: 'bg-rose-500/15 text-rose-600 dark:text-rose-400',
  }[tone]

  return (
    <div className="diretoria-card flex min-h-[7rem] flex-col justify-between gap-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm text-[color:var(--color-muted)]">{title}</p>
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${iconClass}`}
        >
          <Icon className="h-4 w-4" aria-hidden />
        </span>
      </div>
      <div>
        <p className="text-2xl font-bold tracking-tight text-[color:var(--color-ink)]">
          {value}
        </p>
        {hint ? (
          <p className="mt-1 text-xs text-[color:var(--color-muted)]">{hint}</p>
        ) : null}
      </div>
    </div>
  )
}

const STATUS_LABEL: Record<CreditoStatus, string> = {
  em_uso: 'Em uso',
  disponivel: 'Disponível',
  esgotado: 'Esgotado',
  fora_consolidada: 'Fora da consolidada',
}

const STATUS_CLASS: Record<CreditoStatus, string> = {
  em_uso: 'bg-brand-500/15 text-brand-700 dark:text-brand-300',
  disponivel: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  esgotado: 'bg-slate-500/15 text-slate-600 dark:text-slate-300',
  fora_consolidada: 'bg-amber-500/15 text-amber-800 dark:text-amber-200',
}

/** Valor sem "R$" — a moeda vai no cabeçalho da coluna. */
function formatValor(value: number | null | undefined): string {
  return (value ?? 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

/** Rótulo centralizado dentro da barra: nome da série + valor compacto. */
function barLabel(nome: string) {
  return function BarLabel(props: {
    x?: number | string
    y?: number | string
    width?: number | string
    height?: number | string
    value?: unknown
  }) {
    const x = Number(props.x ?? 0)
    const y = Number(props.y ?? 0)
    const w = Number(props.width ?? 0)
    const h = Number(props.height ?? 0)
    if (h < 36 || w < 36) return null
    const cx = x + w / 2
    const cy = y + h / 2
    const valor = `R$ ${Number(props.value ?? 0).toLocaleString('pt-BR', {
      notation: 'compact',
      maximumFractionDigits: 1,
    })}`
    // ~0.6em por caractere: reduz a fonte até o texto caber na largura da barra
    const caber = (texto: string, max: number) => Math.min(max, (w - 10) / (texto.length * 0.6))
    const fsNome = caber(nome, 12)
    const fsValor = caber(valor, 11)
    const mostraNome = fsNome >= 9
    if (fsValor < 8) return null
    return (
      <text x={cx} y={cy} textAnchor="middle" fill="#fff" style={{ pointerEvents: 'none' }}>
        {mostraNome ? (
          <tspan x={cx} dy="-0.2em" fontSize={fsNome} fontWeight={600}>
            {nome}
          </tspan>
        ) : null}
        <tspan x={cx} dy={mostraNome ? '1.3em' : '0.35em'} fontSize={fsValor} opacity={0.9}>
          {valor}
        </tspan>
      </text>
    )
  }
}

function monthInputValue(iso: string | null | undefined): string {
  if (!iso) return ''
  return iso.slice(0, 7)
}

function toCompetenciaIso(ym: string): string {
  return `${ym}-01`
}

export default function DiretoriaCreditos() {
  const { painelFiscalEditor } = useAuth()
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [empresaId, setEmpresaId] = useState('')
  const [competencia, setCompetencia] = useState('')
  const [data, setData] = useState<CreditosDashboard | null>(null)
  const [tab, setTab] = useState<TabId>('consolidada')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('')
  const [importMsg, setImportMsg] = useState('')
  // credito null = cadastro do código `codigo` (posições fixas 1–4)
  const [modal, setModal] = useState<{ credito: CreditoCadastro | null; codigo: number } | null>(
    null,
  )
  // id do crédito pré-selecionado no lançamento de compensação
  const [compModal, setCompModal] = useState<string | null>(null)

  const loadEmpresas = useCallback(async () => {
    const list = await apiFetch<Empresa[]>('/api/creditos/empresas')
    setEmpresas(list)
    setEmpresaId((atual) => {
      if (atual && list.some((e) => e.id === atual)) return atual
      return list[0]?.id ?? ''
    })
  }, [])

  const load = useCallback(async () => {
    if (!empresaId) {
      setData(null)
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    try {
      const q = new URLSearchParams({ empresa_id: empresaId })
      if (competencia) q.set('competencia', toCompetenciaIso(competencia))
      const dash = await apiFetch<CreditosDashboard>(`/api/creditos?${q}`)
      setData(dash)
      if (!competencia && dash.competencia) {
        setCompetencia(monthInputValue(dash.competencia))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar créditos')
    } finally {
      setLoading(false)
    }
  }, [empresaId, competencia])

  useEffect(() => {
    void loadEmpresas().catch((err) =>
      setError(err instanceof Error ? err.message : 'Falha ao listar empresas'),
    )
  }, [loadEmpresas])

  useEffect(() => {
    void load()
  }, [load])

  const creditoAtivo = useMemo(() => {
    if (!data || !/^\d+$/.test(tab)) return null
    return data.creditos.find((c) => String(c.codigo_interno) === tab) ?? null
  }, [data, tab])

  const chartData = useMemo(() => {
    if (!data?.consolidada) return []
    return Object.entries(data.consolidada.por_tributo || {}).map(([tributo, v]) => ({
      tributo,
      compensado: v.compensado,
      remanescente: v.remanescente,
    }))
  }, [data])

  const evolucaoData = useMemo(() => {
    if (!data?.creditos?.length) return []
    const byMonth = new Map<
      string,
      {
        competencia: string
        saldo: number
        compensadoMes: number
        remanescente: number
        selicMes: number
      }
    >()
    for (const c of data.creditos) {
      if (!c.na_consolidada) continue
      for (const m of c.movimentos || []) {
        const key = m.competencia.slice(0, 10)
        const cur = byMonth.get(key) ?? {
          competencia: key,
          saldo: 0,
          compensadoMes: 0,
          remanescente: 0,
          selicMes: 0,
        }
        cur.saldo += m.saldo_atualizado || 0
        cur.compensadoMes += m.total_compensado || 0
        cur.remanescente += m.credito_remanescente || 0
        cur.selicMes += m.atualiz_mes || 0
        byMonth.set(key, cur)
      }
    }
    const sorted = [...byMonth.values()].sort((a, b) =>
      a.competencia.localeCompare(b.competencia),
    )
    let compAcum = 0
    let selicAcum = 0
    return sorted.map((row) => {
      compAcum += row.compensadoMes
      selicAcum += row.selicMes
      return {
        competencia: row.competencia,
        label: formatCompetencia(row.competencia),
        saldo_atualizado: row.saldo,
        compensado: compAcum,
        remanescente: row.remanescente,
        selic_acum: selicAcum,
      }
    })
  }, [data])

  async function onImport(file: File, forcar = false) {
    if (!empresaId) return
    const lower = file.name.toLowerCase()
    if (!lower.endsWith('.xlsx') && !lower.endsWith('.xlsb')) {
      setImportMsg('Envie um arquivo .xlsx ou .xlsb do Controle de Créditos.')
      return
    }
    setBusy('import')
    setImportMsg('')
    try {
      const fd = new FormData()
      fd.append('empresa_id', empresaId)
      fd.append('file', file)
      fd.append('forcar_cnpj', forcar ? 'true' : 'false')
      const result = await apiUpload<CreditosImportResult>('/api/creditos/import', fd)
      const warns = result.warnings?.length
        ? `\nAvisos: ${result.warnings.slice(0, 4).join('; ')}`
        : ''
      setImportMsg(
        `Importados ${result.imported} créditos, ${result.selic} taxas SELIC. Conta ${result.conta_contabil || '—'}.${warns}`,
      )
      await load()
    } catch (err) {
      if (err instanceof ApiError && err.status === 409 && !forcar) {
        const ok = window.confirm(`${err.message}\n\nImportar mesmo assim?`)
        if (ok) {
          await onImport(file, true)
          return
        }
        setImportMsg('Importação cancelada.')
        return
      }
      setImportMsg(err instanceof Error ? err.message : 'Falha na importação')
    } finally {
      setBusy('')
    }
  }

  async function saveCadastro(partial: Partial<CreditoCadastro> & { codigo_interno: number }) {
    if (!empresaId) return
    setBusy('cadastro')
    try {
      await apiFetch(`/api/creditos/cadastros?empresa_id=${empresaId}`, {
        method: 'PUT',
        body: JSON.stringify({
          codigo_interno: partial.codigo_interno,
          tipo_credito: partial.tipo_credito ?? '',
          tributo: partial.tributo ?? '',
          ano_calendario: partial.ano_calendario ?? null,
          credito_original_inicial: partial.credito_original_inicial ?? 0,
          data_inicio_atualizacao: partial.data_inicio_atualizacao ?? null,
          na_consolidada: partial.na_consolidada ?? false,
          ativo: partial.ativo ?? true,
          observacao: partial.observacao ?? '',
        }),
      })
      setModal(null)
      setTab(String(partial.codigo_interno) as TabId)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao salvar cadastro')
    } finally {
      setBusy('')
    }
  }

  async function addCompensacao(creditoId: string, payload: CompensacaoPayload) {
    setBusy('evento')
    try {
      await apiFetch(`/api/creditos/cadastros/${creditoId}/compensacoes`, {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      setCompModal(null)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao lançar compensação')
    } finally {
      setBusy('')
    }
  }

  async function removeEvento(ev: CreditoCompensacao) {
    if (!window.confirm('Excluir este evento de compensação?')) return
    setBusy('evento')
    try {
      await apiFetch(`/api/creditos/compensacoes/${ev.id}`, { method: 'DELETE' })
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao excluir')
    } finally {
      setBusy('')
    }
  }

  async function saveSelic(comp: string, pct: string) {
    setBusy('selic')
    try {
      const taxa = Number(pct.replace(',', '.')) / 100
      await apiFetch('/api/selic', {
        method: 'PUT',
        body: JSON.stringify({
          itens: [{ competencia: toCompetenciaIso(comp), taxa_mensal: taxa, fonte: 'manual' }],
        }),
      })
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao salvar SELIC')
    } finally {
      setBusy('')
    }
  }

  const codigosUsados = useMemo(
    () => new Set((data?.creditos || []).map((c) => c.codigo_interno)),
    [data],
  )

  const creditosCadastrados = data?.creditos || []

  function openCompensacao() {
    const preferido = creditoAtivo ?? creditosCadastrados.find((c) => c.status !== 'esgotado')
    setCompModal(preferido?.id ?? creditosCadastrados[0]?.id ?? '')
  }

  // aba "Incluir" da planilha: o próximo Id livre vira um crédito novo
  function openIncluirCredito() {
    let livre = 1
    while (codigosUsados.has(livre) && livre < 20) livre += 1
    setModal({ credito: null, codigo: livre })
  }

  const cons = data?.consolidada
  const codigosTabs = [...codigosUsados].sort((a, b) => a - b)
  const tabs: { id: TabId; label: string }[] = [
    { id: 'consolidada', label: 'Consolidada' },
    { id: 'compensacoes', label: 'Compensações' },
    ...codigosTabs.map((c) => ({ id: String(c) as TabId, label: String(c) })),
    { id: 'selic', label: 'SELIC' },
  ]

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight text-[color:var(--color-ink)]">
          Controle de Créditos
        </h1>
        <div className="flex items-center gap-3">
          {data?.controle?.updated_at ? (
            <span className="text-xs text-[color:var(--color-muted)]">
              Atualizado {formatDate(data.controle.updated_at.slice(0, 10))}
            </span>
          ) : null}
          <NotificationBell />
        </div>
      </header>

      <div className="glass-panel sticky top-3 z-20 flex items-stretch gap-2 px-3 py-2">
        {data?.empresa?.logo_url || data?.empresa?.logo_url_escuro ? (
          <div className="flex w-[7.5rem] shrink-0 items-center justify-center rounded-xl border border-[color:var(--control-border)] bg-[color:var(--control-bg)] px-3 py-1 sm:w-[9rem]">
            {data.empresa.logo_url ? (
              <img
                src={data.empresa.logo_url}
                alt=""
                className="max-h-7 w-auto max-w-full object-contain dark:hidden"
              />
            ) : null}
            {data.empresa.logo_url_escuro ? (
              <img
                src={data.empresa.logo_url_escuro}
                alt=""
                className="hidden max-h-7 w-auto max-w-full object-contain dark:block"
              />
            ) : null}
          </div>
        ) : null}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <GlassMonthPicker
              className="w-[8.25rem] shrink-0"
              value={competencia}
              onChange={setCompetencia}
            />
            <GlassSelect
              className="min-w-[14rem] flex-1 basis-[14rem]"
              ariaLabel="Empresa"
              icon={Building2}
              value={empresaId}
              onChange={(v) => {
                setEmpresaId(v)
                setCompetencia('')
              }}
              options={empresas.map((e) => ({
                value: e.id,
                label: e.razao_social,
              }))}
            />
            {data?.empresa?.cnpj ? (
              <span className="flex h-9 shrink-0 items-center rounded-xl border border-[color:var(--control-border)] bg-[color:var(--control-bg)] px-3 text-xs tabular-nums text-[color:var(--color-muted)]">
                CNPJ {formatCnpj(data.empresa.cnpj)}
              </span>
            ) : null}
            {painelFiscalEditor ? (
              <div className="flex shrink-0 items-center gap-2">
                <PlanilhaMenu busy={busy === 'import'} onImport={(f) => void onImport(f)} />
                <AcoesToggle
                  podeLancar={creditosCadastrados.length > 0 && !busy}
                  onIncluir={openIncluirCredito}
                  onLancar={openCompensacao}
                />
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {importMsg ? (
        <p className="whitespace-pre-wrap rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] px-3 py-2 text-sm">
          {importMsg}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-700 dark:text-rose-300">
          {error}
        </p>
      ) : null}

      <div
        role="tablist"
        aria-label="Visões do controle"
        className="glass-panel inline-flex max-w-full flex-wrap items-center gap-1.5 p-1.5"
      >
        {tabs.map((t, i) => {
          const ativa = tab === t.id
          // separador entre Consolidada | créditos | SELIC
          const numerica = (id: string) => /^\d+$/.test(id)
          const separar =
            i > 0 &&
            (t.id === 'selic' ||
              t.id === 'compensacoes' ||
              (numerica(t.id) && !numerica(tabs[i - 1].id)))
          return (
            <div key={t.id} className="flex items-center gap-1.5">
              {separar ? (
                <span aria-hidden className="mx-0.5 h-5 w-px bg-[color:var(--color-line)]" />
              ) : null}
              <button
                type="button"
                role="tab"
                aria-selected={ativa}
                title={/^\d+$/.test(t.id) ? `Crédito ${t.id}` : undefined}
                onClick={() => setTab(t.id)}
                className={[
                  'h-8 min-w-[2.25rem] rounded-xl px-3 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40',
                  ativa
                    ? 'bg-brand-500 text-white shadow-sm shadow-brand-500/30'
                    : 'border border-[color:var(--control-border)] bg-[color:var(--control-bg)] text-[color:var(--color-muted)] hover:bg-[color:var(--nav-hover)] hover:text-[color:var(--color-ink)]',
                ].join(' ')}
              >
                {t.label}
              </button>
            </div>
          )
        })}
      </div>

      {loading ? <TableSkeleton rows={6} /> : null}

      {!loading && tab === 'consolidada' && cons ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              title="Saldo atualizado"
              value={formatMoneyBRL(cons.saldo_atualizado)}
              hint={`Original ${formatMoneyBRL(cons.credito_original)} + SELIC`}
              icon={Wallet}
              tone="slate"
            />
            <KpiCard
              title="Compensado"
              value={formatMoneyBRL(cons.total_compensado)}
              icon={Banknote}
              tone="brand"
            />
            <KpiCard
              title="Remanescente"
              value={formatMoneyBRL(cons.credito_remanescente)}
              icon={Wallet}
              tone="emerald"
            />
            <KpiCard
              title="SELIC do mês"
              value={formatMoneyBRL(cons.selic_mes)}
              icon={Percent}
              tone="slate"
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="diretoria-card flex flex-col gap-4">
              <p className="text-sm font-semibold text-[color:var(--color-ink)]">
                Por tributo (consolidada)
              </p>
              <div className="flex min-h-[16rem] flex-1 flex-col gap-4 sm:flex-row">
                <div className="h-64 min-w-0 flex-1 sm:h-auto">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 4, right: 4, left: -8, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.2} vertical={false} />
                      <XAxis
                        dataKey="tributo"
                        tick={{ fontSize: 12 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v) =>
                          Number(v).toLocaleString('pt-BR', {
                            notation: 'compact',
                            compactDisplay: 'short',
                          })
                        }
                      />
                      <Tooltip
                        cursor={{ fill: 'var(--nav-hover)' }}
                        formatter={(v) => formatMoneyBRL(Number(v))}
                        contentStyle={{
                          background: 'var(--color-surface)',
                          border: '1px solid var(--color-border)',
                          borderRadius: 12,
                        }}
                      />
                      <Bar dataKey="compensado" name="Compensado" fill="#2563eb" radius={[8, 8, 0, 0]}>
                        <LabelList content={barLabel('Compensado')} />
                      </Bar>
                      <Bar
                        dataKey="remanescente"
                        name="Remanescente"
                        fill="#059669"
                        radius={[8, 8, 0, 0]}
                      >
                        <LabelList content={barLabel('Remanescente')} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="flex shrink-0 flex-col justify-between gap-4 border-t border-[color:var(--color-line)] pt-4 sm:w-48 sm:border-t-0 sm:border-l sm:pt-0 sm:pl-5">
                  <div>
                    <p className="text-sm text-[color:var(--color-muted)]">Utilizado</p>
                    <p className="mt-1 text-[2.5rem] leading-none font-bold tracking-tight tabular-nums text-[color:var(--color-ink)]">
                      {cons.percentual_utilizado != null
                        ? `${cons.percentual_utilizado.toLocaleString('pt-BR', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}%`
                        : '—'}
                    </p>
                  </div>
                  <div>
                    <p className="flex items-center gap-1.5 text-base font-semibold tabular-nums text-[color:var(--color-ink)]">
                      <TrendingUp className="h-4 w-4 text-emerald-500" strokeWidth={2} />
                      {formatMoneyBRL(cons.total_compensado)}
                    </p>
                    <p className="mt-0.5 text-sm text-[color:var(--color-muted)]">
                      de {formatMoneyBRL(cons.saldo_atualizado)}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <DiretoriaChartCard title="Detalhe consolidada">
              <div className="overflow-hidden rounded-xl border border-[color:var(--color-line)]">
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-[13px]">
                    <thead className="border-b border-[color:var(--color-line)] bg-[color:var(--color-panel)] text-[11px] font-semibold uppercase tracking-wide text-[color:var(--color-muted)]">
                      <tr>
                        <th className="px-2.5 py-2.5">Crédito</th>
                        <th className="px-2.5 py-2.5">Status</th>
                        <th className="px-2.5 py-2.5 text-right">Original (R$)</th>
                        <th className="px-2.5 py-2.5 text-right">Saldo (R$)</th>
                        <th className="px-2.5 py-2.5 text-right">Remanescente (R$)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data?.creditos || []).length === 0 ? (
                        <tr>
                          <td
                            colSpan={5}
                            className="px-4 py-8 text-center text-sm text-[color:var(--color-muted)]"
                          >
                            Nenhum crédito cadastrado.
                          </td>
                        </tr>
                      ) : (
                        (data?.creditos || []).map((c) => {
                          const mov = c.movimento_ref
                          return (
                            <tr
                              key={c.id}
                              onClick={() => setTab(String(c.codigo_interno) as TabId)}
                              title={`Abrir crédito ${c.codigo_interno}`}
                              className="cursor-pointer border-b border-[color:var(--color-line)] transition last:border-0 hover:bg-[color:var(--nav-hover)]"
                            >
                              <td className="whitespace-nowrap px-2.5 py-2.5">
                                <div className="font-medium text-[color:var(--color-ink)]">
                                  {c.tipo_credito || '—'}
                                </div>
                                {/* tributo só quando o tipo já não o menciona */}
                                {c.tributo && !(c.tipo_credito || '').includes(c.tributo) ? (
                                  <div className="mt-0.5 text-xs text-[color:var(--color-muted)]">
                                    {c.tributo}
                                  </div>
                                ) : null}
                              </td>
                              <td className="px-2.5 py-2.5">
                                <span
                                  className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLASS[c.status]}`}
                                >
                                  {STATUS_LABEL[c.status]}
                                </span>
                              </td>
                              <td className="whitespace-nowrap px-2.5 py-2.5 text-right tabular-nums text-[color:var(--color-muted)]">
                                {formatValor(mov?.credito_original)}
                              </td>
                              <td className="whitespace-nowrap px-2.5 py-2.5 text-right tabular-nums text-[color:var(--color-muted)]">
                                {formatValor(mov?.saldo_atualizado)}
                              </td>
                              <td className="whitespace-nowrap px-2.5 py-2.5 text-right font-medium tabular-nums text-[color:var(--color-ink)]">
                                {formatValor(mov?.credito_remanescente)}
                              </td>
                            </tr>
                          )
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </DiretoriaChartCard>
          </div>

          <DiretoriaChartCard
            title="Evolução do Crédito Atualizado (com SELIC)"
            subtitle="Soma dos créditos na consolidada · eixo direito = SELIC acumulada"
          >
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={evolucaoData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis
                    yAxisId="left"
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v) =>
                      Number(v).toLocaleString('pt-BR', {
                        notation: 'compact',
                        compactDisplay: 'short',
                      })
                    }
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v) =>
                      Number(v).toLocaleString('pt-BR', {
                        notation: 'compact',
                        compactDisplay: 'short',
                      })
                    }
                  />
                  <Tooltip
                    formatter={(v, name) => [formatMoneyBRL(Number(v)), String(name)]}
                    contentStyle={{
                      background: 'var(--color-surface)',
                      border: '1px solid var(--color-border)',
                    }}
                  />
                  <Legend />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="saldo_atualizado"
                    name="Saldo Atualizado"
                    stroke="#1e3a5f"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="compensado"
                    name="Compensado"
                    stroke="#16a34a"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="selic_acum"
                    name="SELIC"
                    stroke="#ea580c"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="remanescente"
                    name="Saldo Remanescente"
                    stroke="#38bdf8"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </DiretoriaChartCard>
        </div>
      ) : null}

      {!loading && tab === 'consolidada' && !cons && !data?.controle ? (
        <div className="diretoria-card text-sm text-[color:var(--color-muted)]">
          Nenhum controle para esta empresa. Importe a planilha ou use “Incluir crédito”.
        </div>
      ) : null}

      {!loading && creditoAtivo ? (
        <CreditoLedgerTab
          credito={creditoAtivo}
          canEdit={!!painelFiscalEditor}
          busy={busy}
          onAddEvento={() => setCompModal(creditoAtivo.id)}
          onRemoveEvento={(ev) => void removeEvento(ev)}
          onEdit={() => setModal({ credito: creditoAtivo, codigo: creditoAtivo.codigo_interno })}
        />
      ) : null}

      {!loading && /^\d+$/.test(tab) && !creditoAtivo ? (
        <div className="diretoria-card space-y-3 text-sm">
          <p className="text-[color:var(--color-muted)]">
            Crédito {tab} ainda não cadastrado para esta empresa.
          </p>
          {painelFiscalEditor ? (
            <button
              type="button"
              className="btn-primary"
              onClick={() => setModal({ credito: null, codigo: Number(tab) })}
            >
              <Plus className="h-4 w-4" />
              Cadastrar crédito {tab}
            </button>
          ) : null}
        </div>
      ) : null}

      {!loading && tab === 'compensacoes' ? (
        <CompensacoesTab
          creditos={creditosCadastrados}
          canEdit={!!painelFiscalEditor}
          busy={busy === 'evento'}
          onLancar={openCompensacao}
          onRemove={(ev) => void removeEvento(ev)}
          onOpenCredito={(codigo) => setTab(String(codigo) as TabId)}
        />
      ) : null}

      {!loading && tab === 'selic' ? (
        <SelicTab
          rows={data?.selic || []}
          canEdit={!!painelFiscalEditor}
          onSave={(comp, pct) => void saveSelic(comp, pct)}
        />
      ) : null}

      {modal ? (
        <CadastroModal
          credito={modal.credito}
          codigo={modal.codigo}
          competenciaPadrao={competencia}
          busy={busy === 'cadastro'}
          onClose={() => setModal(null)}
          onSave={(payload) => void saveCadastro(payload)}
        />
      ) : null}

      {compModal != null ? (
        <CompensacaoModal
          creditos={creditosCadastrados}
          creditoInicialId={compModal}
          busy={busy === 'evento'}
          onClose={() => setCompModal(null)}
          onSave={(id, payload) => void addCompensacao(id, payload)}
        />
      ) : null}
    </div>
  )
}

function CreditoLedgerTab({
  credito,
  canEdit,
  busy,
  onAddEvento,
  onRemoveEvento,
  onEdit,
}: {
  credito: CreditoCadastro
  canEdit: boolean
  busy: string
  onAddEvento: () => void
  onRemoveEvento: (ev: CreditoCompensacao) => void
  onEdit: () => void
}) {
  return (
    <div className="space-y-4">
      <div className="diretoria-card flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-lg font-semibold text-[color:var(--color-ink)]">
            [{credito.codigo_interno}] {credito.tipo_credito || 'Crédito'}
          </p>
          <p className="text-sm text-[color:var(--color-muted)]">
            {credito.tributo || '—'} · Ano {credito.ano_calendario ?? '—'} · Original{' '}
            {formatMoneyBRL(credito.credito_original_inicial)} · Início{' '}
            {formatCompetencia(credito.data_inicio_atualizacao)}
            {credito.na_consolidada ? ' · Na consolidada' : ' · Fora da consolidada'}
          </p>
          {credito.observacao ? (
            <p className="mt-2 text-xs text-[color:var(--color-muted)]">{credito.observacao}</p>
          ) : null}
        </div>
        <span
          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLASS[credito.status]}`}
        >
          {STATUS_LABEL[credito.status]}
        </span>
        {canEdit ? (
          <button
            type="button"
            className="rounded-lg border border-[color:var(--color-border)] px-3 py-1.5 text-sm"
            onClick={onEdit}
          >
            Editar cadastro
          </button>
        ) : null}
      </div>

      <DiretoriaChartCard title="Ledger mensal" subtitle="Valores recalculados pelo engine">
        <div className="max-h-[28rem] overflow-auto rounded-xl border border-[color:var(--color-line)]">
          <table className="min-w-full text-left text-[13px]">
            <thead className="sticky top-0 z-10 border-b border-[color:var(--color-line)] bg-[color:var(--color-panel)] text-[11px] font-semibold uppercase tracking-wide text-[color:var(--color-muted)]">
              <tr>
                <th className="whitespace-nowrap px-2.5 py-2.5">Mês</th>
                <th className="whitespace-nowrap px-2.5 py-2.5 text-right">SELIC %</th>
                <th className="whitespace-nowrap px-2.5 py-2.5 text-right">K</th>
                <th className="whitespace-nowrap px-2.5 py-2.5 text-right">Original</th>
                <th className="whitespace-nowrap px-2.5 py-2.5 text-right">Saldo</th>
                <th className="whitespace-nowrap px-2.5 py-2.5 text-right">Compensado</th>
                <th className="whitespace-nowrap px-2.5 py-2.5 text-right">Remanescente</th>
                <th className="whitespace-nowrap px-2.5 py-2.5 text-right">Atualiz.</th>
              </tr>
            </thead>
            <tbody>
              {credito.movimentos.map((m) => (
                <tr key={m.competencia} className="border-b border-[color:var(--color-line)] transition last:border-0 hover:bg-[color:var(--nav-hover)]">
                  <td className="whitespace-nowrap px-2.5 py-2">{formatCompetencia(m.competencia)}</td>
                  <td className="whitespace-nowrap px-2.5 py-2 text-right tabular-nums">
                    {m.selic_mensal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="whitespace-nowrap px-2.5 py-2 text-right tabular-nums">
                    {m.selic_acumulada.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="whitespace-nowrap px-2.5 py-2 text-right tabular-nums">
                    {formatMoneyBRL(m.credito_original)}
                  </td>
                  <td className="whitespace-nowrap px-2.5 py-2 text-right tabular-nums">
                    {formatMoneyBRL(m.saldo_atualizado)}
                  </td>
                  <td className="whitespace-nowrap px-2.5 py-2 text-right tabular-nums">
                    {formatMoneyBRL(m.total_compensado)}
                  </td>
                  <td className="whitespace-nowrap px-2.5 py-2 text-right tabular-nums">
                    {formatMoneyBRL(m.credito_remanescente)}
                  </td>
                  <td className="whitespace-nowrap px-2.5 py-2 text-right tabular-nums">
                    {formatMoneyBRL(m.atualiz_mes)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DiretoriaChartCard>

      <DiretoriaChartCard
        title="Compensações"
        subtitle="Linhas da planilha (colunas U–AB) — o total do mês entra no ledger"
        action={
          canEdit ? (
            <button
              type="button"
              disabled={busy === 'evento'}
              className="btn-primary h-9 !py-0"
              onClick={onAddEvento}
            >
              <Plus className="h-4 w-4" />
              Lançar
            </button>
          ) : null
        }
      >
        <div className="max-h-[28rem] overflow-auto rounded-xl border border-[color:var(--color-line)]">
          <table className="min-w-full text-left text-[13px]">
            <thead className="sticky top-0 z-10 border-b border-[color:var(--color-line)] bg-[color:var(--color-panel)] text-[11px] font-semibold uppercase tracking-wide text-[color:var(--color-muted)]">
              <tr>
                <th className="whitespace-nowrap px-2.5 py-2.5">Data</th>
                <th className="whitespace-nowrap px-2.5 py-2.5 text-right">Principal</th>
                <th className="whitespace-nowrap px-2.5 py-2.5 text-right">Multa</th>
                <th className="whitespace-nowrap px-2.5 py-2.5 text-right">Juros</th>
                <th className="whitespace-nowrap px-2.5 py-2.5 text-right">Total</th>
                <th className="whitespace-nowrap px-2.5 py-2.5">Nº PER/DCOMP</th>
                <th className="whitespace-nowrap px-2.5 py-2.5">Cód. receita</th>
                <th className="whitespace-nowrap px-2.5 py-2.5">Débito compensado</th>
                {canEdit ? <th className="whitespace-nowrap px-2.5 py-2.5" /> : null}
              </tr>
            </thead>
            <tbody>
              {credito.compensacoes.map((ev) => (
                <tr
                  key={ev.id}
                  className="border-b border-[color:var(--color-line)] transition last:border-0 hover:bg-[color:var(--nav-hover)]"
                >
                  <td className="whitespace-nowrap px-2.5 py-2">
                    {ev.data_compensacao
                      ? formatDate(ev.data_compensacao)
                      : formatCompetencia(ev.competencia)}
                  </td>
                  <td className="whitespace-nowrap px-2.5 py-2 text-right tabular-nums">{formatValor(ev.valor)}</td>
                  <td className="whitespace-nowrap px-2.5 py-2 text-right tabular-nums">{formatValor(ev.multa)}</td>
                  <td className="whitespace-nowrap px-2.5 py-2 text-right tabular-nums">{formatValor(ev.juros_evento)}</td>
                  <td className="whitespace-nowrap px-2.5 py-2 text-right font-medium tabular-nums text-[color:var(--color-ink)]">
                    {formatValor(ev.valor + ev.multa + ev.juros_evento)}
                  </td>
                  <td className="whitespace-nowrap px-2.5 py-2 font-mono text-xs text-[color:var(--color-muted)]">
                    {ev.numero_dcomp || '—'}
                  </td>
                  <td className="whitespace-nowrap px-2.5 py-2">{ev.cod_receita || '—'}</td>
                  <td className="max-w-[16rem] truncate px-2.5 py-2" title={ev.debito_compensado}>
                    {ev.debito_compensado || '—'}
                  </td>
                  {canEdit ? (
                    <td className="whitespace-nowrap px-2.5 py-2 text-right">
                      <button
                        type="button"
                        className="text-xs text-rose-600"
                        onClick={() => onRemoveEvento(ev)}
                      >
                        Excluir
                      </button>
                    </td>
                  ) : null}
                </tr>
              ))}
              {!credito.compensacoes.length ? (
                <tr>
                  <td colSpan={9} className="px-2.5 py-8 text-center text-[color:var(--color-muted)]">
                    Nenhuma compensação lançada.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </DiretoriaChartCard>
    </div>
  )
}

function SelicTab({
  rows,
  canEdit,
  onSave,
}: {
  rows: { competencia: string; taxa_mensal: number; taxa_percentual: number }[]
  canEdit: boolean
  onSave: (comp: string, pct: string) => void
}) {
  const [comp, setComp] = useState('')
  const [pct, setPct] = useState('')
  const sorted = useMemo(
    () => [...rows].sort((a, b) => b.competencia.localeCompare(a.competencia)),
    [rows],
  )

  return (
    <div className="space-y-4">
      {canEdit ? (
        <div className="diretoria-card flex flex-wrap items-end gap-3">
          <label className="text-sm">
            Competência
            <input
              type="month"
              className="glass-input mt-1 block"
              value={comp}
              onChange={(e) => setComp(e.target.value)}
            />
          </label>
          <label className="text-sm">
            Taxa % ao mês
            <input
              className="glass-input mt-1 block w-28"
              placeholder="1,16"
              value={pct}
              onChange={(e) => setPct(e.target.value)}
            />
          </label>
          <button
            type="button"
            className="rounded-lg bg-brand-600 px-3 py-2 text-sm text-white"
            onClick={() => {
              if (comp && pct) onSave(comp, pct)
            }}
          >
            Salvar taxa
          </button>
          <p className="w-full text-xs text-[color:var(--color-muted)]">
            Taxas são globais (todas as empresas). Informe o percentual (ex. 1,16).
          </p>
        </div>
      ) : null}
      <DiretoriaChartCard title="Tabela SELIC" subtitle="Fração no banco · % na interface">
        <div className="max-h-[28rem] overflow-auto rounded-xl border border-[color:var(--color-line)]">
          <table className="min-w-full text-left text-[13px]">
            <thead className="sticky top-0 z-10 border-b border-[color:var(--color-line)] bg-[color:var(--color-panel)] text-[11px] font-semibold uppercase tracking-wide text-[color:var(--color-muted)]">
              <tr>
                <th className="whitespace-nowrap px-2.5 py-2.5">Competência</th>
                <th className="whitespace-nowrap px-2.5 py-2.5 text-right">Taxa %</th>
                <th className="whitespace-nowrap px-2.5 py-2.5 text-right">Fração</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => (
                <tr key={r.competencia} className="border-b border-[color:var(--color-line)] transition last:border-0 hover:bg-[color:var(--nav-hover)]">
                  <td className="whitespace-nowrap px-2.5 py-2">{formatCompetencia(r.competencia)}</td>
                  <td className="whitespace-nowrap px-2.5 py-2 text-right tabular-nums">
                    {r.taxa_percentual.toLocaleString('pt-BR', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 4,
                    })}
                  </td>
                  <td className="whitespace-nowrap px-2.5 py-2 text-right font-mono text-xs tabular-nums">
                    {r.taxa_mensal}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DiretoriaChartCard>
    </div>
  )
}

// Lista "Tipo Crédito" da aba Tabela da planilha
const TIPOS_CREDITO = [
  { tipo: 'Saldo Negativo IRPJ', tributo: 'IRPJ' },
  { tipo: 'Saldo Negativo CSLL', tributo: 'CSLL' },
  { tipo: 'Pagamento a maior IRPJ', tributo: 'IRPJ' },
  { tipo: 'Pagamento a maior CSLL', tributo: 'CSLL' },
  { tipo: 'Pagamento indevido PAES', tributo: 'PAES' },
]

function parseValor(v: string): number {
  const limpo = v.replace(/[^\d,.-]/g, '')
  // aceita "1.234,56" (pt-BR) ou "1234.56"
  return Number(limpo.includes(',') ? limpo.replace(/\./g, '').replace(',', '.') : limpo)
}

function CadastroModal({
  credito,
  codigo,
  competenciaPadrao,
  busy,
  onClose,
  onSave,
}: {
  credito: CreditoCadastro | null
  codigo: number
  competenciaPadrao: string
  busy: boolean
  onClose: () => void
  onSave: (p: Partial<CreditoCadastro> & { codigo_interno: number }) => void
}) {
  const [form, setForm] = useState({
    tipo_credito: credito?.tipo_credito || TIPOS_CREDITO[0].tipo,
    ano_calendario: credito?.ano_calendario?.toString() ?? '',
    credito_original_inicial: credito
      ? String(credito.credito_original_inicial ?? 0).replace('.', ',')
      : '',
    data_inicio_atualizacao: credito
      ? monthInputValue(credito.data_inicio_atualizacao)
      : competenciaPadrao || currentCompetenciaMonth(),
    na_consolidada: credito?.na_consolidada ?? true,
    observacao: credito?.observacao ?? '',
  })
  const [erro, setErro] = useState('')

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const tipoOptions = TIPOS_CREDITO.map((t) => ({ value: t.tipo, label: t.tipo }))
  // crédito importado com tipo fora da lista continua selecionável
  if (credito?.tipo_credito && !TIPOS_CREDITO.some((t) => t.tipo === credito.tipo_credito)) {
    tipoOptions.push({ value: credito.tipo_credito, label: credito.tipo_credito })
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    const original = parseValor(form.credito_original_inicial)
    const ano = form.ano_calendario ? Number(form.ano_calendario) : null
    if (!Number.isFinite(original) || original <= 0) {
      return setErro('Informe o crédito original.')
    }
    if (!form.data_inicio_atualizacao) return setErro('Informe a data de atualização.')
    if (ano != null && (ano < 1990 || ano > 2100)) return setErro('Ano calendário inválido.')
    setErro('')
    const tributo =
      TIPOS_CREDITO.find((t) => t.tipo === form.tipo_credito)?.tributo ?? credito?.tributo ?? ''
    onSave({
      codigo_interno: codigo,
      tipo_credito: form.tipo_credito,
      tributo,
      ano_calendario: ano,
      credito_original_inicial: original,
      data_inicio_atualizacao: toCompetenciaIso(form.data_inicio_atualizacao),
      na_consolidada: form.na_consolidada,
      ativo: credito?.ativo ?? true,
      observacao: form.observacao,
    })
  }

  const labelClass = 'mb-1.5 block text-xs font-medium text-[color:var(--color-muted)]'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 backdrop-blur-sm">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Fechar"
        onClick={onClose}
      />
      <form
        onSubmit={submit}
        className="relative z-10 max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-[1.25rem] border border-[color:var(--color-line)] bg-white p-6 shadow-2xl dark:bg-[color:var(--color-panel)]"
      >
        <div className="mb-5 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-[color:var(--color-ink)]">
            {credito ? `Editar crédito ${codigo}` : 'Incluir crédito'}
          </h2>
          <button type="button" className="btn-ghost !p-2" onClick={onClose}>
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-[5rem_1fr_8rem]">
            <div className="min-w-0">
              <label className={labelClass}>Id</label>
              <input className="glass-input py-2.5 text-center" value={codigo} disabled />
            </div>
            <div className="min-w-0">
              <label className={labelClass}>Tipo de crédito</label>
              <GlassSelect
                ariaLabel="Tipo de crédito"
                icon={Wallet}
                value={form.tipo_credito}
                onChange={(v) => setForm({ ...form, tipo_credito: v })}
                options={tipoOptions}
              />
            </div>
            <div className="min-w-0">
              <label className={labelClass}>Ano calendário</label>
              <input
                className="glass-input py-2.5"
                inputMode="numeric"
                placeholder="2025"
                value={form.ano_calendario}
                onChange={(e) =>
                  setForm({
                    ...form,
                    ano_calendario: e.target.value.replace(/\D/g, '').slice(0, 4),
                  })
                }
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="min-w-0">
              <label className={labelClass}>Data de atualização</label>
              <GlassMonthPicker
                ariaLabel="Data de atualização"
                value={form.data_inicio_atualizacao}
                onChange={(v) => setForm({ ...form, data_inicio_atualizacao: v })}
              />
            </div>
            <div className="min-w-0">
              <label className={labelClass}>Crédito original</label>
              <input
                className="glass-input py-2.5 text-right tabular-nums"
                inputMode="decimal"
                placeholder="0,00"
                value={form.credito_original_inicial}
                onChange={(e) =>
                  setForm({ ...form, credito_original_inicial: e.target.value })
                }
              />
            </div>
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-sm text-[color:var(--color-ink)]">
            <input
              type="checkbox"
              className="h-4 w-4 accent-brand-500"
              checked={form.na_consolidada}
              onChange={(e) => setForm({ ...form, na_consolidada: e.target.checked })}
            />
            Entra na posição consolidada
          </label>

          <div>
            <label className={labelClass}>Observação</label>
            <textarea
              className="glass-input resize-none py-2.5"
              rows={2}
              value={form.observacao}
              onChange={(e) => setForm({ ...form, observacao: e.target.value })}
            />
          </div>
        </div>

        {erro ? (
          <p className="mt-4 rounded-xl bg-rose-50/90 px-3 py-2 text-sm text-rose-700">{erro}</p>
        ) : null}

        <div className="mt-6 flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" disabled={busy} className="btn-primary">
            {credito ? 'Salvar' : 'Incluir'}
          </button>
        </div>
      </form>
    </div>
  )
}

interface CompensacaoPayload {
  competencia: string
  valor: number
  multa: number
  juros_evento: number
  numero_dcomp: string
  cod_receita: string
  debito_compensado: string
}

function CompensacaoModal({
  creditos,
  creditoInicialId,
  busy,
  onClose,
  onSave,
}: {
  creditos: CreditoCadastro[]
  creditoInicialId: string
  busy: boolean
  onClose: () => void
  onSave: (creditoId: string, payload: CompensacaoPayload) => void
}) {
  const [form, setForm] = useState({
    credito_id: creditoInicialId,
    data: '',
    principal: '',
    multa: '',
    juros: '',
    numero_dcomp: '',
    cod_receita: '',
    debito_compensado: '',
  })
  const [erro, setErro] = useState('')

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const num = (v: string) => (v.trim() ? parseValor(v) : 0)
  const total = num(form.principal) + num(form.multa) + num(form.juros)
  const credito = creditos.find((c) => c.id === form.credito_id)
  const remanescente = credito?.movimento_ref?.credito_remanescente

  function submit(e: FormEvent) {
    e.preventDefault()
    const principal = num(form.principal)
    if (!form.credito_id) return setErro('Selecione o crédito utilizado.')
    if (!form.data) return setErro('Informe a data da compensação.')
    if (!Number.isFinite(principal) || principal <= 0) {
      return setErro('Informe o valor principal compensado.')
    }
    if (!Number.isFinite(total)) return setErro('Multa ou juros inválidos.')
    setErro('')
    onSave(form.credito_id, {
      competencia: form.data,
      valor: principal,
      multa: num(form.multa),
      juros_evento: num(form.juros),
      numero_dcomp: form.numero_dcomp.trim(),
      cod_receita: form.cod_receita.trim(),
      debito_compensado: form.debito_compensado.trim(),
    })
  }

  const labelClass = 'mb-1.5 block text-xs font-medium text-[color:var(--color-muted)]'
  const moneyInput = (key: 'principal' | 'multa' | 'juros') => (
    <input
      className="glass-input py-2.5 text-right tabular-nums"
      inputMode="decimal"
      placeholder="0,00"
      value={form[key]}
      onChange={(e) => setForm({ ...form, [key]: e.target.value })}
    />
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 backdrop-blur-sm">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Fechar"
        onClick={onClose}
      />
      <form
        onSubmit={submit}
        className="relative z-10 max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-[1.25rem] border border-[color:var(--color-line)] bg-white p-6 shadow-2xl dark:bg-[color:var(--color-panel)]"
      >
        <div className="mb-5 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-[color:var(--color-ink)]">
            Lançar compensação
          </h2>
          <button type="button" className="btn-ghost !p-2" onClick={onClose}>
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-[1fr_11rem]">
            <div className="min-w-0">
              <div className="mb-1.5 flex items-baseline justify-between gap-2">
                <span className="text-xs font-medium text-[color:var(--color-muted)]">Crédito</span>
                {remanescente != null ? (
                  <span className="text-[11px] tabular-nums text-[color:var(--color-muted)]">
                    Saldo {formatMoneyBRL(remanescente)}
                  </span>
                ) : null}
              </div>
              <GlassSelect
                ariaLabel="Crédito"
                icon={Wallet}
                value={form.credito_id}
                onChange={(v) => setForm({ ...form, credito_id: v })}
                options={creditos.map((c) => ({
                  value: c.id,
                  label: `${c.codigo_interno} · ${c.tipo_credito || 'Crédito'}${
                    c.ano_calendario ? ` ${c.ano_calendario}` : ''
                  }`,
                }))}
              />
            </div>
            <div className="min-w-0">
              <label className={labelClass}>Data</label>
              <GlassDatePicker
                value={form.data}
                onChange={(v) => setForm({ ...form, data: v })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="min-w-0">
              <label className={labelClass}>Principal</label>
              {moneyInput('principal')}
            </div>
            <div className="min-w-0">
              <label className={labelClass}>Multa</label>
              {moneyInput('multa')}
            </div>
            <div className="min-w-0">
              <label className={labelClass}>Juros</label>
              {moneyInput('juros')}
            </div>
            <div className="min-w-0">
              <label className={labelClass}>Total</label>
              <div className="flex h-[2.625rem] items-center justify-end rounded-xl bg-brand-500/10 px-3 font-semibold tabular-nums text-brand-700 dark:text-brand-300">
                {formatValor(Number.isFinite(total) ? total : 0)}
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-[1fr_9rem]">
            <div className="min-w-0">
              <label className={labelClass}>Nº PER/DCOMP</label>
              <input
                className="glass-input py-2.5 font-mono text-sm"
                value={form.numero_dcomp}
                onChange={(e) => setForm({ ...form, numero_dcomp: e.target.value })}
              />
            </div>
            <div className="min-w-0">
              <label className={labelClass}>Cód. receita</label>
              <input
                className="glass-input py-2.5"
                value={form.cod_receita}
                onChange={(e) => setForm({ ...form, cod_receita: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label className={labelClass}>Débito compensado</label>
            <input
              className="glass-input py-2.5"
              value={form.debito_compensado}
              onChange={(e) => setForm({ ...form, debito_compensado: e.target.value })}
            />
          </div>
        </div>

        {erro ? (
          <p className="mt-4 rounded-xl bg-rose-50/90 px-3 py-2 text-sm text-rose-700">{erro}</p>
        ) : null}

        <div className="mt-6 flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" disabled={busy} className="btn-primary">
            Lançar
          </button>
        </div>
      </form>
    </div>
  )
}

/** Menu único da planilha: importar e baixar modelo. */
function PlanilhaMenu({
  busy,
  onImport,
}: {
  busy: boolean
  onImport: (file: File) => void
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const menuId = useId()

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const itemClass =
    'flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-medium text-[color:var(--color-ink)] transition-colors hover:bg-brand-500/10 hover:text-brand-600'

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        title="Planilha"
        aria-label="Planilha"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={menuId}
        disabled={busy}
        className="btn-ghost h-9 gap-1.5 !px-2.5 !py-0"
        onClick={() => setOpen((v) => !v)}
      >
        <FileSpreadsheet
          className={`h-4 w-4 ${busy ? 'animate-pulse' : ''}`}
          strokeWidth={1.75}
        />
        <ChevronDown
          className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`}
          strokeWidth={1.75}
        />
      </button>
      <input
        ref={fileRef}
        type="file"
        accept=".xlsx,.xlsb,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel.sheet.binary.macroEnabled.12"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) onImport(f)
          e.target.value = ''
        }}
      />
      {open ? (
        <div
          id={menuId}
          role="menu"
          className="glass-dropdown absolute top-[calc(100%+0.35rem)] right-0 z-50 w-52 p-1.5"
        >
          <button
            type="button"
            role="menuitem"
            className={itemClass}
            onClick={() => {
              setOpen(false)
              fileRef.current?.click()
            }}
          >
            <Upload className="h-4 w-4" strokeWidth={1.75} />
            Importar planilha
          </button>
          <button
            type="button"
            role="menuitem"
            className={itemClass}
            onClick={() => {
              setOpen(false)
              void apiDownload('/api/creditos/modelo.xlsx', 'modelo_creditos.xlsx')
            }}
          >
            <Download className="h-4 w-4" strokeWidth={1.75} />
            Baixar modelo
          </button>
        </div>
      ) : null}
    </div>
  )
}

type Acao = 'incluir' | 'lancar'

/** Toggle Incluir crédito / Lançar compensação: o destaque desliza até a opção sob o mouse. */
function AcoesToggle({
  podeLancar,
  onIncluir,
  onLancar,
}: {
  podeLancar: boolean
  onIncluir: () => void
  onLancar: () => void
}) {
  const padrao: Acao = podeLancar ? 'lancar' : 'incluir'
  const [ativo, setAtivo] = useState<Acao>(padrao)

  useEffect(() => setAtivo(padrao), [padrao])

  const opcoes: { id: Acao; label: string; icon: LucideIcon; onClick: () => void; disabled?: boolean }[] = [
    { id: 'incluir', label: 'Incluir crédito', icon: Plus, onClick: onIncluir },
    {
      id: 'lancar',
      label: 'Lançar compensação',
      icon: Banknote,
      onClick: onLancar,
      disabled: !podeLancar,
    },
  ]

  return (
    <div
      role="group"
      aria-label="Ações"
      className="relative grid h-9 shrink-0 grid-cols-2 rounded-xl border border-[color:var(--control-border)] bg-[color:var(--control-bg)] p-0.5"
      onMouseLeave={() => setAtivo(padrao)}
    >
      <span
        aria-hidden
        className="absolute top-0.5 bottom-0.5 left-0.5 w-[calc(50%-2px)] rounded-[0.6rem] bg-brand-500 shadow-sm shadow-brand-500/30 transition-transform duration-300 ease-out"
        style={{ transform: ativo === 'lancar' ? 'translateX(100%)' : 'translateX(0)' }}
      />
      {opcoes.map((o) => {
        const Icon = o.icon
        const on = ativo === o.id
        return (
          <button
            key={o.id}
            type="button"
            disabled={o.disabled}
            title={o.disabled ? 'Inclua ou importe um crédito primeiro' : undefined}
            onMouseEnter={() => !o.disabled && setAtivo(o.id)}
            onFocus={() => !o.disabled && setAtivo(o.id)}
            onClick={o.onClick}
            className={[
              'relative z-10 inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-[0.6rem] px-3 text-sm font-semibold transition-colors duration-300 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50',
              on ? 'text-white' : 'text-[color:var(--color-muted)]',
            ].join(' ')}
          >
            <Icon className="h-4 w-4" strokeWidth={on ? 2 : 1.75} />
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

type LinhaCompensacao = CreditoCompensacao & { credito: CreditoCadastro; total: number; mes: string }

/** Aba Compensações: todas as linhas U–AB de todos os créditos da empresa, agrupadas por mês. */
function CompensacoesTab({
  creditos,
  canEdit,
  busy,
  onLancar,
  onRemove,
  onOpenCredito,
}: {
  creditos: CreditoCadastro[]
  canEdit: boolean
  busy: boolean
  onLancar: () => void
  onRemove: (ev: CreditoCompensacao) => void
  onOpenCredito: (codigo: number) => void
}) {
  const [creditoId, setCreditoId] = useState('')
  const [periodo, setPeriodo] = useState('')
  const [busca, setBusca] = useState('')

  const linhas = useMemo<LinhaCompensacao[]>(() => {
    const out: LinhaCompensacao[] = []
    for (const c of creditos) {
      for (const ev of c.compensacoes || []) {
        out.push({
          ...ev,
          credito: c,
          total: ev.valor + ev.multa + ev.juros_evento,
          mes: ev.competencia.slice(0, 7),
        })
      }
    }
    // mais recente primeiro
    return out.sort((a, b) =>
      (b.data_compensacao || b.competencia).localeCompare(a.data_compensacao || a.competencia),
    )
  }, [creditos])

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return linhas.filter((l) => {
      if (creditoId && l.credito.id !== creditoId) return false
      if (periodo && l.mes !== periodo) return false
      if (!q) return true
      return [l.numero_dcomp, l.cod_receita, l.debito_compensado, l.credito.tipo_credito]
        .join(' ')
        .toLowerCase()
        .includes(q)
    })
  }, [linhas, creditoId, periodo, busca])

  const grupos = useMemo(() => {
    const map = new Map<string, LinhaCompensacao[]>()
    for (const l of filtradas) {
      const arr = map.get(l.mes) ?? []
      arr.push(l)
      map.set(l.mes, arr)
    }
    return [...map.entries()].map(([mes, itens]) => ({
      mes,
      itens,
      principal: itens.reduce((s, l) => s + l.valor, 0),
      total: itens.reduce((s, l) => s + l.total, 0),
    }))
  }, [filtradas])

  const totalPrincipal = filtradas.reduce((s, l) => s + l.valor, 0)
  const totalGeral = filtradas.reduce((s, l) => s + l.total, 0)
  const dcomps = new Set(filtradas.map((l) => l.numero_dcomp).filter(Boolean)).size
  const meses = [...new Set(linhas.map((l) => l.mes))].sort().reverse()
  const filtrando = !!(creditoId || periodo || busca.trim())
  const colunas = canEdit ? 10 : 9

  const th = 'whitespace-nowrap px-2.5 py-2.5'
  const td = 'whitespace-nowrap px-2.5 py-2'

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          title="Total compensado"
          value={formatMoneyBRL(totalGeral)}
          hint={filtrando ? 'Com os filtros aplicados' : 'Todos os créditos'}
          icon={Banknote}
          tone="brand"
        />
        <KpiCard
          title="Principal (entra no ledger)"
          value={formatMoneyBRL(totalPrincipal)}
          icon={Wallet}
          tone="emerald"
        />
        <KpiCard
          title="Lançamentos"
          value={filtradas.length.toLocaleString('pt-BR')}
          hint={`${grupos.length} ${grupos.length === 1 ? 'mês' : 'meses'}`}
          icon={ClipboardList}
          tone="slate"
        />
        <KpiCard
          title="PER/DCOMPs"
          value={dcomps.toLocaleString('pt-BR')}
          hint="Números distintos informados"
          icon={FileText}
          tone="slate"
        />
      </div>

      <div className="glass-panel flex flex-wrap items-center gap-2 px-3 py-2">
        <GlassSelect
          className="min-w-[13rem] flex-1 basis-[13rem]"
          ariaLabel="Crédito"
          icon={Wallet}
          value={creditoId}
          onChange={setCreditoId}
          options={[
            { value: '', label: 'Todos os créditos' },
            ...creditos.map((c) => ({
              value: c.id,
              label: `${c.codigo_interno} · ${c.tipo_credito || 'Crédito'}${
                c.ano_calendario ? ` ${c.ano_calendario}` : ''
              }`,
            })),
          ]}
        />
        <GlassSelect
          className="min-w-[10rem] basis-[10rem]"
          ariaLabel="Mês"
          icon={CalendarDays}
          value={periodo}
          onChange={setPeriodo}
          options={[
            { value: '', label: 'Todos os meses' },
            ...meses.map((m) => ({ value: m, label: formatCompetencia(`${m}-01`) })),
          ]}
        />
        <div className="relative min-w-[12rem] flex-[1.4] basis-[12rem]">
          <Search
            className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-[color:var(--color-muted)]"
            strokeWidth={1.75}
          />
          <input
            type="search"
            aria-label="Buscar"
            placeholder="DCOMP, cód. receita ou débito…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="glass-control"
          />
        </div>
        {canEdit ? (
          <button
            type="button"
            className="btn-primary h-9 !py-0"
            disabled={busy || !creditos.length}
            onClick={onLancar}
          >
            <Plus className="h-4 w-4" />
            Lançar
          </button>
        ) : null}
      </div>

      <div className="diretoria-card !p-0 overflow-hidden">
        <div className="max-h-[36rem] overflow-auto">
          <table className="min-w-full text-left text-[13px]">
            <thead className="sticky top-0 z-10 border-b border-[color:var(--color-line)] bg-[color:var(--color-panel)] text-[11px] font-semibold uppercase tracking-wide text-[color:var(--color-muted)]">
              <tr>
                <th className={th}>Data</th>
                <th className={th}>Crédito</th>
                <th className={th}>Nº PER/DCOMP</th>
                <th className={th}>Cód. receita</th>
                <th className={th}>Débito compensado</th>
                <th className={`${th} text-right`}>Principal</th>
                <th className={`${th} text-right`}>Multa</th>
                <th className={`${th} text-right`}>Juros</th>
                <th className={`${th} text-right`}>Total</th>
                {canEdit ? <th className={th} /> : null}
              </tr>
            </thead>
            <tbody>
              {grupos.map((g) => (
                <Fragment key={g.mes}>
                  <tr className="border-b border-[color:var(--color-line)] bg-[color:var(--nav-hover)]">
                    <td colSpan={5} className="px-2.5 py-2 text-xs font-semibold text-[color:var(--color-ink)]">
                      {formatCompetencia(`${g.mes}-01`)}
                      <span className="ml-2 font-normal text-[color:var(--color-muted)]">
                        {g.itens.length} {g.itens.length === 1 ? 'lançamento' : 'lançamentos'}
                      </span>
                    </td>
                    <td className="px-2.5 py-2 text-right text-xs font-semibold tabular-nums text-[color:var(--color-ink)]">
                      {formatValor(g.principal)}
                    </td>
                    <td colSpan={2} />
                    <td className="px-2.5 py-2 text-right text-xs font-semibold tabular-nums text-[color:var(--color-ink)]">
                      {formatValor(g.total)}
                    </td>
                    {canEdit ? <td /> : null}
                  </tr>
                  {g.itens.map((l) => (
                    <tr
                      key={l.id}
                      className="border-b border-[color:var(--color-line)] transition last:border-0 hover:bg-[color:var(--nav-hover)]"
                    >
                      <td className={`${td} text-[color:var(--color-muted)]`}>
                        {l.data_compensacao
                          ? formatDate(l.data_compensacao)
                          : formatCompetencia(l.competencia)}
                      </td>
                      <td className={td}>
                        <button
                          type="button"
                          title={`Abrir crédito ${l.credito.codigo_interno}`}
                          className="inline-flex items-center gap-1.5 rounded-lg text-left hover:text-brand-600"
                          onClick={() => onOpenCredito(l.credito.codigo_interno)}
                        >
                          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-md bg-brand-500/10 px-1 text-[11px] font-semibold text-brand-600">
                            {l.credito.codigo_interno}
                          </span>
                          <span className="font-medium text-[color:var(--color-ink)]">
                            {l.credito.tipo_credito || 'Crédito'}
                          </span>
                        </button>
                      </td>
                      <td className={`${td} font-mono text-xs text-[color:var(--color-muted)]`}>
                        {l.numero_dcomp || '—'}
                      </td>
                      <td className={td}>{l.cod_receita || '—'}</td>
                      <td className="max-w-[18rem] truncate px-2.5 py-2" title={l.debito_compensado}>
                        {l.debito_compensado || '—'}
                      </td>
                      <td className={`${td} text-right tabular-nums`}>{formatValor(l.valor)}</td>
                      <td className={`${td} text-right tabular-nums text-[color:var(--color-muted)]`}>
                        {formatValor(l.multa)}
                      </td>
                      <td className={`${td} text-right tabular-nums text-[color:var(--color-muted)]`}>
                        {formatValor(l.juros_evento)}
                      </td>
                      <td className={`${td} text-right font-medium tabular-nums text-[color:var(--color-ink)]`}>
                        {formatValor(l.total)}
                      </td>
                      {canEdit ? (
                        <td className={`${td} text-right`}>
                          <button
                            type="button"
                            className="text-xs text-rose-600 disabled:opacity-50"
                            disabled={busy}
                            onClick={() => onRemove(l)}
                          >
                            Excluir
                          </button>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </Fragment>
              ))}
              {!filtradas.length ? (
                <tr>
                  <td colSpan={colunas} className="px-2.5 py-10 text-center text-[color:var(--color-muted)]">
                    {linhas.length
                      ? 'Nenhuma compensação com esses filtros.'
                      : 'Nenhuma compensação lançada.'}
                  </td>
                </tr>
              ) : null}
            </tbody>
            {filtradas.length ? (
              <tfoot className="sticky bottom-0 border-t border-[color:var(--color-line)] bg-[color:var(--color-panel)] text-[13px] font-semibold text-[color:var(--color-ink)]">
                <tr>
                  <td colSpan={5} className="px-2.5 py-2.5">
                    Total{filtrando ? ' filtrado' : ''}
                  </td>
                  <td className="px-2.5 py-2.5 text-right tabular-nums">
                    {formatValor(totalPrincipal)}
                  </td>
                  <td colSpan={2} />
                  <td className="px-2.5 py-2.5 text-right tabular-nums">{formatValor(totalGeral)}</td>
                  {canEdit ? <td /> : null}
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
      </div>
    </div>
  )
}
