import { History, Landmark, ShieldCheck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { apiFetch } from '../../lib/api'
import { formatDate, formatMoneyBRL } from '../../lib/format'
import type { PainelFiscalPendencia } from '../../types'
import DetalheModal, { Bloco, Campo, Indicador, ROTULO } from '../DetalheModal'
import { AbaHistorico, BlocoEntrega, useEmpresaPorNome, useFiscalAudit } from '../fiscal/EntregaFiscal'
import GlassDatePicker from '../GlassDatePicker'

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

type CampoTexto =
  | 'orgao'
  | 'numero_processo'
  | 'status_cnd'
  | 'cnd'
  | 'motivo'
  | 'nota_01'
  | 'nota_02'
type CampoValor = 'total' | 'principal' | 'multa' | 'juros'
type CampoData = 'vencimento' | 'validade_cnd'

type Form = Record<CampoTexto | CampoValor | CampoData, string>

const VALORES: { key: CampoValor; label: string }[] = [
  { key: 'total', label: 'Total (R$)' },
  { key: 'principal', label: 'Principal (R$)' },
  { key: 'multa', label: 'Multa (R$)' },
  { key: 'juros', label: 'Juros (R$)' },
]

function moneyToInput(value: number | null | undefined): string {
  if (value == null) return ''
  return Number(value).toLocaleString('pt-BR', {
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

function formDe(p: PainelFiscalPendencia): Form {
  return {
    orgao: p.orgao ?? '',
    numero_processo: p.numero_processo ?? '',
    status_cnd: p.status_cnd ?? '',
    cnd: p.cnd ?? '',
    motivo: p.motivo ?? '',
    nota_01: p.nota_01 ?? '',
    nota_02: p.nota_02 ?? '',
    total: moneyToInput(p.total),
    principal: moneyToInput(p.principal),
    multa: moneyToInput(p.multa),
    juros: moneyToInput(p.juros),
    vencimento: p.vencimento ?? '',
    validade_cnd: p.validade_cnd ?? '',
  }
}

function hojeLocal(): string {
  const d = new Date()
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-')
}

/** Empresa e competência de uma pendência nova. */
export interface NovaPendencia {
  empresa: string
  razao_social: string
  cnpj: string
  uf: string
  ano: number | null
  mes: number | null
}

/** Rascunho com os dados da empresa, para o modal abrir em modo criação. */
function rascunho(novo: NovaPendencia): PainelFiscalPendencia {
  return {
    id: '',
    empresa: novo.empresa,
    razao_social: novo.razao_social,
    situacao_cnpj: '',
    cnpj: novo.cnpj,
    cidade_iss: '',
    uf: novo.uf,
    orgao: '',
    sucedida: '',
    data_inscricao: null,
    cnpj_sucedida: '',
    empresa_sucedida: '',
    natureza: '',
    fase: '',
    tipo: '',
    situacao: '',
    codigo: '',
    mes: novo.mes,
    ano: novo.ano,
    periodo_apuracao: '',
    vencimento: null,
    principal: null,
    multa: null,
    juros: null,
    total: null,
    motivo: '',
    numero_processo: '',
    cnd: '',
    validade_cnd: null,
    status_cnd: '',
    nota_01: '',
    nota_02: '',
    entregue_em: null,
    entrega_obs: '',
  }
}

export function periodoPendencia(p: PainelFiscalPendencia): string {
  if (p.periodo_apuracao?.trim()) return p.periodo_apuracao.trim()
  if (p.mes && p.ano) return `${MESES[p.mes - 1] ?? p.mes}/${p.ano}`
  return p.ano ? String(p.ano) : ''
}

/**
 * Detalhe de um débito RFB/PGFN no mesmo modal das tarefas.
 * Sem `pendencia` e com `novo`, abre em modo criação.
 */
export default function PendenciaDetalheModal({
  pendencia,
  novo,
  editable,
  onClose,
  onSaved,
}: {
  pendencia: PainelFiscalPendencia | null
  novo?: NovaPendencia | null
  editable: boolean
  onClose: () => void
  onSaved: (pendencia: PainelFiscalPendencia) => void
}) {
  const inicial = pendencia ?? (novo ? rascunho(novo) : null)
  const [atual, setAtual] = useState<PainelFiscalPendencia | null>(inicial)
  const [form, setForm] = useState<Form | null>(inicial ? formDe(inicial) : null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [versao, setVersao] = useState(0)
  const criando = !pendencia

  useEffect(() => {
    const base = pendencia ?? (novo ? rascunho(novo) : null)
    setAtual(base)
    setForm(base ? formDe(base) : null)
    setError('')
  }, [pendencia, novo])

  const empresa = useEmpresaPorNome(atual?.razao_social, atual?.empresa)
  const audit = useFiscalAudit(
    atual && !criando ? `/api/painel-fiscal/${atual.id}/audit` : null,
    versao,
  )

  if (!atual || !form) return null

  const set = (key: keyof Form, value: string) =>
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev))

  const handleSave = async () => {
    const base = formDe(atual)
    const payload: Record<string, string | number | null> = {}
    for (const key of Object.keys(form) as (keyof Form)[]) {
      if (form[key] === base[key]) continue
      if (VALORES.some((v) => v.key === key)) {
        const n = parseMoney(form[key])
        if (n === 'invalid') {
          setError('Valor inválido. Use o formato 1.234,56')
          return
        }
        payload[key] = n
      } else if (key === 'vencimento' || key === 'validade_cnd') {
        payload[key] = form[key] || null
      } else {
        payload[key] = form[key].trim()
      }
    }
    if (criando && !form.orgao.trim()) {
      setError('Informe o órgão (RFB, PGFN ou CADIN)')
      return
    }
    if (!criando && Object.keys(payload).length === 0) {
      onClose()
      return
    }
    setSaving(true)
    setError('')
    try {
      const updated = criando
        ? await apiFetch<PainelFiscalPendencia>('/api/painel-fiscal', {
            method: 'POST',
            body: JSON.stringify({
              empresa: atual.empresa,
              razao_social: atual.razao_social,
              cnpj: atual.cnpj.replace(/\D/g, ''),
              uf: atual.uf,
              ano: atual.ano,
              mes: atual.mes,
              ...payload,
            }),
          })
        : await apiFetch<PainelFiscalPendencia>(`/api/painel-fiscal/${atual.id}`, {
            method: 'PATCH',
            body: JSON.stringify(payload),
          })
      onSaved(updated)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  const periodo = periodoPendencia(atual)
  const vencido =
    !atual.entregue_em &&
    Boolean(atual.vencimento) &&
    (atual.vencimento ?? '') < hojeLocal()

  const blocoDebito = (
    <Bloco icon={Landmark} titulo="Débito" className="lg:col-span-2">
      {editable ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={ROTULO}>Órgão</label>
            <input
              value={form.orgao}
              onChange={(e) => set('orgao', e.target.value)}
              className="glass-input"
              list="pendencia-orgaos"
            />
            <datalist id="pendencia-orgaos">
              {['RFB', 'PGFN', 'CADIN'].map((o) => (
                <option key={o} value={o} />
              ))}
            </datalist>
          </div>
          <div>
            <label className={ROTULO}>Vencimento</label>
            <GlassDatePicker
              ariaLabel="Vencimento"
              value={form.vencimento}
              onChange={(v) => set('vencimento', v)}
            />
          </div>
          {VALORES.map((v) => (
            <div key={v.key}>
              <label className={ROTULO}>{v.label}</label>
              <input
                value={form[v.key]}
                onChange={(e) => set(v.key, e.target.value)}
                className="glass-input text-right tabular-nums"
                inputMode="decimal"
                placeholder="0,00"
              />
            </div>
          ))}
          <div className="sm:col-span-2">
            <label className={ROTULO}>Nº do processo</label>
            <input
              value={form.numero_processo}
              onChange={(e) => set('numero_processo', e.target.value)}
              className="glass-input"
            />
          </div>
          <div className="sm:col-span-2">
            <label className={ROTULO}>Motivo</label>
            <textarea
              value={form.motivo}
              onChange={(e) => set('motivo', e.target.value)}
              rows={2}
              className="glass-input resize-none"
            />
          </div>
          <div>
            <label className={ROTULO}>Nota 01</label>
            <textarea
              value={form.nota_01}
              onChange={(e) => set('nota_01', e.target.value)}
              rows={3}
              className="glass-input resize-none"
            />
          </div>
          <div>
            <label className={ROTULO}>Nota 02</label>
            <textarea
              value={form.nota_02}
              onChange={(e) => set('nota_02', e.target.value)}
              rows={3}
              className="glass-input resize-none"
            />
          </div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo rotulo="Órgão">{atual.orgao}</Campo>
          <Campo rotulo="Vencimento">{atual.vencimento ? formatDate(atual.vencimento) : null}</Campo>
          {VALORES.map((v) => (
            <Campo key={v.key} rotulo={v.label.replace(' (R$)', '')}>
              {atual[v.key] != null ? formatMoneyBRL(atual[v.key]) : null}
            </Campo>
          ))}
          <Campo rotulo="Nº do processo">{atual.numero_processo}</Campo>
          <Campo rotulo="Código">{atual.codigo}</Campo>
          {[
            ['Motivo', atual.motivo],
            ['Nota 01', atual.nota_01],
            ['Nota 02', atual.nota_02],
          ].map(([rotulo, texto]) => (
            <div key={rotulo} className="sm:col-span-2">
              <Campo rotulo={rotulo}>
                {texto ? <span className="whitespace-pre-wrap">{texto}</span> : null}
              </Campo>
            </div>
          ))}
        </div>
      )}
    </Bloco>
  )

  const blocoCnd = (
    <Bloco icon={ShieldCheck} titulo="Certidão (CND)">
      {editable ? (
        <div className="space-y-3">
          <div>
            <label className={ROTULO}>Status CND</label>
            <input
              value={form.status_cnd}
              onChange={(e) => set('status_cnd', e.target.value)}
              className="glass-input"
              list="pendencia-status-cnd"
            />
            <datalist id="pendencia-status-cnd">
              <option value="Válida" />
              <option value="Pendente" />
            </datalist>
          </div>
          <div>
            <label className={ROTULO}>CND</label>
            <input value={form.cnd} onChange={(e) => set('cnd', e.target.value)} className="glass-input" />
          </div>
          <div>
            <label className={ROTULO}>Validade</label>
            <GlassDatePicker
              ariaLabel="Validade da CND"
              value={form.validade_cnd}
              onChange={(v) => set('validade_cnd', v)}
            />
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <Campo rotulo="Status CND">{atual.status_cnd}</Campo>
          <Campo rotulo="CND">{atual.cnd}</Campo>
          <Campo rotulo="Validade">{atual.validade_cnd ? formatDate(atual.validade_cnd) : null}</Campo>
        </div>
      )}
    </Bloco>
  )

  const abaDados = (
    <>
      {blocoDebito}
      <div className="flex min-w-0 flex-col gap-4">
        {criando ? null : (
          <BlocoEntrega<PainelFiscalPendencia>
            baseUrl={`/api/painel-fiscal/${atual.id}`}
            entregueEm={atual.entregue_em}
            entregaObs={atual.entrega_obs}
            podeEditar={editable}
            textoAberto="Ao entregar, o valor do débito sai do total em aberto da empresa e do órgão."
            onErro={setError}
            onAtualizado={(item) => {
              setAtual(item)
              setVersao((v) => v + 1)
              onSaved(item)
            }}
          />
        )}
        {blocoCnd}
      </div>
    </>
  )

  return (
    <DetalheModal
      aberto
      onClose={onClose}
      empresa={empresa}
      titulo={atual.empresa || 'Pendência'}
      chips={
        <>
          <span className="rounded-full bg-brand-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-700 dark:text-brand-300">
            {criando ? 'Nova pendência' : atual.orgao || 'Pendência'}
          </span>
          {criando ? null : atual.entregue_em ? (
            <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
              Entregue
            </span>
          ) : (
            <span className="rounded-full bg-slate-500/10 px-2 py-0.5 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
              Em aberto
            </span>
          )}
        </>
      }
      subtitulo={[atual.razao_social, atual.cnpj, periodo].filter(Boolean).join(' · ') || undefined}
      indicadores={
        criando ? undefined : (
          <>
            <Indicador rotulo="Total">{formatMoneyBRL(atual.total)}</Indicador>
            <Indicador rotulo="Vencimento" alerta={vencido}>
              {atual.vencimento ? formatDate(atual.vencimento) : '—'}
            </Indicador>
            <Indicador rotulo="Período">{periodo || '—'}</Indicador>
            <Indicador rotulo="Entrega">
              {atual.entregue_em ? formatDate(atual.entregue_em) : 'Em aberto'}
            </Indicador>
          </>
        )
      }
      abas={criando ? undefined : [
        { id: 'dados', rotulo: 'Dados', icon: Landmark, conteudo: abaDados },
        {
          id: 'historico',
          rotulo: 'Histórico',
          icon: History,
          contador: audit.length,
          conteudo: <AbaHistorico rows={audit} />,
        },
      ]}
      rodape={
        editable ? (
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
              {saving ? 'Salvando...' : criando ? 'Criar pendência' : 'Salvar'}
            </button>
          </div>
        ) : undefined
      }
    >
      {error && (
        <p className="rounded-xl bg-rose-50/90 px-3 py-2 text-sm text-rose-700 lg:col-span-3">{error}</p>
      )}
      {criando ? abaDados : null}
    </DetalheModal>
  )
}
