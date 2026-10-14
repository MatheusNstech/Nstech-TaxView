import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
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

const MARGEM = 12
const FOLGA_SOMBRA = 32
const MAX_CNPJS = 6
const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)'
const ABRIR_MS = 320
const FECHAR_MS = 200
const ATRASOS_SECAO_MS = [60, 120, 180]

function Validade({ dia, vencido }: { dia: string; vencido: 'vencida' | 'vencido' }) {
  const [texto, classe] = prazoValidade(diasParaVencer(dia), vencido)
  return (
    <span className="shrink-0 text-right leading-tight">
      <span className="block text-sm font-medium text-[color:var(--color-ink)]">{formatDiaIso(dia)}</span>
      <span className={`block text-[11px] ${classe}`}>{texto}</span>
    </span>
  )
}

function LinhaCnpj({ unidade }: { unidade: EmpresaUnidade }) {
  const nome = unidade.nome_fantasia && unidade.nome_fantasia !== unidade.razao_social ? unidade.nome_fantasia : unidade.razao_social
  const fim = unidade.certificado?.valido_ate
  return (
    <li className="flex items-center gap-3 py-2">
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
        <p className="truncate text-xs text-[color:var(--color-muted)]">{nome}</p>
      </div>
      {fim ? (
        <Validade dia={diaBrasilia(fim)} vencido="vencido" />
      ) : (
        <span className="shrink-0 text-[11px] text-[color:var(--color-muted)]">sem certificado</span>
      )}
    </li>
  )
}

interface Props {
  grupo: EmpresaGrupo
  ancora: DOMRect
  lado: 'direita' | 'esquerda'
  largura: number
  aberto: boolean
}

/** Gaveta com o resumo da empresa (CND, certificados e CNPJs) que sai de trás do card. */
export default function EmpresaResumoTooltip({ grupo, ancora, lado, largura, aberto }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [entrou, setEntrou] = useState(false)
  const [reduzirMovimento] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const mostrar = aberto && entrou

  const unidades = [grupo.matriz, ...grupo.filiais]
  const cnd = grupo.certidoes.find((c) => c.esfera === 'federal')
  const situacao = cnd?.situacao ? SITUACAO_CERTIDAO[cnd.situacao] : null
  const direita = lado === 'direita'

  useEffect(() => {
    const frame = requestAnimationFrame(() => setEntrou(true))
    return () => cancelAnimationFrame(frame)
  }, [])

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const altura = el.offsetHeight - 2 * FOLGA_SOMBRA
    const top = Math.min(ancora.top, window.innerHeight - altura - MARGEM)
    el.style.top = `${Math.max(MARGEM, top) - FOLGA_SOMBRA}px`
  }, [ancora])

  const duracao = mostrar ? ABRIR_MS : FECHAR_MS
  const painel: CSSProperties = {
    minHeight: ancora.height,
    transition: `transform ${duracao}ms ${EASE}, opacity ${duracao}ms ${EASE}`,
    transform: reduzirMovimento || mostrar ? 'none' : `translateX(${direita ? '-100%' : '100%'})`,
    opacity: reduzirMovimento && !mostrar ? 0 : 1,
  }
  const secao = (i: number): CSSProperties => ({
    transition: mostrar
      ? `opacity 260ms ${EASE} ${ATRASOS_SECAO_MS[i]}ms, transform 260ms ${EASE} ${ATRASOS_SECAO_MS[i]}ms`
      : `opacity 120ms ease-in, transform 120ms ease-in`,
    opacity: mostrar ? 1 : 0,
    transform: mostrar || reduzirMovimento ? 'none' : `translateX(${direita ? -8 : 8}px)`,
  })

  return createPortal(
    <div
      ref={ref}
      role="tooltip"
      className="pointer-events-none fixed z-[90] overflow-hidden"
      style={{
        top: ancora.top - FOLGA_SOMBRA,
        ...(direita ? { left: ancora.right, paddingRight: FOLGA_SOMBRA } : { right: document.documentElement.clientWidth - ancora.left, paddingLeft: FOLGA_SOMBRA }),
        paddingTop: FOLGA_SOMBRA,
        paddingBottom: FOLGA_SOMBRA,
        width: largura + FOLGA_SOMBRA,
      }}
    >
      <div
        style={painel}
        className={`flex flex-col border border-[color:var(--color-line)] bg-[color:var(--color-panel)] p-5 shadow-2xl ${
          direita ? 'rounded-r-2xl border-l-0' : 'rounded-l-2xl border-r-0'
        }`}
      >
        <div style={secao(0)} className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-semibold text-[color:var(--color-ink)]">{grupo.nome}</p>
            <p className="truncate text-xs text-[color:var(--color-muted)]">{grupo.matriz.razao_social}</p>
          </div>
          <div className="flex shrink-0 gap-1">
            {grupo.bus.map((bu) => (
              <span
                key={bu}
                className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white"
                style={{ background: buTheme(bu).from }}
              >
                {bu}
              </span>
            ))}
          </div>
        </div>

        <div style={secao(1)} className="mt-4 flex items-center gap-3 border-t border-[color:var(--color-line)] pt-4">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-[color:var(--color-muted)]">CND Federal</p>
            {situacao ? (
              <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${situacao.classe}`}>
                {situacao.rotulo}
              </span>
            ) : (
              <p className="text-sm text-[color:var(--color-muted)]">{cnd ? '—' : 'não cadastrada'}</p>
            )}
          </div>
          {cnd?.valida_ate && <Validade dia={cnd.valida_ate} vencido="vencida" />}
        </div>

        <div style={secao(2)} className="mt-4 border-t border-[color:var(--color-line)] pt-3">
          <div className="flex items-center justify-between text-xs text-[color:var(--color-muted)]">
            <span>{unidades.length === 1 ? 'CNPJ' : `CNPJs (${unidades.length})`}</span>
            <span>Certificado digital</span>
          </div>
          <ul className="divide-y divide-[color:var(--color-line)]">
            {unidades.slice(0, MAX_CNPJS).map((u) => (
              <LinhaCnpj key={u.id} unidade={u} />
            ))}
          </ul>
          {unidades.length > MAX_CNPJS && (
            <p className="pt-1 text-xs text-[color:var(--color-muted)]">
              + {unidades.length - MAX_CNPJS} CNPJs (veja todos no detalhe da empresa)
            </p>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
