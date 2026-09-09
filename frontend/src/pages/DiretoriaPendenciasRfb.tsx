import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  CalendarDays,
  Plus,
} from 'lucide-react'
import GlassSelect from '../components/GlassSelect'
import NotificationBell from '../components/NotificationBell'
import PainelFiscalOrgaoModal, {
  type OrgaoModalKey,
} from '../components/painel-fiscal/PainelFiscalOrgaoModal'
import PainelFiscalStatusComposite from '../components/painel-fiscal/PainelFiscalStatusComposite'
import PainelFiscalValorComposite from '../components/painel-fiscal/PainelFiscalValorComposite'
import { AuthSkeleton } from '../components/ui/PageSkeletons'
import { useAuth } from '../context/AuthContext'
import { apiFetch, buildQuery } from '../lib/api'
import { formatDate, formatMoneyBRL } from '../lib/format'
import type { PainelFiscalPendencia, PainelFiscalSummary } from '../types'

type EmpresaPivot = {
  empresa: string
  cadin: number
  pgfn: number
  rfb: number
  total: number
  rows: PainelFiscalPendencia[]
}

type FormState = {
  empresa: string
  razao_social: string
  cnpj: string
  uf: string
  orgao: string
  situacao_cnpj: string
  status_cnd: string
  cnd: string
  validade_cnd: string
  mes: string
  ano: string
  total: string
  principal: string
  multa: string
  juros: string
  codigo: string
  natureza: string
  fase: string
  tipo: string
  situacao: string
  numero_processo: string
  motivo: string
  nota_01: string
  nota_02: string
}

const emptyForm = (): FormState => ({
  empresa: '',
  razao_social: '',
  cnpj: '',
  uf: '',
  orgao: 'RFB',
  situacao_cnpj: '',
  status_cnd: '',
  cnd: '',
  validade_cnd: '',
  mes: '',
  ano: '',
  total: '',
  principal: '',
  multa: '',
  juros: '',
  codigo: '',
  natureza: '',
  fase: '',
  tipo: '',
  situacao: '',
  numero_processo: '',
  motivo: '',
  nota_01: '',
  nota_02: '',
})

function orgaoBucket(orgao: string): 'CADIN' | 'PGFN' | 'RFB' | 'OUTROS' {
  const key = orgao.trim().toUpperCase()
  if (key.includes('CADIN')) return 'CADIN'
  if (key.includes('PGFN')) return 'PGFN'
  if (key === 'RFB') return 'RFB'
  return 'OUTROS'
}

function toNumber(raw: string): number | null {
  const text = raw.trim()
  if (!text) return null
  const normalized = text.includes(',')
    ? text.replace(/\./g, '').replace(',', '.')
    : text
  const n = Number(normalized)
  return Number.isFinite(n) ? n : null
}

function formFromRow(row: PainelFiscalPendencia): FormState {
  return {
    empresa: row.empresa,
    razao_social: row.razao_social,
    cnpj: row.cnpj,
    uf: row.uf,
    orgao: row.orgao,
    situacao_cnpj: row.situacao_cnpj,
    status_cnd: row.status_cnd,
    cnd: row.cnd,
    validade_cnd: row.validade_cnd ?? '',
    mes: row.mes != null ? String(row.mes) : '',
    ano: row.ano != null ? String(row.ano) : '',
    total: row.total != null ? String(row.total) : '',
    principal: row.principal != null ? String(row.principal) : '',
    multa: row.multa != null ? String(row.multa) : '',
    juros: row.juros != null ? String(row.juros) : '',
    codigo: row.codigo,
    natureza: row.natureza,
    fase: row.fase,
    tipo: row.tipo,
    situacao: row.situacao,
    numero_processo: row.numero_processo,
    motivo: row.motivo,
    nota_01: row.nota_01,
    nota_02: row.nota_02,
  }
}

