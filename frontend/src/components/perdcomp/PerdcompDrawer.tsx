import { Trash2, X } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { apiFetch } from '../../lib/api'
import { formatDate, formatMoneyBRL } from '../../lib/format'
import type { PerdcompFields, PerdcompProcesso } from '../../types'
import GlassDatePicker from '../GlassDatePicker'
import PerdcompPrazoChip from './PerdcompPrazoChip'

const STATUS_SUGESTOES = [
  'Em análise',
  'Intimação/Pendência',
  'Indeferido',
  'Deferido',
  'Deferido parcialmente',
  'Encerrado',
]

const EMPTY: PerdcompFields = {
  perdcomp: '',
  processo: '',
  empresa: '',
  tributo_credito: '',
  periodo: '',
  valor_pedido: null,
  status: '',
  observacoes: '',
  prazo_cumprimento: '',
  data_base_ciencia: '',
  data_limite: null,
  providencia: '',
}

const scrollClass = [
  'min-h-0 flex-1 overflow-y-auto overscroll-contain',
  '[scrollbar-width:thin]',
  '[scrollbar-color:#cbd5e1_transparent]',
].join(' ')

function moneyToInput(value: number | null): string {
  if (value == null) return ''
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function parseMoney(text: string): number | null | 'invalid' {
  const raw = text.replace(/R\$/g, '').replace(/\s/g, '').trim()
  if (!raw) return null
  const normalized = raw.includes(',') ? raw.replace(/\./g, '').replace(',', '.') : raw
  const n = Number(normalized)
  return Number.isFinite(n) ? n : 'invalid'
}

interface PerdcompDrawerProps {
  processo: PerdcompProcesso | null
  mode: 'view' | 'edit' | 'create'
  open: boolean
  statusOptions: string[]
  onClose: () => void
  onSaved: (processo: PerdcompProcesso) => void
  onDeleted: (id: string) => void
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-slate-500">
        {label}
      </label>
      {children}
    </div>
  )
}

function ReadRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="grid grid-cols-[8rem_1fr] gap-3 border-b border-slate-100 py-3 last:border-0">
      <dt className="text-xs font-medium text-slate-500">{label}</dt>
      <dd className="min-w-0 whitespace-pre-wrap break-words text-sm text-slate-800">
        {value || '—'}
      </dd>
    </div>
  )
}

