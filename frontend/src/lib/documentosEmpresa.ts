import type { Certidao, CertificadoDigital, EmpresaGrupo, EmpresaUnidade, SituacaoCertidao } from '../types'

export interface DocumentoPdf {
  titulo: string
  subtitulo: string
  path: string
  arquivo: string
}

export function formatAtualizadoEm(value: string | null | undefined): string {
  if (!value) return ''
  return new Date(value).toLocaleDateString('pt-BR')
}

export function cartaoCnpjArquivo(cnpj: string): string {
  return `Cartao CNPJ - ${cnpj.replace(/\//g, '-')}.pdf`
}

export function cartaoCnpjPath(empresaId: string, download = false): string {
  return `/api/empresas/${empresaId}/cartao-cnpj${download ? '?download=true' : ''}`
}

export function cartaoCnpjDocumento(unidade: EmpresaUnidade): DocumentoPdf {
  const atualizado = formatAtualizadoEm(unidade.cartao_cnpj_atualizado_em)
  return {
    titulo: `Cartão CNPJ · ${unidade.razao_social}`,
    subtitulo: atualizado ? `${unidade.cnpj} · atualizado em ${atualizado}` : unidade.cnpj,
    path: cartaoCnpjPath(unidade.id),
    arquivo: cartaoCnpjArquivo(unidade.cnpj),
  }
}

export function cndArquivo(cnpj: string): string {
  return `CND Federal - ${cnpj.slice(0, 10)}.pdf`
}

export function cndPath(empresaId: string, download = false): string {
  return `/api/empresas/${empresaId}/certidoes/federal${download ? '?download=true' : ''}`
}

export function cndDocumento(grupo: EmpresaGrupo, certidao: Certidao): DocumentoPdf {
  const validade = certidao.valida_ate ? ` · válida até ${formatDiaIso(certidao.valida_ate)}` : ''
  return {
    titulo: `CND Federal · ${grupo.matriz.razao_social}`,
    subtitulo: `${grupo.matriz.cnpj.slice(0, 10)} (matriz e filiais)${validade}`,
    path: cndPath(certidao.empresa_id),
    arquivo: cndArquivo(grupo.matriz.cnpj),
  }
}

export const SITUACAO_CERTIDAO: Record<SituacaoCertidao, { rotulo: string; classe: string }> = {
  negativa: {
    rotulo: 'Negativa',
    classe: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300',
  },
  positiva_efeitos_negativa: {
    rotulo: 'Positiva com efeitos de negativa',
    classe: 'bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300',
  },
  positiva: {
    rotulo: 'Positiva',
    classe: 'bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-300',
  },
}

/** "2027-02-26" → "26/02/2027", sem passar por fuso horário. */
export function formatDiaIso(value: string | null | undefined): string {
  if (!value) return '—'
  const [y, m, d] = value.split('-')
  return `${d}/${m}/${y}`
}

export function diasParaVencer(validaAte: string, hoje = new Date()): number {
  const [y, m, d] = validaAte.split('-').map(Number)
  const fim = Date.UTC(y, m - 1, d)
  const inicio = Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate())
  return Math.round((fim - inicio) / 86_400_000)
}

export function grupoComCartao(
  grupo: EmpresaGrupo,
  empresaId: string,
  atualizadoEm: string | null,
): EmpresaGrupo {
  const ajusta = (u: EmpresaUnidade) =>
    u.id === empresaId ? { ...u, cartao_cnpj_atualizado_em: atualizadoEm } : u
  return { ...grupo, matriz: ajusta(grupo.matriz), filiais: grupo.filiais.map(ajusta) }
}

/** Texto e cor do prazo: vermelho vencido ou vencendo hoje, âmbar com 30 dias ou menos. */
export function prazoValidade(dias: number, vencido: 'vencida' | 'vencido'): [texto: string, classe: string] {
  const vermelho = 'text-rose-600 dark:text-rose-400'
  if (dias < 0) return [`${vencido} há ${-dias} ${dias === -1 ? 'dia' : 'dias'}`, vermelho]
  if (dias === 0) return ['vence hoje', vermelho]
  return [
    `vence em ${dias} ${dias === 1 ? 'dia' : 'dias'}`,
    dias <= 30 ? 'text-amber-600 dark:text-amber-400' : 'text-[color:var(--color-muted)]',
  ]
}

export function certificadoArquivo(cnpj: string): string {
  return `Certificado - ${cnpj.replace(/\//g, '-')}.pfx`
}

export function certificadoPath(empresaId: string): string {
  return `/api/empresas/${empresaId}/certificado`
}

/** Instante ISO → "AAAA-MM-DD" no dia de Brasília (o certificado vence num horário exato). */
export function diaBrasilia(instante: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date(instante))
}

export interface AlertaCertificado {
  unidade: EmpresaUnidade
  validoAte: string
  dias: number
}

/** Certificados vencidos ou que vencem em até 30 dias, do mais urgente para o menos. */
export function alertasCertificado(grupo: EmpresaGrupo, hoje = new Date()): AlertaCertificado[] {
  return [grupo.matriz, ...grupo.filiais]
    .flatMap((unidade) => {
      const fim = unidade.certificado?.valido_ate
      if (!fim) return []
      const validoAte = diaBrasilia(fim)
      return [{ unidade, validoAte, dias: diasParaVencer(validoAte, hoje) }]
    })
    .filter((a) => a.dias <= 30)
    .sort((a, b) => a.dias - b.dias)
}

export function grupoComCertificado(
  grupo: EmpresaGrupo,
  empresaId: string,
  certificado: CertificadoDigital | null,
): EmpresaGrupo {
  const ajusta = (u: EmpresaUnidade) => (u.id === empresaId ? { ...u, certificado } : u)
  return { ...grupo, matriz: ajusta(grupo.matriz), filiais: grupo.filiais.map(ajusta) }
}

export function grupoComCertidao(
  grupo: EmpresaGrupo,
  esfera: Certidao['esfera'],
  certidao: Certidao | null,
): EmpresaGrupo {
  const outras = grupo.certidoes.filter((c) => c.esfera !== esfera)
  return { ...grupo, certidoes: certidao ? [...outras, certidao] : outras }
}
