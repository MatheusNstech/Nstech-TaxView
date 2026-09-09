import { Eye, EyeOff, Lock, Mail } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import ThemeToggle from '../components/ThemeToggle'
import { AuthSkeleton } from '../components/ui/PageSkeletons'
import { useAuth } from '../context/AuthContext'

export default function EsqueciSenha() {
  const {
    loading,
    session,
    recoveryPending,
    requestPasswordReset,
    changePassword,
    refreshMe,
    homePath,
  } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const codeAlreadyVerified = Boolean(session && recoveryPending)

  if (loading) {
    return <AuthSkeleton />
  }

  const handleRequest = async (e: FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      await requestPasswordReset(email)
      setSent(true)
      setInfo('Se este e-mail estiver cadastrado, enviamos um link. Abra o e-mail e clique em Reset password. Confira também o spam.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível enviar o link.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleResend = async () => {
    setSubmitting(true)
    setError('')
    try {
      await requestPasswordReset(email)
      setInfo('Se este e-mail estiver cadastrado, enviamos um link. Abra o e-mail e clique em Reset password. Confira também o spam.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível enviar o link.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleReset = async (e: FormEvent) => {
    e.preventDefault()
    if (password.length < 8) {
      setError('A senha deve ter ao menos 8 caracteres')
      return
    }
    if (password !== confirm) {
      setError('As senhas não coincidem')
      return
    }
    if (!codeAlreadyVerified) {
      setError('Abra o link do e-mail nesta tela para definir a senha.')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      await changePassword(password)
      await refreshMe()
      navigate(homePath, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao definir a senha')
    } finally {
      setSubmitting(false)
    }
  }

  const showPasswordForm = codeAlreadyVerified

  return (
    <div className="mesh-bg relative flex min-h-screen items-center justify-center px-4">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <a
            href="https://nstech.com.br/?scLang=pt-BR"
            target="_blank"
            rel="noopener noreferrer"
            className="mb-5 rounded-full bg-white px-5 py-2.5 transition dark:bg-[color:var(--color-panel)]"
            aria-label="Site nstech"
          >
            <img
              src="/nstech-logo.png"
              alt="nstech"
              className="h-12 w-auto max-w-[15rem] object-contain"
            />
          </a>
          <h1 className="text-2xl font-bold text-[color:var(--color-ink)]">
            TaxView
          </h1>
        </div>

        <form
          onSubmit={(e) => void (showPasswordForm ? handleReset(e) : handleRequest(e))}
          className="glass-panel p-8"
        >
          <h2 className="text-lg font-semibold text-[color:var(--color-ink)]">
            Esqueci minha senha
          </h2>
          <p className="mt-1 text-sm text-[color:var(--color-muted)]">
            {showPasswordForm
              ? 'Defina a senha nova. O link do e-mail já validou esta tela.'
              : 'Informe o e-mail da conta. No plano Free o Supabase envia um link, não um código.'}
          </p>

          <div className="mt-6 space-y-4">
            {!codeAlreadyVerified && (
              <div>
                <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-[color:var(--color-muted)]">
                  <Mail className="h-3.5 w-3.5" strokeWidth={1.75} />
                  E-mail
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="glass-input py-2.5"
                  placeholder="seu@email.com"
                  autoComplete="email"
                  readOnly={sent}
                />
              </div>
            )}

            {showPasswordForm && (
              <>
                <div>
                  <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-[color:var(--color-muted)]">
                    <Lock className="h-3.5 w-3.5" strokeWidth={1.75} />
                    Nova senha
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="glass-input py-2.5 pr-11"
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      className="absolute top-1/2 right-3 -translate-y-1/2 text-[color:var(--color-muted)] hover:text-[color:var(--color-ink)]"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" strokeWidth={1.75} />
                      ) : (
                        <Eye className="h-4 w-4" strokeWidth={1.75} />
                      )}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[color:var(--color-muted)]">
                    Confirmar senha
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirm ? 'text' : 'password'}
                      required
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      className="glass-input py-2.5 pr-11"
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      className="absolute top-1/2 right-3 -translate-y-1/2 text-[color:var(--color-muted)] hover:text-[color:var(--color-ink)]"
                      onClick={() => setShowConfirm((v) => !v)}
                      aria-label={showConfirm ? 'Ocultar senha' : 'Mostrar senha'}
                    >
                      {showConfirm ? (
                        <EyeOff className="h-4 w-4" strokeWidth={1.75} />
                      ) : (
                        <Eye className="h-4 w-4" strokeWidth={1.75} />
                      )}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          {info && (
            <p className="mt-4 rounded-xl bg-emerald-50/90 px-3 py-2 text-sm text-emerald-800">
              {info}
            </p>
          )}
          {error && (
            <p className="mt-4 rounded-xl bg-rose-50/90 px-3 py-2 text-sm text-rose-700">
              {error}
            </p>
          )}

          <button type="submit" disabled={submitting} className="btn-primary mt-6 w-full">
            {submitting
              ? showPasswordForm
                ? 'Salvando...'
                : 'Enviando...'
              : showPasswordForm
                ? 'Definir senha'
                : 'Enviar link'}
          </button>
          {sent && !showPasswordForm && (
            <button
              type="button"
              className="btn-ghost mt-3 w-full"
              disabled={submitting}
              onClick={() => void handleResend()}
            >
              Reenviar link
            </button>
          )}
          <Link
            to="/login"
            className="btn-ghost mt-3 block w-full text-center text-sm"
          >
            Voltar ao login
          </Link>
        </form>
      </div>
    </div>
  )
}
