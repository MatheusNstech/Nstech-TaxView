import { Bell } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch } from '../lib/api'
import type { Notificacao } from '../types'

type Placement = 'bottom-left' | 'bottom-right'

interface NotificationBellProps {
  /** Where the panel opens relative to the button (default: under, aligned end). */
  placement?: Placement
  className?: string
}

export default function NotificationBell({
  placement = 'bottom-right',
  className = '',
}: NotificationBellProps) {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<Notificacao[]>([])
  const navigate = useNavigate()

  const load = useCallback(async () => {
    try {
      setItems(await apiFetch<Notificacao[]>('/api/notificacoes?limit=30'))
    } catch {
      setItems([])
    }
  }, [])

  useEffect(() => {
    const POLL_MS = 5 * 60 * 1000
    const tick = () => {
      if (document.visibilityState === 'visible') void load()
    }
    void load()
    const id = window.setInterval(tick, POLL_MS)
    const onVis = () => {
      if (document.visibilityState === 'visible') void load()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [load])

  const unread = items.filter((n) => !n.lida).length

  const markOne = async (n: Notificacao) => {
    try {
      await apiFetch(`/api/notificacoes/${n.id}/lida`, { method: 'PATCH' })
      setItems((prev) =>
        prev.map((x) => (x.id === n.id ? { ...x, lida: true } : x)),
      )
      setOpen(false)
      if (n.obrigacao_id) {
        navigate('/minhas-tarefas')
      }
    } catch {
      // ignore
    }
  }

  const markAll = async () => {
    try {
      await apiFetch('/api/notificacoes/marcar-todas-lidas', { method: 'POST' })
      setItems((prev) => prev.map((x) => ({ ...x, lida: true })))
    } catch {
      // ignore
    }
  }

  const panelPos =
    placement === 'bottom-left'
      ? 'top-[calc(100%+0.5rem)] left-0'
      : 'top-[calc(100%+0.5rem)] right-0'

  return (
    <div className={['relative', className].filter(Boolean).join(' ')}>
      <button
        type="button"
        className="btn-ghost relative !p-2"
        aria-label="Notificações"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <Bell className="h-4 w-4" strokeWidth={1.75} />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-500 px-1 text-[10px] font-bold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden />
          <div
            className={[
              'glass-panel absolute z-50 w-80 overflow-hidden !rounded-2xl shadow-xl',
              panelPos,
            ].join(' ')}
          >
            <div className="flex items-center justify-between border-b border-[color:var(--color-line)] px-3 py-2">
              <p className="text-xs font-semibold text-[color:var(--color-ink)]">
                Notificações
              </p>
              {unread > 0 && (
                <button
                  type="button"
                  className="text-[10px] font-medium text-brand-600 dark:text-brand-400"
                  onClick={() => void markAll()}
                >
                  Marcar todas
                </button>
              )}
            </div>
            <div className="max-h-72 overflow-y-auto">
              {items.length === 0 && (
                <p className="px-3 py-6 text-center text-xs text-[color:var(--color-muted)]">
                  Nenhuma notificação
                </p>
              )}
              {items.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => void markOne(n)}
                  className={[
                    'block w-full border-b border-[color:var(--color-line)] px-3 py-2.5 text-left hover:bg-[color:var(--nav-hover)]',
                    n.lida ? 'opacity-60' : '',
                  ].join(' ')}
                >
                  <p className="text-xs font-semibold text-[color:var(--color-ink)]">
                    {n.titulo}
                  </p>
                  <p className="mt-0.5 line-clamp-2 text-[11px] text-[color:var(--color-muted)]">
                    {n.corpo}
                  </p>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
