import { ChevronLeft, ChevronRight, UserRound } from 'lucide-react'
import { useEffect, useState } from 'react'
import midiaBg from '../../assets/midia-bg.jpg'

export interface ResponsavelAtividadeResumo {
  nome: string
  quantidade: number
}

export interface ResponsavelCargaItem {
  id?: string
  nome: string
  total: number
  capacidadeMax?: number | null
  fotoUrl?: string | null
  atividades: ResponsavelAtividadeResumo[]
}

interface ResponsavelCargaCarouselProps {
  items: ResponsavelCargaItem[]
}

function initials(nome: string): string {
  const parts = nome.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
}

function shortActivityName(nome: string): string {
  if (nome.length <= 28) return nome
  return `${nome.slice(0, 26)}…`
}

function Avatar({
  nome,
  fotoUrl,
}: {
  nome: string
  fotoUrl?: string | null
}) {
  const [broken, setBroken] = useState(false)
  const showPhoto = Boolean(fotoUrl) && !broken

  return (
    <div className="relative h-28 w-28 shrink-0 overflow-hidden rounded-full shadow-md shadow-black/30 ring-2 ring-white/30">
      {showPhoto ? (
        <img
          src={fotoUrl!}
          alt={nome}
          className="h-full w-full scale-110 object-cover object-[center_15%]"
          onError={() => setBroken(true)}
        />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center bg-brand-500/20 text-brand-200 backdrop-blur-md">
          <UserRound className="mb-1 h-7 w-7 opacity-80" strokeWidth={1.5} />
          <span className="text-xs font-bold tracking-wide opacity-90">
            {initials(nome)}
          </span>
        </div>
      )}
    </div>
  )
}

export default function ResponsavelCargaCarousel({
  items,
}: ResponsavelCargaCarouselProps) {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    setIndex(0)
  }, [items.length])

  if (items.length === 0) {
    return (
      <div className="flex h-full min-h-[280px] items-center justify-center rounded-2xl border border-[color:var(--color-line)] bg-[color:var(--color-panel)] text-sm text-[color:var(--color-muted)]">
        Sem dados de responsáveis
      </div>
    )
  }

  const safeIndex = Math.min(index, items.length - 1)
  const current = items[safeIndex]
  const rank = safeIndex + 1
  const atividades = current.atividades

  const go = (next: number) => {
    const len = items.length
    setIndex(((next % len) + len) % len)
  }

  return (
    <div
      className="relative flex h-full min-h-[320px] overflow-hidden rounded-2xl bg-cover bg-center bg-no-repeat shadow-sm ring-1 ring-black/20 dark:ring-white/15"
      style={{ backgroundImage: `url(${midiaBg})` }}
    >
      <div className="pointer-events-none absolute inset-0 bg-black/35" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/50 via-transparent to-transparent" />

      <div className="relative z-10 flex w-full flex-col p-5 text-white">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.12em] text-brand-300 uppercase">
              Carga por responsável
            </p>
            <div className="mt-3 flex items-center gap-1.5">
              {items.map((item, i) => (
                <button
                  key={item.id ?? item.nome}
                  type="button"
                  aria-label={`Ver ${item.nome}`}
                  onClick={() => setIndex(i)}
                  className={[
                    'h-1.5 rounded-full transition-all',
                    i === safeIndex
                      ? 'w-5 bg-brand-500'
                      : 'w-1.5 bg-brand-300/50 hover:bg-brand-400',
                  ].join(' ')}
                />
              ))}
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="Anterior"
              onClick={() => go(safeIndex - 1)}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-md transition hover:bg-white/25"
            >
              <ChevronLeft className="h-4 w-4" strokeWidth={2} />
            </button>
            <button
              type="button"
              aria-label="Próximo"
              onClick={() => go(safeIndex + 1)}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-md transition hover:bg-white/25"
            >
              <ChevronRight className="h-4 w-4" strokeWidth={2} />
            </button>
          </div>
        </div>

        <div className="mt-6 flex items-center gap-4">
          <Avatar nome={current.nome} fotoUrl={current.fotoUrl} />
          <div className="min-w-0">
            <p className="text-[10px] font-bold tracking-[0.14em] text-brand-300 uppercase">
              Responsável · #{rank} de {items.length}
            </p>
            <h4 className="truncate text-2xl font-bold leading-tight tracking-tight text-white">
              {current.nome}
            </h4>
            <p
              className={[
                'mt-0.5 text-sm',
                current.capacidadeMax != null &&
                current.total > current.capacidadeMax
                  ? 'font-semibold text-rose-300'
                  : 'text-white/65',
              ].join(' ')}
            >
              {current.capacidadeMax != null
                ? `${current.total}/${current.capacidadeMax} obrigações`
                : `${current.total} ${current.total === 1 ? 'obrigação' : 'obrigações'} nesta competência`}
            </p>
          </div>
        </div>

        <div className="mt-5 flex min-h-0 flex-1 flex-col">
          <p className="mb-2 text-[10px] font-bold tracking-[0.12em] text-brand-300 uppercase">
            Por atividade
          </p>
          {atividades.length === 0 ? (
            <p className="text-sm text-white/65">Sem detalhe de atividades</p>
          ) : (
            <ul
              className={[
                'space-y-1.5 pr-1',
                atividades.length > 4
                  ? 'max-h-[11.5rem] overflow-y-auto overscroll-contain [scrollbar-width:thin] [scrollbar-color:rgb(255_107_0_/_0.55)_transparent]'
                  : '',
              ].join(' ')}
            >
              {atividades.map((atividade) => (
                <li
                  key={atividade.nome}
                  className="flex items-center justify-between gap-3 rounded-xl bg-white/12 px-3 py-2 text-white backdrop-blur-md"
                >
                  <span
                    className="min-w-0 truncate text-sm"
                    title={atividade.nome}
                  >
                    {shortActivityName(atividade.nome)}
                  </span>
                  <span className="shrink-0 rounded-full bg-brand-500/25 px-2 py-0.5 text-xs font-bold text-brand-200 tabular-nums">
                    {atividade.quantidade}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
