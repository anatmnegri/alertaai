import { useState } from 'react'
import { useNavigate, useLocation, Link, Navigate } from 'react-router-dom'
import AuthShell from '../components/auth/AuthShell'
import { TextField, SubmitButton, Alert } from '../components/auth/Field'
import { useAuth } from '../context/AuthContext'
import { emailValido } from '../services/authService'

export default function LoginPage() {
  const { login, autenticado } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const destino = location.state?.from || '/'

  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')

  // Se já estiver logado, não faz sentido ver o login
  if (autenticado) {
    return <Navigate to="/" replace />
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErro('')

    if (!emailValido(email)) {
      setErro('Informe um e-mail em formato válido.')
      return
    }

    const res = await login(email, senha)
    if (!res.ok) {
      setErro(res.erro) // mensagem genérica: "E-mail ou senha inválidos"
      return
    }
    navigate(destino, { replace: true })
  }

  return (
    <AuthShell
      titulo="Acesso ao Painel"
      footer={
        <div style={{ display: 'grid', gap: 8, justifyItems: 'center' }}>
          <Link to="/esqueci-senha" style={{ color: '#00936C', fontWeight: 600, textDecoration: 'none' }}>
            Esqueci minha senha
          </Link>
          <Link to="/cadastro" style={{ color: '#00936C', fontWeight: 700, textDecoration: 'none' }}>
            Criar conta
          </Link>
        </div>
      }
    >
      <form onSubmit={handleSubmit} noValidate>
        {erro && <Alert tipo="erro">{erro}</Alert>}

        <TextField
          label="E-mail"
          type="email"
          value={email}
          onChange={setEmail}
          placeholder="seu.email@defesacivil.gov.br"
          autoFocus
          error={!!erro}
        />
        <TextField
          label="Senha"
          type="password"
          value={senha}
          onChange={setSenha}
          placeholder="Sua senha"
          error={!!erro}
        />

        <SubmitButton>Entrar</SubmitButton>
      </form>
    </AuthShell>
  )
}
