import {
  AlertTriangle,
  Building,
  Calculator,
  Check,
  ChevronDown,
  ClipboardCheck,
  Copy,
  Pencil,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import { useState, type ReactNode } from 'react'
import type { EmpresaContato, EmpresaGrupo, EmpresaUnidade } from '../../types'

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

function iniciais(nome: string): string {
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
        className="min-w-0 flex-1 truncate text-xs text-[color:var(--color-ink)] hover:text-brand-600 hover:underline"
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

function Secao({
  icon: Icon,
  titulo,
  children,
}: {
  icon: LucideIcon
  titulo: string
  children: ReactNode
}) {
  return (
    <div className="flex gap-3">
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[color:var(--color-surface)] text-[color:var(--color-muted)]">
        <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--color-muted)]">
          {titulo}
        </p>
        <div className="mt-1">{children}</div>
      </div>
    </div>
  )
}

function Vazio({ texto = 'Não informado' }: { texto?: string }) {
  return <p className="text-xs italic text-[color:var(--color-muted)]">{texto}</p>
}

function NomesContabil({ contatos }: { contatos: EmpresaContato[] }) {
  const nomes = contatos.filter((c) => c.nome)
  if (nomes.length === 0) return <Vazio />
  return (
    <div className="flex flex-wrap gap-1.5">
      {nomes.map((c) => (
        <span
          key={c.id}
          className="rounded-full bg-[color:var(--color-surface)] px-2.5 py-0.5 text-xs font-medium text-[color:var(--color-ink)]"
        >
          {c.nome}
        </span>
      ))}
    </div>
  )
}

function EmailsContasPagar({ contatos }: { contatos: EmpresaContato[] }) {
  const emails = contatos.filter((c) => c.email)
  if (emails.length === 0) return <Vazio />
  return (
    <ul className="space-y-0.5">
      {emails.map((c) => (
        <CopyEmail key={c.id} email={c.email!} />
      ))}
    </ul>
  )
}

