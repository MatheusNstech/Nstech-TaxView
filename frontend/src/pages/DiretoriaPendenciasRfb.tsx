import { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarDays, Plus } from 'lucide-react'
import GlassSelect from '../components/GlassSelect'
import NotificationBell from '../components/NotificationBell'
import PainelFiscalCndModal, {
  type CndFilter,
  type CndModalRow,
} from '../components/painel-fiscal/PainelFiscalCndModal'
import PainelFiscalEmpresaSheet from '../components/painel-fiscal/PainelFiscalEmpresaSheet'
import PainelFiscalObservacoesPanel, {
  buildObservacoesFromPivot,
} from '../components/painel-fiscal/PainelFiscalObservacoesPanel'
import PainelFiscalOrgaoModal, {
  type OrgaoModalKey,
} from '../components/painel-fiscal/PainelFiscalOrgaoModal'
import PainelFiscalStatusComposite from '../components/painel-fiscal/PainelFiscalStatusComposite'
import PainelFiscalValorComposite from '../components/painel-fiscal/PainelFiscalValorComposite'
import { AuthSkeleton } from '../components/ui/PageSkeletons'
import { useAuth } from '../context/AuthContext'
import { apiFetch, buildQuery } from '../lib/api'
import { formatMoneyBRL } from '../lib/format'
import type { PainelFiscalPendencia, PainelFiscalSummary } from '../types'

type EmpresaPivot = {
  empresa: string
  cadin: number
  pgfn: number
  rfb: number
  total: number
  rows: PainelFiscalPendencia[]
}

function orgaoBucket(orgao: string): 'CADIN' | 'PGFN' | 'RFB' | 'OUTROS' {
  const key = orgao.trim().toUpperCase()
  if (key.includes('CADIN')) return 'CADIN'
  if (key.includes('PGFN')) return 'PGFN'
  if (key === 'RFB') return 'RFB'
  return 'OUTROS'
}

/** Só Válida / Pendente com texto explícito; vazio não entra na lista. */
function normalizeStatusCnd(raw: string): CndFilter | null {
  const text = raw.trim().toLowerCase()
  if (!text) return null
  if (text.includes('válid') || text.includes('valid')) return 'Válida'
  if (text.includes('pend')) return 'Pendente'
  return null
}

/** Status agregado da empresa: Pendente > Válida; vazio ignora. */
function companyCndStatus(rows: PainelFiscalPendencia[]): CndFilter | null {
  let best: CndFilter | null = null
  for (const row of rows) {
    const status = normalizeStatusCnd(row.status_cnd)
    if (status === 'Pendente') return 'Pendente'
    if (status === 'Válida') best = 'Válida'
  }
  return best
}

function pickCndRow(
  rows: PainelFiscalPendencia[],
  prefer: CndFilter,
): PainelFiscalPendencia | null {
  const sorted = [...rows].sort((a, b) => {
    const va = a.validade_cnd ?? ''
    const vb = b.validade_cnd ?? ''
    return vb.localeCompare(va)
  })
  return (
    sorted.find((r) => normalizeStatusCnd(r.status_cnd) === prefer) ?? null
  )
}

