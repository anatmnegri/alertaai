import {
  LayoutDashboard,
  ClipboardList,
  Map,
  BarChart2,
  Building2,
  MessageCircle,
  Radio,
} from 'lucide-react'
import logo from '../assets/Logo.svg'

const navItems = [
  { label: 'Dashboard',         icon: LayoutDashboard },
  { label: 'Chamados',          icon: ClipboardList    },
  { label: 'Geomapeamento',     icon: Map              },
  { label: 'Relatórios',        icon: BarChart2        },
  { label: 'Previsões da APAC', icon: Building2        },
]

const chatItems = [
  { label: 'Mensagens',    icon: MessageCircle, badge: 9 },
  { label: 'Comunicações', icon: MessageCircle           },
]

const ITEM_H    = 57
const HABILITADO = ['Dashboard', 'Chamados']

export default function Sidebar({ active = 'Dashboard', onNavigate }) {
  return (
    <aside
      style={{
        width: 294,
        flexShrink: 0,
        height: '100%',
        backgroundColor: '#010010',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: "'Poppins', sans-serif",
        position: 'relative',
        overflowX: 'hidden',
      }}
    >
      {/* Logo */}
      <div style={{ padding: '28px 24px 20px', display: 'flex', justifyContent: 'center' }}>
        <img src={logo} alt="Alerta.AI" style={{ height: 32, width: 'auto' }} />
      </div>

      {/* Navegação principal */}
      <nav style={{ flex: 1, padding: '0 0' }}>
        {navItems.map(({ label, icon: Icon }) => {
          const isActive   = label === active
          const isEnabled  = HABILITADO.includes(label)

          return (
            <div key={label} style={{ position: 'relative', height: ITEM_H }}>
              {/* Fundo gradiente do item ativo */}
              {isActive && (
                <div style={{
                  position: 'absolute', inset: 0,
                  background: 'linear-gradient(90deg, #00936C 68%, rgba(0,147,108,0) 100%)',
                  pointerEvents: 'none',
                }} />
              )}

              {/* Barra lateral branca */}
              {isActive && (
                <div style={{
                  position: 'absolute', left: 0,
                  top: '50%', transform: 'translateY(-50%)',
                  width: 6, height: 50,
                  backgroundColor: '#FFFFFF',
                  borderRadius: '0 3px 3px 0',
                }} />
              )}

              <button
                onClick={() => isEnabled && onNavigate && onNavigate(label)}
                style={{
                  position: 'relative',
                  width: '100%', height: '100%',
                  display: 'flex', alignItems: 'center',
                  gap: 12, paddingLeft: 34, paddingRight: 16,
                  background: 'transparent', border: 'none',
                  cursor: isEnabled ? 'pointer' : 'not-allowed',
                  color: isActive ? '#FFFFFF' : isEnabled ? 'rgba(204,204,204,0.7)' : 'rgba(204,204,204,0.4)',
                  fontFamily: "'Poppins', sans-serif",
                  fontSize: isActive ? 18 : 14,
                  fontWeight: isActive ? 600 : 500,
                  letterSpacing: '-0.2px',
                  textAlign: 'left',
                  opacity: isEnabled ? 1 : 0.45,
                  transition: 'opacity 0.15s',
                }}
              >
                <Icon
                  size={20}
                  strokeWidth={isActive ? 2 : 1.8}
                  style={{ color: isActive ? '#FFFFFF' : '#CCCCCC', flexShrink: 0 }}
                />
                {label}
              </button>
            </div>
          )
        })}
      </nav>

      {/* Separador */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', margin: '0 10px' }} />

      {/* Seção Chats */}
      <div style={{ padding: '16px 10px 24px' }}>
        <p
          style={{
            fontFamily: "'Poppins', sans-serif",
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: 1,
            textTransform: 'uppercase',
            color: '#EAEAEA',
            paddingLeft: 24,
            marginBottom: 4,
          }}
        >
          Chats Alerta.AI
        </p>

        {chatItems.map(({ label, icon: Icon, badge }) => (
          <div key={label} style={{ position: 'relative', height: ITEM_H }}>
            <button
              disabled
              style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                paddingLeft: 34,
                paddingRight: 16,
                background: 'transparent',
                border: 'none',
                cursor: 'not-allowed',
                color: 'rgba(204,204,204,0.4)',
                fontFamily: "'Poppins', sans-serif",
                fontSize: 14,
                fontWeight: 500,
                letterSpacing: '-0.2px',
                opacity: 0.5,
              }}
            >
              <Icon
                size={20}
                strokeWidth={1.8}
                style={{ color: '#CCCCCC', flexShrink: 0 }}
              />
              <span style={{ flex: 1, textAlign: 'left' }}>{label}</span>
              {badge && (
                <span
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: '50%',
                    backgroundColor: '#FF0000',
                    color: '#FFFFFF',
                    fontSize: 8,
                    fontWeight: 700,
                    fontFamily: "'Poppins', sans-serif",
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  {badge}
                </span>
              )}
            </button>
          </div>
        ))}
      </div>
    </aside>
  )
}
