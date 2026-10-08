import { X } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import type { Empresa } from '../types'
import { buTheme } from './empresas/EmpresaCard'
import EmpresaLogo from './empresas/EmpresaLogo'

export const ROTULO = 'mb-1.5 block text-xs font-medium text-[color:var(--color-muted)]'

export function Bloco({
  icon: Icon,
  titulo,
  extra,
  className = '',
  children,
}: {
  icon: typeof X
  titulo: string
  extra?: ReactNode
  className?: string
  children: ReactNode
}) {
  return (
    <section className={`flex min-w-0 flex-col rounded-2xl border border-[color:var(--color-line)] p-4 ${className}`}>
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[color:var(--color-surface)] text-[color:var(--color-muted)]">
          <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
        </span>
        <h3 className="flex-1 text-xs font-semibold uppercase tracking-wide text-[color:var(--color-muted)]">{titulo}</h3>
        {extra}
      </div>
      {children}
    </section>
  )
}

export function Indicador({
  rotulo,
  alerta = false,
  children,
}: {
  rotulo: string
  alerta?: boolean
  children: ReactNode
}) {
  return (
    <div className="min-w-0 px-5 py-2.5">
      <p className="text-[11px] text-[color:var(--color-muted)]">{rotulo}</p>
      <div
        className={`flex min-w-0 items-center gap-1.5 truncate text-base font-semibold leading-tight ${
          alerta ? 'text-[#B71D18] dark:text-[#FF8A75]' : 'text-[color:var(--color-ink)]'
        }`}
      >
        {children}
      </div>
    </div>
  )
}

export function Campo({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-medium text-[color:var(--color-muted)]">{rotulo}</p>
      <div className="mt-0.5 min-w-0 text-sm text-[color:var(--color-ink)]">{children || '—'}</div>
    </div>
  )
}

export function ChipBu({ bu }: { bu: string }) {
  return (
    <span
      className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white"
      style={{ background: buTheme(bu).from }}
    >
      {bu}
    </span>
  )
}

export interface Aba {
  id: string
  rotulo: string
  icon: typeof X
  contador?: number
  conteudo: ReactNode
}

export const BOTAO_TOPO =
  'inline-flex items-center gap-1.5 rounded-lg text-xs font-medium text-[color:var(--color-muted)] transition hover:bg-[color:var(--nav-hover)] hover:text-[color:var(--color-ink)]'

