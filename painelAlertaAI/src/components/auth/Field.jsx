import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'

const fn = "'Nunito Sans', sans-serif"

export function TextField({ label, type = 'text', value, onChange, placeholder, autoFocus, error }) {
  const isPassword = type === 'password'
  const [visivel, setVisivel] = useState(false)
  const tipoReal = isPassword && visivel ? 'text' : type

  return (
    <label style={{ display: 'block', marginBottom: 16, fontFamily: fn }}>
      <span
        style={{
          display: 'block',
          fontSize: 12.5,
          fontWeight: 700,
          color: '#374151',
          marginBottom: 6,
        }}
      >
        {label}
      </span>
      <div style={{ position: 'relative' }}>
        <input
          type={tipoReal}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoFocus={autoFocus}
          style={{
            width: '100%',
            boxSizing: 'border-box',
            padding: isPassword ? '11px 42px 11px 13px' : '11px 13px',
            border: `1.5px solid ${error ? '#EF3826' : '#E5E7EB'}`,
            borderRadius: 9,
            fontSize: 14,
            fontFamily: fn,
            outline: 'none',
            transition: 'border-color 0.15s',
          }}
          onFocus={(e) => { if (!error) e.target.style.borderColor = '#00936C' }}
          onBlur={(e) => { if (!error) e.target.style.borderColor = '#E5E7EB' }}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setVisivel((v) => !v)}
            aria-label={visivel ? 'Ocultar senha' : 'Mostrar senha'}
            style={{
              position: 'absolute',
              right: 10,
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#9CA3AF',
              display: 'flex',
            }}
          >
            {visivel ? <EyeOff size={17} /> : <Eye size={17} />}
          </button>
        )}
      </div>
    </label>
  )
}

export function SubmitButton({ children, disabled }) {
  return (
    <button
      type="submit"
      disabled={disabled}
      style={{
        width: '100%',
        padding: '12px',
        marginTop: 4,
        background: disabled ? '#9CA3AF' : '#00936C',
        color: '#fff',
        border: 'none',
        borderRadius: 9,
        fontFamily: "'Poppins', sans-serif",
        fontSize: 14.5,
        fontWeight: 600,
        cursor: disabled ? 'not-allowed' : 'pointer',
        boxShadow: disabled ? 'none' : '0 4px 14px rgba(0,147,108,0.35)',
        transition: 'background 0.15s',
      }}
    >
      {children}
    </button>
  )
}

export function Alert({ tipo = 'erro', children }) {
  const cores = {
    erro: { bg: 'rgba(239,56,38,0.1)', border: 'rgba(239,56,38,0.3)', color: '#B91C1C' },
    sucesso: { bg: 'rgba(0,182,155,0.12)', border: 'rgba(0,147,108,0.3)', color: '#047857' },
    info: { bg: 'rgba(59,130,246,0.1)', border: 'rgba(59,130,246,0.3)', color: '#1D4ED8' },
  }
  const c = cores[tipo] ?? cores.erro
  return (
    <div
      style={{
        background: c.bg,
        border: `1px solid ${c.border}`,
        color: c.color,
        borderRadius: 9,
        padding: '10px 13px',
        fontSize: 13,
        fontFamily: fn,
        marginBottom: 16,
        lineHeight: 1.5,
        wordBreak: 'break-word',
      }}
    >
      {children}
    </div>
  )
}
