import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate, Link } from 'react-router-dom'
import AuthShell from '../components/auth/AuthShell'
import { TextField, SubmitButton, Alert } from '../components/auth/Field'
import PasswordChecklist from '../components/auth/PasswordChecklist'
import { validarToken, redefinirSenha, senhaForte } from '../services/authService'

export default function ResetPasswordPage() {
  const [params] = useSearchParams()
  const token = params.get('token')
  const navigate = useNavigate()

  const [estadoToken, setEstadoToken] = useState({ validando: true, valido: false, expirado: false })

  const [senha, setSenha] = useState('')
  const [confirma, setConfirma] = useState('')
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState(false)

  useEffect(() => {
    let ativo = true
    validarToken(token).then((res) => {
      if (!ativo) return
      setEstadoToken({ validando: false, valido: !!res.valido, expirado: !!res.expirado })
    })
    return () => {
      ativo = false
    }
  }, [token])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErro('')

    if (!senhaForte(senha)) {
      setErro('A senha não atende aos requisitos de segurança.')
      return
    }
    if (senha !== confirma) {
      setErro('As senhas não coincidem.')
      return
    }

    const res = await redefinirSenha(token, senha)
    if (!res.ok) {
      setErro(res.erro)
      return
    }
    setSucesso(true)
    setTimeout(() => navigate('/login', { replace: true }), 2500)
  }

  if (estadoToken.validando) {
    return (
      <AuthShell titulo="Validando link" subtitulo="Aguarde enquanto verificamos o token de recuperação.">
        <Alert tipo="info">Validando o link de redefinição...</Alert>
      </AuthShell>
    )
  }

  // Não expõe nenhum dado sensível do usuário (e-mail, nome etc.).
  if (!estadoToken.valido) {
    return (
      <AuthShell
        titulo="Link inválido"
        subtitulo="Este link de redefinição é inválido ou já expirou."
        footer={
          <Link to="/esqueci-senha" style={{ color: '#00936C', fontWeight: 600, textDecoration: 'none' }}>
            Solicitar novo link
          </Link>
        }
      >
        <Alert tipo="erro">
          {estadoToken.expirado
            ? 'O link de recuperação expirou (validade de 15 minutos). Solicite um novo.'
            : 'Link de recuperação inválido. Solicite um novo link de redefinição.'}
        </Alert>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      titulo="Redefinir senha"
      subtitulo="Crie uma nova senha para sua conta."
      footer={
        !sucesso && (
          <Link to="/login" style={{ color: '#00936C', fontWeight: 600, textDecoration: 'none' }}>
            Voltar para o login
          </Link>
        )
      }
    >
      {sucesso ? (
        <Alert tipo="sucesso">
          Senha redefinida com sucesso! Redirecionando para o login…
        </Alert>
      ) : (
        <form onSubmit={handleSubmit} noValidate>
          {erro && <Alert tipo="erro">{erro}</Alert>}
          <TextField
            label="Nova senha"
            type="password"
            value={senha}
            onChange={setSenha}
            placeholder="Nova senha"
            autoFocus
            error={!!erro}
          />
          <PasswordChecklist senha={senha} />
          <TextField
            label="Confirmar nova senha"
            type="password"
            value={confirma}
            onChange={setConfirma}
            placeholder="Repita a nova senha"
            error={!!erro}
          />
          <SubmitButton>Redefinir senha</SubmitButton>
        </form>
      )}
    </AuthShell>
  )
}
