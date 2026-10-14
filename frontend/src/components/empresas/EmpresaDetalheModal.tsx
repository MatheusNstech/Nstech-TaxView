import {
  AlertTriangle,
  ArrowUpRight,
  Building,
  Download,
  Eye,
  Info,
  KeyRound,
  Loader2,
  Pencil,
  ShieldCheck,
  Trash2,
  Upload,
  Users,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react'
import { apiDownload, apiFetch, apiUpload } from '../../lib/api'
import {
  SITUACAO_CERTIDAO,
  alertasCertificado,
  cartaoCnpjArquivo,
  cartaoCnpjDocumento,
  cartaoCnpjPath,
  certificadoArquivo,
  certificadoPath,
  cndArquivo,
  cndDocumento,
  cndPath,
  diaBrasilia,
  diasParaVencer,
  formatAtualizadoEm,
  formatDiaIso,
  grupoComCartao,
  grupoComCertidao,
  grupoComCertificado,
  type DocumentoPdf,
} from '../../lib/documentosEmpresa'
import type { Certidao, CertificadoDigital, Empresa, EmpresaGrupo, EmpresaUnidade } from '../../types'
import DocumentoPdfViewer from './DocumentoPdfViewer'
import { CapaFundo, EmailsContasPagar, NomesContabil, Vazio, buTheme } from './EmpresaCard'

const SAIDA_MS = 220

interface Props {
  grupo: EmpresaGrupo | null
  canEdit: boolean
  onClose: () => void
  onEdit: (grupo: EmpresaGrupo) => void
  onVerObrigacoes: (grupo: EmpresaGrupo, apenasAtrasadas: boolean) => void
  onCartaoAlterado: (empresaId: string, atualizadoEm: string | null) => void
  onCertidaoAlterada: (raiz: string, esfera: Certidao['esfera'], certidao: Certidao | null) => void
  onCertificadoAlterado: (empresaId: string, certificado: CertificadoDigital | null) => void
}

function Bloco({
  icon: Icon,
  titulo,
  extra,
  children,
  visivel,
  ordem,
  className = '',
}: {
  icon: typeof Users
  titulo: string
  extra?: ReactNode
  children: ReactNode
  visivel: boolean
  ordem: number
  className?: string
}) {
  const style: CSSProperties = { transitionDelay: visivel ? `${120 + ordem * 60}ms` : '0ms' }
  return (
    <section
      style={style}
      className={[
        'flex min-w-0 flex-col rounded-2xl border border-[color:var(--color-line)] p-4 transition duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]',
        visivel ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0',
        className,
      ].join(' ')}
    >
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[color:var(--color-surface)] text-[color:var(--color-muted)]">
          <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
        </span>
        <h3 className="flex-1 text-xs font-semibold uppercase tracking-wide text-[color:var(--color-muted)]">{titulo}</h3>
        {extra}
      </div>
      {children}
    </section>
  )
}

function Subtitulo({ children }: { children: ReactNode }) {
  return <p className="mb-2 text-xs font-medium text-[color:var(--color-muted)]">{children}</p>
}

function Indicador({
  rotulo,
  children,
  alerta = false,
  onClick,
  title,
}: {
  rotulo: string
  children: ReactNode
  alerta?: boolean
  onClick?: () => void
  title?: string
}) {
  const conteudo = (
    <>
      <p className="flex items-center gap-1 text-[11px] text-[color:var(--color-muted)]">
        {rotulo}
        {onClick && (
          <ArrowUpRight
            className="h-3 w-3 opacity-0 transition group-hover/ind:opacity-100"
            strokeWidth={2.25}
          />
        )}
      </p>
      <div
        className={`flex items-center gap-1 text-base font-semibold leading-tight ${
          alerta ? 'text-[#B71D18] dark:text-[#FF8A75]' : 'text-[color:var(--color-ink)]'
        }`}
      >
        {children}
      </div>
    </>
  )
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        title={title}
        className="group/ind px-5 py-2.5 text-left transition hover:bg-[color:var(--nav-hover)]"
      >
        {conteudo}
      </button>
    )
  }
  return (
    <div className="px-5 py-2.5" title={title}>
      {conteudo}
    </div>
  )
}

