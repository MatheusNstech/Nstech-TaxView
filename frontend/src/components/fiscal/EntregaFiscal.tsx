import { CheckCircle2, RotateCcw, Undo2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { apiFetch } from '../../lib/api'
import { formatDate } from '../../lib/format'
import type { Empresa, FiscalAudit } from '../../types'
import { Bloco, ROTULO } from '../DetalheModal'
import GlassDatePicker from '../GlassDatePicker'

function hojeIso(): string {
  const d = new Date()
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-')
}

function normalizar(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/\b(LTDA|S\/?A|ME|EPP|EIRELI)\b\.?/g, '')
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim()
}

let empresasCache: Promise<Empresa[]> | null = null

/** Empresa do cadastro pelo nome em texto (para o logo no cabeçalho do modal). */
export function useEmpresaPorNome(...nomes: Array<string | null | undefined>): Empresa | null {
  const [empresa, setEmpresa] = useState<Empresa | null>(null)
  const chave = nomes.map((n) => normalizar(n ?? '')).filter(Boolean).join('|')

  useEffect(() => {
    setEmpresa(null)
    if (!chave) return
    let cancelado = false
    empresasCache ??= apiFetch<Empresa[]>('/api/empresas').catch(() => {
      empresasCache = null
      return []
    })
    void empresasCache.then((lista) => {
      if (cancelado) return
      const alvos = chave.split('|')
      const nomesDe = (e: Empresa) =>
        [e.razao_social, e.nome_fantasia ?? ''].map(normalizar).filter(Boolean)
      const achada =
        lista.find((e) => nomesDe(e).some((n) => alvos.includes(n))) ??
        lista.find((e) => nomesDe(e).some((n) => alvos.some((a) => n.startsWith(`${a} `))))
      setEmpresa(achada ?? null)
    })
    return () => {
      cancelado = true
    }
  }, [chave])

  return empresa
}

/** Histórico do item; recarrega quando `versao` muda (após salvar/entregar). */
export function useFiscalAudit(url: string | null, versao = 0): FiscalAudit[] {
  const [rows, setRows] = useState<FiscalAudit[]>([])
  useEffect(() => {
    setRows([])
    if (!url) return
    let cancelado = false
    apiFetch<FiscalAudit[]>(url)
      .then((r) => {
        if (!cancelado) setRows(r)
      })
      .catch(() => undefined)
    return () => {
      cancelado = true
    }
  }, [url, versao])
  return rows
}

export function AbaHistorico({ rows }: { rows: FiscalAudit[] }) {
  return (
    <div className="lg:col-span-3">
      {rows.length === 0 ? (
        <p className="py-10 text-center text-sm text-[color:var(--color-muted)]">
          Sem histórico registrado.
        </p>
      ) : (
        <div className="space-y-2">
          {rows.map((a) => (
            <div key={a.id} className="rounded-xl bg-[color:var(--color-surface)] px-3 py-2 text-xs">
              <p className="whitespace-pre-wrap font-medium text-[color:var(--color-ink)]">{a.acao}</p>
              <p className="mt-1 text-[10px] text-[color:var(--color-muted)]">
                {new Date(a.created_at).toLocaleString('pt-BR')}
                {a.user_email ? ` · ${a.user_email}` : ''}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * Situação de entrega do item: marcar como entregue (data + observação) ou reabrir.
 * `baseUrl` é a rota do item, ex.: /api/perdcomp/{id}.
 */
export function BlocoEntrega<T>({
  baseUrl,
  entregueEm,
  entregaObs,
  podeEditar,
  textoAberto,
  className = '',
  onAtualizado,
  onErro,
}: {
  baseUrl: string
  entregueEm: string | null
  entregaObs: string
  podeEditar: boolean
  /** O que acontece ao entregar, ex.: "O valor sai do total em aberto." */
  textoAberto: string
  className?: string
  onAtualizado: (item: T) => void
  onErro: (msg: string) => void
}) {
  const [modo, setModo] = useState<'ver' | 'entregar' | 'reabrir'>('ver')
  const [data, setData] = useState(hojeIso())
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    setModo('ver')
    setData(hojeIso())
    setTexto('')
  }, [baseUrl, entregueEm])

  const enviar = async () => {
    if (modo === 'entregar' && (!data || data > hojeIso())) {
      onErro('Informe uma data de entrega até hoje')
      return
    }
    setEnviando(true)
    onErro('')
    try {
      const item = await apiFetch<T>(`${baseUrl}/${modo === 'entregar' ? 'entregar' : 'reabrir'}`, {
        method: 'POST',
        body: JSON.stringify(
          modo === 'entregar' ? { data, observacao: texto.trim() } : { motivo: texto.trim() },
        ),
      })
      onAtualizado(item)
    } catch (err) {
      onErro(err instanceof Error ? err.message : 'Não foi possível atualizar a entrega')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Bloco icon={CheckCircle2} titulo="Entrega" className={className}>
      {entregueEm ? (
        <div className="rounded-xl bg-emerald-500/10 px-3 py-2.5 ring-1 ring-inset ring-emerald-500/20">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="h-4 w-4" strokeWidth={2} />
            Entregue em {formatDate(entregueEm)}
          </p>
          {entregaObs ? (
            <p className="mt-1 whitespace-pre-wrap text-xs text-[color:var(--color-ink)]">{entregaObs}</p>
          ) : null}
        </div>
      ) : (
        <div className="rounded-xl bg-[color:var(--color-surface)] px-3 py-2.5">
          <p className="text-sm font-semibold text-[color:var(--color-ink)]">Em aberto</p>
          <p className="mt-0.5 text-xs text-[color:var(--color-muted)]">{textoAberto}</p>
        </div>
      )}

      {podeEditar && modo === 'ver' ? (
        entregueEm ? (
          <button type="button" className="btn-ghost mt-3 w-full" onClick={() => setModo('reabrir')}>
            <RotateCcw className="h-4 w-4" strokeWidth={1.75} />
            Reabrir
          </button>
        ) : (
          <button type="button" className="btn-primary mt-3 w-full" onClick={() => setModo('entregar')}>
            <CheckCircle2 className="h-4 w-4" strokeWidth={1.75} />
            Marcar como entregue
          </button>
        )
      ) : null}

      {podeEditar && modo !== 'ver' ? (
        <div className="mt-3 space-y-3">
          {modo === 'entregar' ? (
            <div>
              <label className={ROTULO}>Data da entrega</label>
              <GlassDatePicker ariaLabel="Data da entrega" value={data} onChange={setData} />
            </div>
          ) : null}
          <div>
            <label className={ROTULO}>
              {modo === 'entregar' ? 'Observação (opcional)' : 'Motivo da reabertura (opcional)'}
            </label>
            <textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              rows={3}
              className="glass-input resize-none"
              placeholder={
                modo === 'entregar' ? 'Ex.: DARF pago, protocolo nº…' : 'Por que está sendo reaberto?'
              }
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              className="btn-ghost flex-1"
              disabled={enviando}
              onClick={() => setModo('ver')}
            >
              <Undo2 className="h-4 w-4" strokeWidth={1.75} />
              Voltar
            </button>
            <button
              type="button"
              className="btn-primary flex-1"
              disabled={enviando}
              onClick={() => void enviar()}
            >
              {enviando ? 'Salvando…' : modo === 'entregar' ? 'Confirmar entrega' : 'Reabrir'}
            </button>
          </div>
        </div>
      ) : null}
    </Bloco>
  )
}
