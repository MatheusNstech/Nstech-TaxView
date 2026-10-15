import { ArrowRightLeft, Check, Hand, Send, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '../context/AuthContext'
import { apiFetch } from '../lib/api'
import { isEntregue } from '../lib/format'
import type { Obrigacao, Responsavel, Tarefa, WorkItem } from '../types'
import { BOTAO_TOPO } from './DetalheModal'
import PersonAvatar from './PersonAvatar'

type ItemTransferido = Tarefa | Obrigacao

function urlTransferir(item: WorkItem) {
  return `/api/${item.origem === 'tarefa' ? 'tarefas' : 'obrigacoes'}/${item.id}/transferir`
}

function donoDoItem(item: WorkItem): string | null {
  return (item.tarefa?.responsavel_id ?? item.obrigacao?.responsavel_id) || null
}

/** Quem pode receber o item: a equipe compartilhada (admin: todos os ativos). */
function useColegas(ativo: boolean) {
  const { isAdmin } = useAuth()
  const [colegas, setColegas] = useState<Responsavel[]>([])

  useEffect(() => {
    if (!ativo) return
    let cancelled = false
    apiFetch<Responsavel[]>(isAdmin ? '/api/responsaveis' : '/api/responsaveis/equipe')
      .then((rows) => {
        if (!cancelled) setColegas(rows.filter((r) => r.ativo))
      })
      .catch(() => {
        if (!cancelled) setColegas([])
      })
    return () => {
      cancelled = true
    }
  }, [ativo, isAdmin])

  return colegas
}

function TransferirModal({
  item,
  colegas,
  onClose,
  onTransferido,
}: {
  item: WorkItem | null
  colegas: Responsavel[]
  onClose: () => void
  onTransferido: (updated: ItemTransferido) => void
}) {
  const [destino, setDestino] = useState('')
  const [motivo, setMotivo] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')
  const itemKey = item?.key
  const dono = item ? donoDoItem(item) : null
  const opcoes = useMemo(() => colegas.filter((c) => c.id !== dono), [colegas, dono])

  useEffect(() => {
    if (!itemKey) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !enviando) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [itemKey, enviando, onClose])

  if (!item) return null

  const ehTarefa = item.origem === 'tarefa'
  const nomeDestino = opcoes.find((c) => c.id === destino)?.nome

  const enviar = async () => {
    if (!destino || enviando) return
    setEnviando(true)
    setErro('')
    try {
      const updated = await apiFetch<ItemTransferido>(urlTransferir(item), {
        method: 'POST',
        body: JSON.stringify({ responsavel_id: destino, motivo: motivo.trim() || null }),
      })
      onTransferido(updated)
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Falha ao transferir')
    } finally {
      setEnviando(false)
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/45 px-4 backdrop-blur-sm">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Fechar"
        onClick={onClose}
        disabled={enviando}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="transferir-titulo"
        className="relative z-10 flex max-h-[min(40rem,92dvh)] w-full max-w-md flex-col rounded-[1.25rem] border border-[color:var(--color-line)] bg-white shadow-2xl dark:bg-[color:var(--color-panel)]"
      >
        <div className="flex items-start justify-between gap-3 border-b border-[color:var(--color-line)] p-5">
          <div className="min-w-0">
            <h2 id="transferir-titulo" className="text-lg font-semibold text-[color:var(--color-ink)]">
              Enviar {ehTarefa ? 'tarefa' : 'obrigação'} para…
            </h2>
            <p className="truncate text-sm font-medium text-[color:var(--color-ink)]">
              {ehTarefa ? item.title : item.subtitle}
            </p>
            <p className="truncate text-xs text-[color:var(--color-muted)]">
              Hoje com {item.responsavelNome ?? 'ninguém'}
            </p>
          </div>
          <button type="button" className="btn-ghost !p-2" onClick={onClose} disabled={enviando}>
            <X className="h-4 w-4" />
          </button>
        </div>

        <ul className="mx-5 mt-4 min-h-[6rem] flex-1 space-y-1 overflow-y-auto overscroll-contain pr-1 [scrollbar-width:thin]">
          {opcoes.length === 0 && (
            <li className="py-6 text-center text-sm text-[color:var(--color-muted)]">
              Nenhum colega disponível.
            </li>
          )}
          {opcoes.map((c) => {
            const marcado = destino === c.id
            return (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => setDestino(c.id)}
                  className={[
                    'flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-left text-sm transition',
                    marcado
                      ? 'border-brand-500/60 bg-brand-500/10'
                      : 'border-transparent hover:bg-[color:var(--nav-hover)]',
                  ].join(' ')}
                >
                  <PersonAvatar nome={c.nome} fotoUrl={c.foto_url} size="md" />
                  <span className="min-w-0 flex-1 truncate font-medium text-[color:var(--color-ink)]">
                    {c.nome}
                  </span>
                  {marcado && <Check className="h-4 w-4 shrink-0 text-brand-600" strokeWidth={2.5} />}
                </button>
              </li>
            )
          })}
        </ul>

        <div className="space-y-3 border-t border-[color:var(--color-line)] p-5">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-[color:var(--color-muted)]">
              Motivo (opcional)
            </span>
            <textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              maxLength={300}
              rows={2}
              placeholder="Ex.: férias, redistribuição da carteira…"
              className="glass-input resize-none"
            />
          </label>
          {erro && <p className="rounded-xl bg-rose-50/90 px-3 py-2 text-sm text-rose-700">{erro}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={onClose} disabled={enviando}>
              Cancelar
            </button>
            <button
              type="button"
              className="btn-primary"
              disabled={!destino || enviando}
              onClick={() => void enviar()}
            >
              <Send className="h-4 w-4" strokeWidth={1.75} />
              {enviando ? 'Enviando…' : nomeDestino ? `Enviar para ${nomeDestino}` : 'Enviar'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}

/**
 * Botões do cabeçalho do detalhe: "Pegar para mim" (item de um colega) e
 * "Enviar para…" (item próprio; admin envia qualquer um).
 */
export function AcoesTransferir({
  item,
  entregue,
  desabilitado = false,
  onAbertoChange,
  onErro,
  onTransferido,
}: {
  item: WorkItem
  /** Entregue/entrega parcial não troca de dono. */
  entregue?: boolean
  desabilitado?: boolean
  onAbertoChange?: (aberto: boolean) => void
  onErro: (mensagem: string) => void
  onTransferido: (updated: ItemTransferido) => void
}) {
  const { isAdmin, canWrite, responsavelId } = useAuth()
  const fechado = entregue ?? isEntregue(item.status)
  const ativo = canWrite && !desabilitado && !fechado
  const colegas = useColegas(ativo)
  const [enviando, setEnviando] = useState(false)
  const [pegando, setPegando] = useState(false)

  const setAberto = (aberto: boolean) => {
    setEnviando(aberto)
    onAbertoChange?.(aberto)
  }

  if (!ativo || colegas.length < 2) return null

  const dono = donoDoItem(item)
  const souDono = Boolean(responsavelId) && dono === responsavelId
  const podePegar = !souDono && Boolean(responsavelId) && colegas.some((c) => c.id === responsavelId)
  const podeEnviar = souDono || isAdmin

  const pegar = async () => {
    if (pegando || !responsavelId) return
    const tipo = item.origem === 'tarefa' ? 'esta tarefa' : 'esta obrigação'
    const de = item.responsavelNome ? ` de ${item.responsavelNome}` : ''
    if (!window.confirm(`Pegar ${tipo}${de} para você?`)) return
    setPegando(true)
    try {
      const updated = await apiFetch<ItemTransferido>(urlTransferir(item), {
        method: 'POST',
        body: JSON.stringify({ responsavel_id: responsavelId }),
      })
      onTransferido(updated)
    } catch (err) {
      onErro(err instanceof Error ? err.message : 'Falha ao pegar o item')
    } finally {
      setPegando(false)
    }
  }

  return (
    <>
      {podePegar && (
        <button
          type="button"
          onClick={() => void pegar()}
          disabled={pegando}
          title="Passar este item para você"
          className={`px-2.5 py-1.5 ${BOTAO_TOPO}`}
        >
          <Hand className="h-3.5 w-3.5" strokeWidth={2} />
          {pegando ? 'Pegando…' : 'Pegar para mim'}
        </button>
      )}
      {podeEnviar && (
        <button
          type="button"
          onClick={() => setAberto(true)}
          title="Passar este item para um colega"
          className={`px-2.5 py-1.5 ${BOTAO_TOPO}`}
        >
          <ArrowRightLeft className="h-3.5 w-3.5" strokeWidth={2} />
          Enviar para…
        </button>
      )}
      {enviando && (
        <TransferirModal
          item={item}
          colegas={colegas}
          onClose={() => setAberto(false)}
          onTransferido={(updated) => {
            setAberto(false)
            onTransferido(updated)
          }}
        />
      )}
    </>
  )
}

export default TransferirModal
