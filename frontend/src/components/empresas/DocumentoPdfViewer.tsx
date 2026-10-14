import { Download, FileText, Loader2, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { apiBlob, triggerDownload } from '../../lib/api'
import type { DocumentoPdf } from '../../lib/documentosEmpresa'

interface Props {
  documento: DocumentoPdf | null
  onClose: () => void
}

interface Carregado {
  path: string
  blob?: Blob
  url?: string
  erro?: string
}

export default function DocumentoPdfViewer({ documento, onClose }: Props) {
  const [carregado, setCarregado] = useState<Carregado | null>(null)

  const path = documento?.path
  useEffect(() => {
    if (!path) return
    let ativo = true
    let criada: string | null = null
    apiBlob(path)
      .then((blob) => {
        if (!ativo) return
        criada = URL.createObjectURL(blob)
        setCarregado({ path, blob, url: criada })
      })
      .catch((err: unknown) => {
        if (!ativo) return
        const erro = err instanceof Error ? err.message : 'Erro ao abrir o documento'
        setCarregado({ path, erro })
      })
    return () => {
      ativo = false
      if (criada) URL.revokeObjectURL(criada)
    }
  }, [path])

  const atual = carregado?.path === path ? carregado : null
  const blob = atual?.blob
  const url = atual?.url
  const erro = atual?.erro

  useEffect(() => {
    if (!documento) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [documento, onClose])

  if (!documento) return null

  const botao =
    'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-[color:var(--color-muted)] transition hover:bg-[color:var(--nav-hover)] hover:text-[color:var(--color-ink)] disabled:opacity-40'

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={documento.titulo}
    >
      <button
        type="button"
        aria-label="Fechar"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-slate-950/60 backdrop-blur-sm"
      />
      <div className="relative z-10 flex h-[calc(100dvh-2rem)] w-full max-w-5xl flex-col overflow-hidden rounded-[1.5rem] border border-[color:var(--color-line)] bg-white shadow-2xl dark:bg-[color:var(--color-panel)]">
        <header className="flex shrink-0 items-center gap-3 border-b border-[color:var(--color-line)] px-5 py-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[color:var(--color-surface)] text-[color:var(--color-muted)]">
            <FileText className="h-4 w-4" strokeWidth={1.75} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-sm font-semibold text-[color:var(--color-ink)]" title={documento.titulo}>
              {documento.titulo}
            </h2>
            <p className="truncate text-xs text-[color:var(--color-muted)]">{documento.subtitulo}</p>
          </div>
          <button
            type="button"
            disabled={!blob}
            onClick={() => blob && triggerDownload(blob, documento.arquivo)}
            className={botao}
          >
            <Download className="h-3.5 w-3.5" strokeWidth={2} />
            Baixar
          </button>
          <button type="button" onClick={onClose} className={`${botao} px-1.5`} aria-label="Fechar">
            <X className="h-4 w-4" strokeWidth={2} />
          </button>
        </header>
        <div className="relative min-h-0 flex-1 bg-[color:var(--color-surface)]">
          {url ? (
            <iframe src={`${url}#view=FitH`} title={documento.titulo} className="h-full w-full border-0" />
          ) : erro ? (
            <p className="flex h-full items-center justify-center px-6 text-center text-sm text-rose-600 dark:text-rose-400">
              {erro}
            </p>
          ) : (
            <div className="flex h-full items-center justify-center gap-2 text-sm text-[color:var(--color-muted)]">
              <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
              Carregando documento…
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
