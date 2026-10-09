import { ClipboardList, History, Trash2, Users } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { apiFetch } from '../lib/api'
import { useAtividadesAtivas } from '../lib/atividades'
import {
  formatCompetencia,
  formatDate,
  formatHorario,
  formatTime,
  isEntregue,
  isItemAtrasado,
  statusLabel,
} from '../lib/format'
import type { StatusObrigacao, Tarefa, TarefaAudit, TarefaUpdate } from '../types'
import { tarefaCategoriaLabel } from '../types'
import { useAuth } from '../context/AuthContext'
import { workItemFromTarefa } from '../lib/workItems'
import CopiarModal from './CopiarModal'
import DetalheModal, { Bloco, Campo, ChipBu, Indicador, ROTULO } from './DetalheModal'
import AcoesEmpresa from './empresas/AcoesEmpresa'
import GlassDatePicker from './GlassDatePicker'
import PersonAvatar from './PersonAvatar'
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
  const [atividadeId, setAtividadeId] = useState('')
  const [motivoAtraso, setMotivoAtraso] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [audit, setAudit] = useState<TarefaAudit[]>([])
  const [copiando, setCopiando] = useState(false)
  const { canWrite } = useAuth()
  const atividades = useAtividadesAtivas(open && !readOnly)

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
    setAtividadeId(tarefa.atividade_id ?? '')
    setMotivoAtraso(tarefa.motivo_atraso ?? '')
    setError('')
    setCopiando(false)
  }, [tarefa, initialStatus])

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
        atividade_id: atividadeId || null,
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

  const empresa = tarefa.empresa
  const atrasada = isItemAtrasado(tarefa)
  const horario = formatHorario(horaInicio, horaFim)

  return (
    <>
      <DetalheModal
        aberto={open}
        onClose={onClose}
        escapeBloqueado={copiando}
        empresa={empresa}
        titulo={tarefa.titulo}
        chips={
          <>
            <span className="rounded-full bg-brand-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-700 dark:text-brand-300">
              Tarefa
            </span>
            {empresa?.bu && <ChipBu bu={empresa.bu} />}
            <StatusBadge status={tarefa.status} urgencia={tarefa.urgencia} />
          </>
        }
        subtitulo={
          <>
            {empresa?.razao_social ?? 'Tarefa interna'}
            {tarefa.atividade?.nome ? ` · ${tarefa.atividade.nome}` : ''}
            {` · ${tarefaCategoriaLabel(tarefa.categoria)}`}
          </>
        }
        acoes={
          <AcoesEmpresa
            empresa={empresa}
            onCopiar={canWrite && !readOnly ? () => setCopiando(true) : undefined}
            onNavegar={onClose}
          />
        }
        indicadores={
          <>
            <Indicador rotulo="Prazo" alerta={atrasada}>
              {formatDate(tarefa.prazo)}
            </Indicador>
            <Indicador rotulo="Horário">{formatHorario(tarefa.hora_inicio, tarefa.hora_fim) ?? '—'}</Indicador>
            <Indicador rotulo="Competência">{formatCompetencia(tarefa.competencia)}</Indicador>
            <Indicador rotulo="Entrega">
              {tarefa.entregue_em ? formatDate(tarefa.entregue_em.slice(0, 10)) : '—'}
            </Indicador>
          </>
        }
        rodape={
          readOnly ? undefined : (
            <>
              <button
                type="button"
                className="btn-ghost text-rose-600"
                disabled={saving}
                onClick={() => void remove()}
              >
                <Trash2 className="h-4 w-4" />
                Excluir tarefa
              </button>
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
                  {saving ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </>
          )
        }
      >
        {error && (
          <p className="rounded-xl bg-rose-50/90 px-3 py-2 text-sm text-rose-700 lg:col-span-3">{error}</p>
        )}

        <Bloco icon={ClipboardList} titulo="Tarefa" className="lg:col-span-2">
          {readOnly ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo rotulo="Status">{statusLabel(status)}</Campo>
              <Campo rotulo="Prazo">
                {formatDate(prazo)}
                {horario ? ` · ${horario}` : ''}
              </Campo>
              <Campo rotulo="Tipo de serviço">{tarefa.atividade?.nome}</Campo>
              <div className="sm:col-span-2">
                <Campo rotulo="Descrição">
                  {descricao ? <span className="whitespace-pre-wrap">{descricao}</span> : null}
                </Campo>
              </div>
              {tarefa.motivo_atraso ? (
                <div className="sm:col-span-2">
                  <Campo rotulo="Motivo do atraso">
                    <span className="whitespace-pre-wrap">{tarefa.motivo_atraso}</span>
                  </Campo>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className={ROTULO}>Título</label>
                <input value={titulo} onChange={(e) => setTitulo(e.target.value)} className="glass-input" />
              </div>
              <div className="sm:col-span-2">
                <label className={ROTULO}>Tipo de serviço</label>
                <select
                  value={atividadeId}
                  onChange={(e) => setAtividadeId(e.target.value)}
                  className="glass-input"
                >
                  <option value="">Sem tipo de serviço</option>
                  {tarefa.atividade && !atividades.some((a) => a.id === tarefa.atividade?.id) ? (
                    <option value={tarefa.atividade.id}>{tarefa.atividade.nome}</option>
                  ) : null}
                  {atividades.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.nome}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={ROTULO}>Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as StatusObrigacao)}
                  className="glass-input"
                >
                  {STATUS_OPTS.map((s) => (
                    <option key={s} value={s}>
                      {statusLabel(s)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={ROTULO}>Prazo</label>
                <GlassDatePicker ariaLabel="Prazo" value={prazo} onChange={setPrazo} />
              </div>
              <div>
                <label className={ROTULO}>Início</label>
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
                <label className={ROTULO}>Fim</label>
                <input
                  type="time"
                  required
                  value={horaFim}
                  onChange={(e) => setHoraFim(e.target.value)}
                  className="glass-input"
                  aria-label="Horário de fim"
                />
              </div>
              <p className="-mt-1 text-[11px] text-[color:var(--color-muted)] sm:col-span-2">
                Obrigatório. O atraso continua só pelo dia do prazo, não pelo horário.
              </p>
              {needsMotivo ? (
                <div className="sm:col-span-2">
                  <label className="mb-1.5 block text-xs font-medium text-rose-600">Motivo do atraso *</label>
                  <textarea
                    value={motivoAtraso}
                    onChange={(e) => setMotivoAtraso(e.target.value)}
                    rows={3}
                    className="glass-input resize-none border-rose-200 focus:border-rose-400 focus:ring-rose-400/20"
                    placeholder="Por que a entrega está fora do prazo?"
                  />
                  <p className="mt-1 text-[11px] text-[color:var(--color-muted)]">
                    Obrigatório para entregar após o prazo (mín. 20 caracteres).
                  </p>
                </div>
              ) : null}
              <div className="sm:col-span-2">
                <label className={ROTULO}>Descrição</label>
                <textarea
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  rows={3}
                  className="glass-input resize-none"
                  placeholder="Anotações..."
                />
              </div>
            </div>
          )}
        </Bloco>

        <div className="flex min-w-0 flex-col gap-4">
          <Bloco icon={Users} titulo="Pessoas">
            <div className="space-y-3">
              <div>
                <p className="mb-1.5 text-[11px] font-medium text-[color:var(--color-muted)]">Responsável</p>
                {tarefa.responsavel?.nome ? (
                  <div className="flex items-center gap-2.5">
                    <PersonAvatar nome={tarefa.responsavel.nome} fotoUrl={tarefa.responsavel.foto_url} size="lg" />
                    <span className="truncate text-sm font-medium text-[color:var(--color-ink)]">
                      {tarefa.responsavel.nome}
                    </span>
                  </div>
                ) : (
                  <p className="text-sm text-[color:var(--color-muted)]">—</p>
                )}
              </div>
              <div className="border-t border-[color:var(--color-line)] pt-3">
                <Campo rotulo="Solicitante">{tarefa.solicitante_nome}</Campo>
              </div>
            </div>
          </Bloco>

          <Bloco icon={History} titulo="Histórico">
            {audit.length === 0 ? (
              <p className="text-sm text-[color:var(--color-muted)]">Sem histórico registrado.</p>
            ) : (
              <div className="max-h-48 space-y-2 overflow-y-auto pr-1 [scrollbar-width:thin]">
                {audit.map((a) => (
                  <div key={a.id} className="rounded-xl bg-[color:var(--color-surface)] px-3 py-2 text-xs">
                    <p className="font-medium text-[color:var(--color-ink)]">{a.acao}</p>
                    <p className="mt-1 text-[10px] text-[color:var(--color-muted)]">
                      {new Date(a.created_at).toLocaleString('pt-BR')}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </Bloco>
        </div>
      </DetalheModal>
      <CopiarModal
        item={copiando ? workItemFromTarefa(tarefa) : null}
        onClose={() => setCopiando(false)}
      />
    </>
  )
}
