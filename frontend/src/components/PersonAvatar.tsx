import { useState } from 'react'
import { avatarInitials, resolveAvatarUrl } from '../lib/avatars'

interface PersonAvatarProps {
  nome: string | null | undefined
  fotoUrl?: string | null
  size?: 'sm' | 'md'
  className?: string
}

const SIZE = {
  sm: 'h-7 w-7 text-[9px]',
  md: 'h-8 w-8 text-[10px]',
} as const

export default function PersonAvatar({
  nome,
  fotoUrl,
  size = 'sm',
  className = '',
}: PersonAvatarProps) {
  const [broken, setBroken] = useState(false)
  const label = nome?.trim() || '?'
  const src = resolveAvatarUrl(nome, fotoUrl)
  const showPhoto = Boolean(src) && !broken

  return (
    <span
      className={[
        'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-200 font-semibold text-slate-600 ring-1 ring-slate-200/80',
        SIZE[size],
        className,
      ].join(' ')}
      aria-hidden={!showPhoto}
    >
      {showPhoto ? (
        <img
          src={src!}
          alt=""
          className="h-full w-full object-cover object-[center_20%]"
          onError={() => setBroken(true)}
        />
      ) : (
        <span>{avatarInitials(label)}</span>
      )}
    </span>
  )
}
