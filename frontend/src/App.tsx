import type { ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import { AuthSkeleton } from './components/ui/PageSkeletons'
import { useAuth } from './context/AuthContext'
import Atividades from './pages/Atividades'
import Calendario from './pages/Calendario'
import Dashboard from './pages/Dashboard'
import Diretoria from './pages/Diretoria'
import EsqueciSenha from './pages/EsqueciSenha'
import DiretoriaFechamento from './pages/DiretoriaFechamento'
import DiretoriaPendencias from './pages/DiretoriaPendencias'
import Empresas from './pages/Empresas'
import Importacao from './pages/Importacao'
import Login from './pages/Login'
import MinhasTarefas from './pages/MinhasTarefas'
import Obrigacoes from './pages/Obrigacoes'
import Responsaveis from './pages/Responsaveis'
import TrocarSenha from './pages/TrocarSenha'
import Usuarios from './pages/Usuarios'

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { session, loading, mustChangePassword, recoveryPending } = useAuth()

  if (loading) {
    return <AuthSkeleton />
  }

  if (!session) {
    return <Navigate to="/login" replace />
  }

  if (recoveryPending) {
    return <Navigate to="/esqueci-senha" replace />
  }

  if (mustChangePassword) {
    return <Navigate to="/trocar-senha" replace />
  }

  return <>{children}</>
}

function AdminRoute({ children }: { children: ReactNode }) {
  const { isAdmin, loading, homePath } = useAuth()

  if (loading) {
    return <AuthSkeleton fullScreen={false} />
  }

  if (!isAdmin) {
    return <Navigate to={homePath} replace />
  }

  return <>{children}</>
}

function DiretorRoute({ children }: { children: ReactNode }) {
  const { isDiretor, isAdmin, loading, homePath } = useAuth()

  if (loading) {
    return <AuthSkeleton fullScreen={false} />
  }

  if (!isDiretor && !isAdmin) {
    return <Navigate to={homePath} replace />
  }

  return <>{children}</>
}

function IndexRedirect() {
  const { isDiretor } = useAuth()
  if (isDiretor) {
    return <Navigate to="/diretoria" replace />
  }
  return <Dashboard />
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/esqueci-senha" element={<EsqueciSenha />} />
      <Route path="/trocar-senha" element={<TrocarSenha />} />
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<IndexRedirect />} />
        <Route
          path="diretoria"
          element={
            <DiretorRoute>
              <Diretoria />
            </DiretorRoute>
          }
        />
        <Route
          path="diretoria/pendencias"
          element={
            <DiretorRoute>
              <DiretoriaPendencias />
            </DiretorRoute>
          }
        />
        <Route
          path="diretoria/fechamento"
          element={
            <DiretorRoute>
              <DiretoriaFechamento />
            </DiretorRoute>
          }
        />
        <Route path="minhas-tarefas" element={<MinhasTarefas />} />
        <Route path="kanban" element={<Navigate to="/minhas-tarefas" replace />} />
        <Route path="calendario" element={<Calendario />} />
        <Route path="obrigacoes" element={<Obrigacoes />} />
        <Route path="empresas" element={<AdminRoute><Empresas /></AdminRoute>} />
        <Route path="atividades" element={<AdminRoute><Atividades /></AdminRoute>} />
        <Route path="responsaveis" element={<AdminRoute><Responsaveis /></AdminRoute>} />
        <Route path="importacao" element={<AdminRoute><Importacao /></AdminRoute>} />
        <Route
          path="usuarios"
          element={
            <AdminRoute>
              <Usuarios />
            </AdminRoute>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
