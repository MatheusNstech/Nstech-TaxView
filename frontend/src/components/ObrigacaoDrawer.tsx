import { ClipboardCheck, History, MessageSquare, Users } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { apiFetch } from '../lib/api'
import { formatCompetencia, formatDate, isItemAtrasado, statusLabel } from '../lib/format'
import { obrigacaoResponsaveis } from '../lib/responsaveis'
import { workItemFromObrigacao } from '../lib/workItems'
import type { AuditLog, Comentario, Obrigacao, ObrigacaoUpdate, StatusObrigacao } from '../types'
import CopiarModal from './CopiarModal'
import DetalheModal, { Bloco, Campo, ChipBu, Indicador, ROTULO } from './DetalheModal'
import AcoesEmpresa from './empresas/AcoesEmpresa'
import PersonAvatar from './PersonAvatar'
import StatusBadge from './StatusBadge'

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
  'ENTREGA_PARCIAL',
  'ENTREGUE',
  'ATRASADO',
]

const LISTA = 'space-y-2'
const ITEM = 'rounded-xl bg-[color:var(--color-surface)] px-3 py-2 text-xs'
const VAZIO = 'py-10 text-center text-sm text-[color:var(--color-muted)]'

export default function ObrigacaoDrawer({
  obrigacao,
  open,
  onClose,
  onSaved,
}: ObrigacaoDrawerProps) {
  const { isAdmin, canWrite } = useAuth()
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
  const [copiando, setCopiando] = useState(false)

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
    setShowReprovar(false)
    setReprovarMotivo('')
    setCopiando(false)
    void loadExtras(obrigacao.id)
  }, [obrigacao, loadExtras])

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
      const updated = await apiFetch<Obrigacao>(`/api/obrigacoes/${obrigacao.id}`, {
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
      const updated = await apiFetch<Obrigacao>(`/api/obrigacoes/${obrigacao.id}/aprovar`, {
        method: 'POST',
      })
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
      const updated = await apiFetch<Obrigacao>(`/api/obrigacoes/${obrigacao.id}/reprovar`, {
        method: 'POST',
        body: JSON.stringify({ motivo: reprovarMotivo.trim() }),
      })
      onSaved(updated)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao reprovar')
    } finally {
      setSaving(false)
    }
  }

  const empresa = obrigacao.empresa
  const responsaveis = obrigacaoResponsaveis(obrigacao)
  const atrasada = isItemAtrasado(obrigacao)

  const abaEntrega = (
    <>
      <Bloco icon={ClipboardCheck} titulo="Entrega" className="lg:col-span-2">
        {canWrite && isAdmin && obrigacao.status === 'EM_REVISAO' && (
          <div className="mb-4 space-y-2 rounded-xl border border-brand-500/30 bg-brand-500/5 p-4">
            <p className="text-xs font-semibold text-brand-700">Aprovação formal</p>
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
                  <button type="button" className="btn-ghost flex-1" onClick={() => setShowReprovar(false)}>
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
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={ROTULO}>Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as StatusObrigacao)}
                className="glass-input"
              >
                {statusOptions.map((s) => (
                  <option key={s} value={s}>
                    {statusLabel(s)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={ROTULO}>Data de entrega</label>
              <input
                type="date"
                value={dataEntrega}
                onChange={(e) => setDataEntrega(e.target.value)}
                className="glass-input"
              />
              {obrigacao.entrega_original ? (
                <p className="mt-1 text-[11px] text-[color:var(--color-muted)]">
                  Reaberta. Ao entregar de novo vale a entrega de {formatDate(obrigacao.entrega_original)}.
                </p>
              ) : null}
            </div>
            <div>
              <label className={ROTULO}>Prazo legal</label>
              <input
                type="date"
                value={prazoLegal}
                onChange={(e) => setPrazoLegal(e.target.value)}
                className="glass-input"
              />
            </div>
            <div>
              <label className={ROTULO}>Prazo fiscal</label>
              <input
                type="date"
                value={prazoFiscal}
                onChange={(e) => setPrazoFiscal(e.target.value)}
                className="glass-input"
              />
            </div>
            <div className="sm:col-span-2">
              <label className={ROTULO}>Nº do recibo</label>
              <input
                type="text"
                value={reciboNumero}
                onChange={(e) => setReciboNumero(e.target.value)}
                placeholder="Número do recibo"
                className="glass-input"
              />
            </div>
            <div className="sm:col-span-2">
              <label className={ROTULO}>Observação</label>
              <textarea
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                rows={3}
                placeholder="Anotações sobre a entrega..."
                className="glass-input resize-none"
              />
            </div>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo rotulo="Status">{statusLabel(obrigacao.status)}</Campo>
            <Campo rotulo="Data de entrega">{formatDate(obrigacao.data_entrega)}</Campo>
            {obrigacao.entrega_original ? (
              <Campo rotulo="Reaberta">Entregue em {formatDate(obrigacao.entrega_original)}</Campo>
            ) : null}
            <Campo rotulo="Nº do recibo">{obrigacao.recibo_numero}</Campo>
            <div className="sm:col-span-2">
              <Campo rotulo="Observação">
                {obrigacao.observacao?.trim() ? (
                  <span className="whitespace-pre-wrap">{obrigacao.observacao}</span>
                ) : null}
              </Campo>
            </div>
            {obrigacao.motivo_atraso ? (
              <div className="sm:col-span-2">
                <Campo rotulo="Motivo do atraso">
                  <span className="whitespace-pre-wrap">{obrigacao.motivo_atraso}</span>
                </Campo>
              </div>
            ) : null}
          </div>
        )}
      </Bloco>

      <Bloco icon={Users} titulo={responsaveis.length > 1 ? 'Responsáveis' : 'Responsável'}>
        {responsaveis.length === 0 ? (
          <p className="text-sm text-[color:var(--color-muted)]">Sem responsável</p>
        ) : (
          <ul className="space-y-2.5">
            {responsaveis.map((r) => (
              <li key={r.id} className="flex items-center gap-2.5">
                <PersonAvatar nome={r.nome} fotoUrl={r.foto_url} size="lg" />
                <span className="truncate text-sm font-medium text-[color:var(--color-ink)]">{r.nome}</span>
              </li>
            ))}
          </ul>
        )}
      </Bloco>
    </>
  )

  const abaComentarios = (
    <div className="space-y-3 lg:col-span-3">
      {comentarios.length === 0 ? (
        <p className={VAZIO}>Nenhum comentário ainda.</p>
      ) : (
        <div className={LISTA}>
          {comentarios.map((c) => (
            <div key={c.id} className={ITEM}>
              <p className="text-[color:var(--color-muted)]">
                {c.autor_email ?? 'usuário'} · {new Date(c.created_at).toLocaleString('pt-BR')}
              </p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-[color:var(--color-ink)]">{c.texto}</p>
            </div>
          ))}
        </div>
      )}
      {canWrite && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <textarea
            className="glass-input flex-1 resize-none"
            rows={2}
            placeholder="Escreva um comentário..."
            value={novoComentario}
            onChange={(e) => setNovoComentario(e.target.value)}
          />
          <button
            type="button"
            className="btn-ghost !py-2 text-sm"
            disabled={saving || !novoComentario.trim()}
            onClick={() => void handleComentar()}
          >
            Comentar
          </button>
        </div>
      )}
    </div>
  )

  const abaHistorico = (
    <div className="lg:col-span-3">
      {audit.length === 0 ? (
        <p className={VAZIO}>Sem histórico registrado.</p>
      ) : (
        <div className={LISTA}>
          {audit.map((a) => (
            <div key={a.id} className={ITEM}>
              <p className="font-medium text-[color:var(--color-ink)]">
                {a.acao}
                {a.campo ? ` · ${a.campo}` : ''}
              </p>
              {a.campo ? (
                <p className="text-[color:var(--color-muted)]">
                  {a.valor_anterior ?? '—'} → {a.valor_novo ?? '—'}
                </p>
              ) : null}
              <p className="mt-1 text-[10px] text-[color:var(--color-muted)]">
                {new Date(a.created_at).toLocaleString('pt-BR')}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )

  return (
    <>
      <DetalheModal
        aberto={open}
        onClose={onClose}
        escapeBloqueado={copiando}
        empresa={empresa}
        titulo={obrigacao.atividade?.nome ?? 'Obrigação'}
        chips={
          <>
            {empresa?.bu && <ChipBu bu={empresa.bu} />}
            <StatusBadge status={obrigacao.status} urgencia={obrigacao.urgencia} />
          </>
        }
        subtitulo={
          <>
            {empresa?.razao_social ?? '—'}
            {empresa?.cnpj && (
              <>
                {' · '}
                <span className="font-mono text-xs">{empresa.cnpj}</span>
              </>
            )}
          </>
        }
        acoes={
          <AcoesEmpresa
            empresa={empresa}
            onCopiar={isAdmin ? () => setCopiando(true) : undefined}
            onNavegar={onClose}
          />
        }
        indicadores={
          <>
            <Indicador rotulo="Competência">{formatCompetencia(obrigacao.competencia)}</Indicador>
            <Indicador rotulo="Prazo legal" alerta={atrasada && !obrigacao.prazo_fiscal}>
              {formatDate(obrigacao.prazo_legal)}
            </Indicador>
            <Indicador rotulo="Prazo fiscal" alerta={atrasada && Boolean(obrigacao.prazo_fiscal)}>
              {formatDate(obrigacao.prazo_fiscal)}
            </Indicador>
            <Indicador rotulo="Entrega">
              {obrigacao.data_entrega ? formatDate(obrigacao.data_entrega) : '—'}
            </Indicador>
          </>
        }
        abas={[
          { id: 'entrega', rotulo: 'Entrega', icon: ClipboardCheck, conteudo: abaEntrega },
          {
            id: 'comentarios',
            rotulo: 'Comentários',
            icon: MessageSquare,
            contador: comentarios.length,
            conteudo: abaComentarios,
          },
          {
            id: 'historico',
            rotulo: 'Histórico',
            icon: History,
            contador: audit.length,
            conteudo: abaHistorico,
          },
        ]}
        rodape={
          canWrite ? (
            <div className="ml-auto flex gap-2">
              <button type="button" onClick={onClose} className="btn-ghost">
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={saving}
                className="btn-primary"
              >
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          ) : undefined
        }
      >
        {error && (
          <p className="rounded-xl bg-rose-50/90 px-3 py-2 text-sm text-rose-700 lg:col-span-3">{error}</p>
        )}
      </DetalheModal>
      <CopiarModal
        item={copiando ? workItemFromObrigacao(obrigacao) : null}
        onClose={() => setCopiando(false)}
      />
    </>
  )
}
