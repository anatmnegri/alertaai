import { useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import { marcadoresMapa } from '../data/mockData'

const font = "'Poppins', sans-serif"

function FlyTo({ posicao }) {
  const map = useMap()
  if (posicao) map.flyTo(posicao, 14, { duration: 1.2 })
  return null
}

const tipoIconConfig = {
  sensor:       { bg: '#fff7e6', border: '#FA8001', label: '📡' },
  rio:          { bg: '#e6f4ff', border: '#1890ff', label: '🌊' },
  relato:       { bg: '#fff1f0', border: '#ff4d4f', label: '👥' },
  satelite:     { bg: '#f9f0ff', border: '#722ed1', label: '🛰️' },
  meteorologia: { bg: '#f6ffed', border: '#52c41a', label: '🌦️' },
  radar:        { bg: '#fff2e8', border: '#fa541c', label: '📻' },
}

function criarIconeCategoria(tipo, titulo, descricao) {
  const cfg = tipoIconConfig[tipo] || tipoIconConfig.sensor
  return L.divIcon({
    className: '',
    html: `
      <div style="
        background:#fff;
        border:1.5px solid ${cfg.border};
        border-radius:8px;
        padding:6px 10px;
        font-family:'Poppins',sans-serif;
        box-shadow:0 2px 10px rgba(0,0,0,0.12);
        min-width:220px;
        cursor:pointer;
      ">
        <div style="font-size:11px;font-weight:600;color:#272835;display:flex;align-items:center;gap:5px;">
          <span>${cfg.label}</span>
          <span>${titulo}</span>
        </div>
        <div style="font-size:9px;font-weight:400;color:#8F92A1;margin-top:2px;line-height:1.4;">${descricao}</div>
      </div>`,
    iconAnchor: [0, 0],
  })
}

const iconeOcorrencia = L.divIcon({
  className: '',
  html: `
    <div style="
      width:30px;height:30px;
      background:#FA8001;
      border:2px solid #fff;
      border-radius:50%;
      display:flex;align-items:center;justify-content:center;
      font-size:14px;
      box-shadow:0 2px 6px rgba(0,0,0,0.25);
    ">👤</div>`,
  iconAnchor: [15, 15],
})

export default function MapCard({ chamados = [], onChamadoSelect }) {
  const [busca, setBusca] = useState('')
  const [posicao, setPosicao] = useState(null)

  async function buscarLocalizacao(e) {
    if (e.key !== 'Enter' && e.type !== 'click') return
    if (!busca.trim()) return
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(busca)}&format=json&limit=1`
    )
    const data = await res.json()
    if (data.length > 0) {
      setPosicao([parseFloat(data[0].lat), parseFloat(data[0].lon)])
    }
  }

  return (
    <div
      style={{
        backgroundColor: '#fff',
        borderRadius: 10,
        overflow: 'hidden',
        boxShadow: '0 1px 4px rgba(0,0,0,0.07), 0 4px 16px rgba(0,0,0,0.05)',
        fontFamily: font,
      }}
    >
      {/* Cabeçalho */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px 12px' }}>
        <h2 style={{ fontSize: 18, fontWeight: 500, color: '#272835', margin: 0, lineHeight: '20px' }}>
          Geomapeamento da Cidade
        </h2>
        <span style={{ fontSize: 20, color: '#00000033', letterSpacing: 2, cursor: 'pointer' }}>···</span>
      </div>

      {/* Barra de controles */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 22px 12px', flexWrap: 'wrap' }}>
        {/* Search */}
        <div style={{
          flex: 1, minWidth: 160,
          display: 'flex', alignItems: 'center', gap: 6,
          background: '#F9F8F9', border: '1px solid #E8E8E8',
          borderRadius: 8, padding: '6px 10px',
        }}>
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
            <circle cx="6.5" cy="6.5" r="5.5" stroke="#8F92A1" strokeWidth="1.5"/>
            <path d="M10.5 10.5L14 14" stroke="#8F92A1" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            onKeyDown={buscarLocalizacao}
            placeholder="Procure por uma localização específica..."
            style={{
              border: 'none',
              outline: 'none',
              background: 'transparent',
              fontSize: 11,
              color: '#272835',
              fontFamily: font,
              width: '100%',
            }}
          />
        </div>

        <button
          onClick={(e) => buscarLocalizacao({ ...e, key: 'Enter' })}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            background: '#FA8001',
            border: 'none',
            borderRadius: 8,
            padding: '7px 14px',
            cursor: 'pointer',
            fontFamily: font,
            fontSize: 11,
            fontWeight: 600,
            color: '#fff',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          Buscar
        </button>

      </div>

      {/* Mapa */}
      <div style={{ position: 'relative', height: 393, margin: '0 22px 22px', borderRadius: 10, overflow: 'hidden' }}>
        {/* Badge "Monitoramento em Tempo Real" */}
        <div style={{
          position: 'absolute', top: 12,
          left: '50%', transform: 'translateX(-50%)',
          zIndex: 1000,
          display: 'flex', alignItems: 'center', gap: 6,
          backgroundColor: '#fff',
          border: '1px solid #E8E8E8',
          borderRadius: 999,
          padding: '5px 14px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          whiteSpace: 'nowrap',
          fontFamily: font,
        }}>
          <span style={{
            width: 8, height: 8, borderRadius: '50%',
            backgroundColor: '#22c55e',
            display: 'inline-block',
            animation: 'pulse 1.5s infinite',
          }} />
          <span style={{ fontSize: 11, fontWeight: 600, color: '#272835' }}>
            Monitoramento em Tempo Real
          </span>
        </div>

        <MapContainer
          center={[-8.038, -34.900]}
          zoom={12}
          style={{ height: '100%', width: '100%' }}
          zoomControl={true}
          scrollWheelZoom={false}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <FlyTo posicao={posicao} />

          {marcadoresMapa.map((m) => (
            <Marker
              key={m.id}
              position={[m.lat, m.lng]}
              icon={criarIconeCategoria(m.tipo, m.titulo, m.descricao)}
            >
              <Popup>
                <div style={{ fontFamily: font, fontSize: 11 }}>
                  <p style={{ fontWeight: 600, margin: '0 0 2px' }}>{m.titulo}</p>
                  <p style={{ color: '#8F92A1', margin: 0 }}>{m.descricao}</p>
                </div>
              </Popup>
            </Marker>
          ))}

          {chamados.filter((c) => c.lat != null && c.lng != null).map((c) => (
            <Marker
              key={`chamado-${c.id}`}
              position={[c.lat, c.lng]}
              icon={iconeOcorrencia}
              eventHandlers={{
                click: () => onChamadoSelect?.(c),
              }}
            >
              <Popup>
                <div style={{ fontFamily: font, fontSize: 11, minWidth: 160 }}>
                  <p style={{ fontWeight: 600, margin: '0 0 4px' }}>
                    Chamado #{c.id}
                  </p>
                  <p style={{ color: '#8F92A1', margin: '0 0 8px', lineHeight: 1.4 }}>
                    {c.localizacao}
                  </p>
                  <p style={{ margin: '0 0 8px' }}>
                    <span style={{ fontWeight: 600 }}>{c.tipo}</span>
                    {' · '}
                    {c.status}
                  </p>
                  {onChamadoSelect && (
                    <button
                      type="button"
                      onClick={() => onChamadoSelect(c)}
                      style={{
                        background: '#FA8001',
                        border: 'none',
                        borderRadius: 6,
                        color: '#fff',
                        fontSize: 10,
                        fontWeight: 600,
                        padding: '6px 10px',
                        cursor: 'pointer',
                        fontFamily: font,
                      }}
                    >
                      Ver detalhes
                    </button>
                  )}
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  )
}