export default function PerdcompDrawer({
  processo,
  mode,
  open,
  statusOptions,
  onClose,
  onSaved,
  onDeleted,
}: PerdcompDrawerProps) {
  const [form, setForm] = useState<PerdcompFields>(EMPTY)
  const [valorText, setValorText] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    const base = processo && mode !== 'create' ? processo : EMPTY
    setForm({ ...EMPTY, ...base })
    setValorText(moneyToInput(base.valor_pedido))
    setError('')
  }, [open, processo, mode])

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  if (!open || (mode !== 'create' && !processo)) return null

  const readOnly = mode === 'view'
  const set = <K extends keyof PerdcompFields>(key: K, value: PerdcompFields[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  const suggestions = Array.from(
    new Set([...STATUS_SUGESTOES, ...statusOptions.filter((s) => s !== 'Sem status')]),
  )

  const handleSave = async () => {
    const perdcomp = form.perdcomp.trim()
    if (!perdcomp) {
      setError('Informe o número do PER/DCOMP')
      return
    }
    const valor = parseMoney(valorText)
    if (valor === 'invalid') {
      setError('Valor do pedido inválido')
      return
    }
    const payload: PerdcompFields = {
      ...form,
      perdcomp,
      valor_pedido: valor,
      data_limite: form.data_limite || null,
    }
    setSaving(true)
    setError('')
    try {
      const saved =
        mode === 'create'
          ? await apiFetch<PerdcompProcesso>('/api/perdcomp', {
              method: 'POST',
              body: JSON.stringify(payload),
            })
          : await apiFetch<PerdcompProcesso>(`/api/perdcomp/${processo!.id}`, {
              method: 'PATCH',
              body: JSON.stringify(payload),
            })
      onSaved(saved)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    if (!processo) return
    if (!window.confirm(`Excluir o PER/DCOMP ${processo.perdcomp}?`)) return
    setSaving(true)
    setError('')
    try {
      await apiFetch(`/api/perdcomp/${processo.id}`, { method: 'DELETE' })
      onDeleted(processo.id)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao excluir')
    } finally {
      setSaving(false)
    }
  }

  const title =
    mode === 'create' ? 'Novo processo' : readOnly ? 'Detalhes do processo' : 'Editar processo'

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[80] bg-slate-900/45 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <aside className="fixed inset-y-3 right-3 z-[90] flex w-[min(100%-1.5rem,30rem)] flex-col overflow-hidden rounded-2xl bg-white shadow-[0_24px_64px_rgb(15_23_42_/_0.28)] ring-1 ring-slate-200">
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              {readOnly ? 'Somente leitura' : 'PER/DCOMP'}
            </p>
            <h2 className="mt-0.5 text-base font-semibold text-slate-900">{title}</h2>
            {processo && mode !== 'create' ? (
              <p className="mt-0.5 truncate font-mono text-xs text-slate-500">
                {processo.perdcomp}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" strokeWidth={1.75} />
          </button>
        </header>

        <div className={`${scrollClass} px-5 py-4`}>
          {readOnly && processo ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-900">{processo.empresa || '—'}</p>
                <p className="mt-1 text-xs text-slate-500">{processo.tributo_credito || '—'}</p>
                <p className="mt-2 text-lg font-bold text-slate-900">
                  {formatMoneyBRL(processo.valor_pedido)}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-slate-200/70 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                    {processo.status || 'Sem status'}
                  </span>
                  <PerdcompPrazoChip
                    situacao={processo.prazo_situacao}
                    dias={processo.dias_para_prazo}
                  />
                </div>
              </div>
              <dl>
                <ReadRow label="Processo" value={processo.processo} />
                <ReadRow label="Período" value={processo.periodo} />
                <ReadRow label="Data limite" value={formatDate(processo.data_limite)} />
                <ReadRow label="Prazo" value={processo.prazo_cumprimento} />
                <ReadRow label="Data-base / Ciência" value={processo.data_base_ciencia} />
                <ReadRow label="Providência" value={processo.providencia} />
                <ReadRow label="Observações" value={processo.observacoes} />
              </dl>
            </div>
          ) : (
            <div className="space-y-4">
              <Field label="PER/DCOMP *">
                <input
                  value={form.perdcomp}
                  onChange={(e) => set('perdcomp', e.target.value)}
                  className="glass-input font-mono"
                  placeholder="00000.00000.000000.0.0.00-0000"
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Processo">
                  <input
                    value={form.processo}
                    onChange={(e) => set('processo', e.target.value)}
                    className="glass-input"
                  />
                </Field>
                <Field label="Valor do pedido (R$)">
                  <input
                    value={valorText}
                    onChange={(e) => setValorText(e.target.value)}
                    className="glass-input"
                    inputMode="decimal"
                    placeholder="0,00"
                  />
                </Field>
              </div>
              <Field label="Empresa">
                <input
                  value={form.empresa}
                  onChange={(e) => set('empresa', e.target.value)}
                  className="glass-input"
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Tributo / Crédito">
                  <input
                    value={form.tributo_credito}
                    onChange={(e) => set('tributo_credito', e.target.value)}
                    className="glass-input"
                  />
                </Field>
                <Field label="Período">
                  <input
                    value={form.periodo}
                    onChange={(e) => set('periodo', e.target.value)}
                    className="glass-input"
                  />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Status">
                  <input
                    value={form.status}
                    onChange={(e) => set('status', e.target.value)}
                    className="glass-input"
                    list="perdcomp-status-options"
                  />
                  <datalist id="perdcomp-status-options">
                    {suggestions.map((s) => (
                      <option key={s} value={s} />
                    ))}
                  </datalist>
                </Field>
                <Field label="Data limite">
                  <GlassDatePicker
                    ariaLabel="Data limite"
                    value={form.data_limite ?? ''}
                    onChange={(v) => set('data_limite', v || null)}
                  />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Prazo para cumprimento">
                  <input
                    value={form.prazo_cumprimento}
                    onChange={(e) => set('prazo_cumprimento', e.target.value)}
                    className="glass-input"
                    placeholder="Ex.: 30 dias da ciência"
                  />
                </Field>
                <Field label="Data-base / Ciência">
                  <input
                    value={form.data_base_ciencia}
                    onChange={(e) => set('data_base_ciencia', e.target.value)}
                    className="glass-input"
                  />
                </Field>
              </div>
              <Field label="Providência">
                <textarea
                  value={form.providencia}
                  onChange={(e) => set('providencia', e.target.value)}
                  rows={3}
                  className="glass-input resize-none"
                />
              </Field>
              <Field label="Observações">
                <textarea
                  value={form.observacoes}
                  onChange={(e) => set('observacoes', e.target.value)}
                  rows={5}
                  className="glass-input resize-none"
                />
              </Field>
            </div>
          )}

          {error ? (
            <p className="mt-4 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
          ) : null}
        </div>

        <footer className="flex shrink-0 flex-col gap-2 border-t border-slate-100 px-5 py-4">
          {readOnly ? (
            <button type="button" className="btn-ghost w-full" onClick={onClose}>
              Fechar
            </button>
          ) : (
            <div className="flex items-center justify-end gap-2">
              <button type="button" className="btn-ghost" onClick={onClose}>
                Cancelar
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={saving}
                onClick={() => void handleSave()}
              >
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          )}
          {mode === 'edit' ? (
            <button
              type="button"
              className="btn-ghost w-full text-rose-600"
              disabled={saving}
              onClick={() => void remove()}
            >
              <Trash2 className="h-4 w-4" />
              Excluir processo
            </button>
          ) : null}
        </footer>
      </aside>
    </>,
    document.body,
  )
}
