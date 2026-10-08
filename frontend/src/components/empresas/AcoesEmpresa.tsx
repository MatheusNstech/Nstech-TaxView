import { ArrowUpRight, Copy } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { Empresa } from '../../types'
import { BOTAO_TOPO } from '../DetalheModal'
import { linkEmpresa } from './EmpresaLogo'

export default function AcoesEmpresa({
  empresa,
  onCopiar,
  onNavegar,
}: {
  empresa: Empresa | null | undefined
  onCopiar?: () => void
  onNavegar?: () => void
}) {
  return (
    <>
      {empresa && (
        <Link to={linkEmpresa(empresa)} onClick={onNavegar} className={`px-2.5 py-1.5 ${BOTAO_TOPO}`}>
          Ver empresa
          <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={2} />
        </Link>
      )}
      {onCopiar && (
        <button
          type="button"
          onClick={onCopiar}
          title="Copiar para outra empresa"
          className={`px-2.5 py-1.5 ${BOTAO_TOPO}`}
        >
          <Copy className="h-3.5 w-3.5" strokeWidth={2} />
          Copiar
        </button>
      )}
    </>
  )
}