/** Moldura centralizada dos detalhes (mesmo visual do modal da empresa). */
export default function DetalheModal({
  aberto,
  onClose,
  empresa,
  titulo,
  chips,
  subtitulo,
  acoes,
  indicadores,
  rodape,
  abas,
  escapeBloqueado = false,
  children,
}: {
  aberto: boolean
  onClose: () => void
  empresa: Empresa | null | undefined
  titulo: ReactNode
  chips?: ReactNode
  subtitulo?: ReactNode
  acoes?: ReactNode
  indicadores?: ReactNode
  rodape?: ReactNode
  /** Conteúdo em abas; `children` continua visível acima da aba ativa. */
  abas?: Aba[]
  escapeBloqueado?: boolean
  children?: ReactNode
}) {
  const [visivel, setVisivel] = useState(false)
  const [abaId, setAbaId] = useState<string | null>(null)
  const painelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!aberto) {
      setVisivel(false)
      setAbaId(null)
      return
    }
    const id = window.setTimeout(() => {
      // Força o estado inicial para a transição de entrada sempre rodar.
      painelRef.current?.getBoundingClientRect()
      setVisivel(true)
    }, 20)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.clearTimeout(id)
      document.body.style.overflow = overflow
    }
  }, [aberto])

  useEffect(() => {
    if (!aberto || escapeBloqueado) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [aberto, escapeBloqueado, onClose])

  if (!aberto) return null

  const theme = buTheme(empresa?.bu ?? undefined)
  const abaAtiva = abas?.find((a) => a.id === abaId) ?? abas?.[0]

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <button
        type="button"
        aria-label="Fechar"
        onClick={onClose}
        className={`absolute inset-0 cursor-default bg-slate-950/55 backdrop-blur-md transition-opacity duration-300 ${
          visivel ? 'opacity-100' : 'opacity-0'
        }`}
      />
      <div
        ref={painelRef}
        className={[
          'relative z-10 flex max-h-[calc(100dvh-2rem)] w-full max-w-5xl flex-col overflow-hidden rounded-[1.5rem] border border-[color:var(--color-line)] bg-white shadow-2xl dark:bg-[color:var(--color-panel)]',
          'transition duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]',
          visivel ? 'translate-y-0 scale-100 opacity-100' : 'translate-y-6 scale-95 opacity-0',
        ].join(' ')}
      >
        <header className="relative flex shrink-0 items-center gap-4 border-b border-[color:var(--color-line)] px-5 py-4">
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.06] dark:opacity-[0.12]"
            style={{ background: `linear-gradient(100deg, ${theme.from} 0%, transparent 70%)` }}
          />
          <EmpresaLogo empresa={empresa} size="lg" className="relative" />
          <div className="relative min-w-0 flex-1">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <h2 className="min-w-0 truncate text-xl font-bold text-[color:var(--color-ink)]">{titulo}</h2>
              {chips && <div className="flex shrink-0 flex-wrap items-center gap-1">{chips}</div>}
            </div>
            {subtitulo && (
              <div className="mt-0.5 truncate text-sm text-[color:var(--color-muted)]">{subtitulo}</div>
            )}
          </div>
          <div className="relative flex shrink-0 items-center gap-1 self-start">
            {acoes}
            <button type="button" onClick={onClose} className={`p-1.5 ${BOTAO_TOPO}`} aria-label="Fechar">
              <X className="h-4 w-4" strokeWidth={2} />
            </button>
          </div>
        </header>

        {indicadores && (
          <div className="grid shrink-0 grid-cols-2 divide-x divide-y divide-[color:var(--color-line)] border-b border-[color:var(--color-line)] sm:grid-cols-4 sm:divide-y-0">
            {indicadores}
          </div>
        )}

        {abas && abas.length > 0 && (
          <div
            role="tablist"
            className="flex shrink-0 gap-1 overflow-x-auto border-b border-[color:var(--color-line)] px-5 [scrollbar-width:none]"
          >
            {abas.map((aba) => {
              const ativa = aba.id === abaAtiva?.id
              const Icon = aba.icon
              return (
                <button
                  key={aba.id}
                  type="button"
                  role="tab"
                  aria-selected={ativa}
                  onClick={() => setAbaId(aba.id)}
                  className={`-mb-px inline-flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium transition ${
                    ativa
                      ? 'border-brand-500 text-[color:var(--color-ink)]'
                      : 'border-transparent text-[color:var(--color-muted)] hover:text-[color:var(--color-ink)]'
                  }`}
                >
                  <Icon className="h-4 w-4" strokeWidth={1.75} />
                  {aba.rotulo}
                  {aba.contador ? (
                    <span
                      className={`rounded-full px-1.5 text-[10px] font-semibold tabular-nums ${
                        ativa
                          ? 'bg-brand-500/15 text-brand-700 dark:text-brand-300'
                          : 'bg-[color:var(--color-surface)] text-[color:var(--color-muted)]'
                      }`}
                    >
                      {aba.contador}
                    </span>
                  ) : null}
                </button>
              )
            })}
          </div>
        )}

        <div
          role={abaAtiva ? 'tabpanel' : undefined}
          className={`grid flex-1 content-start items-start gap-4 overflow-y-auto p-5 lg:grid-cols-3 [scrollbar-width:thin] ${
            abaAtiva ? 'min-h-[min(22rem,40dvh)]' : 'min-h-0'
          }`}
        >
          {children}
          {abaAtiva?.conteudo}
        </div>

        {rodape && (
          <footer className="flex shrink-0 items-center gap-2 border-t border-[color:var(--color-line)] px-5 py-3.5">
            {rodape}
          </footer>
        )}
      </div>
    </div>,
    document.body,
  )
}
