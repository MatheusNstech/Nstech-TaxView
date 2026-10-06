import { Trash2, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { apiFetch } from '../lib/api'
import {
  formatDate,
  formatHorario,
  formatTime,
  isEntregue,
  statusLabel,
} from '../lib/format'
import type { StatusObrigacao, Tarefa, TarefaAudit, TarefaUpdate } from '../types'
import { tarefaCategoriaLabel } from '../types'
import GlassDatePicker from './GlassDatePicker'
import StatusBadge from './StatusBadge'

const STATUS_OPTS: StatusObrigacao[] = [
  'PENDENTE',
  'EM_ANDAMENTO',
  'EM_REVISAO',
  'ENTREGA_PARCIAL',
  'ENTREGUE',
  'ATRASADO',
]

interface TarefaDrawerProps {
  tarefa: Tarefa | null
  open: boolean
  onClose: () => void
  onSaved: (tarefa: Tarefa) => void
  onDeleted: (id: string) => void
  readOnly?: boolean
  /** Pré-seleciona status ao abrir (ex.: drag Kanban → ENTREGUE). */
  initialStatus?: StatusObrigacao | null
}

function isLateEntrega(
  status: StatusObrigacao,
  prazoIso: string | null | undefined,
  tarefa: Tarefa,
): boolean {
  if (!isEntregue(status)) return false
  const prazo = prazoIso?.slice(0, 10)
  // Reaberta ou já entregue (parcial -> entregue): vale a data da entrega.
  const entrega =
    tarefa.entrega_original ?? (isEntregue(tarefa.status) ? tarefa.entregue_em : null)
  if (entrega) return Boolean(prazo && prazo < entrega.slice(0, 10))
  if (tarefa.status === 'ATRASADO') return true
  if (!prazo) return false
  const today = new Date()
  const todayIso = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, '0'),
    String(today.getDate()).padStart(2, '0'),
  ].join('-')
  return prazo < todayIso
}

const scrollClass = [
  'min-h-0 flex-1 overflow-y-auto overscroll-contain',
  '[scrollbar-width:thin]',
  '[scrollbar-color:#cbd5e1_transparent]',
  '[&::-webkit-scrollbar]:w-1.5',
  '[&::-webkit-scrollbar-track]:bg-transparent',
  '[&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300',
].join(' ')

