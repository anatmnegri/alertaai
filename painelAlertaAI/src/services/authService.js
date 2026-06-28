const SESSION_KEY = 'alertaai_session'
const BASE_URL = 'http://localhost:5019'

async function parseResponse(res, fallbackErro) {
  let body = null
  try {
    body = await res.json()
  } catch {
    body = null
  }

  if (!res.ok) {
    return { ok: false, erro: body?.erro || fallbackErro }
  }

  return body || { ok: true }
}

export function emailValido(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((email ?? '').trim())
}

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

export async function registrarUsuario(nome, email, senha) {
  if (!emailValido(email)) {
    return { ok: false, erro: 'Informe um e-mail válido.' }
  }
  if (!senhaForte(senha)) {
    return { ok: false, erro: 'A senha não atende aos requisitos de segurança.' }
  }

  const res = await fetch(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nome, email, senha }),
  })

  return parseResponse(res, 'Não foi possível concluir o cadastro agora.')
}

export async function login(email, senha) {
  if (!emailValido(email)) {
    return { ok: false, erro: 'E-mail ou senha inválidos' }
  }

  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, senha }),
  })

  const out = await parseResponse(res, 'E-mail ou senha inválidos')
  if (!out.ok) return out

  localStorage.setItem(SESSION_KEY, JSON.stringify(out.sessao))
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

export async function alterarSenha(email, senhaAtual, novaSenha) {
  if (!senhaForte(novaSenha)) {
    return { ok: false, erro: 'A nova senha não atende aos requisitos de segurança.' }
  }

  const res = await fetch(`${BASE_URL}/api/auth/change-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, senhaAtual, novaSenha }),
  })

  const out = await parseResponse(res, 'Não foi possível alterar a senha.')
  if (!out.ok) return out

  logout()
  return { ok: true }
}

export async function solicitarRecuperacao(email) {
  if (!emailValido(email)) {
    return { ok: false, erro: 'Informe um e-mail válido.' }
  }

  const res = await fetch(`${BASE_URL}/api/auth/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  })

  return parseResponse(res, 'Não foi possível enviar o e-mail de recuperação.')
}

export async function validarToken(token) {
  if (!token) return { valido: false }

  const res = await fetch(`${BASE_URL}/api/auth/validate-reset-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  })

  if (!res.ok) return { valido: false }

  try {
    return await res.json()
  } catch {
    return { valido: false }
  }
}

export async function redefinirSenha(token, novaSenha) {
  if (!senhaForte(novaSenha)) {
    return { ok: false, erro: 'A nova senha não atende aos requisitos de segurança.' }
  }

  const res = await fetch(`${BASE_URL}/api/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, novaSenha }),
  })

  return parseResponse(res, 'Não foi possível redefinir a senha.')
}
