import { supabase } from './supabase'

const configuredApiUrl = import.meta.env.VITE_API_URL as string | undefined

function resolveApiUrl(): string {
  if (import.meta.env.DEV) {
    return configuredApiUrl ?? 'http://localhost:8002'
  }
  // Front e API compartilham o mesmo domínio na Vercel. A URL gravada no build
  // pode não existir (sufixo da conta), então o painel usa o endereço aberto.
  if (typeof window !== 'undefined' && window.location.origin) {
    return window.location.origin
  }
  return configuredApiUrl ?? ''
}

const API_URL = resolveApiUrl()

/** In-memory token — avoids auth.getSession() on every API call. */
let accessToken: string | null = null

export function setAccessToken(token: string | null) {
  accessToken = token
}

async function resolveToken(): Promise<string | undefined> {
  if (accessToken) return accessToken
  const { data } = await supabase.auth.getSession()
  accessToken = data.session?.access_token ?? null
  return accessToken ?? undefined
}

export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = await resolveToken()

  const headers = new Headers(options.headers)
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  if (
    options.body &&
    !(options.body instanceof FormData) &&
    !headers.has('Content-Type')
  ) {
    headers.set('Content-Type', 'application/json')
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  })

  if (!response.ok) {
    let message = `Erro ${response.status}`
    try {
      const body = (await response.json()) as { detail?: string }
      if (body.detail) message = body.detail
    } catch {
      // ignore parse errors
    }
    throw new ApiError(message, response.status)
  }

  if (response.status === 204) {
    return undefined as T
  }

  return response.json() as Promise<T>
}

export async function apiUpload<T>(
  path: string,
  formData: FormData,
): Promise<T> {
  const token = await resolveToken()

  const headers = new Headers()
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  const response = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers,
    body: formData,
  })

  if (!response.ok) {
    let message = `Erro ${response.status}`
    try {
      const body = (await response.json()) as { detail?: string }
      if (body.detail) message = body.detail
    } catch {
      // ignore parse errors
    }
    throw new ApiError(message, response.status)
  }

  return response.json() as Promise<T>
}

export function buildQuery(params: Record<string, string | undefined>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value)
  }
  const qs = search.toString()
  return qs ? `?${qs}` : ''
}

export async function apiDownload(
  path: string,
  filename: string,
  onProgress?: (progress: number | null) => void,
): Promise<void> {
  const token = await resolveToken()
  const headers = new Headers()
  if (token) headers.set('Authorization', `Bearer ${token}`)

  onProgress?.(null)
  const response = await fetch(`${API_URL}${path}`, { headers })
  if (!response.ok) {
    let message = `Erro ${response.status}`
    try {
      const body = (await response.json()) as { detail?: string }
      if (typeof body.detail === 'string' && body.detail) message = body.detail
    } catch {
      // ignore parse errors
    }
    if (response.status === 405) {
      message = 'Não foi possível exportar. Atualize a página e tente de novo.'
    }
    throw new ApiError(message, response.status)
  }

  const blob = await readDownloadBlob(response, onProgress)
  onProgress?.(100)
  triggerDownload(blob, filename)
}

async function readDownloadBlob(
  response: Response,
  onProgress?: (progress: number | null) => void,
): Promise<Blob> {
  const total = Number(response.headers.get('Content-Length') || 0)
  const reader = response.body?.getReader()
  if (!reader) return response.blob()

  const chunks: BlobPart[] = []
  let received = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    received += value.byteLength
    if (total > 0) {
      onProgress?.(Math.min(99, Math.round((received / total) * 100)))
    }
  }
  return new Blob(chunks)
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  window.setTimeout(() => {
    a.remove()
    URL.revokeObjectURL(url)
  }, 1000)
}
