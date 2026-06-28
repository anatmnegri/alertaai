import { createContext, useContext, useState, useCallback } from 'react'
import * as auth from '../services/authService'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [sessao, setSessao] = useState(() => auth.getSessao())

  const login = useCallback((email, senha) => {
    const res = auth.login(email, senha)
    if (res.ok) setSessao(auth.getSessao())
    return res
  }, [])

  const logout = useCallback(() => {
    auth.logout()
    setSessao(null)
  }, [])

  const alterarSenha = useCallback((atual, nova) => {
    const res = auth.alterarSenha(atual, nova)
    if (res.ok) setSessao(null) // senha antiga invalidada → sessão encerrada
    return res
  }, [])

  const value = {
    sessao,
    autenticado: sessao !== null,
    login,
    logout,
    alterarSenha,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth deve ser usado dentro de <AuthProvider>')
  return ctx
}
