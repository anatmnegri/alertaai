import { Bell, Settings, ClipboardList, BarChart2, Mic, Bell as BellIcon } from 'lucide-react'
import { proximasPrevisoes, atividadesRecentes, usuario } from '../data/mockData'

const previsaoConfig = {
  chuva:      { bg: '#FFE4C2', color: '#FFAD47' },
  alagamento: { bg: '#FFE4C2', color: '#FFAD47' },
}

const atividadeConfig = {
  socorro:     { bg: '#F3E4FF', color: '#8F00FF', icon: ClipboardList },
  analise:     { bg: '#D5FFDA', color: '#008E13', icon: BarChart2     },
  comunicacao: { bg: '#E4FAFF', color: '#008AD8', icon: Mic           },
}

const font = "'Poppins', sans-serif"

export default function RightPanel() {
  return (
    <aside
      style={{
        width: 294,
        flexShrink: 0,
        height: '100%',
        backgroundColor: '#F9F8F9',
        borderLeft: '1px solid #EFEFEF',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: font,
      }}
    >
      {/* ── Top: Bell + Settings + Avatar ─────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '28px 24px 20px',
        }}
      >
        {/* Bell */}
        <div style={{ position: 'relative' }}>
          <Bell size={24} strokeWidth={1.8} style={{ color: '#8B8C8C' }} />
          <span
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              width: 10,
              height: 10,
              borderRadius: '50%',
              backgroundColor: '#FF0000',
            }}
          />
        </div>

        {/* Settings */}
        <Settings size={22} strokeWidth={1.8} style={{ color: '#8B8C8C' }} />

        {/* Avatar */}
        <div style={{ marginLeft: 'auto' }}>
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: 16,
              backgroundColor: '#EAEEFD',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
            }}
          >
            <span
              style={{
                fontSize: 24,
                fontWeight: 700,
                color: '#5B7BF8',
                fontFamily: font,
              }}
            >
              {usuario.nome.charAt(0)}
            </span>
          </div>
        </div>
      </div>

      {/* ── Próximas Previsões ─────────────────────────── */}
      <div style={{ padding: '0 24px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 style={{ fontSize: 16, fontWeight: 500, color: '#272835', margin: 0 }}>
            Próximas previsões
          </h2>
          <span style={{ fontSize: 18, color: '#00000033', letterSpacing: 2, cursor: 'pointer' }}>···</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {proximasPrevisoes.map((prev) => {
            const cfg = previsaoConfig[prev.tipo] ?? previsaoConfig.chuva
            return (
              <div key={prev.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {/* Ícone */}
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 8,
                    backgroundColor: cfg.bg,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <BellIcon size={18} style={{ color: cfg.color }} />
                </div>

                {/* Texto */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 10, fontWeight: 600, color: '#272835', margin: 0, lineHeight: '15px' }}>
                    {prev.titulo}
                  </p>
                  <p style={{ fontSize: 10, fontWeight: 300, color: '#9E9E9E', margin: 0, lineHeight: '15px' }}>
                    {prev.horario}{' '}
                    <span style={{ color: '#FFAD47' }}>{prev.urgencia}</span>
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Divisor */}
      <div style={{ borderTop: '1px solid #EFEFEF', margin: '0 24px' }} />

      {/* ── Atividades Recentes ────────────────────────── */}
      <div style={{ padding: '20px 24px 32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 style={{ fontSize: 16, fontWeight: 500, color: '#272835', margin: 0 }}>
            Atividades Recentes
          </h2>
          <span style={{ fontSize: 18, color: '#00000033', letterSpacing: 2, cursor: 'pointer' }}>···</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {atividadesRecentes.map((ativ) => {
            const cfg = atividadeConfig[ativ.tipo] ?? atividadeConfig.socorro
            const Icon = cfg.icon
            return (
              <div key={ativ.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                {/* Ícone */}
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 8,
                    backgroundColor: cfg.bg,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Icon size={16} style={{ color: cfg.color }} />
                </div>

                {/* Texto */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 10, fontWeight: 600, color: '#272835', margin: 0, lineHeight: '15px' }}>
                    {ativ.descricao}
                  </p>
                  <p style={{ fontSize: 10, fontWeight: 300, color: '#9E9E9E', margin: '2px 0 0', lineHeight: '15px' }}>
                    {ativ.data}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </aside>
  )
}
