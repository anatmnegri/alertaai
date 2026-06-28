import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CloudRain, Droplets, RefreshCw, Wind } from 'lucide-react'

const BASE = 'https://api.apac.pe.gov.br/api.php'
const FALLBACK_MUNICIPIOS = [
  { nome: 'Recife', codigo: 2611606 },
  { nome: 'Olinda', codigo: 2609600 },
  { nome: 'Jaboatão dos Guararapes', codigo: 2607901 },
  { nome: 'Paulista', codigo: 2610707 },
  { nome: 'Cabo de Santo Agostinho', codigo: 2602902 },
  { nome: 'Caruaru', codigo: 2604106 },
  { nome: 'Petrolina', codigo: 2611101 },
  { nome: 'Garanhuns', codigo: 2606002 },
]

const fontPoppins = "'Poppins', sans-serif"
const fontNunito = "'Nunito Sans', sans-serif"

async function getJson(path, signal) {
  const res = await fetch(`${BASE}${path}`, { signal })
  if (!res.ok) throw new Error(`APAC ${res.status}`)
  return res.json()
}

function formatarHora(dataStr) {
  const d = new Date(String(dataStr).replace(' ', 'T'))
  if (Number.isNaN(d.getTime())) return '--:--'
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function formatarDataCurta(dataStr) {
  const d = new Date(String(dataStr).replace(' ', 'T'))
  if (Number.isNaN(d.getTime())) return '--'
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

function num(v, casas = 1) {
  return typeof v === 'number' && !Number.isNaN(v) ? v.toFixed(casas) : '0.0'
}

function Card({ children, style }) {
  return (
    <div
      style={{
        background: '#FFFFFF',
        borderRadius: 14,
        boxShadow: '0 1px 4px rgba(0,0,0,0.06), 0 8px 24px rgba(0,0,0,0.03)',
        ...style,
      }}
    >
      {children}
    </div>
  )
}

export default function PrevisoesApacPage() {
  const [municipios, setMunicipios] = useState(FALLBACK_MUNICIPIOS)
  const [municipioIndex, setMunicipioIndex] = useState(0)
  const [refreshKey, setRefreshKey] = useState(0)
  const [carregando, setCarregando] = useState(true)
  const [carregandoMunicipios, setCarregandoMunicipios] = useState(true)
  const [erro, setErro] = useState('')
  const [previsao, setPrevisao] = useState([])
  const [alertas, setAlertas] = useState([])
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState('')

  const municipioSelecionado = municipios[municipioIndex]

  useEffect(() => {
    const ctrl = new AbortController()

    const carregarMunicipios = async () => {
      try {
        const lista = await getJson('/municipio', ctrl.signal)
        if (Array.isArray(lista) && lista.length > 0) {
          const ordenado = lista
            .filter((item) => item && item.codigo && item.nome)
            .map((item) => ({ codigo: item.codigo, nome: item.nome }))

          if (ordenado.length > 0) {
            setMunicipios(ordenado)
            const idxRecife = ordenado.findIndex((m) => m.codigo === 2611606)
            setMunicipioIndex(idxRecife >= 0 ? idxRecife : 0)
          }
        }
      } catch {
        // Mantém a lista fallback quando a API de municípios falhar.
      } finally {
        setCarregandoMunicipios(false)
      }
    }

    carregarMunicipios()
    return () => ctrl.abort()
  }, [])

  const carregar = async (signal, municipio) => {
    setCarregando(true)
    setErro('')

    try {
      const [previsaoRes, alertasRes] = await Promise.all([
        getJson(`/previsao_municipio?codigo=${municipio.codigo}`, signal),
        getJson('/alertas', signal),
      ])

      const previsaoLista = Array.isArray(previsaoRes) ? previsaoRes : []
      const alertasLista = Array.isArray(alertasRes) ? alertasRes : []

      const agora = Date.now()
      const previsoesFuturas = previsaoLista
        .filter((item) => {
          const t = new Date(String(item.data).replace(' ', 'T')).getTime()
          return !Number.isNaN(t) && t >= agora
        })
        .slice(0, 12)

      const alertasVigentes = alertasLista
        .filter((item) => {
          const validade = new Date(String(item.data_validade_aviso).replace(' ', 'T')).getTime()
          return !Number.isNaN(validade) && validade >= agora
        })
        .slice(0, 6)

      setPrevisao(previsoesFuturas)
      setAlertas(alertasVigentes)
      setUltimaAtualizacao(new Date().toLocaleString('pt-BR'))
    } catch (e) {
      if (e.name !== 'AbortError') {
        setErro('Não foi possível carregar os dados da APAC neste momento.')
      }
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    const ctrl = new AbortController()
    if (municipioSelecionado) {
      carregar(ctrl.signal, municipioSelecionado)
    }
    return () => ctrl.abort()
  }, [municipioSelecionado, refreshKey])

  const resumoAtual = useMemo(() => previsao[0] || null, [previsao])

  return (
    <div
      style={{
        padding: '40px',
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
        minHeight: '100%',
        fontFamily: fontNunito,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <h1
            style={{
              fontFamily: fontPoppins,
              fontSize: 30,
              fontWeight: 800,
              margin: 0,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              background: 'linear-gradient(90deg, #0B8F9A 0%, #1F5A9F 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            Previsões da APAC
          </h1>
          <p style={{ margin: '4px 0 0', color: '#6B7280', fontSize: 12.5 }}>
            Dados em tempo real de {BASE}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <button
            onClick={() => setMunicipioIndex((i) => (i - 1 + municipios.length) % municipios.length)}
            style={{
              border: '1px solid #D1D5DB',
              borderRadius: 10,
              background: '#FFFFFF',
              color: '#334155',
              padding: '10px 12px',
              fontFamily: fontPoppins,
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Anterior
          </button>

          <select
            value={municipioIndex}
            onChange={(e) => setMunicipioIndex(Number(e.target.value))}
            disabled={carregandoMunicipios}
            style={{
              border: '1px solid #D1D5DB',
              borderRadius: 10,
              background: '#FFFFFF',
              color: '#111827',
              padding: '10px 12px',
              minWidth: 220,
              fontFamily: fontPoppins,
              fontSize: 12.5,
              fontWeight: 600,
            }}
          >
            {municipios.map((m, idx) => (
              <option key={`${m.codigo}-${m.nome}`} value={idx}>
                {m.nome}
              </option>
            ))}
          </select>

          <button
            onClick={() => setMunicipioIndex((i) => (i + 1) % municipios.length)}
            style={{
              border: '1px solid #D1D5DB',
              borderRadius: 10,
              background: '#FFFFFF',
              color: '#334155',
              padding: '10px 12px',
              fontFamily: fontPoppins,
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Proximo
          </button>

          <button
            onClick={() => setRefreshKey((k) => k + 1)}
            style={{
              border: 'none',
              borderRadius: 10,
              background: '#00936C',
              color: '#FFFFFF',
              padding: '10px 14px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              fontFamily: fontPoppins,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <RefreshCw size={15} /> Atualizar
          </button>
        </div>
      </div>

      {erro && (
        <Card style={{ padding: '14px 16px', border: '1px solid rgba(220,38,38,0.2)', background: '#FEF2F2' }}>
          <p style={{ margin: 0, color: '#B91C1C', fontSize: 13.5, fontWeight: 700 }}>{erro}</p>
        </Card>
      )}

      {carregando && (
        <Card style={{ padding: '14px 16px' }}>
          <p style={{ margin: 0, color: '#6B7280', fontSize: 13.5 }}>Carregando previsões meteorológicas...</p>
        </Card>
      )}

      {!carregando && resumoAtual && (
        <Card style={{ padding: '18px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
            <div>
              <p style={{ margin: 0, color: '#9CA3AF', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>
                Município
              </p>
              <h2 style={{ margin: '3px 0 0', color: '#111827', fontSize: 22, fontFamily: fontPoppins }}>
                {resumoAtual.municipio}
              </h2>
              <p style={{ margin: '4px 0 0', color: '#6B7280', fontSize: 12.5 }}>
                {formatarDataCurta(resumoAtual.data)} às {formatarHora(resumoAtual.data)}
              </p>
            </div>
            <span
              style={{
                background: 'rgba(2,132,199,0.12)',
                color: '#0369A1',
                borderRadius: 999,
                padding: '5px 10px',
                fontSize: 11.5,
                fontWeight: 700,
              }}
            >
              {resumoAtual.texto_tela || resumoAtual.texto_api}
            </span>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 14 }}>
            {[
              { icon: CloudRain, label: 'Chuva', value: `${num(resumoAtual.precipitacao, 1)} mm` },
              { icon: Droplets, label: 'Umidade', value: `${num(resumoAtual.umidade_relativa, 0)}%` },
              { icon: Wind, label: 'Vento', value: `${num(resumoAtual.velocidade_vento, 1)} m/s` },
            ].map((m) => (
              <div
                key={m.label}
                style={{
                  flex: '1 1 160px',
                  minWidth: 150,
                  borderRadius: 10,
                  background: '#F8FAFC',
                  padding: '10px 12px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <m.icon size={15} style={{ color: '#0F766E' }} />
                  <span style={{ color: '#64748B', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>
                    {m.label}
                  </span>
                </div>
                <p style={{ margin: '6px 0 0', color: '#0F172A', fontSize: 18, fontWeight: 800, fontFamily: fontPoppins }}>
                  {m.value}
                </p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {!carregando && (
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20 }}>
          <Card style={{ padding: '16px 18px' }}>
            <h3 style={{ margin: 0, fontSize: 15, fontFamily: fontPoppins, color: '#1F2937' }}>
              Próximas horas
            </h3>
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {previsao.length === 0 && (
                <p style={{ margin: 0, color: '#6B7280', fontSize: 13 }}>Sem previsão futura disponível no momento.</p>
              )}

              {previsao.map((item, idx) => (
                <div
                  key={`${item.data}-${idx}`}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '88px 1fr auto',
                    gap: 10,
                    alignItems: 'center',
                    padding: '8px 10px',
                    borderRadius: 8,
                    background: idx === 0 ? 'rgba(2,132,199,0.09)' : '#F8FAFC',
                  }}
                >
                  <div>
                    <p style={{ margin: 0, color: '#0F172A', fontSize: 13, fontWeight: 800 }}>{formatarHora(item.data)}</p>
                    <p style={{ margin: 0, color: '#64748B', fontSize: 11 }}>{formatarDataCurta(item.data)}</p>
                  </div>
                  <p style={{ margin: 0, color: '#1F2937', fontSize: 12.5 }}>{item.texto_tela || item.texto_api}</p>
                  <p style={{ margin: 0, color: '#0369A1', fontSize: 12, fontWeight: 700 }}>
                    {num(item.precipitacao, 1)} mm
                  </p>
                </div>
              ))}
            </div>
          </Card>

          <Card style={{ padding: '16px 18px' }}>
            <h3 style={{ margin: 0, fontSize: 15, fontFamily: fontPoppins, color: '#1F2937' }}>
              Alertas vigentes
            </h3>
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {alertas.length === 0 && (
                <p style={{ margin: 0, color: '#6B7280', fontSize: 13 }}>Nenhum alerta vigente.</p>
              )}

              {alertas.map((a, idx) => (
                <div
                  key={`${a.numero_aviso_meteorologico}-${idx}`}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 8,
                    borderRadius: 8,
                    padding: '8px 10px',
                    background: 'rgba(245,158,11,0.14)',
                  }}
                >
                  <AlertTriangle size={15} style={{ color: '#B45309', marginTop: 1 }} />
                  <div>
                    <p style={{ margin: 0, color: '#92400E', fontSize: 12.5, fontWeight: 700 }}>{a.texto_aviso}</p>
                    <p style={{ margin: '2px 0 0', color: '#6B7280', fontSize: 11 }}>
                      Nível {a.nivel_aviso} - validade até {formatarDataCurta(a.data_validade_aviso)} {formatarHora(a.data_validade_aviso)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {ultimaAtualizacao && (
        <p style={{ margin: 0, textAlign: 'right', color: '#9CA3AF', fontSize: 11.5 }}>
          Última atualização: {ultimaAtualizacao}
        </p>
      )}
    </div>
  )
}
