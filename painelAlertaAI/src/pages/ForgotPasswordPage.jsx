import { useState } from 'react'
import { Link } from 'react-router-dom'
import AuthShell from '../components/auth/AuthShell'
import { TextField, SubmitButton, Alert } from '../components/auth/Field'
import { solicitarRecuperacao } from '../services/authService'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [erro, setErro] = useState('')
  const [enviado, setEnviado] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErro('')

    const res = await solicitarRecuperacao(email)
    if (!res.ok) {
      setErro(res.erro)
      return
    }
    // Mensagem genérica: não revela se o e-mail está cadastrado.
    setEnviado(true)
  }

  return (
    <AuthShell
      titulo="Recuperar acesso"
      subtitulo="Informe seu e-mail cadastrado para receber um link de redefinição de senha."
      footer={
        <Link to="/login" style={{ color: '#00936C', fontWeight: 600, textDecoration: 'none' }}>
          Voltar para o login
        </Link>
      }
    >
      {enviado ? (
        <>
          <Alert tipo="sucesso">
            Se o e-mail informado estiver cadastrado, enviamos um link de redefinição válido por
            15 minutos. Verifique sua caixa de entrada.
          </Alert>
        </>
      ) : (
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
          <SubmitButton>Enviar link de recuperação</SubmitButton>
        </form>
      )}
    </AuthShell>
  )
}
