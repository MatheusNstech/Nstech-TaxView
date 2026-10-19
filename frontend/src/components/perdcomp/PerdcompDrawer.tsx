import { FileText, History, Trash2 } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { apiFetch } from '../../lib/api'
import { formatDate, formatMoneyBRL } from '../../lib/format'
import type { PerdcompFields, PerdcompProcesso } from '../../types'
import DetalheModal, { Bloco, Campo, Indicador, ROTULO } from '../DetalheModal'
import { AbaHistorico, BlocoEntrega, useEmpresaPorNome, useFiscalAudit } from '../fiscal/EntregaFiscal'
import GlassDatePicker from '../GlassDatePicker'
import PerdcompPrazoChip from './PerdcompPrazoChip'
import { PerdcompStatusPill } from './PerdcompStatusChart'

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

function Texto({ children }: { children: ReactNode }) {
  return children ? <span className="whitespace-pre-wrap">{children}</span> : null
}

/** Detalhe do processo PER/DCOMP no mesmo modal das tarefas. */
export default function PerdcompDrawer({
  processo,
  mode,
  open,
  statusOptions,
  onClose,
  onSaved,
  onDeleted,
}: PerdcompDrawerProps) {
  const [atual, setAtual] = useState<PerdcompProcesso | null>(null)
  const [form, setForm] = useState<PerdcompFields>(EMPTY)
  const [valorText, setValorText] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [versao, setVersao] = useState(0)

  const criando = mode === 'create'
  const readOnly = mode === 'view'

  useEffect(() => {
    if (!open) return
    const base = processo && !criando ? processo : EMPTY
    setAtual(processo && !criando ? processo : null)
    setForm({ ...EMPTY, ...base })
    setValorText(moneyToInput(base.valor_pedido))
    setError('')
  }, [open, processo, criando])

  const empresa = useEmpresaPorNome(open ? form.empresa : null)
  const audit = useFiscalAudit(open && atual ? `/api/perdcomp/${atual.id}/audit` : null, versao)

  if (!open || (!criando && !processo)) return null

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
      const saved = criando
        ? await apiFetch<PerdcompProcesso>('/api/perdcomp', {
            method: 'POST',
            body: JSON.stringify(payload),
          })
        : await apiFetch<PerdcompProcesso>(`/api/perdcomp/${atual!.id}`, {
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
    if (!atual) return
    if (!window.confirm(`Excluir o PER/DCOMP ${atual.perdcomp}?`)) return
    setSaving(true)
    setError('')
    try {
      await apiFetch(`/api/perdcomp/${atual.id}`, { method: 'DELETE' })
      onDeleted(atual.id)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao excluir')
    } finally {
      setSaving(false)
    }
  }

  const blocoProcesso = (
    <Bloco icon={FileText} titulo="Processo" className={criando ? 'lg:col-span-3' : 'lg:col-span-2'}>
      {readOnly && atual ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo rotulo="PER/DCOMP">
            <span className="font-mono">{atual.perdcomp}</span>
          </Campo>
          <Campo rotulo="Processo">{atual.processo}</Campo>
          <Campo rotulo="Tributo / Crédito">{atual.tributo_credito}</Campo>
          <Campo rotulo="Período">{atual.periodo}</Campo>
          <Campo rotulo="Prazo para cumprimento">{atual.prazo_cumprimento}</Campo>
          <Campo rotulo="Data-base / Ciência">{atual.data_base_ciencia}</Campo>
          <div className="sm:col-span-2">
            <Campo rotulo="Providência">
              <Texto>{atual.providencia}</Texto>
            </Campo>
          </div>
          <div className="sm:col-span-2">
            <Campo rotulo="Observações">
              <Texto>{atual.observacoes}</Texto>
            </Campo>
          </div>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={ROTULO}>PER/DCOMP *</label>
            <input
              value={form.perdcomp}
              onChange={(e) => set('perdcomp', e.target.value)}
              className="glass-input font-mono"
              placeholder="00000.00000.000000.0.0.00-0000"
            />
          </div>
          <div>
            <label className={ROTULO}>Processo</label>
            <input
              value={form.processo}
              onChange={(e) => set('processo', e.target.value)}
              className="glass-input"
            />
          </div>
          <div>
            <label className={ROTULO}>Valor do pedido (R$)</label>
            <input
              value={valorText}
              onChange={(e) => setValorText(e.target.value)}
              className="glass-input"
              inputMode="decimal"
              placeholder="0,00"
            />
          </div>
          <div className="sm:col-span-2">
            <label className={ROTULO}>Empresa</label>
            <input
              value={form.empresa}
              onChange={(e) => set('empresa', e.target.value)}
              className="glass-input"
            />
          </div>
          <div>
            <label className={ROTULO}>Tributo / Crédito</label>
            <input
              value={form.tributo_credito}
              onChange={(e) => set('tributo_credito', e.target.value)}
              className="glass-input"
            />
          </div>
          <div>
            <label className={ROTULO}>Período</label>
            <input
              value={form.periodo}
              onChange={(e) => set('periodo', e.target.value)}
              className="glass-input"
            />
          </div>
          <div>
            <label className={ROTULO}>Status</label>
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
          </div>
          <div>
            <label className={ROTULO}>Data limite</label>
            <GlassDatePicker
              ariaLabel="Data limite"
              value={form.data_limite ?? ''}
              onChange={(v) => set('data_limite', v || null)}
            />
          </div>
          <div>
            <label className={ROTULO}>Prazo para cumprimento</label>
            <input
              value={form.prazo_cumprimento}
              onChange={(e) => set('prazo_cumprimento', e.target.value)}
              className="glass-input"
              placeholder="Ex.: 30 dias da ciência"
            />
          </div>
          <div>
            <label className={ROTULO}>Data-base / Ciência</label>
            <input
              value={form.data_base_ciencia}
              onChange={(e) => set('data_base_ciencia', e.target.value)}
              className="glass-input"
            />
          </div>
          <div className="sm:col-span-2">
            <label className={ROTULO}>Providência</label>
            <textarea
              value={form.providencia}
              onChange={(e) => set('providencia', e.target.value)}
              rows={3}
              className="glass-input resize-none"
            />
          </div>
          <div className="sm:col-span-2">
            <label className={ROTULO}>Observações</label>
            <textarea
              value={form.observacoes}
              onChange={(e) => set('observacoes', e.target.value)}
              rows={4}
              className="glass-input resize-none"
            />
          </div>
        </div>
      )}
    </Bloco>
  )

  const abaDados = (
    <>
      {blocoProcesso}
      {atual ? (
        <BlocoEntrega<PerdcompProcesso>
          baseUrl={`/api/perdcomp/${atual.id}`}
          entregueEm={atual.entregue_em}
          entregaObs={atual.entrega_obs}
          podeEditar={!readOnly}
          textoAberto="Ao entregar a providência, o valor do pedido sai do total em aberto."
          onErro={setError}
          onAtualizado={(item) => {
            setAtual(item)
            setVersao((v) => v + 1)
            onSaved(item)
          }}
        />
      ) : null}
    </>
  )

  const vencido = atual?.prazo_situacao === 'vencido'

  return (
    <DetalheModal
      aberto={open}
      onClose={onClose}
      empresa={empresa}
      titulo={criando ? 'Novo processo' : atual?.empresa || 'Processo PER/DCOMP'}
      chips={
        <>
          <span className="rounded-full bg-brand-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-700 dark:text-brand-300">
            PER/DCOMP
          </span>
          {atual ? <PerdcompStatusPill status={atual.status} /> : null}
          {atual ? (
            <PerdcompPrazoChip situacao={atual.prazo_situacao} dias={atual.dias_para_prazo} />
          ) : null}
        </>
      }
      subtitulo={
        atual ? (
          <>
            <span className="font-mono">{atual.perdcomp}</span>
            {atual.tributo_credito ? ` · ${atual.tributo_credito}` : ''}
          </>
        ) : (
          'Cadastre o pedido e acompanhe o prazo da providência'
        )
      }
      indicadores={
        atual ? (
          <>
            <Indicador rotulo="Valor do pedido">{formatMoneyBRL(atual.valor_pedido)}</Indicador>
            <Indicador rotulo="Data limite" alerta={vencido}>
              {formatDate(atual.data_limite)}
            </Indicador>
            <Indicador rotulo="Status">{atual.status || 'Sem status'}</Indicador>
            <Indicador rotulo="Entrega">
              {atual.entregue_em ? formatDate(atual.entregue_em) : 'Em aberto'}
            </Indicador>
          </>
        ) : undefined
      }
      abas={
        criando
          ? undefined
          : [
              { id: 'dados', rotulo: 'Dados', icon: FileText, conteudo: abaDados },
              {
                id: 'historico',
                rotulo: 'Histórico',
                icon: History,
                contador: audit.length,
                conteudo: <AbaHistorico rows={audit} />,
              },
            ]
      }
      rodape={
        readOnly ? undefined : (
          <>
            {!criando ? (
              <button
                type="button"
                className="btn-ghost text-rose-600"
                disabled={saving}
                onClick={() => void remove()}
              >
                <Trash2 className="h-4 w-4" />
                Excluir processo
              </button>
            ) : null}
            <div className="ml-auto flex gap-2">
              <button type="button" className="btn-ghost" onClick={onClose}>
                Cancelar
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={saving}
                onClick={() => void handleSave()}
              >
                {saving ? 'Salvando...' : criando ? 'Criar processo' : 'Salvar'}
              </button>
            </div>
          </>
        )
      }
    >
      {error && (
        <p className="rounded-xl bg-rose-50/90 px-3 py-2 text-sm text-rose-700 lg:col-span-3">{error}</p>
      )}
      {criando ? blocoProcesso : null}
    </DetalheModal>
  )
}
