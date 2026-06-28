import { useState } from 'react'
import { useNavigate, useLocation, Link, Navigate } from 'react-router-dom'
import AuthShell from '../components/auth/AuthShell'
import { TextField, SubmitButton, Alert } from '../components/auth/Field'
import { useAuth } from '../context/AuthContext'
import { emailValido, DEFAULT_ADMIN } from '../services/authService'

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

  const handleSubmit = (e) => {
    e.preventDefault()
    setErro('')

    if (!emailValido(email)) {
      setErro('Informe um e-mail em formato válido.')
      return
    }

    const res = login(email, senha)
    if (!res.ok) {
      setErro(res.erro) // mensagem genérica: "E-mail ou senha inválidos"
      return
    }
    navigate(destino, { replace: true })
  }

  return (
    <AuthShell
      titulo="Acesso ao Painel"
      subtitulo="Defesa Civil do Recife — área restrita do administrador"
      footer={
        <Link to="/esqueci-senha" style={{ color: '#00936C', fontWeight: 600, textDecoration: 'none' }}>
          Esqueci minha senha
        </Link>
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

      {/* Dica apenas para a demonstração acadêmica */}
      <p style={{ marginTop: 18, fontSize: 11.5, color: '#9CA3AF', textAlign: 'center', lineHeight: 1.6 }}>
        Demo — administrador padrão:<br />
        <strong>{DEFAULT_ADMIN.email}</strong> / <strong>{DEFAULT_ADMIN.senha}</strong>
      </p>
    </AuthShell>
  )
}
