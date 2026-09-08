import { ChevronDown, Download, FileSpreadsheet, Presentation } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { apiDownload } from '../lib/api'

interface ExportMenuProps {
  query: string
  excelFilename?: string
  pptxFilename: string
}

type DownloadKind = 'excel' | 'pptx'

export default function ExportMenu({
  query,
  excelFilename = 'cronograma.xlsx',
  pptxFilename,
}: ExportMenuProps) {
  const [open, setOpen] = useState(false)
  const [kind, setKind] = useState<DownloadKind | null>(null)
  const [progress, setProgress] = useState<number | null>(null)
  const [error, setError] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)
  const menuId = useId()
  const busy = kind !== null

  useEffect(() => {
    if (!open) return

    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const download = async (nextKind: DownloadKind, path: string, filename: string) => {
    if (busy) return
    setOpen(false)
    setError('')
    setKind(nextKind)
    setProgress(null)
    try {
      await apiDownload(`${path}${query}`, filename, setProgress)
      setProgress(100)
      await new Promise((resolve) => window.setTimeout(resolve, 400))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível exportar')
    } finally {
      setKind(null)
      setProgress(null)
    }
  }

  useEffect(() => {
    if (!error) return
    const timer = window.setTimeout(() => setError(''), 6000)
    return () => window.clearTimeout(timer)
  }, [error])

  const statusLabel =
    kind === 'excel'
      ? 'Gerando Excel…'
      : kind === 'pptx'
        ? 'Gerando Market Call…'
        : ''

  return (
    <div className="relative" ref={rootRef}>
      {busy && (
        <div className="download-bar" role="status" aria-live="polite">
          <div className="download-bar-track">
            <div
              className={
                progress == null
                  ? 'download-bar-fill is-indeterminate'
                  : 'download-bar-fill'
              }
              style={progress == null ? undefined : { width: `${progress}%` }}
            />
          </div>
          <div className="glass-dropdown mx-auto mt-3 w-fit px-3 py-1.5 text-xs font-medium text-[color:var(--color-ink)]">
            {statusLabel}
            {progress != null ? ` ${progress}%` : ''}
          </div>
        </div>
      )}
      {error && (
        <p className="absolute top-[calc(100%+0.35rem)] right-0 z-50 w-64 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-500/30 dark:bg-rose-950/80 dark:text-rose-200">
          {error}
        </p>
      )}
      <button
        type="button"
        className="btn-ghost"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={menuId}
        aria-busy={busy}
        disabled={busy}
        onClick={() => {
          setError('')
          setOpen((current) => !current)
        }}
      >
        <Download className="h-4 w-4" strokeWidth={1.75} />
        {busy ? 'Exportando…' : 'Exportar'}
        <ChevronDown className="h-3.5 w-3.5" strokeWidth={1.75} />
      </button>
      {open && (
        <div
          id={menuId}
          role="menu"
          className="glass-dropdown absolute top-[calc(100%+0.35rem)] right-0 z-50 w-52 p-1.5"
        >
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-medium text-[color:var(--color-ink)] transition-colors hover:bg-brand-500/10 hover:text-brand-600"
            role="menuitem"
            disabled={busy}
            onClick={() =>
              void download('excel', '/api/obrigacoes/export.xlsx', excelFilename)
            }
          >
            <FileSpreadsheet className="h-4 w-4" strokeWidth={1.75} />
            Excel
          </button>
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-medium text-[color:var(--color-ink)] transition-colors hover:bg-brand-500/10 hover:text-brand-600"
            role="menuitem"
            disabled={busy}
            onClick={() =>
              void download('pptx', '/api/obrigacoes/export.pptx', pptxFilename)
            }
          >
            <Presentation className="h-4 w-4" strokeWidth={1.75} />
            Market Call
          </button>
        </div>
      )}
    </div>
  )
}

export function marketCallFilename(competencia: string): string {
  const [year, month] = competencia.split('-')
  const mm = (month || '01').padStart(2, '0')
  const period = Number(month) || 1
  return `${mm}.${year || '0000'} - Market Call BR - P${period}.pptx`
}
