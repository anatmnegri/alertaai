import { usuario } from '../data/mockData'

export default function Header() {
  return (
    <div style={{ fontFamily: "'Poppins', sans-serif" }}>
      <p
        style={{
          fontSize: 16,
          fontWeight: 400,
          color: '#8F92A1',
          lineHeight: '24px',
          margin: '0 0 2px',
        }}
      >
        Olá {usuario.nome}, bem-vinda de volta! 👋
      </p>
      <h1
        style={{
          fontSize: 36,
          fontWeight: 900,
          textTransform: 'uppercase',
          color: '#FA8001',
          letterSpacing: '-0.06em',
          lineHeight: '54px',
          margin: 0,
        }}
      >
        Defesa Civil do Recife
      </h1>
    </div>
  )
}
