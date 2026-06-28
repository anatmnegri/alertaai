import { Routes, Route, Navigate } from 'react-router-dom'
import './App.css'
import ProtectedRoute from './components/ProtectedRoute'
import Painel from './pages/Painel'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import ChangePasswordPage from './pages/ChangePasswordPage'

function App() {
  return (
    <Routes>
      {/* Rotas públicas (autenticação) */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/cadastro" element={<RegisterPage />} />
      <Route path="/esqueci-senha" element={<ForgotPasswordPage />} />
      <Route path="/redefinir-senha" element={<ResetPasswordPage />} />

      {/* Rotas protegidas (painel da Defesa Civil) */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Painel />
          </ProtectedRoute>
        }
      />
      <Route
        path="/alterar-senha"
        element={
          <ProtectedRoute>
            <ChangePasswordPage />
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