const botaoDoc =
  'inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-[color:var(--color-line)] px-2.5 py-1 text-xs font-medium text-[color:var(--color-ink)] transition hover:bg-[color:var(--nav-hover)] disabled:opacity-40'
const botaoIcone =
  'shrink-0 rounded-lg p-1.5 text-[color:var(--color-muted)] transition hover:bg-[color:var(--nav-hover)] hover:text-[color:var(--color-ink)] disabled:opacity-40'

function DocumentoAcoes({
  rotulo,
  tem,
  canEdit,
  onVisualizar,
  baixar,
  enviar,
  onAbrirEnvio,
  remover,
  onErro,
}: {
  rotulo: string
  tem: boolean
  canEdit: boolean
  onVisualizar?: () => void
  baixar: () => Promise<void>
  enviar?: (file: File) => Promise<void>
  /** Substitui o seletor de PDF quando o envio precisa de um formulário próprio. */
  onAbrirEnvio?: () => void
  remover: () => Promise<void>
  onErro: (mensagem: string) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [ocupado, setOcupado] = useState(false)

  const executar = async (acao: () => Promise<void>) => {
    setOcupado(true)
    onErro('')
    try {
      await acao()
    } catch (err) {
      onErro(err instanceof Error ? err.message : `Erro no ${rotulo}`)
    } finally {
      setOcupado(false)
    }
  }

  return (
    <div className="flex shrink-0 items-center gap-1.5">
      {ocupado && <Loader2 className="h-3.5 w-3.5 animate-spin text-[color:var(--color-muted)]" strokeWidth={2} />}
      {tem && (
        <>
          {onVisualizar && (
            <button type="button" onClick={onVisualizar} className={botaoDoc} aria-label={`Visualizar ${rotulo}`}>
              <Eye className="h-3.5 w-3.5" strokeWidth={2} />
              Visualizar
            </button>
          )}
          <button
            type="button"
            disabled={ocupado}
            onClick={() => void executar(baixar)}
            className={botaoDoc}
            aria-label={`Baixar ${rotulo}`}
          >
            <Download className="h-3.5 w-3.5" strokeWidth={2} />
            Baixar
          </button>
        </>
      )}
      {canEdit && (
        <>
          <button
            type="button"
            disabled={ocupado}
            onClick={onAbrirEnvio ?? (() => inputRef.current?.click())}
            className={tem ? botaoIcone : botaoDoc}
            title={tem ? `Trocar ${rotulo}` : `Enviar ${rotulo}`}
            aria-label={`${tem ? 'Trocar' : 'Enviar'} ${rotulo}`}
          >
            <Upload className="h-3.5 w-3.5" strokeWidth={2} />
            {!tem && 'Enviar'}
          </button>
          {tem && (
            <button
              type="button"
              disabled={ocupado}
              onClick={() => {
                if (window.confirm(`Remover ${rotulo}?`)) void executar(remover)
              }}
              className={`${botaoIcone} hover:text-rose-600`}
              title={`Remover ${rotulo}`}
              aria-label={`Remover ${rotulo}`}
            >
              <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
            </button>
          )}
          {enviar && (
            <input
              ref={inputRef}
              type="file"
              accept="application/pdf,.pdf"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                e.target.value = ''
                if (file) void executar(() => enviar(file))
              }}
            />
          )}
        </>
      )}
    </div>
  )
}

