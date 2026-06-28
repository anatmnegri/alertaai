import logo from '../../assets/Logo.svg'

const fp = "'Poppins', sans-serif"
const fn = "'Nunito Sans', sans-serif"

// Moldura comum das telas de autenticação: fundo escuro da marca + card central.
export default function AuthShell({ titulo, subtitulo, children, footer }) {
  return (
    <div
      style={{
        minHeight: '100vh',
        width: '100vw',
        background:
          'radial-gradient(1200px 600px at 20% -10%, rgba(0,147,108,0.35), transparent), #010010',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        fontFamily: fn,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 420,
          background: '#fff',
          borderRadius: 18,
          padding: '36px 34px',
          boxShadow: '0 24px 80px rgba(0,0,0,0.45)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 26 }}>
          <div
            style={{
              background: '#010010',
              borderRadius: 12,
              padding: '14px 22px',
              display: 'flex',
              justifyContent: 'center',
            }}
          >
            <img src={logo} alt="Alerta.AI" style={{ height: 30 }} />
          </div>
        </div>

        <h1
          style={{
            fontFamily: fp,
            fontSize: 22,
            fontWeight: 700,
            color: '#1A1A1A',
            margin: '0 0 6px',
            textAlign: 'center',
          }}
        >
          {titulo}
        </h1>
        {subtitulo && (
          <p
            style={{
              fontSize: 13.5,
              color: '#6B7280',
              textAlign: 'center',
              lineHeight: 1.5,
              margin: '0 0 24px',
            }}
          >
            {subtitulo}
          </p>
        )}

        {children}

        {footer && (
          <div style={{ marginTop: 22, textAlign: 'center', fontSize: 13 }}>{footer}</div>
        )}
      </div>
    </div>
  )
}