export default function DiretoriaPendenciasRfb() {
  const { painelFiscalEditor } = useAuth()
  const [ano, setAno] = useState('')
  const [mes, setMes] = useState('')
  const [summary, setSummary] = useState<PainelFiscalSummary | null>(null)
  const [rows, setRows] = useState<PainelFiscalPendencia[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedEmpresa, setSelectedEmpresa] = useState<string | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerEmpresa, setPickerEmpresa] = useState('')
  const [error, setError] = useState('')
  const [selectedOrgao, setSelectedOrgao] = useState<OrgaoModalKey | null>(null)
  const [selectedCndFilter, setSelectedCndFilter] = useState<CndFilter | null>(
    null,
  )

  const loadData = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true)
    setError('')
    try {
      const q = buildQuery({
        ano: ano || undefined,
        mes: mes || undefined,
      })
      const [summaryData, list] = await Promise.all([
        apiFetch<PainelFiscalSummary>(`/api/painel-fiscal/summary${q}`),
        apiFetch<PainelFiscalPendencia[]>(`/api/painel-fiscal${q}`),
      ])
      setSummary(summaryData)
      setRows(list)
    } catch (err) {
      setSummary(null)
      setRows([])
      setError(err instanceof Error ? err.message : 'Falha ao carregar pendências')
    } finally {
      if (!opts?.silent) setLoading(false)
    }
  }, [ano, mes])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const pivot = useMemo(() => {
    const map = new Map<string, EmpresaPivot>()
    for (const row of rows) {
      const key = row.empresa || '—'
      const current = map.get(key) ?? {
        empresa: key,
        cadin: 0,
        pgfn: 0,
        rfb: 0,
        total: 0,
        rows: [],
      }
      const valor = Number(row.total ?? 0)
      const bucket = orgaoBucket(row.orgao)
      if (bucket === 'CADIN') current.cadin += valor
      if (bucket === 'PGFN') current.pgfn += valor
      if (bucket === 'RFB') current.rfb += valor
      current.total += valor
      current.rows.push(row)
      map.set(key, current)
    }
    return [...map.values()].sort((a, b) => b.total - a.total)
  }, [rows])

  const selectedPivot = useMemo(() => {
    if (!selectedEmpresa) return null
    return (
      pivot.find((item) => item.empresa === selectedEmpresa) ?? {
        empresa: selectedEmpresa,
        cadin: 0,
        pgfn: 0,
        rfb: 0,
        total: 0,
        rows: [] as PainelFiscalPendencia[],
      }
    )
  }, [pivot, selectedEmpresa])

  const observacoesRows = useMemo(
    () => buildObservacoesFromPivot(pivot),
    [pivot],
  )

  const empresasComObs = useMemo(() => {
    const set = new Set(observacoesRows.map((r) => r.empresa))
    return set
  }, [observacoesRows])

  const orgaoModalRows = useMemo(() => {
    if (!selectedOrgao) return []
    const mapped = pivot.map((item) => ({
      empresa: item.empresa,
      cadin: item.cadin,
      pgfn: item.pgfn,
      rfb: item.rfb,
      total: item.total,
      hasObservacao: empresasComObs.has(item.empresa),
      orgaoValor:
        selectedOrgao === 'CADIN'
          ? item.cadin
          : selectedOrgao === 'PGFN'
            ? item.pgfn
            : selectedOrgao === 'RFB'
              ? item.rfb
              : item.total,
    }))
    if (selectedOrgao === 'TOTAL') return mapped.filter((item) => item.total > 0)
    return mapped.filter((item) => item.orgaoValor > 0)
  }, [pivot, selectedOrgao, empresasComObs])

  const cndModalRows = useMemo((): CndModalRow[] => {
    if (!selectedCndFilter) return []
    const out: CndModalRow[] = []
    for (const item of pivot) {
      if (companyCndStatus(item.rows) !== selectedCndFilter) continue
      const row = pickCndRow(item.rows, selectedCndFilter)
      if (!row) continue
      out.push({
        empresa: item.empresa,
        status_cnd: row.status_cnd || selectedCndFilter,
        cnd: row.cnd,
        validade_cnd: row.validade_cnd,
        nota_01: row.nota_01,
        nota_02: row.nota_02,
      })
    }
    return out
  }, [pivot, selectedCndFilter])

  const anoOptions = useMemo(() => {
    const years = summary?.anos?.length
      ? summary.anos
      : [...new Set(rows.map((r) => r.ano).filter(Boolean) as number[])].sort(
          (a, b) => b - a,
        )
    return [
      { value: '', label: 'Todos os anos' },
      ...years.map((y) => ({ value: String(y), label: String(y) })),
    ]
  }, [summary, rows])

  const mesOptions = useMemo(
    () => [
      { value: '', label: 'Todos os meses' },
      ...[
        'Janeiro',
        'Fevereiro',
        'Março',
        'Abril',
        'Maio',
        'Junho',
        'Julho',
        'Agosto',
        'Setembro',
        'Outubro',
        'Novembro',
        'Dezembro',
      ].map((label, i) => ({
        value: String(i + 1),
        label,
      })),
    ],
    [],
  )

  const empresaOptions = useMemo(
    () =>
      pivot.map((item) => ({
        value: item.empresa,
        label: item.empresa,
      })),
    [pivot],
  )

  const openEmpresa = (empresa: string) => {
    setSelectedEmpresa(empresa)
  }

  const closeEmpresa = () => {
    setSelectedEmpresa(null)
  }

  const confirmPicker = () => {
    const name = pickerEmpresa.trim()
    if (!name) return
    setPickerOpen(false)
    setPickerEmpresa('')
    openEmpresa(name)
  }

  const sheetDefaults = useMemo(() => {
    const first = selectedPivot?.rows[0]
    return {
      empresa: selectedPivot?.empresa ?? '',
      razao_social: first?.razao_social ?? '',
      cnpj: first?.cnpj ?? '',
      uf: first?.uf ?? '',
      ano: ano ? Number(ano) : (first?.ano ?? null),
      mes: mes ? Number(mes) : (first?.mes ?? null),
    }
  }, [selectedPivot, ano, mes])

  if (loading && !summary) {
    return <AuthSkeleton fullScreen={false} />
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[color:var(--color-ink)]">
            PENDÊNCIAS RFB / PGFN
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <NotificationBell placement="bottom-right" />
          {painelFiscalEditor && (
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                setPickerEmpresa('')
                setPickerOpen(true)
              }}
            >
              <Plus className="h-4 w-4" strokeWidth={1.75} />
              Nova linha
            </button>
          )}
        </div>
      </div>

      <div className="glass-panel sticky top-3 z-20 flex flex-wrap items-center gap-2 px-3 py-2">
        <GlassSelect
          className="min-w-[9rem] flex-1 basis-[9rem]"
          ariaLabel="Ano"
          icon={CalendarDays}
          value={ano}
          onChange={setAno}
          options={anoOptions}
        />
        <GlassSelect
          className="min-w-[9rem] flex-1 basis-[9rem]"
          ariaLabel="Mês"
          icon={CalendarDays}
          value={mes}
          onChange={setMes}
          options={mesOptions}
        />
      </div>

      {error && (
        <p className="rounded-xl bg-rose-50/90 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      )}

      {summary && (
        <>
          <PainelFiscalStatusComposite
            totalEmpresas={summary.total_empresas}
            baixadas={summary.baixadas}
            cndValida={summary.cnd_valida}
            cndPendente={summary.cnd_pendente}
            onCndClick={(key) =>
              setSelectedCndFilter(key === 'valida' ? 'Válida' : 'Pendente')
            }
          />
          <PainelFiscalValorComposite
            totalValor={summary.total_valor}
            porOrgao={summary.por_orgao_valor}
            onSelect={setSelectedOrgao}
          />
          <PainelFiscalObservacoesPanel
            rows={observacoesRows}
            onSelectEmpresa={(empresa) => openEmpresa(empresa)}
          />
        </>
      )}

      {selectedCndFilter && (
        <PainelFiscalCndModal
          filter={selectedCndFilter}
          rows={cndModalRows}
          onClose={() => setSelectedCndFilter(null)}
          onSelectEmpresa={(empresa) => {
            setSelectedCndFilter(null)
            openEmpresa(empresa)
          }}
        />
      )}

      {selectedOrgao && summary && (
        <PainelFiscalOrgaoModal
          orgao={selectedOrgao}
          totalValor={
            selectedOrgao === 'TOTAL'
              ? summary.total_valor
              : (summary.por_orgao_valor[selectedOrgao] ?? 0)
          }
          rows={orgaoModalRows}
          onClose={() => setSelectedOrgao(null)}
          onSelectEmpresa={(empresa) => {
            setSelectedOrgao(null)
            openEmpresa(empresa)
          }}
        />
      )}

      {pickerOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-[color:var(--color-line)] bg-white p-6 shadow-2xl dark:bg-[color:var(--color-panel)]">
            <h2 className="text-lg font-semibold text-[color:var(--color-ink)]">
              Nova linha
            </h2>
            <p className="mt-1 text-sm text-[color:var(--color-muted)]">
              Escolha uma empresa existente ou digite um nome novo. A planilha
              abre com uma linha em branco.
            </p>
            <label className="mt-4 block text-xs text-[color:var(--color-muted)]">
              Empresa
              <input
                className="glass-input mt-1 py-2"
                list="painel-fiscal-empresas"
                value={pickerEmpresa}
                onChange={(e) => setPickerEmpresa(e.target.value)}
                placeholder="Ex.: OPEN"
                autoFocus
              />
              <datalist id="painel-fiscal-empresas">
                {empresaOptions.map((opt) => (
                  <option key={opt.value} value={opt.value} />
                ))}
              </datalist>
            </label>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setPickerOpen(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={!pickerEmpresa.trim()}
                onClick={confirmPicker}
              >
                Abrir planilha
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedPivot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-2 sm:p-3 backdrop-blur-sm">
          <div className="flex max-h-[94vh] w-full max-w-[min(96rem,calc(100vw-1rem))] flex-col overflow-hidden rounded-3xl border border-[color:var(--color-line)] bg-white shadow-2xl dark:bg-[color:var(--color-panel)]">
            <div className="flex shrink-0 flex-wrap items-start justify-between gap-3 border-b border-[color:var(--color-line)] px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold text-[color:var(--color-ink)]">
                  {selectedPivot.empresa}
                </h2>
                <p className="text-xs text-[color:var(--color-muted)]">
                  {sheetDefaults.razao_social
                    ? `${sheetDefaults.razao_social} · `
                    : ''}
                  {selectedPivot.rows.length} linha(s) ·{' '}
                  {formatMoneyBRL(selectedPivot.total)}
                  {painelFiscalEditor
                    ? ' · edição estilo planilha'
                    : ''}
                </p>
              </div>
              <button type="button" className="btn-ghost" onClick={closeEmpresa}>
                Fechar
              </button>
            </div>
            <PainelFiscalEmpresaSheet
              key={selectedPivot.empresa}
              rows={selectedPivot.rows}
              defaults={sheetDefaults}
              editable={painelFiscalEditor}
              onChanged={async () => {
                await loadData({ silent: true })
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
