// Autenticação mock (frontend) para o painel da Defesa Civil.
// ⚠️ Uso acadêmico/demonstração: as credenciais ficam no localStorage.
// Em produção isto seria substituído por um backend com hash forte (bcrypt/argon2),
// HTTPS e envio real de e-mail. Aqui simulamos todo o fluxo no navegador.

const ADMIN_KEY = 'alertaai_admin'
const SESSION_KEY = 'alertaai_session'
const RESET_KEY = 'alertaai_reset'

// Token de recuperação expira em 15 minutos (conforme critério de aceite)
export const RESET_TOKEN_TTL_MS = 15 * 60 * 1000

// Administrador padrão (seed) — exibido como dica na tela de login para a demo
export const DEFAULT_ADMIN = {
  email: 'admin@defesacivil.recife.gov.br',
  senha: 'Admin@123',
}

// "Hash" leve só para não guardar a senha em texto puro no localStorage.
// NÃO é criptografia real — apenas evita leitura casual durante a demonstração.
function ofuscar(texto) {
  try {
    return btoa(unescape(encodeURIComponent(`alertaai::${texto}`)))
  } catch {
    return `alertaai::${texto}`
  }
}

function lerAdmin() {
  const raw = localStorage.getItem(ADMIN_KEY)
  if (!raw) {
    const seed = { email: DEFAULT_ADMIN.email, senhaHash: ofuscar(DEFAULT_ADMIN.senha) }
    localStorage.setItem(ADMIN_KEY, JSON.stringify(seed))
    return seed
  }
  try {
    return JSON.parse(raw)
  } catch {
    localStorage.removeItem(ADMIN_KEY)
    return lerAdmin()
  }
}

function salvarAdmin(admin) {
  localStorage.setItem(ADMIN_KEY, JSON.stringify(admin))
}

// ─── Validações ───────────────────────────────────────────────────────────────

export function emailValido(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((email ?? '').trim())
}

// Regras de força da nova senha: mínimo 8, maiúscula, minúscula, número e especial.
export function validarForcaSenha(senha) {
  const s = senha ?? ''
  return {
    comprimento: s.length >= 8,
    maiuscula: /[A-Z]/.test(s),
    minuscula: /[a-z]/.test(s),
    numero: /[0-9]/.test(s),
    especial: /[^A-Za-z0-9]/.test(s),
  }
}

export function senhaForte(senha) {
  return Object.values(validarForcaSenha(senha)).every(Boolean)
}

// ─── Sessão / Login ─────────────────────────────────────────────────────────

const ERRO_GENERICO = 'E-mail ou senha inválidos'

export function login(email, senha) {
  const admin = lerAdmin()
  // Mensagem genérica em qualquer falha (não revela se o e-mail existe)
  if (!emailValido(email)) {
    return { ok: false, erro: ERRO_GENERICO }
  }
  const emailOk = email.trim().toLowerCase() === admin.email.toLowerCase()
  const senhaOk = ofuscar(senha) === admin.senhaHash
  if (!emailOk || !senhaOk) {
    return { ok: false, erro: ERRO_GENERICO }
  }
  localStorage.setItem(
    SESSION_KEY,
    JSON.stringify({ email: admin.email, logadoEm: Date.now() }),
  )
  return { ok: true }
}

export function logout() {
  localStorage.removeItem(SESSION_KEY)
}

export function getSessao() {
  const raw = localStorage.getItem(SESSION_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export function estaAutenticado() {
  return getSessao() !== null
}

// ─── Alteração de senha (admin logado) ────────────────────────────────────────

export function alterarSenha(senhaAtual, novaSenha) {
  const admin = lerAdmin()
  if (ofuscar(senhaAtual) !== admin.senhaHash) {
    return { ok: false, erro: 'A senha atual está incorreta.' }
  }
  if (!senhaForte(novaSenha)) {
    return { ok: false, erro: 'A nova senha não atende aos requisitos de segurança.' }
  }
  if (ofuscar(novaSenha) === admin.senhaHash) {
    return { ok: false, erro: 'A nova senha deve ser diferente da atual.' }
  }
  salvarAdmin({ ...admin, senhaHash: ofuscar(novaSenha) })
  // A senha antiga é invalidada imediatamente: encerra a sessão e remove
  // quaisquer tokens de recuperação pendentes.
  localStorage.removeItem(RESET_KEY)
  logout()
  return { ok: true }
}

// ─── Recuperação de senha (esqueci minha senha) ──────────────────────────────

function gerarToken() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

// Gera um token temporário. Retorna sempre sucesso (não revela se o e-mail existe).
// `link` só é preenchido quando o e-mail confere — simula o envio do e-mail
// exibindo o link na própria tela para fins de demonstração.
export function solicitarRecuperacao(email) {
  const admin = lerAdmin()
  if (!emailValido(email)) {
    return { ok: false, erro: 'Informe um e-mail válido.' }
  }
  let link = null
  if (email.trim().toLowerCase() === admin.email.toLowerCase()) {
    const token = gerarToken()
    const expiraEm = Date.now() + RESET_TOKEN_TTL_MS
    localStorage.setItem(RESET_KEY, JSON.stringify({ token, expiraEm }))
    link = `${window.location.origin}/redefinir-senha?token=${token}`
  }
  return { ok: true, link }
}

export function validarToken(token) {
  const raw = localStorage.getItem(RESET_KEY)
  if (!raw || !token) return { valido: false }
  try {
    const { token: salvo, expiraEm } = JSON.parse(raw)
    if (token !== salvo) return { valido: false }
    if (Date.now() > expiraEm) {
      localStorage.removeItem(RESET_KEY)
      return { valido: false, expirado: true }
    }
    return { valido: true }
  } catch {
    return { valido: false }
  }
}

export function redefinirSenha(token, novaSenha) {
  const check = validarToken(token)
  if (!check.valido) {
    return {
      ok: false,
      erro: check.expirado
        ? 'O link de recuperação expirou. Solicite um novo.'
        : 'Link de recuperação inválido.',
    }
  }
  if (!senhaForte(novaSenha)) {
    return { ok: false, erro: 'A nova senha não atende aos requisitos de segurança.' }
  }
  const admin = lerAdmin()
  salvarAdmin({ ...admin, senhaHash: ofuscar(novaSenha) })
  localStorage.removeItem(RESET_KEY)
  logout()
  return { ok: true }
}