function Filial({ unidade }: { unidade: EmpresaUnidade }) {
  const contabil = unidade.contatos.filter((c) => c.area === 'contabil')
  const pagar = unidade.contatos.filter((c) => c.area === 'contas_pagar')
  return (
    <li className="rounded-xl border border-[color:var(--color-line)] px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[11px] text-[color:var(--color-muted)]">{unidade.cnpj}</span>
        <span className="rounded-full bg-[color:var(--color-surface)] px-2 py-0.5 text-[10px] font-medium text-[color:var(--color-muted)]">
          {unidade.bu}
        </span>
      </div>
      <p className="mt-0.5 truncate text-xs text-[color:var(--color-ink)]" title={unidade.razao_social}>
        {unidade.nome_fantasia || unidade.razao_social}
      </p>
      {unidade.contatos_diferentes && (
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

interface EmpresaCardProps {
  grupo: EmpresaGrupo
  canEdit: boolean
  onEdit: (grupo: EmpresaGrupo) => void
}

export default function EmpresaCard({ grupo, canEdit, onEdit }: EmpresaCardProps) {
  const [filiaisOpen, setFiliaisOpen] = useState(false)
  const theme = buTheme(grupo.bus[0])
  const fiscais = grupo.responsaveis_fiscais
  const filiaisDiferentes = grupo.filiais.filter((f) => f.contatos_diferentes).length

  return (
    <article className="card-surface flex flex-col overflow-hidden transition-shadow hover:shadow-lg">
      <div
        className="relative h-24 shrink-0"
        style={{ background: `linear-gradient(135deg, ${theme.from} 0%, ${theme.to} 100%)` }}
      >
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              'radial-gradient(circle at 20% 120%, rgba(255,255,255,0.55) 0, transparent 45%), radial-gradient(circle at 85% -10%, rgba(255,255,255,0.4) 0, transparent 40%)',
          }}
        />
        <div className="absolute left-3 top-3 flex flex-wrap gap-1">
          {grupo.bus.map((bu) => (
            <span
              key={bu}
              className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white backdrop-blur-sm"
            >
              {bu}
            </span>
          ))}
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={() => onEdit(grupo)}
            className="absolute right-3 top-3 rounded-lg bg-white/20 p-1.5 text-white backdrop-blur-sm transition hover:bg-white/35"
            aria-label={`Editar ${grupo.nome}`}
            title="Editar responsáveis"
          >
            <Pencil className="h-3.5 w-3.5" strokeWidth={2} />
          </button>
        )}
      </div>

      <div className="-mt-9 flex justify-center">
        <div className="flex h-[4.5rem] w-[4.5rem] items-center justify-center overflow-hidden rounded-full border-4 border-[color:var(--color-panel)] bg-[color:var(--color-panel)] shadow-md">
          {grupo.logo_url ? (
            <img src={grupo.logo_url} alt="" className="h-full w-full object-contain p-1.5" />
          ) : (
            <span
              className="flex h-full w-full items-center justify-center text-lg font-bold"
              style={{ color: theme.ink, background: `${theme.from}1f` }}
            >
              {iniciais(grupo.nome)}
            </span>
          )}
        </div>
      </div>

      <div className="px-5 pt-2 text-center">
        <h3 className="truncate text-base font-semibold text-[color:var(--color-ink)]" title={grupo.nome}>
          {grupo.nome}
        </h3>
        <p className="truncate text-xs text-[color:var(--color-muted)]" title={grupo.matriz.razao_social}>
          {grupo.matriz.razao_social}
        </p>
        <p className="mt-0.5 font-mono text-[11px] text-[color:var(--color-muted)]">{grupo.matriz.cnpj}</p>
        {grupo.filiais.length > 0 && (
          <button
            type="button"
            onClick={() => setFiliaisOpen((v) => !v)}
            className="mt-2 inline-flex items-center gap-1 rounded-full border border-[color:var(--color-line)] px-2.5 py-0.5 text-[11px] font-medium text-[color:var(--color-ink)] transition hover:bg-[color:var(--nav-hover)]"
            aria-expanded={filiaisOpen}
          >
            <Building className="h-3 w-3" strokeWidth={1.75} />
            +{grupo.filiais.length} {grupo.filiais.length === 1 ? 'filial' : 'filiais'}
            {filiaisDiferentes > 0 && (
              <span className="h-1.5 w-1.5 rounded-full bg-brand-500" title="Filial com contato próprio" />
            )}
            <ChevronDown
              className={`h-3 w-3 transition-transform ${filiaisOpen ? 'rotate-180' : ''}`}
              strokeWidth={2}
            />
          </button>
        )}
      </div>

      {filiaisOpen && (
        <ul className="mx-5 mt-3 space-y-1.5">
          {grupo.filiais.map((f) => (
            <Filial key={f.id} unidade={f} />
          ))}
        </ul>
      )}

      <div className="mt-4 flex-1 space-y-3 border-t border-[color:var(--color-line)] px-5 py-4">
        <Secao icon={Calculator} titulo="Contábil">
          <NomesContabil contatos={grupo.contatos.contabil} />
        </Secao>
        <Secao icon={Wallet} titulo="Contas a pagar">
          <EmailsContasPagar contatos={grupo.contatos.contas_pagar} />
        </Secao>
        <Secao icon={ClipboardCheck} titulo="Fiscal">
          {fiscais.length === 0 ? (
            <Vazio texto="Sem obrigações no mês" />
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {fiscais.slice(0, 4).map((r) => (
                <span
                  key={r.id}
                  className="inline-flex items-center gap-1.5 rounded-full bg-[color:var(--color-surface)] py-0.5 pl-0.5 pr-2.5 text-xs font-medium text-[color:var(--color-ink)]"
                  title={`${r.nome}: ${r.total} obrigação(ões) no mês`}
                >
                  <span
                    className="flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold text-white"
                    style={{ background: theme.from }}
                  >
                    {iniciais(r.nome)}
                  </span>
                  {r.nome.split(' ')[0]}
                </span>
              ))}
              {fiscais.length > 4 && (
                <span
                  className="rounded-full bg-[color:var(--color-surface)] px-2 py-0.5 text-xs text-[color:var(--color-muted)]"
                  title={fiscais
                    .slice(4)
                    .map((r) => r.nome)
                    .join(', ')}
                >
                  +{fiscais.length - 4}
                </span>
              )}
            </div>
          )}
        </Secao>
      </div>

      <div className="grid grid-cols-3 divide-x divide-[color:var(--color-line)] border-t border-[color:var(--color-line)] py-3 text-center">
        <div>
          <p className="text-[11px] text-[color:var(--color-muted)]">Porte</p>
          <p className="mt-0.5 text-sm font-semibold text-[color:var(--color-ink)]">{grupo.porte ?? '—'}</p>
        </div>
        <div>
          <p className="text-[11px] text-[color:var(--color-muted)]">Obrigações</p>
          <p className="mt-0.5 text-sm font-semibold text-[color:var(--color-ink)]">
            {grupo.obrigacoes_entregues}
            <span className="font-normal text-[color:var(--color-muted)]">/{grupo.obrigacoes_total}</span>
          </p>
        </div>
        <div>
          <p className="text-[11px] text-[color:var(--color-muted)]">Atrasadas</p>
          <p
            className={`mt-0.5 inline-flex items-center gap-1 text-sm font-semibold ${
              grupo.obrigacoes_atrasadas > 0 ? 'text-[#B71D18] dark:text-[#FF8A75]' : 'text-[color:var(--color-ink)]'
            }`}
          >
            {grupo.obrigacoes_atrasadas > 0 && <AlertTriangle className="h-3.5 w-3.5" strokeWidth={2} />}
            {grupo.obrigacoes_atrasadas}
          </p>
        </div>
      </div>
    </article>
  )
}
