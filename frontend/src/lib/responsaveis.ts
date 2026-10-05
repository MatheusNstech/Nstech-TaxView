import type { Obrigacao, Responsavel } from '../types'

/** Principal + co-responsáveis; cai no principal quando a API não manda a lista. */
export function obrigacaoResponsaveis(o: Obrigacao): Responsavel[] {
  if (o.responsaveis && o.responsaveis.length > 0) return o.responsaveis
  return o.responsavel ? [o.responsavel] : []
}

export function obrigacaoResponsaveisLabel(o: Obrigacao): string | null {
  const nomes = obrigacaoResponsaveis(o)
    .map((r) => r.nome)
    .filter(Boolean)
  return nomes.length > 0 ? nomes.join(' / ') : null
}

export function obrigacaoTemResponsavel(o: Obrigacao, responsavelId: string): boolean {
  if ((o.responsavel_id ?? o.responsavel?.id) === responsavelId) return true
  return obrigacaoResponsaveis(o).some((r) => r.id === responsavelId)
}

export function obrigacaoTemResponsavelNome(o: Obrigacao, nome: string): boolean {
  return obrigacaoResponsaveis(o).some((r) => r.nome === nome)
}
