import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
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
const FOLGA_SOMBRA = 40
/** Cobre a borda transparente do card e evita a fresta de antialiasing em coordenadas fracionadas. */
const SOBREPOR = 1
const MAX_CNPJS = 6
const RAIO = 28
const MOLA_MS = 500
const FECHAR_MS = 200
const ATRASOS_SECAO_MS = [70, 130, 190]
const SUAVE = 'cubic-bezier(0.22, 1, 0.36, 1)'
const SOMBRA = 'drop-shadow(0 20px 25px rgb(0 0 0 / 0.1)) drop-shadow(0 8px 10px rgb(0 0 0 / 0.08))'

/** Curva `linear()` de uma mola subamortecida (massa 1), no estilo da Dynamic Island. */
function curvaMola(rigidez: number, amortecimento: number, duracaoMs: number, passos = 40) {
  const w = Math.sqrt(rigidez)
  const zeta = amortecimento / (2 * w)
  const wd = w * Math.sqrt(1 - zeta * zeta)
  const pontos = Array.from({ length: passos + 1 }, (_, i) => {
    const t = (i / passos) * (duracaoMs / 1000)
    const decai = Math.exp(-zeta * w * t)
    return (1 - decai * (Math.cos(wd * t) + ((zeta * w) / wd) * Math.sin(wd * t))).toFixed(4)
  })
  pontos[passos] = '1'
  return `linear(${pontos.join(', ')})`
}

const MOLA = CSS.supports('transition-timing-function', 'linear(0, 1)')
  ? curvaMola(400, 30, MOLA_MS)
  : 'cubic-bezier(0.34, 1.3, 0.64, 1)'

function Rotulo({ children }: { children: ReactNode }) {
  return (
    <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[color:var(--color-muted)]">
      {children}
    </span>
  )
}

function Validade({ dia, vencido }: { dia: string; vencido: 'vencida' | 'vencido' }) {
  const [texto, classe] = prazoValidade(diasParaVencer(dia), vencido)
  return (
    <span className="shrink-0 text-right leading-tight">
      <span className="block text-sm font-semibold text-[color:var(--color-ink)]">{formatDiaIso(dia)}</span>
      <span className={`block text-[11px] ${classe}`}>{texto}</span>
    </span>
  )
}

function LinhaCnpj({ unidade }: { unidade: EmpresaUnidade }) {
  const nome = unidade.nome_fantasia && unidade.nome_fantasia !== unidade.razao_social ? unidade.nome_fantasia : unidade.razao_social
  const fim = unidade.certificado?.valido_ate
  return (
    <li className="flex items-center gap-3 rounded-xl bg-[color:var(--color-surface)]/60 px-3 py-2">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-xs font-medium text-[color:var(--color-ink)]">{unidade.cnpj}</span>
          <span
            className={`rounded-full px-1.5 text-[9px] font-semibold uppercase ${
              unidade.matriz
                ? 'bg-[color:var(--color-ink)] text-[color:var(--color-panel)]'
                : 'bg-[color:var(--color-panel)] text-[color:var(--color-muted)]'
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

/** Gaveta com o resumo da empresa (CND, certificados e CNPJs) que cresce a partir da lateral do card. */
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

  const painel: CSSProperties = reduzirMovimento
    ? {
        width: largura,
        opacity: mostrar ? 1 : 0,
        transition: `opacity ${FECHAR_MS}ms ease-out`,
      }
    : {
        width: mostrar ? largura : 0,
        transition: mostrar ? `width ${MOLA_MS}ms ${MOLA}` : `width ${FECHAR_MS}ms ease-in`,
      }
  const secao = (i: number): CSSProperties => {
    if (reduzirMovimento) return {}
    return {
      opacity: mostrar ? 1 : 0,
      transform: mostrar ? 'none' : 'scale(0.96)',
      filter: mostrar ? 'none' : 'blur(6px)',
      transformOrigin: direita ? 'left center' : 'right center',
      transition: mostrar
        ? ['opacity', 'transform', 'filter'].map((p) => `${p} 320ms ${SUAVE} ${ATRASOS_SECAO_MS[i]}ms`).join(', ')
        : ['opacity', 'transform', 'filter'].map((p) => `${p} 120ms ease-in`).join(', '),
    }
  }

  return createPortal(
    <div
      ref={ref}
      role="tooltip"
      className="pointer-events-none fixed z-[90] overflow-hidden"
      style={{
        top: ancora.top - FOLGA_SOMBRA,
        ...(direita
          ? { left: ancora.right - SOBREPOR, paddingRight: FOLGA_SOMBRA }
          : { right: document.documentElement.clientWidth - ancora.left - SOBREPOR, paddingLeft: FOLGA_SOMBRA }),
        paddingTop: FOLGA_SOMBRA,
        paddingBottom: FOLGA_SOMBRA,
        width: largura + FOLGA_SOMBRA,
      }}
    >
      <div className={`flex ${direita ? 'justify-start' : 'justify-end'}`} style={{ filter: SOMBRA }}>
        <div
          style={{
            ...painel,
            minHeight: ancora.height,
            ...(direita
              ? { borderTopRightRadius: RAIO, borderBottomRightRadius: RAIO }
              : { borderTopLeftRadius: RAIO, borderBottomLeftRadius: RAIO }),
          }}
          className={`flex overflow-hidden border border-[color:var(--color-line)] bg-[color:var(--color-panel)] ${
            direita ? 'justify-start border-l-0' : 'justify-end border-r-0'
          }`}
        >
          <div style={{ width: largura }} className="flex shrink-0 flex-col p-5">
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

            <div style={secao(1)} className="mt-5">
              <Rotulo>CND Federal</Rotulo>
              <div className="mt-1.5 flex items-center gap-3 rounded-2xl bg-[color:var(--color-surface)]/60 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  {situacao ? (
                    <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${situacao.classe}`}>
                      {situacao.rotulo}
                    </span>
                  ) : (
                    <span className="text-sm text-[color:var(--color-muted)]">{cnd ? '—' : 'não cadastrada'}</span>
                  )}
                </div>
                {cnd?.valida_ate && <Validade dia={cnd.valida_ate} vencido="vencida" />}
              </div>
            </div>

            <div style={secao(2)} className="mt-5">
              <div className="flex items-center justify-between">
                <Rotulo>{unidades.length === 1 ? 'CNPJ' : `CNPJs (${unidades.length})`}</Rotulo>
                <Rotulo>Certificado digital</Rotulo>
              </div>
              <ul className="mt-1.5 flex flex-col gap-1.5">
                {unidades.slice(0, MAX_CNPJS).map((u) => (
                  <LinhaCnpj key={u.id} unidade={u} />
                ))}
              </ul>
              {unidades.length > MAX_CNPJS && (
                <p className="pt-2 text-xs text-[color:var(--color-muted)]">
                  + {unidades.length - MAX_CNPJS} CNPJs (veja todos no detalhe da empresa)
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
