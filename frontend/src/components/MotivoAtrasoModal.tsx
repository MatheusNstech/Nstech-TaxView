import { X } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'

interface MotivoAtrasoModalProps {
  open: boolean
  title: string
  subtitle?: string
  submitting?: boolean
  onCancel: () => void
  onConfirm: (motivo: string) => void | Promise<void>
}

export default function MotivoAtrasoModal({
  open,
  title,
  subtitle,
  submitting = false,
  onCancel,
  onConfirm,
}: MotivoAtrasoModalProps) {
  const [motivo, setMotivo] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setMotivo('')
    setError('')
  }, [open, title])

  if (!open) return null

  const trimmed = motivo.trim()
  const canSubmit = trimmed.length >= 50 && !submitting

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (trimmed.length < 50) {
      setError('Informe o motivo do atraso (mínimo 50 caracteres)')
      return
    }
    setError('')
    await onConfirm(trimmed)
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/45 px-4 backdrop-blur-sm">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Fechar"
        onClick={onCancel}
        disabled={submitting}
      />
      <form
        onSubmit={(e) => void handleSubmit(e)}
        className="relative z-10 w-full max-w-md rounded-[1.25rem] border border-[color:var(--color-line)] bg-white p-5 shadow-2xl dark:bg-[color:var(--color-panel)]"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-[color:var(--color-ink)]">
              Motivo do atraso
            </h2>
            <p className="mt-1 truncate text-sm font-medium text-[color:var(--color-ink)]">
              {title}
            </p>
            {subtitle ? (
              <p className="mt-0.5 truncate text-xs text-[color:var(--color-muted)]">
                {subtitle}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            className="btn-ghost !p-2"
            onClick={onCancel}
            disabled={submitting}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-rose-600">
            Por que a entrega está fora do prazo? *
          </label>
          <textarea
            autoFocus
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            rows={4}
            className="glass-input resize-none border-rose-200 py-2.5 focus:border-rose-400 focus:ring-rose-400/20"
            placeholder="Descreva o motivo do atraso..."
            disabled={submitting}
          />
          <p className="mt-1 text-[11px] text-[color:var(--color-muted)]">
            Obrigatório para confirmar a entrega (mín. 50 caracteres).
          </p>
        </div>

        {error ? (
          <p className="mt-3 rounded-xl bg-rose-50/90 px-3 py-2 text-sm text-rose-700">
            {error}
          </p>
        ) : null}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            className="btn-ghost"
            onClick={onCancel}
            disabled={submitting}
          >
            Cancelar
          </button>
          <button type="submit" className="btn-primary" disabled={!canSubmit}>
            {submitting ? 'Confirmando...' : 'Confirmar entrega'}
          </button>
        </div>
      </form>
    </div>
  )
}
