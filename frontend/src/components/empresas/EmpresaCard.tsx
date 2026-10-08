import {
  AlertTriangle,
  ArrowUpRight,
  Building,
  Check,
  ClipboardCheck,
  Copy,
  Pencil,
  type LucideIcon,
} from 'lucide-react'
import { useState, type ReactNode } from 'react'
import type { EmpresaContato, EmpresaGrupo } from '../../types'
const BU_THEME: Record<string, { from: string; to: string; ink: string }> = {
  TMS: { from: '#FF6B2C', to: '#B7380C', ink: '#B7380C' },
  Embarcador: { from: '#1D7BF2', to: '#0B3F8F', ink: '#0B4FB3' },
  PSL: { from: '#7C4DFF', to: '#3E1F9E', ink: '#5B35D5' },
  Fintech: { from: '#13B38B', to: '#06664F', ink: '#08795E' },
  Corporativo: { from: '#334155', to: '#0F172A', ink: '#334155' },
  Plataforma: { from: '#E5459B', to: '#8C1757', ink: '#B0236E' },
}
const FALLBACK_THEME = { from: '#64748B', to: '#1E293B', ink: '#475569' }

export function buTheme(bu: string | undefined) {
  return (bu && BU_THEME[bu]) || FALLBACK_THEME
}

export function iniciais(nome: string): string {
  const partes = nome
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean)
  if (partes.length === 0) return '?'
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase()
  return (partes[0][0] + partes[1][0]).toUpperCase()
}

function CopyEmail({ email }: { email: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <li className="group flex min-w-0 items-center gap-1.5">
      <a
        href={`mailto:${email}`}
        className="min-w-0 flex-1 truncate text-sm text-[color:var(--color-ink)] hover:text-brand-600 hover:underline"
        title={email}
      >
        {email}
      </a>
      <button
        type="button"
        onClick={() => {
          void navigator.clipboard?.writeText(email).then(() => {
            setCopied(true)
            window.setTimeout(() => setCopied(false), 1500)
          })
        }}
        className="shrink-0 rounded-md p-1 text-[color:var(--color-muted)] opacity-60 transition hover:bg-[color:var(--nav-hover)] hover:text-[color:var(--color-ink)] group-hover:opacity-100"
        aria-label={`Copiar ${email}`}
        title="Copiar e-mail"
      >
        {copied ? (
          <Check className="h-3.5 w-3.5 text-emerald-600" strokeWidth={2} />
        ) : (
          <Copy className="h-3.5 w-3.5" strokeWidth={1.75} />
        )}
      </button>
    </li>
  )
}

export function Vazio({ texto = 'Não informado' }: { texto?: string }) {
  return <p className="text-xs italic text-[color:var(--color-muted)]">{texto}</p>
}

export function NomesContabil({ contatos }: { contatos: EmpresaContato[] }) {
  const nomes = contatos.filter((c) => c.nome)
  if (nomes.length === 0) return <Vazio />
  return (
    <div className="flex flex-wrap gap-1.5">
      {nomes.map((c) => (
        <span
          key={c.id}
          className="rounded-full bg-[color:var(--color-surface)] px-3 py-1 text-sm font-semibold text-[color:var(--color-ink)]"
        >
          {c.nome}
        </span>
      ))}
    </div>
  )
}

export function EmailsContasPagar({ contatos }: { contatos: EmpresaContato[] }) {
  const emails = contatos.filter((c) => c.email)
  if (emails.length === 0) return <Vazio />
  return (
    <ul className="space-y-1">
      {emails.map((c) => (
        <CopyEmail key={c.id} email={c.email!} />
      ))}
    </ul>
  )
}

export function Chip({ icon: Icon, children, tone = 'neutro', title, onClick }: {
  icon: LucideIcon
  children: ReactNode
  tone?: 'neutro' | 'alerta'
  title?: string
  onClick?: () => void
}) {
  const className = [
    'inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium',
    tone === 'alerta'
      ? 'bg-[#FF5630]/12 text-[#B71D18] dark:text-[#FF8A75]'
      : 'bg-[color:var(--color-surface)] text-[color:var(--color-ink)]',
    onClick ? 'cursor-pointer transition hover:ring-1 hover:ring-current' : '',
  ].join(' ')
  const conteudo = (
    <>
      <Icon className="h-3.5 w-3.5 opacity-70" strokeWidth={1.75} />
      {children}
    </>
  )
  if (onClick) {
    return (
      <button type="button" title={title} onClick={onClick} className={className}>
        {conteudo}
      </button>
    )
  }
  return (
    <span title={title} className={className}>
      {conteudo}
    </span>
  )
}

