import { Check, MessageSquare, History, X } from 'lucide-react'
import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '../context/AuthContext'
import { apiFetch } from '../lib/api'
import { formatDate, statusLabel } from '../lib/format'
import type {
  AuditLog,
  Comentario,
  Obrigacao,
  ObrigacaoUpdate,
  StatusObrigacao,
} from '../types'
import StatusBadge from './StatusBadge'
import PersonAvatar from './PersonAvatar'

interface ObrigacaoDrawerProps {
  obrigacao: Obrigacao | null
  open: boolean
  onClose: () => void
  onSaved: (updated: Obrigacao) => void
}

const statusOptions: StatusObrigacao[] = [
  'PENDENTE',
  'EM_ANDAMENTO',
  'EM_REVISAO',
  'ENTREGUE',
  'ATRASADO',
]

type Tab = 'dados' | 'comentarios' | 'historico'

function FieldRow({
  label,
  value,
}: {
  label: string
  value: ReactNode
}) {
  return (
    <div className="grid grid-cols-[7.5rem_1fr] gap-3 border-b border-slate-100 py-3 last:border-b-0 sm:grid-cols-[8.5rem_1fr]">
      <dt className="text-xs font-medium text-slate-500">{label}</dt>
      <dd className="min-w-0 text-sm text-slate-800">{value || '—'}</dd>
    </div>
  )
}

const scrollClass = [
  'min-h-0 flex-1 overflow-y-auto overscroll-contain',
  '[scrollbar-width:thin]',
  '[scrollbar-color:#cbd5e1_transparent]',
  '[&::-webkit-scrollbar]:w-1.5',
  '[&::-webkit-scrollbar-track]:bg-transparent',
  '[&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300',
].join(' ')

