import { Check, CheckCircle2, Copy, Search, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { apiFetch } from '../lib/api'
import { formatCompetencia, formatDate } from '../lib/format'
import type { Empresa, WorkItem } from '../types'
import EmpresaLogo from './empresas/EmpresaLogo'
import { empresaDoItem } from './KanbanCard'

interface CopiarResultado {
  criadas: number
  ignoradas: { empresa_id: string; motivo: string }[]
}

function normaliza(texto: string | null | undefined) {
  return (texto ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function escapeRegex(texto: string) {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Mesma regra do backend: troca o nome da empresa de origem pelo do destino. */
export function trocarNomeEmpresa(
  titulo: string,
  origem: Pick<Empresa, 'razao_social' | 'nome_fantasia'> | null | undefined,
  destino: Pick<Empresa, 'razao_social' | 'nome_fantasia'>,
): string {
  if (!origem) return titulo
  const pares = (['razao_social', 'nome_fantasia'] as const)
    .map((campo) => [campo, (origem[campo] ?? '').trim()] as const)
    .sort((a, b) => b[1].length - a[1].length)
  for (const [campo, nome] of pares) {
    if (!nome) continue
    const novo = (destino[campo] || destino.razao_social || '').trim()
    if (!novo) continue
    const re = new RegExp(escapeRegex(nome), 'gi')
    if (re.test(titulo)) return titulo.replace(re, novo)
  }
  return titulo
}

function plural(n: number, um: string, varios: string) {
  return `${n} ${n === 1 ? um : varios}`
}

export default function CopiarModal({
  item,
  onClose,
  onCopiado,
}: {
  item: WorkItem | null
  onClose: () => void
  onCopiado?: () => void
}) {
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [carregando, setCarregando] = useState(false)
  const [busca, setBusca] = useState('')
  const [selecionadas, setSelecionadas] = useState<string[]>([])
  const [tituloManual, setTituloManual] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')
  const [resultado, setResultado] = useState<CopiarResultado | null>(null)

  const origem = item ? empresaDoItem(item) : null
  const ehTarefa = item?.origem === 'tarefa'
  const itemKey = item?.key

  useEffect(() => {
    if (!itemKey) return
    setBusca('')
    setSelecionadas([])
    setTituloManual(null)
    setErro('')
    setResultado(null)
    if (empresas.length) return
    setCarregando(true)
    apiFetch<Empresa[]>('/api/empresas')
      .then((rows) => setEmpresas(rows.filter((e) => e.ativa)))
      .catch(() => setErro('Não foi possível carregar as empresas'))
      .finally(() => setCarregando(false))
  }, [itemKey, empresas.length])

  useEffect(() => {
    if (!itemKey) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !enviando) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [itemKey, enviando, onClose])

  const filtradas = useMemo(() => {
    const termo = normaliza(busca.trim())
    const digitos = busca.replace(/\D/g, '')
    return empresas
      .filter((e) => {
        if (!termo) return true
        if (digitos.length >= 2 && e.cnpj?.replace(/\D/g, '').startsWith(digitos)) return true
        return normaliza(`${e.razao_social} ${e.nome_fantasia ?? ''} ${e.bu ?? ''}`).includes(termo)
      })
      .sort((a, b) => a.razao_social.localeCompare(b.razao_social, 'pt-BR'))
  }, [empresas, busca])

  const porId = useMemo(() => new Map(empresas.map((e) => [e.id, e])), [empresas])

  if (!item) return null

  const tituloOrigem = item.tarefa?.titulo ?? ''
  const unica = selecionadas.length === 1 ? porId.get(selecionadas[0]) : undefined
  const tituloAuto = unica ? trocarNomeEmpresa(tituloOrigem, origem, unica) : tituloOrigem
  const previews = selecionadas
    .slice(0, 3)
    .map((id) => porId.get(id))
    .filter((e): e is Empresa => Boolean(e))
    .map((e) => trocarNomeEmpresa(tituloOrigem, origem, e))

  const alternar = (id: string) => {
    setTituloManual(null)
    setSelecionadas((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const marcarVisiveis = () => {
    setTituloManual(null)
    setSelecionadas((prev) => {
      const set = new Set(prev)
      for (const e of filtradas) if (e.id !== origem?.id) set.add(e.id)
      return [...set]
    })
  }

  const copiar = async () => {
    if (!selecionadas.length || enviando) return
    setEnviando(true)
    setErro('')
    try {
      const titulo = ehTarefa && unica && tituloManual?.trim() ? tituloManual.trim() : undefined
      const res = await apiFetch<CopiarResultado>(
        `/api/${ehTarefa ? 'tarefas' : 'obrigacoes'}/${item.id}/copiar`,
        { method: 'POST', body: JSON.stringify({ empresa_ids: selecionadas, titulo }) },
      )
      setResultado(res)
      if (res.criadas > 0) onCopiado?.()
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Falha ao copiar')
    } finally {
      setEnviando(false)
    }
  }

  const nomeEmpresa = (id: string) => {
    const e = porId.get(id)
    return e ? e.nome_fantasia || e.razao_social : 'Empresa'
  }

  return (
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
        aria-labelledby="copiar-titulo"
        className="relative z-10 flex max-h-[min(44rem,92dvh)] w-full max-w-xl flex-col rounded-[1.25rem] border border-[color:var(--color-line)] bg-white shadow-2xl dark:bg-[color:var(--color-panel)]"
      >
        <div className="flex items-start justify-between gap-3 border-b border-[color:var(--color-line)] p-5">
          <div className="flex min-w-0 items-center gap-3">
            <EmpresaLogo empresa={origem} size="md" />
            <div className="min-w-0">
              <h2 id="copiar-titulo" className="text-lg font-semibold text-[color:var(--color-ink)]">
                Copiar {ehTarefa ? 'tarefa' : 'obrigação'} para outras empresas
              </h2>
              <p className="truncate text-sm font-medium text-[color:var(--color-ink)]">
                {ehTarefa ? item.title : item.subtitle}
              </p>
              <p className="truncate text-xs text-[color:var(--color-muted)]">
                {origem?.razao_social ?? 'Sem empresa'}
                {item.prazo ? ` · prazo ${formatDate(item.prazo)}` : ''}
                {item.obrigacao?.competencia
                  ? ` · competência ${formatCompetencia(item.obrigacao.competencia)}`
                  : ''}
              </p>
            </div>
          </div>
          <button type="button" className="btn-ghost !p-2" onClick={onClose} disabled={enviando}>
            <X className="h-4 w-4" />
          </button>
        </div>

        {resultado ? (
          <div className="space-y-3 p-5">
            <p className="flex items-center gap-2 text-sm font-semibold text-[color:var(--color-ink)]">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              {plural(resultado.criadas, 'cópia criada', 'cópias criadas')}
              {resultado.ignoradas.length > 0 &&
                `, ${plural(resultado.ignoradas.length, 'ignorada', 'ignoradas')}`}
            </p>
            {resultado.ignoradas.length > 0 && (
              <ul className="max-h-56 space-y-1 overflow-y-auto text-xs text-[color:var(--color-muted)]">
                {resultado.ignoradas.map((i) => (
                  <li key={i.empresa_id} className="rounded-lg bg-[color:var(--control-bg)] px-3 py-1.5">
                    <span className="font-semibold text-[color:var(--color-ink)]">
                      {nomeEmpresa(i.empresa_id)}
                    </span>{' '}
                    — {i.motivo}
                  </li>
                ))}
              </ul>
            )}
            <div className="flex justify-end">
              <button type="button" className="btn-primary" onClick={onClose}>
                Fechar
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="space-y-2.5 px-5 pt-4">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[color:var(--color-muted)]" />
                <input
                  type="search"
                  autoFocus
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar empresa por nome, CNPJ ou BU"
                  className="glass-control"
                />
              </div>
              <div className="flex items-center justify-between text-[11px] text-[color:var(--color-muted)]">
                <span>{plural(selecionadas.length, 'empresa selecionada', 'empresas selecionadas')}</span>
                <span className="flex gap-3">
                  <button type="button" className="font-semibold text-brand-600 hover:underline" onClick={marcarVisiveis}>
                    Marcar visíveis
                  </button>
                  {selecionadas.length > 0 && (
                    <button
                      type="button"
                      className="font-semibold text-[color:var(--color-muted)] hover:underline"
                      onClick={() => setSelecionadas([])}
                    >
                      Limpar
                    </button>
                  )}
                </span>
              </div>
            </div>

            <ul className="mx-5 mt-2 min-h-[10rem] flex-1 space-y-1 overflow-y-auto overscroll-contain pr-1 [scrollbar-width:thin]">
              {carregando && (
                <li className="py-6 text-center text-sm text-[color:var(--color-muted)]">Carregando empresas…</li>
              )}
              {!carregando && filtradas.length === 0 && (
                <li className="py-6 text-center text-sm text-[color:var(--color-muted)]">Nenhuma empresa encontrada.</li>
              )}
              {filtradas.map((e) => {
                const ehOrigem = e.id === origem?.id
                const marcada = selecionadas.includes(e.id)
                return (
                  <li key={e.id}>
                    <button
                      type="button"
                      disabled={ehOrigem}
                      onClick={() => alternar(e.id)}
                      className={[
                        'flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-left text-sm transition',
                        marcada
                          ? 'border-brand-500/60 bg-brand-500/10'
                          : 'border-transparent hover:bg-[color:var(--nav-hover)]',
                        ehOrigem ? 'cursor-not-allowed opacity-50' : '',
                      ].join(' ')}
                    >
                      <span
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                          marcada ? 'border-brand-500 bg-brand-500 text-white' : 'border-[color:var(--color-line)]'
                        }`}
                      >
                        {marcada && <Check className="h-3 w-3" strokeWidth={3} />}
                      </span>
                      <EmpresaLogo empresa={e} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-[color:var(--color-ink)]">
                          {e.razao_social}
                        </span>
                        <span className="block truncate text-[11px] text-[color:var(--color-muted)]">
                          {[e.cnpj, e.bu].filter(Boolean).join(' · ')}
                        </span>
                      </span>
                      {ehOrigem && (
                        <span className="shrink-0 text-[10px] font-bold uppercase text-[color:var(--color-muted)]">
                          Origem
                        </span>
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>

            <div className="space-y-3 border-t border-[color:var(--color-line)] p-5">
              {ehTarefa && selecionadas.length > 0 && (
                unica ? (
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-[color:var(--color-muted)]">
                      Título da cópia
                    </span>
                    <input
                      value={tituloManual ?? tituloAuto}
                      onChange={(e) => setTituloManual(e.target.value)}
                      maxLength={200}
                      className="glass-input"
                    />
                  </label>
                ) : (
                  <div className="text-xs text-[color:var(--color-muted)]">
                    <p className="mb-1 font-medium">Títulos das cópias</p>
                    <ul className="space-y-0.5">
                      {previews.map((t, i) => (
                        <li key={`${t}-${i}`} className="truncate text-[color:var(--color-ink)]">
                          {t}
                        </li>
                      ))}
                      {selecionadas.length > previews.length && (
                        <li>+ {selecionadas.length - previews.length} outras</li>
                      )}
                    </ul>
                  </div>
                )
              )}
              {!ehTarefa && (
                <p className="text-xs text-[color:var(--color-muted)]">
                  Copia atividade, competência, prazos e responsáveis. As cópias começam como Pendente.
                </p>
              )}
              {erro && <p className="rounded-xl bg-rose-50/90 px-3 py-2 text-sm text-rose-700">{erro}</p>}
              <div className="flex justify-end gap-2">
                <button type="button" className="btn-ghost" onClick={onClose} disabled={enviando}>
                  Cancelar
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  disabled={!selecionadas.length || enviando}
                  onClick={() => void copiar()}
                >
                  <Copy className="h-4 w-4" strokeWidth={1.75} />
                  {enviando
                    ? 'Copiando…'
                    : `Copiar para ${plural(selecionadas.length, 'empresa', 'empresas')}`}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
