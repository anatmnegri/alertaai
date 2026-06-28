import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import AuthShell from '../components/auth/AuthShell'
import { TextField, SubmitButton, Alert } from '../components/auth/Field'
import PasswordChecklist from '../components/auth/PasswordChecklist'
import { useAuth } from '../context/AuthContext'
import { senhaForte } from '../services/authService'

export default function ChangePasswordPage() {
  const { alterarSenha } = useAuth()
  const navigate = useNavigate()

  const [atual, setAtual] = useState('')
  const [nova, setNova] = useState('')
  const [confirma, setConfirma] = useState('')
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErro('')

    if (!senhaForte(nova)) {
      setErro('A nova senha não atende aos requisitos de segurança.')
      return
    }
    if (nova !== confirma) {
      setErro('A confirmação não coincide com a nova senha.')
      return
    }

    const res = await alterarSenha(atual, nova)
    if (!res.ok) {
      setErro(res.erro)
      return
    }
    // Senha antiga invalidada: a sessão é encerrada e o admin faz login novamente.
    setSucesso(true)
    setTimeout(() => navigate('/login', { replace: true }), 2500)
  }

  return (
    <AuthShell
      titulo="Alterar senha"
      subtitulo="Atualize sua senha de acesso ao painel."
      footer={
        !sucesso && (
          <Link
            to="/"
            style={{
              color: '#00936C',
              fontWeight: 600,
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
            }}
          >
            <ArrowLeft size={15} /> Voltar ao painel
          </Link>
        )
      }
    >
      {sucesso ? (
        <Alert tipo="sucesso">
          Senha alterada com sucesso! Por segurança, faça login novamente com a nova senha.
        </Alert>
      ) : (
        <form onSubmit={handleSubmit} noValidate>
          {erro && <Alert tipo="erro">{erro}</Alert>}
          <TextField
            label="Senha atual"
            type="password"
            value={atual}
            onChange={setAtual}
            placeholder="Sua senha atual"
            autoFocus
            error={!!erro}
          />
          <TextField
            label="Nova senha"
            type="password"
            value={nova}
            onChange={setNova}
            placeholder="Nova senha"
            error={!!erro}
          />
          <PasswordChecklist senha={nova} />
          <TextField
            label="Confirmar nova senha"
            type="password"
            value={confirma}
            onChange={setConfirma}
            placeholder="Repita a nova senha"
            error={!!erro}
          />
          <SubmitButton>Salvar nova senha</SubmitButton>
        </form>
      )}
    </AuthShell>
  )
}