function CertificadoResumo({ certificado }: { certificado: CertificadoDigital | null }) {
  if (!certificado?.valido_ate) {
    return (
      <p className="text-[11px] leading-tight text-[color:var(--color-muted)]">
        Certificado digital
        <br />
        <span className="text-[color:var(--color-ink)]">não enviado</span>
      </p>
    )
  }
  const validoAte = diaBrasilia(certificado.valido_ate)
  const [texto, classe] = prazo(diasParaVencer(validoAte), 'vencido')
  const detalhes = [
    certificado.titular && `Titular: ${certificado.titular}`,
    certificado.emissor && `Emissor: ${certificado.emissor}`,
    certificado.numero_serie && `Série: ${certificado.numero_serie}`,
    `Atualizado em ${formatAtualizadoEm(certificado.atualizado_em)}`,
  ]
  return (
    <p className="text-[11px] leading-tight text-[color:var(--color-muted)]" title={detalhes.filter(Boolean).join('\n')}>
      Certificado digital
      <br />
      <span className="text-[color:var(--color-ink)]">válido até {formatDiaIso(validoAte)}</span>
      <span className={`block ${classe}`}>{texto}</span>
    </p>
  )
}

/** O certificado que vence primeiro no grupo (com vários CNPJs, é o que pede atenção). */
function IndicadorCertificado({ grupo }: { grupo: EmpresaGrupo }) {
  const unidades = [grupo.matriz, ...grupo.filiais]
  const proximo = unidades
    .flatMap((u) => (u.certificado?.valido_ate ? [{ unidade: u, validoAte: diaBrasilia(u.certificado.valido_ate) }] : []))
    .sort((a, b) => a.validoAte.localeCompare(b.validoAte))[0]
  if (!proximo) {
    return (
      <Indicador rotulo="Certificado digital">
        <span className="text-sm font-normal text-[color:var(--color-muted)]">não enviado</span>
      </Indicador>
    )
  }
  const dias = diasParaVencer(proximo.validoAte)
  const [texto, classe] = prazo(dias, 'vencido')
  const comCertificado = unidades.filter((u) => u.certificado).length
  return (
    <Indicador
      rotulo={unidades.length > 1 ? `Certificado digital · ${comCertificado}/${unidades.length}` : 'Certificado digital'}
      alerta={dias <= 0}
      title={`Vence primeiro: ${proximo.unidade.cnpj}`}
    >
      {dias <= 30 && <AlertTriangle className={`h-4 w-4 ${classe}`} strokeWidth={2} />}
      {formatDiaIso(proximo.validoAte)}
      <span className={`ml-1 text-xs font-normal ${classe}`}>{texto}</span>
    </Indicador>
  )
}

function AlertaCertificados({ grupo }: { grupo: EmpresaGrupo }) {
  const alertas = alertasCertificado(grupo)
  if (!alertas.length) return null
  const vencido = alertas[0].dias <= 0
  return (
    <div
      role="alert"
      className={`flex gap-2.5 rounded-2xl border px-4 py-3 text-sm lg:col-span-5 ${
        vencido
          ? 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200'
          : 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200'
      }`}
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} />
      <ul className="space-y-0.5">
        {alertas.map(({ unidade, validoAte, dias }) => (
          <li key={unidade.id}>
            Certificado digital de <span className="font-mono text-xs font-semibold">{unidade.cnpj}</span>{' '}
            {dias < 0
              ? `vencido em ${formatDiaIso(validoAte)}`
              : dias === 0
                ? 'vence hoje'
                : `vence em ${dias} ${dias === 1 ? 'dia' : 'dias'} (${formatDiaIso(validoAte)})`}
          </li>
        ))}
      </ul>
    </div>
  )
}