export function CapaFundo({
  grupo,
  className = '',
  logoClassName = 'p-[14%]',
  iniciaisClassName = 'text-5xl',
}: {
  grupo: EmpresaGrupo
  className?: string
  logoClassName?: string
  iniciaisClassName?: string
}) {
  const theme = buTheme(grupo.bus[0])
  if (grupo.logo_url) {
    const temEscuro = Boolean(grupo.logo_url_escuro)
    const img = `absolute inset-0 h-full w-full object-contain ${logoClassName}`
    return (
      <div
        className={`relative h-full w-full ${
          temEscuro ? 'bg-white dark:bg-[color:var(--color-panel)]' : 'bg-white'
        } ${className}`}
      >
        <div
          className="absolute inset-0 opacity-[0.07] dark:opacity-[0.14]"
          style={{ background: `linear-gradient(135deg, ${theme.from} 0%, ${theme.to} 100%)` }}
        />
        <img
          src={grupo.logo_url}
          alt={grupo.nome}
          className={`${img} ${temEscuro ? 'dark:hidden' : ''}`}
          loading="lazy"
        />
        {temEscuro && (
          <img
            src={grupo.logo_url_escuro!}
            alt={grupo.nome}
            className={`${img} hidden dark:block`}
            loading="lazy"
          />
        )}
      </div>
    )
  }
  return (
    <div
      className={`relative h-full w-full ${className}`}
      style={{ background: `linear-gradient(135deg, ${theme.from} 0%, ${theme.to} 100%)` }}
    >
      <div
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            'radial-gradient(circle at 15% 115%, rgba(255,255,255,0.5) 0, transparent 45%), radial-gradient(circle at 90% -10%, rgba(255,255,255,0.35) 0, transparent 40%)',
        }}
      />
      <span
        className={`absolute inset-0 flex items-center justify-center font-bold tracking-tight text-white/90 drop-shadow-sm ${iniciaisClassName}`}
      >
        {iniciais(grupo.nome)}
      </span>
    </div>
  )
}

/** Estilo dos controles sobre a capa: claro quando há logo, escuro sobre o degradê. */
export function estiloSobreCapa(temLogo: boolean): string {
  return temLogo
    ? 'bg-white/85 text-slate-700 ring-1 ring-black/5 hover:bg-white dark:bg-white/10 dark:text-white/90 dark:ring-white/10 dark:hover:bg-white/20'
    : 'bg-black/25 text-white hover:bg-black/40'
}

interface EmpresaCardProps {
  grupo: EmpresaGrupo
  canEdit: boolean
  onEdit: (grupo: EmpresaGrupo) => void
  onOpen: (grupo: EmpresaGrupo) => void
  onVerObrigacoes: (grupo: EmpresaGrupo, apenasAtrasadas: boolean) => void
}

export default function EmpresaCard({ grupo, canEdit, onEdit, onOpen, onVerObrigacoes }: EmpresaCardProps) {
  const cnpjs = 1 + grupo.filiais.length
  const temLogo = Boolean(grupo.logo_url)

  return (
    <article className="card-surface group flex h-full flex-col p-3 transition duration-300 hover:-translate-y-0.5 hover:shadow-lg">
      <div className="relative aspect-[16/9] overflow-hidden rounded-xl ring-1 ring-inset ring-black/5 dark:ring-white/5">
        <button
          type="button"
          onClick={() => onOpen(grupo)}
          className="block h-full w-full"
          aria-label={`Ver detalhes de ${grupo.nome}`}
        >
          <CapaFundo
            grupo={grupo}
            logoClassName="px-[18%] py-[14%]"
            className="transition-transform duration-500 group-hover:scale-[1.04]"
          />
        </button>
        {canEdit && (
          <button
            type="button"
            onClick={() => onEdit(grupo)}
            className={`absolute right-2.5 top-2.5 rounded-lg p-1.5 opacity-0 backdrop-blur-sm transition group-hover:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100 ${estiloSobreCapa(temLogo)}`}
            aria-label={`Editar ${grupo.nome}`}
            title="Editar"
          >
            <Pencil className="h-3.5 w-3.5" strokeWidth={2} />
          </button>
        )}
      </div>

      <div className="mt-3 flex flex-nowrap gap-1.5 overflow-hidden px-1">
        <Chip icon={Building} title={cnpjs === 1 ? 'Somente matriz' : `Matriz + ${grupo.filiais.length} filial(is)`}>
          {cnpjs} {cnpjs === 1 ? 'CNPJ' : 'CNPJs'}
        </Chip>
        <Chip
          icon={ClipboardCheck}
          title="Ver obrigações do mês (entregues / total)"
          onClick={() => onVerObrigacoes(grupo, false)}
        >
          {grupo.obrigacoes_entregues}/{grupo.obrigacoes_total}
        </Chip>
        {grupo.obrigacoes_atrasadas > 0 && (
          <Chip
            icon={AlertTriangle}
            tone="alerta"
            title="Ver obrigações atrasadas"
            onClick={() => onVerObrigacoes(grupo, true)}
          >
            {grupo.obrigacoes_atrasadas}
          </Chip>
        )}
      </div>

      <div className="mb-3 mt-2.5 min-h-[2.75rem] px-1">
        <h3 className="line-clamp-1 text-[15px] font-semibold text-[color:var(--color-ink)]" title={grupo.nome}>
          {grupo.nome}
        </h3>
        <p className="truncate text-xs text-[color:var(--color-muted)]" title={grupo.matriz.razao_social}>
          {grupo.matriz.razao_social}
        </p>
      </div>

      <div className="mt-auto flex items-center justify-between gap-2 border-t border-[color:var(--color-line)] px-1 pt-3">
        <div className="min-w-0">
          <p className="text-[11px] text-[color:var(--color-muted)]">Porte</p>
          <p className="text-base font-semibold leading-tight text-[color:var(--color-ink)]">
            {grupo.porte ?? '—'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onOpen(grupo)}
          className="btn-responsaveis"
        >
          Responsáveis
          <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={2.25} />
        </button>
      </div>
    </article>
  )
}