export default function TarefaDrawer({
  tarefa,
  open,
  onClose,
  onSaved,
  onDeleted,
  readOnly = false,
  initialStatus = null,
}: TarefaDrawerProps) {
  const [titulo, setTitulo] = useState('')
  const [status, setStatus] = useState<StatusObrigacao>('PENDENTE')
  const [prazo, setPrazo] = useState('')
  const [horaInicio, setHoraInicio] = useState('')
  const [horaFim, setHoraFim] = useState('')
  const [descricao, setDescricao] = useState('')
  const [motivoAtraso, setMotivoAtraso] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [audit, setAudit] = useState<TarefaAudit[]>([])

  const tarefaId = open ? tarefa?.id : undefined
  useEffect(() => {
    setAudit([])
    if (!tarefaId) return
    let cancelled = false
    apiFetch<TarefaAudit[]>(`/api/tarefas/${tarefaId}/audit`)
      .then((rows) => {
        if (!cancelled) setAudit(rows)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [tarefaId])

  useEffect(() => {
    if (!tarefa) return
    setTitulo(tarefa.titulo)
    setStatus(initialStatus ?? tarefa.status)
    setPrazo(tarefa.prazo?.slice(0, 10) ?? '')
    setHoraInicio(formatTime(tarefa.hora_inicio))
    setHoraFim(formatTime(tarefa.hora_fim))
    setDescricao(tarefa.descricao ?? '')
    setMotivoAtraso(tarefa.motivo_atraso ?? '')
    setError('')
  }, [tarefa, initialStatus])

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  const needsMotivo = useMemo(
    () => (tarefa ? isLateEntrega(status, prazo || tarefa.prazo, tarefa) : false),
    [tarefa, status, prazo],
  )

  if (!open || !tarefa) return null

  const handleSave = async () => {
    if (readOnly) return
    const trimmed = titulo.trim()
    if (!trimmed) {
      setError('Informe o título da tarefa')
      return
    }
    const motivo = motivoAtraso.trim()
    if (needsMotivo && motivo.length < 20) {
      setError('Informe o motivo do atraso (mínimo 20 caracteres)')
      return
    }
    const inicio = formatTime(horaInicio)
    const fim = formatTime(horaFim)
    if (!prazo || !inicio || !fim) {
      setError('Informe o prazo e o horário de início e fim')
      return
    }
    if (fim <= inicio) {
      setError('O horário final deve ser depois do início')
      return
    }
    setSaving(true)
    setError('')
    try {
      const payload: TarefaUpdate = {
        titulo: trimmed,
        status,
        prazo,
        hora_inicio: inicio,
        hora_fim: fim,
        descricao: descricao.trim() || null,
      }
      if (needsMotivo) {
        payload.motivo_atraso = motivo
      }
      const updated = await apiFetch<Tarefa>(`/api/tarefas/${tarefa.id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      })
      const savedPrazo = (updated.prazo || '').slice(0, 10)
      const savedInicio = formatTime(updated.hora_inicio)
      const savedFim = formatTime(updated.hora_fim)
      if (savedPrazo !== prazo || savedInicio !== inicio || savedFim !== fim) {
        setError('Não foi possível salvar o prazo. Tente de novo.')
        return
      }
      onSaved({
        ...tarefa,
        ...updated,
        titulo: trimmed,
        status,
        prazo: savedPrazo,
        hora_inicio: savedInicio,
        hora_fim: savedFim,
        descricao: descricao.trim() || null,
        motivo_atraso: needsMotivo ? motivo : updated.motivo_atraso,
      })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    if (readOnly) return
    if (!window.confirm('Excluir esta tarefa?')) return
    setSaving(true)
    setError('')
    try {
      await apiFetch(`/api/tarefas/${tarefa.id}`, { method: 'DELETE' })
      onDeleted(tarefa.id)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao excluir')
    } finally {
      setSaving(false)
    }
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
              {readOnly ? 'Somente leitura' : 'Edição'}
            </p>
            <h2 className="mt-0.5 text-base font-semibold text-slate-900">
              {readOnly ? 'Detalhes da tarefa' : 'Editar tarefa'}
            </h2>
            <p className="mt-0.5 truncate text-sm text-slate-500">
              {tarefa.empresa?.razao_social ??
                tarefaCategoriaLabel(tarefa.categoria)}
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

        <div className={`${scrollClass} px-5 py-4`}>
          <div className="space-y-4">
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-900">{titulo || '—'}</p>
              <p className="mt-1 text-xs text-slate-500">
                Categoria: {tarefaCategoriaLabel(tarefa.categoria)}
                {tarefa.competencia
                  ? ` · Competência ${formatDate(tarefa.competencia)}`
                  : ''}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Solicitante: {tarefa.solicitante_nome || '—'}
              </p>
              <div className="mt-2.5">
                <StatusBadge status={tarefa.status} urgencia={tarefa.urgencia} />
              </div>
            </div>

            {readOnly ? (
              <dl>
                <div className="grid grid-cols-[7.5rem_1fr] gap-3 border-b border-slate-100 py-3">
                  <dt className="text-xs font-medium text-slate-500">Status</dt>
                  <dd className="text-sm text-slate-800">
                    <StatusBadge status={status} urgencia={tarefa.urgencia} />
                  </dd>
                </div>
                <div className="grid grid-cols-[7.5rem_1fr] gap-3 border-b border-slate-100 py-3">
                  <dt className="text-xs font-medium text-slate-500">Prazo</dt>
                  <dd className="text-sm text-slate-800">
                    {formatDate(prazo)}
                    {formatHorario(horaInicio, horaFim)
                      ? ` · ${formatHorario(horaInicio, horaFim)}`
                      : ''}
                  </dd>
                </div>
                <div className="grid grid-cols-[7.5rem_1fr] gap-3 border-b border-slate-100 py-3">
                  <dt className="text-xs font-medium text-slate-500">
                    Solicitante
                  </dt>
                  <dd className="text-sm text-slate-800">
                    {tarefa.solicitante_nome || '—'}
                  </dd>
                </div>
                <div className="grid grid-cols-[7.5rem_1fr] gap-3 border-b border-slate-100 py-3">
                  <dt className="text-xs font-medium text-slate-500">Empresa</dt>
                  <dd className="min-w-0 text-sm text-slate-800">
                    {tarefa.empresa?.razao_social ?? '—'}
                  </dd>
                </div>
                <div className="grid grid-cols-[7.5rem_1fr] gap-3 border-b border-slate-100 py-3">
                  <dt className="text-xs font-medium text-slate-500">
                    Responsável
                  </dt>
                  <dd className="text-sm text-slate-800">
                    {tarefa.responsavel?.nome ?? '—'}
                  </dd>
                </div>
                <div className="grid grid-cols-[7.5rem_1fr] gap-3 border-b border-slate-100 py-3">
                  <dt className="text-xs font-medium text-slate-500">
                    Descrição
                  </dt>
                  <dd className="whitespace-pre-wrap text-sm text-slate-800">
                    {descricao || '—'}
                  </dd>
                </div>
                {tarefa.motivo_atraso ? (
                  <div className="grid grid-cols-[7.5rem_1fr] gap-3 py-3">
                    <dt className="text-xs font-medium text-slate-500">
                      Motivo do atraso
                    </dt>
                    <dd className="whitespace-pre-wrap text-sm text-slate-800">
                      {tarefa.motivo_atraso}
                    </dd>
                  </div>
                ) : null}
              </dl>
            ) : (
              <>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-500">
                    Título
                  </label>
                  <input
                    value={titulo}
                    onChange={(e) => setTitulo(e.target.value)}
                    className="glass-input"
                  />
                </div>

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
                    {STATUS_OPTS.map((s) => (
                      <option key={s} value={s}>
                        {statusLabel(s)}
                      </option>
                    ))}
                  </select>
                </div>

                {needsMotivo ? (
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-rose-600">
                      Motivo do atraso *
                    </label>
                    <textarea
                      value={motivoAtraso}
                      onChange={(e) => setMotivoAtraso(e.target.value)}
                      rows={3}
                      className="glass-input resize-none border-rose-200 focus:border-rose-400 focus:ring-rose-400/20"
                      placeholder="Por que a entrega está fora do prazo?"
                    />
                    <p className="mt-1 text-[11px] text-slate-500">
                      Obrigatório para entregar após o prazo (mín. 20 caracteres).
                    </p>
                  </div>
                ) : null}

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-500">
                    Prazo
                  </label>
                  <GlassDatePicker
                    ariaLabel="Prazo"
                    value={prazo}
                    onChange={setPrazo}
                    placement="top"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-slate-500">
                      Início
                    </label>
                    <input
                      type="time"
                      required
                      value={horaInicio}
                      onChange={(e) => setHoraInicio(e.target.value)}
                      className="glass-input"
                      aria-label="Horário de início"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-slate-500">
                      Fim
                    </label>
                    <input
                      type="time"
                      required
                      value={horaFim}
                      onChange={(e) => setHoraFim(e.target.value)}
                      className="glass-input"
                      aria-label="Horário de fim"
                    />
                  </div>
                </div>
                <p className="-mt-2 text-[11px] text-slate-500">
                  Obrigatório. O atraso continua só pelo dia do prazo, não pelo horário.
                </p>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-500">
                    Solicitante
                  </label>
                  <p className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5 text-sm text-slate-700">
                    {tarefa.solicitante_nome || '—'}
                  </p>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-500">
                    Empresa
                  </label>
                  <p className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5 text-sm text-slate-700">
                    {tarefa.empresa?.razao_social ?? '—'}
                  </p>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-500">
                    Responsável
                  </label>
                  <p className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5 text-sm text-slate-700">
                    {tarefa.responsavel?.nome ?? '—'}
                  </p>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-500">
                    Descrição
                  </label>
                  <textarea
                    value={descricao}
                    onChange={(e) => setDescricao(e.target.value)}
                    rows={3}
                    className="glass-input resize-none"
                    placeholder="Anotações..."
                  />
                </div>
              </>
            )}

            {audit.length > 0 ? (
              <div>
                <p className="mb-1.5 text-xs font-medium text-slate-500">Histórico</p>
                <div className="space-y-2">
                  {audit.map((a) => (
                    <div
                      key={a.id}
                      className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5 text-xs"
                    >
                      <p className="font-medium text-slate-800">{a.acao}</p>
                      <p className="mt-1 text-[10px] text-slate-400">
                        {new Date(a.created_at).toLocaleString('pt-BR')}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {error ? (
              <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {error}
              </p>
            ) : null}
          </div>
        </div>

        <footer className="flex shrink-0 flex-col gap-2 border-t border-slate-100 px-5 py-4">
          {!readOnly ? (
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
          ) : (
            <button type="button" className="btn-ghost w-full" onClick={onClose}>
              Fechar
            </button>
          )}
          {!readOnly ? (
            <button
              type="button"
              className="btn-ghost w-full text-rose-600"
              disabled={saving}
              onClick={() => void remove()}
            >
              <Trash2 className="h-4 w-4" />
              Excluir tarefa
            </button>
          ) : null}
        </footer>
      </aside>
    </>,
    document.body,
  )
}
