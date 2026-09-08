import type { Session } from '@supabase/supabase-js'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { apiFetch, setAccessToken } from '../lib/api'
import { supabase } from '../lib/supabase'

type UserRole = 'admin' | 'diretor' | 'user'

interface MeProfile {
  user_id: string
  email: string | null
  role: UserRole
  responsavel_id: string | null
  responsavel_nome: string | null
  must_change_password: boolean
  is_viewer: boolean
}

interface AuthContextValue {
  session: Session | null
  loading: boolean
  profileLoading: boolean
  role: UserRole
  isAdmin: boolean
  isDiretor: boolean
  canWrite: boolean
  responsavelId: string | null
  responsavelNome: string | null
  hasResponsavel: boolean
  mustChangePassword: boolean
  isViewer: boolean
  homePath: string
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  refreshMe: () => Promise<void>
  changePassword: (newPassword: string) => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

function roleFromSession(session: Session | null): UserRole {
  const meta = session?.user?.app_metadata as { role?: string } | undefined
  if (meta?.role === 'admin') return 'admin'
  if (meta?.role === 'diretor') return 'diretor'
  return 'user'
}

function mustChangeFromSession(session: Session | null): boolean {
  const app = session?.user?.app_metadata as
    | { must_change_password?: boolean | string }
    | undefined
  const value = app?.must_change_password
  return value === true || value === 'true'
}

export function homePathForRole(role: UserRole): string {
  if (role === 'admin') return '/'
  if (role === 'diretor') return '/diretoria'
  return '/minhas-tarefas'
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [profileLoading, setProfileLoading] = useState(false)
  const [me, setMe] = useState<MeProfile | null>(null)

  const refreshMe = useCallback(async () => {
    setProfileLoading(true)
    try {
      const profile = await apiFetch<MeProfile>('/api/me')
      setMe(profile)
    } catch {
      setMe(null)
    } finally {
      setProfileLoading(false)
    }
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setAccessToken(data.session?.access_token ?? null)
      setSession(data.session)
      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setAccessToken(nextSession?.access_token ?? null)
      setSession(nextSession)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (session) {
      void refreshMe()
    } else {
      setMe(null)
    }
  }, [session, refreshMe])

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }, [])

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }, [])

  const changePassword = useCallback(async (newPassword: string) => {
    await apiFetch('/api/me/change-password', {
      method: 'POST',
      body: JSON.stringify({ password: newPassword }),
    })
    await supabase.auth.refreshSession()
  }, [])

  const role = me?.role ?? roleFromSession(session)
  const mustChangePassword =
    me?.must_change_password ?? mustChangeFromSession(session)
  const isViewer = Boolean(me?.is_viewer)
  const isAdmin = role === 'admin'
  const isDiretor = role === 'diretor'
  const canWrite = !isViewer && !isDiretor

  const value = useMemo(
    () => ({
      session,
      loading,
      profileLoading,
      role,
      isAdmin,
      isDiretor,
      canWrite,
      responsavelId: me?.responsavel_id ?? null,
      responsavelNome: me?.responsavel_nome ?? null,
      hasResponsavel: Boolean(me?.responsavel_id),
      mustChangePassword,
      isViewer,
      homePath: homePathForRole(role),
      signIn,
      signOut,
      refreshMe,
      changePassword,
    }),
    [
      session,
      loading,
      profileLoading,
      role,
      isAdmin,
      isDiretor,
      canWrite,
      me,
      mustChangePassword,
      isViewer,
      signIn,
      signOut,
      refreshMe,
      changePassword,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider')
  return ctx
}