function CertificadoEnvio({
  unidade,
  onSalvo,
  onCancelar,
}: {
  unidade: EmpresaUnidade
  onSalvo: (certificado: CertificadoDigital) => void
  onCancelar: () => void
}) {
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [senha, setSenha] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState('')

  const salvar = async (e: FormEvent) => {
    e.preventDefault()
    if (!arquivo || !senha) return
    setOcupado(true)
    setErro('')
    const form = new FormData()
    form.append('file', arquivo)
    form.append('senha', senha)
    try {
      const certificado = await apiUpload<CertificadoDigital>(certificadoPath(unidade.id), form)
      setSenha('')
      onSalvo(certificado)
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao ler o certificado')
    } finally {
      setOcupado(false)
    }
  }

  const campo =
    'min-w-0 rounded-lg border border-[color:var(--color-line)] bg-transparent px-2.5 py-1.5 text-xs text-[color:var(--color-ink)] outline-none focus:border-[color:var(--color-ink)]'

  return (
    <form
      onSubmit={(e) => void salvar(e)}
      className="mt-2 rounded-xl border border-dashed border-[color:var(--color-line)] p-3"
      autoComplete="off"
    >
      <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-[color:var(--color-ink)]">
        <KeyRound className="h-3.5 w-3.5" strokeWidth={2} />
        Certificado digital de {unidade.cnpj}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="file"
          accept=".pfx,.p12,application/x-pkcs12"
          aria-label="Arquivo do certificado (.pfx)"
          onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
          className={`${campo} flex-1 file:mr-2 file:rounded-md file:border-0 file:bg-[color:var(--color-surface)] file:px-2 file:py-0.5 file:text-xs file:text-[color:var(--color-ink)]`}
        />
        <input
          type="password"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          placeholder="Senha do certificado"
          aria-label="Senha do certificado"
          autoComplete="new-password"
          className={`${campo} w-48`}
        />
        <button type="submit" disabled={!arquivo || !senha || ocupado} className={botaoDoc}>
          {ocupado ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
          ) : (
            <Upload className="h-3.5 w-3.5" strokeWidth={2} />
          )}
          Ler e salvar
        </button>
        <button
          type="button"
          onClick={() => {
            setSenha('')
            onCancelar()
          }}
          className={botaoIcone}
          aria-label="Cancelar envio do certificado"
        >
          <X className="h-3.5 w-3.5" strokeWidth={2} />
        </button>
      </div>
      <p className="mt-1.5 text-[11px] text-[color:var(--color-muted)]">
        A senha só é usada para ler a validade e não fica salva. O arquivo é guardado como{' '}
        <span className="font-mono">{certificadoArquivo(unidade.cnpj)}</span>.
      </p>
      {erro && <p className="mt-1.5 text-xs text-rose-600 dark:text-rose-400">{erro}</p>}
    </form>
  )
}

