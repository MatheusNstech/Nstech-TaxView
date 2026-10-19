import { CheckCircle2, ChevronRight, Landmark, Plus, ShieldCheck } from 'lucide-react'
import { formatDate, formatMoneyBRL } from '../../lib/format'
import type { PainelFiscalPendencia } from '../../types'
import DetalheModal, { Campo, Indicador } from '../DetalheModal'
import { useEmpresaPorNome } from '../fiscal/EntregaFiscal'
import { periodoPendencia } from './PendenciaDetalheModal'

function hojeLocal(): string {
  const d = new Date()
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-')
}

/** Abertos: vencidos primeiro, depois maior valor. Entregues: mais recentes primeiro. */
function ordenar(rows: PainelFiscalPendencia[], entregues: boolean): PainelFiscalPendencia[] {
  return [...rows].sort((a, b) =>
    entregues
      ? (b.entregue_em ?? '').localeCompare(a.entregue_em ?? '')
      : (a.vencimento ?? '9999').localeCompare(b.vencimento ?? '9999') ||
        Number(b.total ?? 0) - Number(a.total ?? 0),
  )
}

function statusCnd(rows: PainelFiscalPendencia[]): string {
  const textos = rows.map((r) => r.status_cnd.trim().toLowerCase()).filter(Boolean)
  if (textos.some((t) => t.includes('pend'))) return 'Pendente'
  if (textos.some((t) => t.includes('valid') || t.includes('válid'))) return 'Válida'
  return '—'
}

function ListaDebitos({
  rows,
  vazio,
  onAbrir,
}: {
  rows: PainelFiscalPendencia[]
  vazio: string
  onAbrir: (p: PainelFiscalPendencia) => void
}) {
  if (rows.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-[color:var(--color-muted)] lg:col-span-3">{vazio}</p>
    )
  }
  const hoje = hojeLocal()
  return (
    <ul className="divide-y divide-[color:var(--color-line)] overflow-hidden rounded-2xl border border-[color:var(--color-line)] lg:col-span-3">
      {rows.map((p) => {
        const vencido = !p.entregue_em && Boolean(p.vencimento) && (p.vencimento ?? '') < hoje
        const nota = p.motivo || p.nota_01 || p.nota_02
        const periodo = periodoPendencia(p)
        return (
          <li key={p.id}>
            <button
              type="button"
              onClick={() => onAbrir(p)}
              className="group flex w-full items-center gap-4 px-4 py-3 text-left transition hover:bg-[color:var(--nav-hover)]"
            >
              <span className="w-16 shrink-0 rounded-lg bg-brand-500/10 px-2 py-1 text-center text-[11px] font-bold uppercase tracking-wide text-brand-700 dark:text-brand-300">
                {p.orgao || '—'}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-[color:var(--color-ink)]">
                  {[periodo, p.numero_processo || p.codigo].filter(Boolean).join(' · ') || 'Débito'}
                </p>
                <p className="truncate text-xs text-[color:var(--color-muted)]">
                  {p.entregue_em ? (
                    <span className="font-medium text-emerald-700 dark:text-emerald-300">
                      Entregue em {formatDate(p.entregue_em)}
                      {p.entrega_obs ? ` · ${p.entrega_obs}` : ''}
                    </span>
                  ) : (
                    <>
                      {p.vencimento ? (
                        <span className={vencido ? 'font-medium text-[#B71D18] dark:text-[#FF8A75]' : ''}>
                          Vence {formatDate(p.vencimento)}
                        </span>
                      ) : (
                        'Sem vencimento'
                      )}
                      {nota ? ` · ${nota}` : ''}
                    </>
                  )}
                </p>
              </div>
              <span
                className={`shrink-0 text-right text-sm font-semibold tabular-nums ${
                  p.entregue_em
                    ? 'text-[color:var(--color-muted)] line-through decoration-1'
                    : 'text-[color:var(--color-ink)]'
                }`}
              >
                {formatMoneyBRL(p.total)}
              </span>
              <ChevronRight
                className="h-4 w-4 shrink-0 text-[color:var(--color-muted)] transition group-hover:translate-x-0.5"
                strokeWidth={2}
              />
            </button>
          </li>
        )
      })}
    </ul>
  )
}

