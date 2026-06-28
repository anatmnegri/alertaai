import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

// Bloqueia o acesso direto às rotas do painel quando não há sessão ativa.
export default function ProtectedRoute({ children }) {
  const { autenticado } = useAuth()
  const location = useLocation()

  if (!autenticado) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  return children
}
