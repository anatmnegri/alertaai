import { useState, useEffect } from 'react'
import { Thermometer, Droplets, Wind, CloudRain, AlertTriangle, RefreshCw } from 'lucide-react'
import { fetchPanoramaAPAC, nivelRiscoClimatico, corNivelAviso } from '../services/weatherService'

const fp = "'Poppins', sans-serif"
const fn = "'Nunito Sans', sans-serif"

const labelStyle = {
  fontFamily: fp, fontSize: 11, fontWeight: 600,
  color: '#9CA3AF', textTransform: 'uppercase',
  letterSpacing: '0.6px', margin: '0 0 6px',
}

function num(v, casas = 0) {
  return typeof v === 'number' && !Number.isNaN(v) ? v.toFixed(casas) : '—'
}

// Moldura da seção (sempre presente, com o mesmo título nos vários estados).
function PanoramaCard({ children }) {
  return (
    <div style={{
      borderRadius: 12, border: '1px solid #EEF0F2',
      background: 'linear-gradient(180deg, #FBFDFC 0%, #FFFFFF 100%)',
      padding: '16px 18px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <CloudRain size={16} style={{ color: '#00936C' }} />
        <h3 style={{ fontFamily: fp, fontSize: 14, fontWeight: 700, color: '#1A1A1A', margin: 0 }}>
          Panorama Climático Instantâneo da APAC
        </h3>
      </div>
      {children}
    </div>
  )
}

function Metrica({ icon: Icon, titulo, valor, sub }) {
  return (
    <div style={{
      flex: '1 1 120px', minWidth: 110,
      background: '#F9FAFB', borderRadius: 10, padding: '12px 14px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <Icon size={14} style={{ color: '#00936C' }} />
        <span style={{ fontFamily: fp, fontSize: 10.5, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
          {titulo}
        </span>
      </div>
      <p style={{ fontFamily: fp, fontSize: 19, fontWeight: 700, color: '#1A1A1A', margin: 0, lineHeight: 1.1 }}>
        {valor}
      </p>
      {sub && (
        <p style={{ fontFamily: fn, fontSize: 11.5, color: '#9CA3AF', margin: '3px 0 0' }}>{sub}</p>
      )}
    </div>
  )
}

export default function PanoramaAPAC({ lat, lng }) {
  const [tentativa, setTentativa] = useState(0)
  // resultado.key identifica a qual consulta os dados pertencem — evita setState
  // síncrono dentro do effect (todo setState ocorre em callbacks assíncronos).
  const [resultado, setResultado] = useState({ key: null, dados: null, erro: false })

  const semCoord = lat == null || lng == null
  const key = `${lat},${lng},${tentativa}`

  useEffect(() => {
    if (semCoord) return
    const ctrl = new AbortController()
    fetchPanoramaAPAC(lat, lng, ctrl.signal)
      .then((d) => setResultado({ key, dados: d, erro: false }))
      .catch((err) => {
        if (err.name !== 'AbortError') {
          console.error('APAC:', err)
          setResultado({ key, dados: null, erro: true })
        }
      })
    return () => ctrl.abort()
  }, [lat, lng, semCoord, key])

  const carregado = resultado.key === key
  const dados = carregado ? resultado.dados : null
  const erro = carregado && resultado.erro

  if (semCoord) {
    return (
      <PanoramaCard>
        <p style={{ fontFamily: fn, fontSize: 12.5, color: '#9CA3AF', margin: 0 }}>
          Localização sem coordenadas — não foi possível consultar o clima da região.
        </p>
      </PanoramaCard>
    )
  }

  if (erro) {
    return (
      <PanoramaCard>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <p style={{ fontFamily: fn, fontSize: 12.5, color: '#B91C1C', margin: 0 }}>
            Não foi possível obter os dados da APAC agora.
          </p>
          <button
            onClick={() => setTentativa((t) => t + 1)}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              background: '#00936C', color: '#fff', border: 'none',
              borderRadius: 7, padding: '6px 12px',
              fontFamily: fp, fontSize: 12, fontWeight: 600, cursor: 'pointer',
            }}
          >
            <RefreshCw size={13} /> Tentar novamente
          </button>
        </div>
      </PanoramaCard>
    )
  }

  if (!dados) {
    return (
      <PanoramaCard>
        <p style={{ fontFamily: fn, fontSize: 12.5, color: '#6B7280', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          <RefreshCw size={14} className="apac-spin" style={{ color: '#00936C' }} />
          Consultando dados da APAC para esta região…
        </p>
        <style>{`@keyframes apacspin{to{transform:rotate(360deg)}}.apac-spin{animation:apacspin 1s linear infinite}`}</style>
      </PanoramaCard>
    )
  }

  const { instantaneo, precipitacao, previsao, alertas } = dados
  const precAtual = previsao?.precipitacao ?? 0
  const acum24 = precipitacao?.['24_horas'] ?? 0
  const risco = nivelRiscoClimatico({ precipitacaoAtual: precAtual, acumulado24h: acum24 })

  const municipio = instantaneo?.municipio || previsao?.municipio || precipitacao?.municipio
  const estacao = precipitacao?.estacao
  const leitura = instantaneo?.data_leitura || precipitacao?.data_hora_ultima_leitura

  const temp = instantaneo?.temp_instatanea ?? previsao?.temperatura
  const sensacao = instantaneo?.sensacao_termica
  const umidade = instantaneo?.umidade ?? previsao?.umidade_relativa
  const condUmidade = instantaneo?.cond_umidade
  const vento = instantaneo?.vento ?? previsao?.velocidade_vento
  const dirVento = instantaneo?.direcao_vento || previsao?.direcao_vento_texto
  const condicao = previsao?.texto_tela || previsao?.texto_api

  return (
    <PanoramaCard>
      {/* Cabeçalho: localidade + nível de risco */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 14 }}>
        <div>
          {municipio && (
            <p style={{ fontFamily: fp, fontSize: 13, fontWeight: 600, color: '#374151', margin: 0 }}>
              {municipio}
            </p>
          )}
          {estacao && (
            <p style={{ fontFamily: fn, fontSize: 11, color: '#9CA3AF', margin: '2px 0 0' }}>
              Estação: {estacao}
            </p>
          )}
        </div>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          background: risco.bg, color: risco.cor,
          borderRadius: 20, padding: '4px 12px',
          fontFamily: fn, fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap',
        }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: risco.cor }} />
          Risco {risco.rotulo}
        </span>
      </div>

      {/* Métricas instantâneas */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
        <Metrica
          icon={Thermometer}
          titulo="Temperatura"
          valor={`${num(temp, 1)}°C`}
          sub={sensacao != null ? `Sensação ${num(sensacao, 1)}°C` : condicao}
        />
        <Metrica icon={Droplets} titulo="Umidade" valor={`${num(umidade, 0)}%`} sub={condUmidade} />
        <Metrica icon={Wind} titulo="Vento" valor={`${num(vento, 1)} m/s`} sub={dirVento} />
        <Metrica icon={CloudRain} titulo="Chuva agora" valor={`${num(precAtual, 1)} mm`} sub={condicao} />
      </div>

      {/* Precipitação acumulada */}
      {precipitacao && (
        <div style={{ marginBottom: alertas?.length ? 14 : 0 }}>
          <p style={labelStyle}>Precipitação acumulada</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {[
              ['1h', precipitacao['1_hora']],
              ['24h', precipitacao['24_horas']],
              ['48h', precipitacao['48_horas']],
              ['72h', precipitacao['72_horas']],
            ].map(([rotulo, valor]) => (
              <div key={rotulo} style={{
                flex: '1 1 60px', minWidth: 56, textAlign: 'center',
                background: '#F9FAFB', borderRadius: 8, padding: '8px 6px',
              }}>
                <p style={{ fontFamily: fn, fontSize: 10, fontWeight: 700, color: '#9CA3AF', margin: 0 }}>{rotulo}</p>
                <p style={{ fontFamily: fp, fontSize: 14, fontWeight: 700, color: '#1A1A1A', margin: '2px 0 0' }}>
                  {num(valor, 1)}<span style={{ fontSize: 10, color: '#9CA3AF' }}> mm</span>
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Avisos vigentes da APAC */}
      {alertas?.length > 0 && (
        <div>
          <p style={labelStyle}>Avisos vigentes da APAC</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {alertas.slice(0, 3).map((a, i) => {
              const c = corNivelAviso(a.nivel_aviso)
              return (
                <div key={i} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 8,
                  background: c.bg, borderRadius: 8, padding: '8px 11px',
                }}>
                  <AlertTriangle size={15} style={{ color: c.cor, flexShrink: 0, marginTop: 1 }} />
                  <div>
                    <p style={{ fontFamily: fn, fontSize: 12.5, fontWeight: 700, color: c.cor, margin: 0 }}>
                      {a.texto_aviso}
                    </p>
                    <p style={{ fontFamily: fn, fontSize: 11, color: '#6B7280', margin: '2px 0 0' }}>
                      Nível {a.nivel_aviso} · aviso {a.numero_aviso_meteorologico}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {leitura && (
        <p style={{ fontFamily: fn, fontSize: 10.5, color: '#B6BBC2', margin: '12px 0 0', textAlign: 'right' }}>
          Fonte: APAC · leitura {leitura}
        </p>
      )}
    </PanoramaCard>
  )
}