function formToPayload(form: FormState) {
  return {
    empresa: form.empresa.trim(),
    razao_social: form.razao_social.trim(),
    cnpj: form.cnpj.replace(/\D/g, ''),
    uf: form.uf.trim(),
    orgao: form.orgao.trim(),
    situacao_cnpj: form.situacao_cnpj.trim(),
    status_cnd: form.status_cnd.trim(),
    cnd: form.cnd.trim(),
    validade_cnd: form.validade_cnd || null,
    mes: form.mes ? Number(form.mes) : null,
    ano: form.ano ? Number(form.ano) : null,
    total: toNumber(form.total),
    principal: toNumber(form.principal),
    multa: toNumber(form.multa),
    juros: toNumber(form.juros),
    codigo: form.codigo.trim(),
    natureza: form.natureza.trim(),
    fase: form.fase.trim(),
    tipo: form.tipo.trim(),
    situacao: form.situacao.trim(),
    numero_processo: form.numero_processo.trim(),
    motivo: form.motivo.trim(),
    nota_01: form.nota_01.trim(),
    nota_02: form.nota_02.trim(),
  }
}

export default function DiretoriaPendenciasRfb() {
  const { painelFiscalEditor } = useAuth()
  const [ano, setAno] = useState('')
  const [mes, setMes] = useState('')
  const [summary, setSummary] = useState<PainelFiscalSummary | null>(null)
  const [rows, setRows] = useState<PainelFiscalPendencia[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedEmpresa, setSelectedEmpresa] = useState<EmpresaPivot | null>(null)
  const [editing, setEditing] = useState<PainelFiscalPendencia | null>(null)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [selectedOrgao, setSelectedOrgao] = useState<OrgaoModalKey | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
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
      setLoading(false)
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

  const orgaoModalRows = useMemo(() => {
    if (!selectedOrgao) return []
    const mapped = pivot.map((item) => ({
      empresa: item.empresa,
      cadin: item.cadin,
      pgfn: item.pgfn,
      rfb: item.rfb,
      total: item.total,
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
  }, [pivot, selectedOrgao])

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

  const openCreate = () => {
    setCreating(true)
    setEditing(null)
    setForm(emptyForm())
    setError('')
  }

  const openEdit = (row: PainelFiscalPendencia) => {
    setEditing(row)
    setCreating(false)
    setForm(formFromRow(row))
    setError('')
  }

  const closeForm = () => {
    setCreating(false)
    setEditing(null)
    setForm(emptyForm())
    setError('')
  }

  const openEmpresa = (empresa: string) => {
    const found = pivot.find((item) => item.empresa === empresa)
    if (found) setSelectedEmpresa(found)
  }

  const saveForm = async () => {
    if (!form.empresa.trim()) {
      setError('Informe a empresa')
      return
    }
    setSaving(true)
    setError('')
    try {
      const payload = formToPayload(form)
      if (editing) {
        await apiFetch(`/api/painel-fiscal/${editing.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        })
      } else {
        await apiFetch('/api/painel-fiscal', {
          method: 'POST',
          body: JSON.stringify(payload),
        })
      }
      closeForm()
      setSelectedEmpresa(null)
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao salvar')
    } finally {
      setSaving(false)
    }
  }

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
            <button type="button" className="btn-primary" onClick={openCreate}>
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

      {error && !creating && !editing && (
        <p className="rounded-xl bg-rose-50/90 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      )}

      {summary && (
        <>
          <PainelFiscalValorComposite
            totalValor={summary.total_valor}
            porOrgao={summary.por_orgao_valor}
            onSelect={setSelectedOrgao}
          />
          <PainelFiscalStatusComposite
            totalEmpresas={summary.total_empresas}
            baixadas={summary.baixadas}
            cndValida={summary.cnd_valida}
            cndPendente={summary.cnd_pendente}
          />
        </>
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

      {selectedEmpresa && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
          <div className="max-h-[85vh] w-full max-w-4xl overflow-hidden rounded-3xl border border-[color:var(--color-line)] bg-white shadow-2xl dark:bg-[color:var(--color-panel)]">
            <div className="flex items-center justify-between border-b border-[color:var(--color-line)] px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold text-[color:var(--color-ink)]">
                  {selectedEmpresa.empresa}
                </h2>
                <p className="text-xs text-[color:var(--color-muted)]">
                  {selectedEmpresa.rows.length} linha(s) ·{' '}
                  {formatMoneyBRL(selectedEmpresa.total)}
                </p>
              </div>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setSelectedEmpresa(null)}
              >
                Fechar
              </button>
            </div>
            <div className="max-h-[65vh] overflow-y-auto p-4">
              <div className="space-y-3">
                {selectedEmpresa.rows.map((row) => (
                  <div
                    key={row.id}
                    className="rounded-2xl border border-[color:var(--color-line)] bg-[color:var(--color-surface)] p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-[color:var(--color-ink)]">
                          {row.orgao || '—'} · {formatMoneyBRL(row.total)}
                        </p>
                        <p className="mt-1 text-xs text-[color:var(--color-muted)]">
                          {row.razao_social || row.empresa} · CND{' '}
                          {row.status_cnd || '—'}
                          {row.validade_cnd
                            ? ` · ${formatDate(row.validade_cnd)}`
                            : ''}
                        </p>
                      </div>
                      {painelFiscalEditor && (
                        <button
                          type="button"
                          className="btn-ghost"
                          onClick={() => openEdit(row)}
                        >
                          Editar
                        </button>
                      )}
                    </div>
                    {(row.nota_01 || row.nota_02 || row.motivo) && (
                      <p className="mt-2 text-xs text-[color:var(--color-muted)]">
                        {[row.motivo, row.nota_01, row.nota_02]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {(creating || editing) && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-[color:var(--color-line)] bg-white p-6 shadow-2xl dark:bg-[color:var(--color-panel)]">
            <h2 className="text-lg font-semibold text-[color:var(--color-ink)]">
              {editing ? 'Editar linha' : 'Nova linha'}
            </h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {(
                [
                  ['empresa', 'Empresa'],
                  ['razao_social', 'Razão social'],
                  ['cnpj', 'CNPJ'],
                  ['uf', 'UF'],
                  ['orgao', 'Órgão'],
                  ['situacao_cnpj', 'Situação CNPJ'],
                  ['status_cnd', 'Status CND'],
                  ['cnd', 'CND'],
                  ['validade_cnd', 'Validade CND (AAAA-MM-DD)'],
                  ['ano', 'Ano'],
                  ['mes', 'Mês'],
                  ['total', 'Total'],
                  ['principal', 'Principal'],
                  ['multa', 'Multa'],
                  ['juros', 'Juros'],
                  ['codigo', 'Código'],
                  ['natureza', 'Natureza'],
                  ['fase', 'Fase'],
                  ['tipo', 'Tipo'],
                  ['situacao', 'Situação'],
                  ['numero_processo', 'Nº processo'],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="block text-xs text-[color:var(--color-muted)]">
                  {label}
                  <input
                    className="glass-input mt-1 py-2"
                    value={form[key]}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, [key]: e.target.value }))
                    }
                  />
                </label>
              ))}
              <label className="block text-xs text-[color:var(--color-muted)] sm:col-span-2">
                Motivo
                <textarea
                  className="glass-input mt-1 min-h-20 py-2"
                  value={form.motivo}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, motivo: e.target.value }))
                  }
                />
              </label>
              <label className="block text-xs text-[color:var(--color-muted)] sm:col-span-2">
                Nota 01
                <textarea
                  className="glass-input mt-1 min-h-16 py-2"
                  value={form.nota_01}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, nota_01: e.target.value }))
                  }
                />
              </label>
              <label className="block text-xs text-[color:var(--color-muted)] sm:col-span-2">
                Nota 02
                <textarea
                  className="glass-input mt-1 min-h-16 py-2"
                  value={form.nota_02}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, nota_02: e.target.value }))
                  }
                />
              </label>
            </div>
            {error && (
              <p className="mt-3 rounded-xl bg-rose-50/90 px-3 py-2 text-sm text-rose-700">
                {error}
              </p>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" className="btn-ghost" onClick={closeForm}>
                Cancelar
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={saving}
                onClick={() => void saveForm()}
              >
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
