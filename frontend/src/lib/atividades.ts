import { useEffect, useState } from 'react'
import type { Atividade } from '../types'
import { apiFetch } from './api'

/** Tipos de serviço ativos, para escolher na tarefa. */
export function useAtividadesAtivas(enabled = true): Atividade[] {
  const [atividades, setAtividades] = useState<Atividade[]>([])

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    apiFetch<Atividade[]>('/api/atividades')
      .then((rows) => {
        if (!cancelled) setAtividades(rows.filter((a) => a.ativa))
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [enabled])

  return atividades
}
