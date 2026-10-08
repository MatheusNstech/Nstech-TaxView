import { AlertTriangle, ArrowUpRight, Building, ClipboardCheck, Info, Pencil, Users, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import type { EmpresaGrupo, EmpresaUnidade } from '../../types'
import PersonAvatar from '../PersonAvatar'
import { CapaFundo, EmailsContasPagar, NomesContabil, Vazio, buTheme } from './EmpresaCard'

const SAIDA_MS = 220

interface Props {
  grupo: EmpresaGrupo | null
  canEdit: boolean
  onClose: () => void
  onEdit: (grupo: EmpresaGrupo) => void
  onVerObrigacoes: (grupo: EmpresaGrupo, apenasAtrasadas: boolean) => void
}

function Bloco({
  icon: Icon,
  titulo,
  extra,
  children,
  visivel,
  ordem,
}: {
  icon: typeof Users
  titulo: string
  extra?: ReactNode
  children: ReactNode
  visivel: boolean
  ordem: number
}) {
  const style: CSSProperties = { transitionDelay: visivel ? `${120 + ordem * 60}ms` : '0ms' }
  return (
    <section
      style={style}
      className={[
        'flex min-w-0 flex-col rounded-2xl border border-[color:var(--color-line)] p-4 transition duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]',
        visivel ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0',
      ].join(' ')}
    >
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

function Subtitulo({ children }: { children: ReactNode }) {
  return <p className="mb-2 text-xs font-medium text-[color:var(--color-muted)]">{children}</p>
}

function Indicador({
  rotulo,
  children,
  alerta = false,
  onClick,
  title,
}: {
  rotulo: string
  children: ReactNode
  alerta?: boolean
  onClick?: () => void
  title?: string
}) {
  const conteudo = (
    <>
      <p className="flex items-center gap-1 text-[11px] text-[color:var(--color-muted)]">
        {rotulo}
        {onClick && (
          <ArrowUpRight
            className="h-3 w-3 opacity-0 transition group-hover/ind:opacity-100"
            strokeWidth={2.25}
          />
        )}
      </p>
      <div
        className={`flex items-center gap-1 text-base font-semibold leading-tight ${
          alerta ? 'text-[#B71D18] dark:text-[#FF8A75]' : 'text-[color:var(--color-ink)]'
        }`}
      >
        {children}
      </div>
    </>
  )
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        title={title}
        className="group/ind px-5 py-2.5 text-left transition hover:bg-[color:var(--nav-hover)]"
      >
        {conteudo}
      </button>
    )
  }
  return <div className="px-5 py-2.5">{conteudo}</div>
}

function UnidadeLinha({ unidade }: { unidade: EmpresaUnidade }) {
  const [aberta, setAberta] = useState(false)
  const contabil = unidade.contatos.filter((c) => c.area === 'contabil')
  const pagar = unidade.contatos.filter((c) => c.area === 'contas_pagar')
  const nome = unidade.nome_fantasia || unidade.razao_social
  return (
    <li className="rounded-lg px-2 py-1.5 transition hover:bg-[color:var(--color-surface)]">
      <div className="flex items-center gap-2">
        <span className="shrink-0 font-mono text-[11px] text-[color:var(--color-ink)]">{unidade.cnpj}</span>
        <span
          className={`shrink-0 rounded px-1.5 py-px text-[10px] font-semibold uppercase ${
            unidade.matriz
              ? 'bg-[color:var(--color-ink)] text-[color:var(--color-panel)]'
              : 'bg-[color:var(--color-surface)] text-[color:var(--color-muted)]'
          }`}
        >
          {unidade.matriz ? 'Matriz' : 'Filial'}
        </span>
        <span className="min-w-0 flex-1 truncate text-[11px] text-[color:var(--color-muted)]" title={unidade.razao_social}>
          {nome}
        </span>
        {unidade.contatos_diferentes && (
          <button
            type="button"
            onClick={() => setAberta((v) => !v)}
            className={`shrink-0 rounded-md p-0.5 transition hover:text-[color:var(--color-ink)] ${
              aberta ? 'text-[color:var(--color-ink)]' : 'text-amber-600 dark:text-amber-400'
            }`}
            title="Esta unidade tem responsáveis próprios"
            aria-label={`Responsáveis próprios de ${unidade.cnpj}`}
            aria-expanded={aberta}
          >
            <Info className="h-3.5 w-3.5" strokeWidth={2} />
          </button>
        )}
      </div>
      {aberta && (
        <div className="mt-1.5 space-y-1 border-t border-dashed border-[color:var(--color-line)] pt-1.5">
          {contabil.length > 0 && (
            <p className="text-[11px] text-[color:var(--color-muted)]">
              Contábil: <span className="text-[color:var(--color-ink)]">{contabil.map((c) => c.nome).join(', ')}</span>
            </p>
          )}
          {pagar.length > 0 && <EmailsContasPagar contatos={pagar} />}
        </div>
      )}
    </li>
  )
}

export default function EmpresaDetalheModal({ grupo, canEdit, onClose, onEdit, onVerObrigacoes }: Props) {
  const [atual, setAtual] = useState<EmpresaGrupo | null>(grupo)
  const [visivel, setVisivel] = useState(false)
  const painelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!grupo) return
    setAtual(grupo)
    const id = window.setTimeout(() => {
      // Força o cálculo do estado inicial para a transição de entrada sempre rodar.
      painelRef.current?.getBoundingClientRect()
      setVisivel(true)
    }, 20)
    return () => window.clearTimeout(id)
  }, [grupo])

  const fechar = useCallback(
    (depois?: () => void) => {
      setVisivel(false)
      window.setTimeout(() => {
        setAtual(null)
        ;(depois ?? onClose)()
      }, SAIDA_MS)
    },
    [onClose],
  )

  useEffect(() => {
    if (!atual) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') fechar()
    }
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = overflow
      window.removeEventListener('keydown', onKey)
    }
  }, [atual, fechar])

  if (!atual) return null

  const theme = buTheme(atual.bus[0])
  const cnpjs = 1 + atual.filiais.length
  const pct = atual.obrigacoes_total
    ? Math.round((atual.obrigacoes_entregues / atual.obrigacoes_total) * 100)
    : 0
  const maxFiscal = Math.max(1, ...atual.responsaveis_fiscais.map((r) => r.total))
  const botaoTopo =
    'rounded-lg text-[color:var(--color-muted)] transition hover:bg-[color:var(--nav-hover)] hover:text-[color:var(--color-ink)]'

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={atual.nome}>
      <button
        type="button"
        aria-label="Fechar"
        onClick={() => fechar()}
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
          <div className="relative h-16 w-24 shrink-0 overflow-hidden rounded-xl shadow-sm ring-1 ring-black/5 dark:ring-white/10">
            <CapaFundo
              grupo={atual}
              logoClassName="p-2"
              iniciaisClassName="text-xl"
              className={`transition-transform duration-700 ease-out ${visivel ? 'scale-100' : 'scale-125'}`}
            />
          </div>
          <div
            className={`relative min-w-0 flex-1 transition duration-500 delay-100 ease-out ${
              visivel ? 'translate-x-0 opacity-100' : '-translate-x-2 opacity-0'
            }`}
          >
            <div className="flex min-w-0 items-center gap-2">
              <h2 className="truncate text-xl font-bold text-[color:var(--color-ink)]">{atual.nome}</h2>
              <div className="flex shrink-0 gap-1">
                {atual.bus.map((bu) => (
                  <span
                    key={bu}
                    className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white"
                    style={{ background: buTheme(bu).from }}
                  >
                    {bu}
                  </span>
                ))}
              </div>
            </div>
            <p className="truncate text-sm text-[color:var(--color-muted)]" title={atual.matriz.razao_social}>
              {atual.matriz.razao_social} · <span className="font-mono text-xs">{atual.matriz.cnpj}</span>
            </p>
          </div>
          <div className="relative flex shrink-0 gap-1 self-start">
            {canEdit && (
              <button
                type="button"
                onClick={() => fechar(() => onEdit(atual))}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium ${botaoTopo}`}
              >
                <Pencil className="h-3.5 w-3.5" strokeWidth={2} />
                Editar
              </button>
            )}
            <button type="button" onClick={() => fechar()} className={`p-1.5 ${botaoTopo}`} aria-label="Fechar">
              <X className="h-4 w-4" strokeWidth={2} />
            </button>
          </div>
        </header>

        <div className="grid shrink-0 grid-cols-2 divide-x divide-y divide-[color:var(--color-line)] border-b border-[color:var(--color-line)] sm:grid-cols-4 sm:divide-y-0">
          <Indicador rotulo="Porte">{atual.porte ?? '—'}</Indicador>
          <Indicador rotulo="CNPJs">
            {cnpjs}
            <span className="text-xs font-normal text-[color:var(--color-muted)]">
              {cnpjs === 1 ? 'matriz' : `matriz + ${atual.filiais.length}`}
            </span>
          </Indicador>
          <Indicador
            rotulo="Obrigações no mês"
            title="Ver as obrigações desta empresa no mês"
            onClick={() => onVerObrigacoes(atual, false)}
          >
            <span>
              {atual.obrigacoes_entregues}
              <span className="text-sm font-normal text-[color:var(--color-muted)]">/{atual.obrigacoes_total}</span>
            </span>
            <span className="ml-1.5 h-1.5 flex-1 overflow-hidden rounded-full bg-[color:var(--color-surface)]">
              <span
                className="block h-full rounded-full transition-[width] delay-200 duration-700 ease-out"
                style={{ width: visivel ? `${pct}%` : '0%', background: theme.from }}
              />
            </span>
          </Indicador>
          <Indicador
            rotulo="Atrasadas"
            alerta={atual.obrigacoes_atrasadas > 0}
            title="Ver as obrigações atrasadas desta empresa"
            onClick={atual.obrigacoes_atrasadas > 0 ? () => onVerObrigacoes(atual, true) : undefined}
          >
            {atual.obrigacoes_atrasadas > 0 && <AlertTriangle className="h-4 w-4" strokeWidth={2} />}
            {atual.obrigacoes_atrasadas}
          </Indicador>
        </div>

        <div className="grid min-h-0 flex-1 items-start gap-4 overflow-y-auto p-5 md:grid-cols-2 lg:grid-cols-3">
          <Bloco icon={Users} titulo="Responsáveis da empresa" visivel={visivel} ordem={0}>
            <Subtitulo>Contábil</Subtitulo>
            <NomesContabil contatos={atual.contatos.contabil} />
            <div className="mt-3 border-t border-[color:var(--color-line)] pt-3">
              <Subtitulo>Contas a pagar</Subtitulo>
              <EmailsContasPagar contatos={atual.contatos.contas_pagar} />
            </div>
          </Bloco>

          <Bloco
            icon={ClipboardCheck}
            titulo="Time fiscal"
            visivel={visivel}
            ordem={1}
            extra={
              atual.responsaveis_fiscais.length > 0 && (
                <span className="text-[11px] text-[color:var(--color-muted)]">no mês</span>
              )
            }
          >
            {atual.responsaveis_fiscais.length === 0 ? (
              <Vazio texto="Sem obrigações no mês" />
            ) : (
              <ul className="space-y-2.5">
                {atual.responsaveis_fiscais.map((r) => (
                  <li key={r.id} className="flex items-center gap-2.5">
                    <PersonAvatar nome={r.nome} size="lg" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="truncate text-sm font-medium text-[color:var(--color-ink)]">{r.nome}</span>
                        <span className="shrink-0 text-xs tabular-nums text-[color:var(--color-muted)]">
                          {r.total} {r.total === 1 ? 'obrigação' : 'obrigações'}
                        </span>
                      </div>
                      <div className="mt-1 h-1 overflow-hidden rounded-full bg-[color:var(--color-surface)]">
                        <div
                          className="h-full rounded-full opacity-70 transition-[width] delay-300 duration-700 ease-out"
                          style={{
                            width: visivel ? `${(r.total / maxFiscal) * 100}%` : '0%',
                            background: theme.from,
                          }}
                        />
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Bloco>

          <Bloco
            icon={Building}
            titulo={atual.filiais.length ? 'Matriz e filiais' : 'Matriz'}
            visivel={visivel}
            ordem={2}
          >
            <ul className="-mx-2 space-y-0.5">
              <UnidadeLinha unidade={atual.matriz} />
              {atual.filiais.map((f) => (
                <UnidadeLinha key={f.id} unidade={f} />
              ))}
            </ul>
          </Bloco>
        </div>
      </div>
    </div>
  )
}
