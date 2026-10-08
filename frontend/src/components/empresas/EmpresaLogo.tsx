import { ClipboardList } from 'lucide-react'
import { useState } from 'react'
import { buTheme, iniciais } from './EmpresaCard'

export interface EmpresaLogoInfo {
  nome?: string | null
  razao_social?: string | null
  nome_fantasia?: string | null
  bu?: string | null
  logo_url?: string | null
  logo_url_escuro?: string | null
}

const SIZE = {
  xs: { box: 'h-5 w-7 rounded-md', pad: 'p-0.5', text: 'text-[8px]', icon: 'h-3 w-3' },
  sm: { box: 'h-7 w-10 rounded-lg', pad: 'p-1', text: 'text-[10px]', icon: 'h-3.5 w-3.5' },
  md: { box: 'h-10 w-14 rounded-xl', pad: 'p-1.5', text: 'text-xs', icon: 'h-4 w-4' },
  lg: { box: 'h-16 w-24 rounded-xl shadow-sm', pad: 'p-2', text: 'text-xl', icon: 'h-7 w-7' },
} as const

/** Link da tela Empresas com o card do grupo (raiz do CNPJ) já aberto. */
export function linkEmpresa(empresa: { id: string; cnpj?: string | null }): string {
  const digitos = (empresa.cnpj ?? '').replace(/\D/g, '')
  const raiz = digitos.length === 14 ? digitos.slice(0, 8) : `id:${empresa.id}`
  return `/empresas?raiz=${encodeURIComponent(raiz)}`
}

export function empresaNome(empresa: EmpresaLogoInfo | null | undefined): string {
  return empresa?.nome || empresa?.nome_fantasia || empresa?.razao_social || ''
}

export default function EmpresaLogo({
  empresa,
  size = 'sm',
  className = '',
}: {
  empresa: EmpresaLogoInfo | null | undefined
  size?: keyof typeof SIZE
  className?: string
}) {
  const [quebrado, setQuebrado] = useState(false)
  const s = SIZE[size]
  const nome = empresaNome(empresa)
  const base = `relative inline-flex shrink-0 items-center justify-center overflow-hidden ${s.box} ${className}`

  if (!empresa) {
    return (
      <span
        className={`${base} bg-brand-500/12 text-brand-600 ring-1 ring-inset ring-brand-500/20`}
        title="Tarefa sem empresa"
      >
        <ClipboardList className={s.icon} strokeWidth={2} />
      </span>
    )
  }

  if (empresa.logo_url && !quebrado) {
    const temEscuro = Boolean(empresa.logo_url_escuro)
    const img = `h-full w-full object-contain ${s.pad}`
    return (
      <span
        className={`${base} ring-1 ring-inset ring-black/5 dark:ring-white/10 ${
          temEscuro ? 'bg-white dark:bg-white/5' : 'bg-white'
        }`}
        title={nome}
      >
        <img
          src={empresa.logo_url}
          alt={nome}
          loading="lazy"
          onError={() => setQuebrado(true)}
          className={`${img} ${temEscuro ? 'dark:hidden' : ''}`}
        />
        {temEscuro && (
          <img
            src={empresa.logo_url_escuro!}
            alt={nome}
            loading="lazy"
            className={`${img} hidden dark:block`}
          />
        )}
      </span>
    )
  }

  const theme = buTheme(empresa.bu ?? undefined)
  return (
    <span
      className={`${base} font-bold text-white ${s.text}`}
      style={{ background: `linear-gradient(135deg, ${theme.from} 0%, ${theme.to} 100%)` }}
      title={nome}
    >
      {iniciais(nome || '?')}
    </span>
  )
}
