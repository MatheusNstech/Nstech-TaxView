import { useLayoutEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import {
  SITUACAO_CERTIDAO,
  diaBrasilia,
  diasParaVencer,
  formatDiaIso,
  prazoValidade,
} from '../../lib/documentosEmpresa'
import type { EmpresaGrupo, EmpresaUnidade } from '../../types'
import { buTheme } from './EmpresaCard'

const LARGURA = 352
const MARGEM = 12
const MAX_CNPJS = 6

function Validade({ dia, vencido }: { dia: string; vencido: 'vencida' | 'vencido' }) {
  const [texto, classe] = prazoValidade(diasParaVencer(dia), vencido)
  return (
    <span className="text-right leading-tight">
      <span className="block text-xs font-medium text-[color:var(--color-ink)]">{formatDiaIso(dia)}</span>
      <span className={`block text-[10px] ${classe}`}>{texto}</span>
    </span>
  )
}

function LinhaCnpj({ unidade }: { unidade: EmpresaUnidade }) {
  const nome = unidade.nome_fantasia && unidade.nome_fantasia !== unidade.razao_social ? unidade.nome_fantasia : unidade.razao_social
  const fim = unidade.certificado?.valido_ate
  return (
    <li className="flex items-center gap-3 py-1.5">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-xs font-medium text-[color:var(--color-ink)]">{unidade.cnpj}</span>
          <span
            className={`rounded px-1 text-[9px] font-semibold uppercase ${
              unidade.matriz
                ? 'bg-[color:var(--color-ink)] text-[color:var(--color-panel)]'
                : 'bg-[color:var(--color-surface)] text-[color:var(--color-muted)]'
            }`}
          >
            {unidade.matriz ? 'Matriz' : 'Filial'}
          </span>
        </div>
        <p className="truncate text-[11px] text-[color:var(--color-muted)]">{nome}</p>
      </div>
      {fim ? (
        <Validade dia={diaBrasilia(fim)} vencido="vencido" />
      ) : (
        <span className="text-[10px] text-[color:var(--color-muted)]">sem certificado</span>
      )}
    </li>
  )
}

/** Resumo rápido da empresa ao lado do card (CND, certificados e CNPJs). */
export default function EmpresaResumoTooltip({ grupo, ancora }: { grupo: EmpresaGrupo; ancora: DOMRect }) {
  const ref = useRef<HTMLDivElement>(null)
  const unidades = [grupo.matriz, ...grupo.filiais]
  const cnd = grupo.certidoes.find((c) => c.esfera === 'federal')
  const situacao = cnd?.situacao ? SITUACAO_CERTIDAO[cnd.situacao] : null

  const cabeDireita = ancora.right + MARGEM + LARGURA <= window.innerWidth - MARGEM
  const left = cabeDireita ? ancora.right + MARGEM : Math.max(MARGEM, ancora.left - MARGEM - LARGURA)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const top = Math.min(Math.max(MARGEM, ancora.top), window.innerHeight - el.offsetHeight - MARGEM)
    el.style.top = `${Math.max(MARGEM, top)}px`
    const frame = requestAnimationFrame(() => {
      el.style.opacity = '1'
      el.style.transform = 'translateX(0)'
    })
    return () => cancelAnimationFrame(frame)
  }, [ancora])

  return createPortal(
    <div
      ref={ref}
      role="tooltip"
      style={{
        left,
        top: ancora.top,
        width: LARGURA,
        opacity: 0,
        transform: `translateX(${cabeDireita ? -6 : 6}px)`,
      }}
      className="pointer-events-none fixed z-[90] rounded-2xl border border-[color:var(--color-line)] bg-white p-4 shadow-2xl transition duration-200 ease-out dark:bg-[color:var(--color-panel)]"
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-[color:var(--color-ink)]">{grupo.nome}</p>
          <p className="truncate text-[11px] text-[color:var(--color-muted)]">{grupo.matriz.razao_social}</p>
        </div>
        <div className="flex shrink-0 gap-1">
          {grupo.bus.map((bu) => (
            <span
              key={bu}
              className="rounded-full px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide text-white"
              style={{ background: buTheme(bu).from }}
            >
              {bu}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-3 flex items-center gap-3 border-t border-[color:var(--color-line)] pt-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] text-[color:var(--color-muted)]">CND Federal</p>
          {situacao ? (
            <span className={`mt-0.5 inline-block rounded-full px-2 py-px text-[10px] font-semibold ${situacao.classe}`}>
              {situacao.rotulo}
            </span>
          ) : (
            <p className="text-xs text-[color:var(--color-muted)]">{cnd ? '—' : 'não cadastrada'}</p>
          )}
        </div>
        {cnd?.valida_ate && <Validade dia={cnd.valida_ate} vencido="vencida" />}
      </div>

      <div className="mt-3 border-t border-[color:var(--color-line)] pt-2">
        <div className="flex items-center justify-between text-[11px] text-[color:var(--color-muted)]">
          <span>
            {unidades.length === 1 ? 'CNPJ' : `CNPJs (${unidades.length})`}
          </span>
          <span>Certificado digital</span>
        </div>
        <ul className="divide-y divide-[color:var(--color-line)]">
          {unidades.slice(0, MAX_CNPJS).map((u) => (
            <LinhaCnpj key={u.id} unidade={u} />
          ))}
        </ul>
        {unidades.length > MAX_CNPJS && (
          <p className="pt-1 text-[11px] text-[color:var(--color-muted)]">
            + {unidades.length - MAX_CNPJS} CNPJs (veja todos no detalhe da empresa)
          </p>
        )}
      </div>
    </div>,
    document.body,
  )
}
