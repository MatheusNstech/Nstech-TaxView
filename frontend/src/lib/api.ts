import { supabase } from './supabase'

const configuredApiUrl = import.meta.env.VITE_API_URL as string | undefined

if (import.meta.env.PROD && !configuredApiUrl) {
  throw new Error(
    'VITE_API_URL é obrigatória em produção. Configure a URL da API na Vercel.',
  )
}

const API_URL = configuredApiUrl ?? 'http://localhost:8002'

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

export async function apiDownload(path: string, filename: string): Promise<void> {
  const token = await resolveToken()
  const headers = new Headers()
  if (token) headers.set('Authorization', `Bearer ${token}`)

  const response = await fetch(`${API_URL}${path}`, { headers })
  if (!response.ok) {
    throw new ApiError(`Erro ${response.status}`, response.status)
  }
  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
