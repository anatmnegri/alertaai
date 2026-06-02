import { useEffect } from 'react'
import { X, MessageCircle } from 'lucide-react'
import Badge from './ui/Badge'

const fp = "'Poppins', sans-serif"
const fn = "'Nunito Sans', sans-serif"

const TIPO_COR = {
  'Alagamento':      { bg: 'rgba(249,115,22,0.12)',  color: '#F97316' },
  'Deslizamento':    { bg: 'rgba(251,191,36,0.15)',  color: '#D97706' },
  'Ventania':        { bg: 'rgba(99,102,241,0.12)',  color: '#6366F1' },
  'Fortes Ventos':   { bg: 'rgba(99,102,241,0.12)',  color: '#6366F1' },
  'Queda de árvore': { bg: 'rgba(34,197,94,0.12)',   color: '#16A34A' },
  'Desabamento':     { bg: 'rgba(239,68,68,0.12)',   color: '#DC2626' },
}

const label = {
  fontFamily: fp, fontSize: 11, fontWeight: 600,
  color: '#9CA3AF', textTransform: 'uppercase',
  letterSpacing: '0.6px', margin: '0 0 6px',
}

export default function ChamadoModal({ chamado, onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!chamado) return null

  const tipoCor = TIPO_COR[chamado.tipo] ?? { bg: 'rgba(0,0,0,0.08)', color: '#555' }
  const inicial = chamado.nome?.charAt(0).toUpperCase() ?? '?'

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        backgroundColor: 'rgba(0,0,0,0.55)',
        backdropFilter: 'blur(3px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, padding: '20px',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#fff', borderRadius: 16,
          width: '100%', maxWidth: 720,
          maxHeight: '92vh', overflowY: 'auto',
          padding: '28px 32px 28px',
          boxShadow: '0 24px 80px rgba(0,0,0,0.22)',
          animation: 'modalIn 0.2s ease',
        }}
      >

        {/* ── Cabeçalho ──────────────────────────────────────────────────── */}
        <div style={{
          display: 'flex', alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 24, gap: 12, flexWrap: 'wrap',
        }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <h2 style={{ fontFamily: fp, fontSize: 20, fontWeight: 700, color: '#1A1A1A', margin: 0 }}>
              Detalhes do Chamado
            </h2>
            <span style={{ fontFamily: fp, fontSize: 17, fontWeight: 400, color: '#9CA3AF' }}>
              #{chamado.id}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button style={{
              display: 'flex', alignItems: 'center', gap: 6,
              backgroundColor: '#00936C', color: '#fff',
              border: 'none', borderRadius: 8, padding: '9px 18px',
              fontFamily: fp, fontSize: 13, fontWeight: 600, cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(0,147,108,0.3)',
            }}>
              <MessageCircle size={14} /> Abrir chat
            </button>
            <button
              onClick={onClose}
              style={{
                width: 32, height: 32, borderRadius: '50%',
                background: 'rgba(0,0,0,0.07)', border: 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', color: '#555', flexShrink: 0,
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.14)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(0,0,0,0.07)'}
            >
              <X size={15} strokeWidth={2.5} />
            </button>
          </div>
        </div>

        {/* ── Corpo: 2 colunas ───────────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: 32, alignItems: 'flex-start' }}>

          {/* ── Coluna esquerda ──────────────────────────────────────────── */}
          <div style={{ flex: '0 0 42%' }}>

            {/* Aberto por */}
            <p style={label}>Aberto por</p>
            <div style={{ marginBottom: 20 }}>
              <p style={{ fontFamily: fp, fontSize: 14, fontWeight: 600, color: '#1A1A1A', margin: 0 }}>
                {chamado.nome}
              </p>
              <p style={{ fontFamily: fn, fontSize: 12, color: '#9CA3AF', margin: '4px 0 0' }}>
                {chamado.telefone ?? '—'}
              </p>
            </div>

            {/* Divisor */}
            <div style={{ borderTop: '0.5px solid #E5E7EB', marginBottom: 20 }} />

            {/* Resumo da Transcrição */}
            <p style={{ fontFamily: fp, fontSize: 14, fontWeight: 700, color: '#1A1A1A', margin: '0 0 10px' }}>
              Resumo da Transcrição
            </p>
            <p style={{
              fontFamily: fn, fontSize: 12.5, color: '#6B7280',
              lineHeight: 1.9, fontStyle: 'italic', margin: 0,
            }}>
              &ldquo;{chamado.transcricao ?? 'Sem transcrição disponível.'}&rdquo;
            </p>
          </div>

          {/* Divisor vertical */}
          <div style={{ width: '0.5px', background: '#E5E7EB', alignSelf: 'stretch', flexShrink: 0 }} />

          {/* ── Coluna direita ───────────────────────────────────────────── */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Localização */}
            <div>
              <p style={label}>Localização</p>
              <p style={{ fontFamily: fn, fontSize: 13, color: '#374151', fontStyle: 'italic', margin: 0 }}>
                {chamado.localizacao}
              </p>
            </div>

            {/* Data | Tipo | Classificação — mesma linha */}
            <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap', alignItems: 'flex-start' }}>
              <div>
                <p style={label}>Data</p>
                <p style={{ fontFamily: fn, fontSize: 13, color: '#374151', margin: 0 }}>
                  {chamado.data}
                </p>
              </div>
              <div>
                <p style={label}>Tipo</p>
                <span style={{
                  display: 'inline-flex', alignItems: 'center',
                  padding: '4px 14px', borderRadius: 20,
                  backgroundColor: tipoCor.bg, color: tipoCor.color,
                  fontFamily: fn, fontSize: 12, fontWeight: 700,
                }}>
                  {chamado.tipo}
                </span>
              </div>
              <div>
                <p style={label}>Classificação</p>
                <Badge status={chamado.status} />
              </div>
            </div>

            {/* Anexos */}
            <div>
              <p style={{ fontFamily: fp, fontSize: 14, fontWeight: 700, color: '#1A1A1A', margin: '0 0 10px' }}>
                Anexos
              </p>
              <div style={{
                background: '#F9FAFB', borderRadius: 10,
                padding: '14px', display: 'flex', flexWrap: 'wrap', gap: 12,
                minHeight: 100,
              }}>
                {chamado.imagem ? (
                  <img src={chamado.imagem} alt="anexo"
                    style={{ width: 120, height: 90, objectFit: 'cover', borderRadius: 8 }}
                  />
                ) : (
                  <div style={{
                    width: 90, height: 80, borderRadius: 10,
                    border: '1.5px solid #E5E7EB', background: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none"
                      stroke="#C4C4C4" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="2"/>
                      <circle cx="8.5" cy="8.5" r="1.5"/>
                      <polyline points="21 15 16 10 5 21"/>
                    </svg>
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>
      </div>

      <style>{`
        @keyframes modalIn {
          from { opacity: 0; transform: scale(0.96) translateY(10px); }
          to   { opacity: 1; transform: scale(1)   translateY(0);     }
        }
      `}</style>
    </div>
  )
}
