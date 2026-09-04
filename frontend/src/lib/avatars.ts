/** Preview local até foto_url no banco. */
const AVATAR_PREVIEW: Record<string, string> = {
  glaucia: '/avatars/glaucia.jpg',
  solange: '/avatars/solange.jpg',
  felipe: '/avatars/felipe.jpg',
  flávia: '/avatars/flavia.jpg',
  flavia: '/avatars/flavia.jpg',
  viviane: '/avatars/viviane.jpg',
}

/** Resolve URL da foto: `foto_url` do banco ou preview por primeiro nome. */
export function resolveAvatarUrl(
  nome: string | null | undefined,
  fotoUrl?: string | null,
): string | null {
  if (fotoUrl) return fotoUrl
  if (!nome?.trim()) return null
  const first = nome.trim().split(/\s+/)[0]?.toLowerCase() ?? ''
  return AVATAR_PREVIEW[first] ?? null
}

export function avatarInitials(nome: string): string {
  const parts = nome.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
}
