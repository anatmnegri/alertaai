import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import AuthShell from '../components/auth/AuthShell'
import { TextField, SubmitButton, Alert } from '../components/auth/Field'
import PasswordChecklist from '../components/auth/PasswordChecklist'
import { useAuth } from '../context/AuthContext'
import { emailValido, senhaForte } from '../services/authService'

export default function RegisterPage() {
  const { autenticado, registrar } = useAuth()
  const navigate = useNavigate()

  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState(false)

  if (autenticado) return <Navigate to="/" replace />

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErro('')

    if (nome.trim().length < 2) {
      setErro('Informe um nome válido.')
      return
    }
    if (!emailValido(email)) {
      setErro('Informe um e-mail em formato válido.')
      return
    }
    if (!senhaForte(senha)) {
      setErro('A senha não atende aos requisitos de segurança.')
      return
    }
    if (senha !== confirmar) {
      setErro('As senhas não coincidem.')
      return
    }

    const res = await registrar(nome.trim(), email.trim(), senha)
    if (!res.ok) {
      setErro(res.erro)
      return
    }

    setSucesso(true)
    setTimeout(() => navigate('/login', { replace: true }), 1800)
  }

  return (
    <AuthShell
      titulo="Criar conta"
      subtitulo="Cadastre um novo usuário para acessar o painel."
      footer={
        <Link to="/login" style={{ color: '#00936C', fontWeight: 600, textDecoration: 'none' }}>
          Já tenho conta
        </Link>
      }
    >
      {sucesso ? (
        <Alert tipo="sucesso">Conta criada com sucesso! Redirecionando para o login...</Alert>
      ) : (
        <form onSubmit={handleSubmit} noValidate>
          {erro && <Alert tipo="erro">{erro}</Alert>}

          <TextField
            label="Nome"
            value={nome}
            onChange={setNome}
            placeholder="Seu nome"
            autoFocus
            error={!!erro}
          />
          <TextField
            label="E-mail"
            type="email"
            value={email}
            onChange={setEmail}
            placeholder="seu.email@dominio.com"
            error={!!erro}
          />
          <TextField
            label="Senha"
            type="password"
            value={senha}
            onChange={setSenha}
            placeholder="Crie uma senha forte"
            error={!!erro}
          />
          <PasswordChecklist senha={senha} />
          <TextField
            label="Confirmar senha"
            type="password"
            value={confirmar}
            onChange={setConfirmar}
            placeholder="Repita a senha"
            error={!!erro}
          />

          <SubmitButton>Cadastrar</SubmitButton>
        </form>
      )}
    </AuthShell>
  )
}