/** Débitos de uma empresa no modal padrão; cada débito abre o seu próprio modal. */
export default function PendenciasEmpresaModal({
  empresa: nome,
  rows,
  editable,
  bloqueado,
  onClose,
  onAbrir,
  onNova,
}: {
  empresa: string
  rows: PainelFiscalPendencia[]
  editable: boolean
  /** Outro modal aberto por cima: não fecha com Esc. */
  bloqueado: boolean
  onClose: () => void
  onAbrir: (p: PainelFiscalPendencia) => void
  onNova: () => void
}) {
  const primeira = rows[0]
  const empresa = useEmpresaPorNome(primeira?.razao_social, nome)
  const abertos = ordenar(rows.filter((r) => !r.entregue_em), false)
  const entregues = ordenar(rows.filter((r) => r.entregue_em), true)
  const soma = (lista: PainelFiscalPendencia[]) =>
    lista.reduce((s, r) => s + Number(r.total ?? 0), 0)
  const valorAberto = soma(abertos)
  const valorEntregue = soma(entregues)
  const hoje = hojeLocal()
  const vencidos = abertos.filter((r) => r.vencimento && r.vencimento < hoje).length
  const cnd = statusCnd(rows)
  const comCnd = [...rows]
    .filter((r) => r.status_cnd || r.cnd || r.validade_cnd)
    .sort((a, b) => (b.validade_cnd ?? '').localeCompare(a.validade_cnd ?? ''))[0]

  const porOrgao = ['RFB', 'PGFN', 'CADIN']
    .map((o) => ({
      orgao: o,
      valor: soma(abertos.filter((r) => r.orgao.toUpperCase().includes(o))),
    }))
    .filter((o) => o.valor > 0)

  return (
    <DetalheModal
      aberto
      onClose={onClose}
      escapeBloqueado={bloqueado}
      empresa={empresa}
      titulo={nome}
      chips={
        <>
          <span className="rounded-full bg-brand-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-700 dark:text-brand-300">
            Pendências RFB / PGFN
          </span>
          {abertos.length === 0 && rows.length > 0 ? (
            <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
              Sem débitos em aberto
            </span>
          ) : null}
        </>
      }
      subtitulo={
        [primeira?.razao_social, primeira?.cnpj, porOrgao.map((o) => `${o.orgao} ${formatMoneyBRL(o.valor)}`).join(' · ')]
          .filter(Boolean)
          .join(' · ') || undefined
      }
      indicadores={
        <>
          <Indicador rotulo="Em aberto" alerta={vencidos > 0}>
            {formatMoneyBRL(valorAberto)}
          </Indicador>
          <Indicador rotulo="Entregue">{formatMoneyBRL(valorEntregue)}</Indicador>
          <Indicador rotulo="Débitos" alerta={vencidos > 0}>
            {abertos.length} em aberto
            {vencidos > 0 ? ` · ${vencidos} vencido${vencidos === 1 ? '' : 's'}` : ''}
          </Indicador>
          <Indicador rotulo="CND" alerta={cnd === 'Pendente'}>
            {cnd}
          </Indicador>
        </>
      }
      abas={[
        {
          id: 'abertos',
          rotulo: 'Em aberto',
          icon: Landmark,
          contador: abertos.length,
          conteudo: (
            <ListaDebitos
              rows={abertos}
              vazio="Nenhum débito em aberto. Tudo entregue."
              onAbrir={onAbrir}
            />
          ),
        },
        {
          id: 'entregues',
          rotulo: 'Entregues',
          icon: CheckCircle2,
          contador: entregues.length,
          conteudo: (
            <ListaDebitos rows={entregues} vazio="Nenhum débito entregue ainda." onAbrir={onAbrir} />
          ),
        },
        {
          id: 'cnd',
          rotulo: 'Certidão',
          icon: ShieldCheck,
          conteudo: (
            <div className="grid gap-4 rounded-2xl border border-[color:var(--color-line)] p-4 sm:grid-cols-3 lg:col-span-3">
              <Campo rotulo="Status CND">{comCnd?.status_cnd}</Campo>
              <Campo rotulo="Validade">
                {comCnd?.validade_cnd ? formatDate(comCnd.validade_cnd) : null}
              </Campo>
              <Campo rotulo="CND">{comCnd?.cnd}</Campo>
              <p className="text-xs text-[color:var(--color-muted)] sm:col-span-3">
                A certidão é editada dentro de cada débito, no bloco Certidão (CND).
              </p>
            </div>
          ),
        },
      ]}
      rodape={
        <>
          <p className="text-xs text-[color:var(--color-muted)]">
            {rows.length} {rows.length === 1 ? 'débito' : 'débitos'} · clique em um para ver, editar ou
            marcar como entregue
          </p>
          <div className="ml-auto flex gap-2">
            <button type="button" className="btn-ghost" onClick={onClose}>
              Fechar
            </button>
            {editable ? (
              <button type="button" className="btn-primary" onClick={onNova}>
                <Plus className="h-4 w-4" strokeWidth={1.75} />
                Nova pendência
              </button>
            ) : null}
          </div>
        </>
      }
    />
  )
}