function UnidadeLinha({
  unidade,
  canEdit,
  onVisualizar,
  onCartaoAlterado,
  onCertificadoAlterado,
}: {
  unidade: EmpresaUnidade
  canEdit: boolean
  onVisualizar: (documento: DocumentoPdf) => void
  onCartaoAlterado: (empresaId: string, atualizadoEm: string | null) => void
  onCertificadoAlterado: (empresaId: string, certificado: CertificadoDigital | null) => void
}) {
  const [aberta, setAberta] = useState(false)
  const [enviandoCertificado, setEnviandoCertificado] = useState(false)
  const [erro, setErro] = useState('')
  const contabil = unidade.contatos.filter((c) => c.area === 'contabil')
  const pagar = unidade.contatos.filter((c) => c.area === 'contas_pagar')
  const fantasia = unidade.nome_fantasia && unidade.nome_fantasia !== unidade.razao_social ? unidade.nome_fantasia : null
  const atualizado = formatAtualizadoEm(unidade.cartao_cnpj_atualizado_em)
  const rotulo = `Cartão CNPJ de ${unidade.cnpj}`

  return (
    <li className="px-1 py-3 first:pt-1 last:pb-1">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="min-w-[14rem] flex-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-medium text-[color:var(--color-ink)]">{unidade.cnpj}</span>
            <span
              className={`rounded px-1.5 py-px text-[10px] font-semibold uppercase ${
                unidade.matriz
                  ? 'bg-[color:var(--color-ink)] text-[color:var(--color-panel)]'
                  : 'bg-[color:var(--color-surface)] text-[color:var(--color-muted)]'
              }`}
            >
              {unidade.matriz ? 'Matriz' : 'Filial'}
            </span>
            {unidade.contatos_diferentes && (
              <button
                type="button"
                onClick={() => setAberta((v) => !v)}
                className={`rounded-md p-0.5 transition hover:text-[color:var(--color-ink)] ${
                  aberta ? 'text-[color:var(--color-ink)]' : 'text-amber-600 dark:text-amber-400'
                }`}
                title="Esta unidade tem responsáveis próprios"
                aria-label={`Responsáveis próprios de ${unidade.cnpj}`}
                aria-expanded={aberta}
              >
                <Info className="h-3.5 w-3.5" strokeWidth={2} />
              </button>
            )}
          </div>
          <p className="mt-0.5 text-xs text-[color:var(--color-muted)]">
            {fantasia && <span className="font-medium text-[color:var(--color-ink)]">{fantasia} · </span>}
            {unidade.razao_social}
          </p>
        </div>
        <div className="grid shrink-0 grid-cols-[9.5rem_auto] items-center gap-x-4 gap-y-2.5">
          <p className="text-[11px] leading-tight text-[color:var(--color-muted)]">
            Cartão CNPJ
            <br />
            <span className="text-[color:var(--color-ink)]">{atualizado ? `atualizado em ${atualizado}` : 'não enviado'}</span>
          </p>
          <div className="justify-self-end">
            <DocumentoAcoes
              rotulo={rotulo}
              tem={Boolean(unidade.cartao_cnpj_atualizado_em)}
              canEdit={canEdit}
              onVisualizar={() => onVisualizar(cartaoCnpjDocumento(unidade))}
              baixar={() => apiDownload(cartaoCnpjPath(unidade.id, true), cartaoCnpjArquivo(unidade.cnpj))}
              enviar={async (file) => {
                const form = new FormData()
                form.append('file', file)
                const empresa = await apiUpload<Empresa>(cartaoCnpjPath(unidade.id), form)
                onCartaoAlterado(unidade.id, empresa.cartao_cnpj_atualizado_em ?? new Date().toISOString())
              }}
              remover={async () => {
                await apiFetch<void>(cartaoCnpjPath(unidade.id), { method: 'DELETE' })
                onCartaoAlterado(unidade.id, null)
              }}
              onErro={setErro}
            />
          </div>
          <CertificadoResumo certificado={unidade.certificado} />
          <div className="justify-self-end">
            <DocumentoAcoes
              rotulo={`Certificado digital de ${unidade.cnpj}`}
              tem={Boolean(unidade.certificado)}
              canEdit={canEdit}
              baixar={() => apiDownload(certificadoPath(unidade.id), certificadoArquivo(unidade.cnpj))}
              onAbrirEnvio={() => setEnviandoCertificado((v) => !v)}
              remover={async () => {
                await apiFetch<void>(certificadoPath(unidade.id), { method: 'DELETE' })
                onCertificadoAlterado(unidade.id, null)
              }}
              onErro={setErro}
            />
          </div>
        </div>
      </div>
      {erro && <p className="mt-1.5 text-xs text-rose-600 dark:text-rose-400">{erro}</p>}
      {canEdit && enviandoCertificado && (
        <CertificadoEnvio
          unidade={unidade}
          onSalvo={(certificado) => {
            setEnviandoCertificado(false)
            onCertificadoAlterado(unidade.id, certificado)
          }}
          onCancelar={() => setEnviandoCertificado(false)}
        />
      )}
      {aberta && (
        <div className="mt-2 space-y-1 border-t border-dashed border-[color:var(--color-line)] pt-2">
          {contabil.length > 0 && (
            <p className="text-[11px] text-[color:var(--color-muted)]">
              Contábil: <span className="text-[color:var(--color-ink)]">{contabil.map((c) => c.nome).join(', ')}</span>
            </p>
          )}
          {pagar.length > 0 && <EmailsContasPagar contatos={pagar} />}
        </div>
      )}
    </li>
  )
}

const VERMELHO = 'text-rose-600 dark:text-rose-400'
const AMBAR = 'text-amber-600 dark:text-amber-400'

function prazo(dias: number, vencido: string): [texto: string, classe: string] {
  if (dias < 0) return [`${vencido} há ${-dias} ${dias === -1 ? 'dia' : 'dias'}`, VERMELHO]
  if (dias === 0) return ['vence hoje', VERMELHO]
  return [
    `vence em ${dias} ${dias === 1 ? 'dia' : 'dias'}`,
    dias <= 30 ? AMBAR : 'text-[color:var(--color-muted)]',
  ]
}

