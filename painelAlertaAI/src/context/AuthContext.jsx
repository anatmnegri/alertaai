import { createContext, useContext, useState, useCallback } from 'react'
import * as auth from '../services/authService'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [sessao, setSessao] = useState(() => auth.getSessao())

  const login = useCallback(async (email, senha) => {
    const res = await auth.login(email, senha)
    if (res.ok) setSessao(auth.getSessao())
    return res
  }, [])

  const registrar = useCallback(async (nome, email, senha) => {
    return auth.registrarUsuario(nome, email, senha)
  }, [])

  const logout = useCallback(() => {
    auth.logout()
    setSessao(null)
  }, [])

  const alterarSenha = useCallback(async (atual, nova) => {
    const email = sessao?.email
    if (!email) return { ok: false, erro: 'Sessão inválida. Faça login novamente.' }
    const res = await auth.alterarSenha(email, atual, nova)
    if (res.ok) setSessao(null) // senha antiga invalidada → sessão encerrada
    return res
  }, [sessao])

  const value = {
    sessao,
    autenticado: sessao !== null,
    login,
    registrar,
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
