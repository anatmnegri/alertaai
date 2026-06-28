import { Check, X } from 'lucide-react'
import { validarForcaSenha } from '../../services/authService'

const REGRAS = [
  { chave: 'comprimento', texto: 'Mínimo de 8 caracteres' },
  { chave: 'maiuscula', texto: 'Uma letra maiúscula' },
  { chave: 'minuscula', texto: 'Uma letra minúscula' },
  { chave: 'numero', texto: 'Um número' },
  { chave: 'especial', texto: 'Um caractere especial (!@#$...)' },
]

export default function PasswordChecklist({ senha }) {
  const status = validarForcaSenha(senha)
  return (
    <ul
      style={{
        listStyle: 'none',
        padding: 0,
        margin: '0 0 16px',
        display: 'grid',
        gap: 5,
        fontFamily: "'Nunito Sans', sans-serif",
      }}
    >
      {REGRAS.map(({ chave, texto }) => {
        const ok = status[chave]
        return (
          <li
            key={chave}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              fontSize: 12.5,
              color: ok ? '#047857' : '#9CA3AF',
            }}
          >
            {ok ? <Check size={14} strokeWidth={3} /> : <X size={14} strokeWidth={2.5} />}
            {texto}
          </li>
        )
      })}
    </ul>
  )
}