function Validade({ validaAte }: { validaAte: string | null }) {
  if (!validaAte) return <span className="text-[color:var(--color-muted)]">—</span>
  const [texto, classe] = prazo(diasParaVencer(validaAte), 'vencida')
  return (
    <>
      {formatDiaIso(validaAte)}
      <span className={`block text-[11px] font-normal ${classe}`}>{texto}</span>
    </>
  )
}

function Dado({ rotulo, children, mono = false }: { rotulo: string; children: ReactNode; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] text-[color:var(--color-muted)]">{rotulo}</p>
      <div className={`text-sm font-medium text-[color:var(--color-ink)] ${mono ? 'break-all font-mono text-xs' : ''}`}>
        {children}
      </div>
    </div>
  )
}

function CndFederal({
  grupo,
  canEdit,
  onVisualizar,
  onAlterada,
}: {
  grupo: EmpresaGrupo
  canEdit: boolean
  onVisualizar: (documento: DocumentoPdf) => void
  onAlterada: (certidao: Certidao | null) => void
}) {
  const [erro, setErro] = useState('')
  const cnd = grupo.certidoes.find((c) => c.esfera === 'federal') ?? null
  const situacao = cnd?.situacao ? SITUACAO_CERTIDAO[cnd.situacao] : null
  const matrizId = cnd?.empresa_id ?? grupo.matriz.id
  const alcance = grupo.filiais.length
    ? `Vale para a matriz e ${grupo.filiais.length === 1 ? 'a filial' : `as ${grupo.filiais.length} filiais`}`
    : 'Vale para a matriz'

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-[color:var(--color-ink)]">CND Federal</span>
        {situacao && (
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${situacao.classe}`}>{situacao.rotulo}</span>
        )}
      </div>
      <p className="mt-0.5 text-xs text-[color:var(--color-muted)]">Receita Federal e PGFN · {alcance}</p>

      {cnd ? (
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Dado rotulo="Emitida em">{formatDiaIso(cnd.emitida_em)}</Dado>
          <Dado rotulo="Válida até">
            <Validade validaAte={cnd.valida_ate} />
          </Dado>
          <Dado rotulo="Código de controle" mono>
            {cnd.codigo_controle ?? '—'}
          </Dado>
        </div>
      ) : (
        <div className="mt-3">
          <Vazio texto="Nenhuma CND Federal cadastrada" />
        </div>
      )}

      {(cnd || canEdit) && (
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[color:var(--color-line)] pt-3">
          <DocumentoAcoes
            rotulo="CND Federal"
            tem={Boolean(cnd)}
            canEdit={canEdit}
            onVisualizar={() => cnd && onVisualizar(cndDocumento(grupo, cnd))}
            baixar={() => apiDownload(cndPath(matrizId, true), cndArquivo(grupo.matriz.cnpj))}
            enviar={async (file) => {
              const form = new FormData()
              form.append('file', file)
              onAlterada(await apiUpload<Certidao>(cndPath(matrizId), form))
            }}
            remover={async () => {
              await apiFetch<void>(cndPath(matrizId), { method: 'DELETE' })
              onAlterada(null)
            }}
            onErro={setErro}
          />
          {cnd && (
            <span className="ml-auto text-[11px] text-[color:var(--color-muted)]">
              atualizada em {formatAtualizadoEm(cnd.atualizado_em)}
            </span>
          )}
        </div>
      )}
      {erro && <p className="mt-1.5 text-xs text-rose-600 dark:text-rose-400">{erro}</p>}
    </div>
  )
}

export default function EmpresaDetalheModal({
  grupo,
  canEdit,
  onClose,
  onEdit,
  onVerObrigacoes,
  onCartaoAlterado,
  onCertidaoAlterada,
  onCertificadoAlterado,
}: Props) {
  const [atual, setAtual] = useState<EmpresaGrupo | null>(grupo)
  const [visivel, setVisivel] = useState(false)
  const [documento, setDocumento] = useState<DocumentoPdf | null>(null)
  const painelRef = useRef<HTMLDivElement>(null)

  const cartaoAlterado = useCallback(
    (empresaId: string, atualizadoEm: string | null) => {
      setAtual((g) => (g ? grupoComCartao(g, empresaId, atualizadoEm) : g))
      onCartaoAlterado(empresaId, atualizadoEm)
    },
    [onCartaoAlterado],
  )
  const certificadoAlterado = useCallback(
    (empresaId: string, certificado: CertificadoDigital | null) => {
      setAtual((g) => (g ? grupoComCertificado(g, empresaId, certificado) : g))
      onCertificadoAlterado(empresaId, certificado)
    },
    [onCertificadoAlterado],
  )
  const fecharDocumento = useCallback(() => setDocumento(null), [])

  useEffect(() => {
    if (!grupo) return
    setAtual(grupo)
    const id = window.setTimeout(() => {
      // Força o cálculo do estado inicial para a transição de entrada sempre rodar.
      painelRef.current?.getBoundingClientRect()
      setVisivel(true)
    }, 20)
    return () => window.clearTimeout(id)
  }, [grupo])

  const fechar = useCallback(
    (depois?: () => void) => {
      setVisivel(false)
      setDocumento(null)
      window.setTimeout(() => {
        setAtual(null)
        ;(depois ?? onClose)()
      }, SAIDA_MS)
    },
    [onClose],
  )

  useEffect(() => {
    if (!atual || documento) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') fechar()
    }
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = overflow
      window.removeEventListener('keydown', onKey)
    }
  }, [atual, documento, fechar])

  if (!atual) return null

  const theme = buTheme(atual.bus[0])
  const cnpjs = 1 + atual.filiais.length
  const pct = atual.obrigacoes_total
    ? Math.round((atual.obrigacoes_entregues / atual.obrigacoes_total) * 100)
    : 0
  const botaoTopo =
    'rounded-lg text-[color:var(--color-muted)] transition hover:bg-[color:var(--nav-hover)] hover:text-[color:var(--color-ink)]'

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={atual.nome}>
      <button
        type="button"
        aria-label="Fechar"
        onClick={() => fechar()}
        className={`absolute inset-0 cursor-default bg-slate-950/55 backdrop-blur-md transition-opacity duration-300 ${
          visivel ? 'opacity-100' : 'opacity-0'
        }`}
      />

      <div
        ref={painelRef}
        className={[
          'relative z-10 flex max-h-[calc(100dvh-2rem)] w-full max-w-5xl flex-col overflow-hidden rounded-[1.5rem] border border-[color:var(--color-line)] bg-white shadow-2xl dark:bg-[color:var(--color-panel)]',
          'transition duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]',
          visivel ? 'translate-y-0 scale-100 opacity-100' : 'translate-y-6 scale-95 opacity-0',
        ].join(' ')}
      >
        <header className="relative flex shrink-0 items-center gap-4 border-b border-[color:var(--color-line)] px-5 py-4">
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.06] dark:opacity-[0.12]"
            style={{ background: `linear-gradient(100deg, ${theme.from} 0%, transparent 70%)` }}
          />
          <div className="relative h-16 w-24 shrink-0 overflow-hidden rounded-xl shadow-sm ring-1 ring-black/5 dark:ring-white/10">
            <CapaFundo
              grupo={atual}
              logoClassName="p-2"
              iniciaisClassName="text-xl"
              className={`transition-transform duration-700 ease-out ${visivel ? 'scale-100' : 'scale-125'}`}
            />
          </div>
          <div
            className={`relative min-w-0 flex-1 transition duration-500 delay-100 ease-out ${
              visivel ? 'translate-x-0 opacity-100' : '-translate-x-2 opacity-0'
            }`}
          >
            <div className="flex min-w-0 items-center gap-2">
              <h2 className="truncate text-xl font-bold text-[color:var(--color-ink)]">{atual.nome}</h2>
              <div className="flex shrink-0 gap-1">
                {atual.bus.map((bu) => (
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
            <p className="truncate text-sm text-[color:var(--color-muted)]" title={atual.matriz.razao_social}>
              {atual.matriz.razao_social} · <span className="font-mono text-xs">{atual.matriz.cnpj}</span>
            </p>
          </div>
          <div className="relative flex shrink-0 gap-1 self-start">
            {canEdit && (
              <button
                type="button"
                onClick={() => fechar(() => onEdit(atual))}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium ${botaoTopo}`}
              >
                <Pencil className="h-3.5 w-3.5" strokeWidth={2} />
                Editar
              </button>
            )}
            <button type="button" onClick={() => fechar()} className={`p-1.5 ${botaoTopo}`} aria-label="Fechar">
              <X className="h-4 w-4" strokeWidth={2} />
            </button>
          </div>
        </header>

        <div className="grid shrink-0 grid-cols-2 divide-x divide-y divide-[color:var(--color-line)] border-b border-[color:var(--color-line)] sm:grid-cols-4 sm:divide-y-0">
          <Indicador rotulo="Porte">{atual.porte ?? '—'}</Indicador>
          <Indicador rotulo="CNPJs">
            {cnpjs}
            <span className="text-xs font-normal text-[color:var(--color-muted)]">
              {cnpjs === 1 ? 'matriz' : `matriz + ${atual.filiais.length}`}
            </span>
          </Indicador>
          <Indicador
            rotulo="Obrigações no mês"
            title="Ver as obrigações desta empresa no mês"
            onClick={() => onVerObrigacoes(atual, false)}
          >
            <span>
              {atual.obrigacoes_entregues}
              <span className="text-sm font-normal text-[color:var(--color-muted)]">/{atual.obrigacoes_total}</span>
            </span>
            <span className="ml-1.5 h-1.5 flex-1 overflow-hidden rounded-full bg-[color:var(--color-surface)]">
              <span
                className="block h-full rounded-full transition-[width] delay-200 duration-700 ease-out"
                style={{ width: visivel ? `${pct}%` : '0%', background: theme.from }}
              />
            </span>
          </Indicador>
          <IndicadorCertificado grupo={atual} />
        </div>

        <div className="grid min-h-0 flex-1 items-stretch gap-4 overflow-y-auto p-5 lg:grid-cols-5">
          <AlertaCertificados grupo={atual} />
          <Bloco icon={Users} titulo="Responsáveis da empresa" visivel={visivel} ordem={0} className="lg:col-span-2">
            <Subtitulo>Contábil</Subtitulo>
            <NomesContabil contatos={atual.contatos.contabil} />
            <div className="mt-3 border-t border-[color:var(--color-line)] pt-3">
              <Subtitulo>Contas a pagar</Subtitulo>
              <EmailsContasPagar contatos={atual.contatos.contas_pagar} />
            </div>
          </Bloco>

          <Bloco icon={ShieldCheck} titulo="Certidões" visivel={visivel} ordem={1} className="lg:col-span-3">
            <CndFederal
              grupo={atual}
              canEdit={canEdit}
              onVisualizar={setDocumento}
              onAlterada={(certidao) => {
                setAtual((g) => (g ? grupoComCertidao(g, 'federal', certidao) : g))
                onCertidaoAlterada(atual.raiz, 'federal', certidao)
              }}
            />
          </Bloco>

          <Bloco
            icon={Building}
            titulo={atual.filiais.length ? `CNPJs · matriz e ${atual.filiais.length} ${atual.filiais.length === 1 ? 'filial' : 'filiais'}` : 'CNPJ · matriz'}
            visivel={visivel}
            ordem={2}
            className="lg:col-span-5"
          >
            <ul className="divide-y divide-[color:var(--color-line)]">
              {[atual.matriz, ...atual.filiais].map((u) => (
                <UnidadeLinha
                  key={u.id}
                  unidade={u}
                  canEdit={canEdit}
                  onVisualizar={setDocumento}
                  onCartaoAlterado={cartaoAlterado}
                  onCertificadoAlterado={certificadoAlterado}
                />
              ))}
            </ul>
          </Bloco>
        </div>
      </div>
      <DocumentoPdfViewer documento={documento} onClose={fecharDocumento} />
    </div>
  )
}