export default function ObrigacaoDrawer({
  obrigacao,
  open,
  onClose,
  onSaved,
}: ObrigacaoDrawerProps) {
  const { isAdmin, canWrite } = useAuth()
  const [tab, setTab] = useState<Tab>('dados')
  const [status, setStatus] = useState<StatusObrigacao>('PENDENTE')
  const [prazoLegal, setPrazoLegal] = useState('')
  const [prazoFiscal, setPrazoFiscal] = useState('')
  const [dataEntrega, setDataEntrega] = useState('')
  const [reciboNumero, setReciboNumero] = useState('')
  const [observacao, setObservacao] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [comentarios, setComentarios] = useState<Comentario[]>([])
  const [novoComentario, setNovoComentario] = useState('')
  const [audit, setAudit] = useState<AuditLog[]>([])
  const [reprovarMotivo, setReprovarMotivo] = useState('')
  const [showReprovar, setShowReprovar] = useState(false)

  const loadExtras = useCallback(async (id: string) => {
    try {
      const [c, a] = await Promise.all([
        apiFetch<Comentario[]>(`/api/obrigacoes/${id}/comentarios`),
        apiFetch<AuditLog[]>(`/api/obrigacoes/${id}/audit`),
      ])
      setComentarios(c)
      setAudit(a)
    } catch {
      setComentarios([])
      setAudit([])
    }
  }, [])

  useEffect(() => {
    if (!obrigacao) return
    setStatus(obrigacao.status)
    setPrazoLegal(obrigacao.prazo_legal ?? '')
    setPrazoFiscal(obrigacao.prazo_fiscal ?? '')
    setDataEntrega(obrigacao.data_entrega ?? '')
    setReciboNumero(obrigacao.recibo_numero ?? '')
    setObservacao(obrigacao.observacao ?? '')
    setError('')
    setTab('dados')
    setShowReprovar(false)
    setReprovarMotivo('')
    void loadExtras(obrigacao.id)
  }, [obrigacao, loadExtras])

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  if (!open || !obrigacao) return null

  const handleSave = async () => {
    if (!canWrite) {
      setError('Conta somente leitura — não é possível salvar alterações')
      return
    }
    setSaving(true)
    setError('')
    try {
      const payload: ObrigacaoUpdate = {
        status,
        prazo_legal: prazoLegal || null,
        prazo_fiscal: prazoFiscal || null,
        data_entrega: dataEntrega || null,
        recibo_numero: reciboNumero || null,
        observacao: observacao || null,
      }
      const updated = await apiFetch<Obrigacao>(
        `/api/obrigacoes/${obrigacao.id}`,
        {
          method: 'PATCH',
          body: JSON.stringify(payload),
        },
      )
      onSaved(updated)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  const handleComentar = async () => {
    if (!canWrite) {
      setError('Conta somente leitura — não é possível comentar')
      return
    }
    if (!novoComentario.trim()) return
    setSaving(true)
    setError('')
    try {
      await apiFetch(`/api/obrigacoes/${obrigacao.id}/comentarios`, {
        method: 'POST',
        body: JSON.stringify({ texto: novoComentario.trim() }),
      })
      setNovoComentario('')
      await loadExtras(obrigacao.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao comentar')
    } finally {
      setSaving(false)
    }
  }

  const handleAprovar = async () => {
    setSaving(true)
    setError('')
    try {
      const updated = await apiFetch<Obrigacao>(
        `/api/obrigacoes/${obrigacao.id}/aprovar`,
        { method: 'POST' },
      )
      onSaved(updated)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao aprovar')
    } finally {
      setSaving(false)
    }
  }

  const handleReprovar = async () => {
    if (!reprovarMotivo.trim()) {
      setError('Informe o motivo da reprovação')
      return
    }
    setSaving(true)
    setError('')
    try {
      const updated = await apiFetch<Obrigacao>(
        `/api/obrigacoes/${obrigacao.id}/reprovar`,
        {
          method: 'POST',
          body: JSON.stringify({ motivo: reprovarMotivo.trim() }),
        },
      )
      onSaved(updated)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao reprovar')
    } finally {
      setSaving(false)
    }
  }

  const tabs: { id: Tab; label: string; icon: typeof MessageSquare }[] = [
    { id: 'dados', label: 'Dados', icon: Check },
    { id: 'comentarios', label: 'Comentários', icon: MessageSquare },
    { id: 'historico', label: 'Histórico', icon: History },
  ]

  const displayOrDash = (v: string | null | undefined) => {
    if (!v) return '—'
    return v
  }

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[80] bg-slate-900/45 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <aside className="fixed inset-y-3 right-3 z-[90] flex w-[min(100%-1.5rem,26rem)] flex-col overflow-hidden rounded-2xl bg-white shadow-[0_24px_64px_rgb(15_23_42_/_0.28)] ring-1 ring-slate-200">
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              {canWrite ? 'Edição' : 'Somente leitura'}
            </p>
            <h2 className="mt-0.5 text-base font-semibold text-slate-900">
              {canWrite ? 'Editar obrigação' : 'Detalhes da obrigação'}
            </h2>
            <p className="mt-0.5 truncate text-sm text-slate-500">
              {obrigacao.empresa?.razao_social ?? '—'}
            </p>
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

        <div className="flex shrink-0 gap-1 border-b border-slate-100 px-3 pt-2">
          {tabs.map((t) => {
            const Icon = t.icon
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={[
                  'flex items-center gap-1.5 rounded-t-lg px-3 py-2 text-xs font-medium transition',
                  tab === t.id
                    ? 'bg-slate-100 text-brand-600'
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700',
                ].join(' ')}
              >
                <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
                {t.label}
              </button>
            )
          })}
        </div>

        <div className={`${scrollClass} px-5 py-4`}>
          {tab === 'dados' && (
            <div className="space-y-4">
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-900">
                  {obrigacao.atividade?.nome ?? '—'}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Competência: {formatDate(obrigacao.competencia)}
                  {obrigacao.empresa?.bu
                    ? ` · BU ${obrigacao.empresa.bu}`
                    : ''}
                </p>
                <div className="mt-2.5">
                  <StatusBadge
                    status={obrigacao.status}
                    urgencia={obrigacao.urgencia}
                  />
                </div>
              </div>

              {canWrite && isAdmin && obrigacao.status === 'EM_REVISAO' && (
                <div className="space-y-2 rounded-xl border border-brand-500/30 bg-brand-500/5 p-4">
                  <p className="text-xs font-semibold text-brand-700">
                    Aprovação formal
                  </p>
                  {!showReprovar ? (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="btn-primary flex-1 !py-2 text-sm"
                        disabled={saving}
                        onClick={() => void handleAprovar()}
                      >
                        Aprovar
                      </button>
                      <button
                        type="button"
                        className="btn-ghost flex-1 !py-2 text-sm"
                        onClick={() => setShowReprovar(true)}
                      >
                        Reprovar
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <textarea
                        className="glass-input"
                        rows={2}
                        placeholder="Motivo da reprovação"
                        value={reprovarMotivo}
                        onChange={(e) => setReprovarMotivo(e.target.value)}
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className="btn-ghost flex-1"
                          onClick={() => setShowReprovar(false)}
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          className="btn-primary flex-1"
                          disabled={saving}
                          onClick={() => void handleReprovar()}
                        >
                          Confirmar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {canWrite ? (
                <>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-slate-500">
                      Status
                    </label>
                    <select
                      value={status}
                      onChange={(e) =>
                        setStatus(e.target.value as StatusObrigacao)
                      }
                      className="glass-input"
                    >
                      {statusOptions.map((s) => (
                        <option key={s} value={s}>
                          {statusLabel(s)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-slate-500">
                        Prazo legal
                      </label>
                      <input
                        type="date"
                        value={prazoLegal}
                        onChange={(e) => setPrazoLegal(e.target.value)}
                        className="glass-input"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-slate-500">
                        Prazo fiscal
                      </label>
                      <input
                        type="date"
                        value={prazoFiscal}
                        onChange={(e) => setPrazoFiscal(e.target.value)}
                        className="glass-input"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-slate-500">
                      Data de entrega
                    </label>
                    <input
                      type="date"
                      value={dataEntrega}
                      onChange={(e) => setDataEntrega(e.target.value)}
                      className="glass-input"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-slate-500">
                      Nº do recibo
                    </label>
                    <input
                      type="text"
                      value={reciboNumero}
                      onChange={(e) => setReciboNumero(e.target.value)}
                      placeholder="Número do recibo"
                      className="glass-input"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-slate-500">
                      Observação
                    </label>
                    <textarea
                      value={observacao}
                      onChange={(e) => setObservacao(e.target.value)}
                      rows={4}
                      placeholder="Anotações sobre a entrega..."
                      className="glass-input"
                    />
                  </div>
                </>
              ) : (
                <dl className="rounded-xl border border-slate-100 px-4">
                  <FieldRow
                    label="Responsável"
                    value={
                      obrigacao.responsavel?.nome ? (
                        <span className="inline-flex items-center gap-2">
                          <PersonAvatar
                            nome={obrigacao.responsavel.nome}
                            fotoUrl={obrigacao.responsavel.foto_url}
                          />
                          {obrigacao.responsavel.nome}
                        </span>
                      ) : (
                        '—'
                      )
                    }
                  />
                  <FieldRow
                    label="Status"
                    value={statusLabel(obrigacao.status)}
                  />
                  <FieldRow
                    label="Prazo legal"
                    value={formatDate(obrigacao.prazo_legal)}
                  />
                  <FieldRow
                    label="Prazo fiscal"
                    value={formatDate(obrigacao.prazo_fiscal)}
                  />
                  <FieldRow
                    label="Data entrega"
                    value={formatDate(obrigacao.data_entrega)}
                  />
                  <FieldRow
                    label="Nº recibo"
                    value={displayOrDash(obrigacao.recibo_numero)}
                  />
                  <FieldRow
                    label="Observação"
                    value={
                      obrigacao.observacao?.trim() ? (
                        <span className="whitespace-pre-wrap">
                          {obrigacao.observacao}
                        </span>
                      ) : (
                        '—'
                      )
                    }
                  />
                </dl>
              )}
            </div>
          )}

          {tab === 'comentarios' && (
            <div className="space-y-4">
              <div className="space-y-3">
                {comentarios.length === 0 && (
                  <p className="text-sm text-slate-500">
                    Nenhum comentário ainda.
                  </p>
                )}
                {comentarios.map((c) => (
                  <div
                    key={c.id}
                    className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5 text-sm"
                  >
                    <p className="text-xs text-slate-500">
                      {c.autor_email ?? 'usuário'} ·{' '}
                      {new Date(c.created_at).toLocaleString('pt-BR')}
                    </p>
                    <p className="mt-1 text-slate-800">{c.texto}</p>
                  </div>
                ))}
              </div>
              {canWrite ? (
                <div className="space-y-2">
                  <textarea
                    className="glass-input"
                    rows={3}
                    placeholder="Escreva um comentário..."
                    value={novoComentario}
                    onChange={(e) => setNovoComentario(e.target.value)}
                  />
                  <button
                    type="button"
                    className="btn-primary w-full"
                    disabled={saving || !novoComentario.trim()}
                    onClick={() => void handleComentar()}
                  >
                    Comentar
                  </button>
                </div>
              ) : (
                <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
                  Visão somente leitura — comentários desabilitados.
                </p>
              )}
            </div>
          )}

          {tab === 'historico' && (
            <div className="space-y-2">
              {audit.length === 0 && (
                <p className="text-sm text-slate-500">
                  Sem histórico registrado.
                </p>
              )}
              {audit.map((a) => (
                <div
                  key={a.id}
                  className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5 text-xs"
                >
                  <p className="font-medium text-slate-800">
                    {a.acao}
                    {a.campo ? ` · ${a.campo}` : ''}
                  </p>
                  <p className="text-slate-500">
                    {a.valor_anterior ?? '—'} → {a.valor_novo ?? '—'}
                  </p>
                  <p className="mt-1 text-[10px] text-slate-400">
                    {new Date(a.created_at).toLocaleString('pt-BR')}
                  </p>
                </div>
              ))}
            </div>
          )}

          {error && (
            <p className="mt-4 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </p>
          )}
        </div>

        {tab === 'dados' && (
          <footer className="flex shrink-0 gap-3 border-t border-slate-100 px-5 py-3.5">
            <button type="button" onClick={onClose} className="btn-ghost flex-1">
              {canWrite ? 'Cancelar' : 'Fechar'}
            </button>
            {canWrite && (
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={saving}
                className="btn-primary flex-1"
              >
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            )}
          </footer>
        )}
      </aside>
    </>,
    document.body,
  )
}
