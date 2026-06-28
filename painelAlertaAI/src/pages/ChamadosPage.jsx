import React, { useState, useRef, useEffect } from 'react'
import { Filter, Home, TreePine, Mountain, Waves, CheckCircle } from 'lucide-react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import Badge from '../components/ui/Badge'
import ChamadoModal from '../components/ChamadoModal'
import {
  getChamadosAbertos,
  getDadosChamados48h,
  getResumoChamados48h,
} from '../services/chamadosService'
import { resolverOcorrencia } from '../services/api'

const fontPoppins    = "'Poppins', sans-serif"
const fontNunito     = "'Nunito Sans', sans-serif"
const colunas        = ['ID', 'NAME', 'LOCALIZAÇÃO', 'DATA', 'TIPO', 'STATUS']

const FILTROS = [
  { label: 'Todos',    value: null,       bg: 'rgba(0,0,0,0.06)',      cor: '#555'    },
  { label: 'Leve',     value: 'Leve',     bg: 'rgba(0,182,155,0.18)',  cor: '#00B69B' },
  { label: 'Moderado', value: 'Moderado', bg: 'rgba(245,158,11,0.18)', cor: '#B45309' },
  { label: 'Crítico',  value: 'Crítico',  bg: 'rgba(239,56,38,0.15)', cor: '#EF3826'  },
]

const ICONE_MAP = { home: Home, tree: TreePine, mountain: Mountain, waves: Waves }
const MAX_BAR   = 150

// ─── Sub-componente: linha do resumo ─────────────────────────────────────────
function ResumoItem({ tipo, count, cor, icone, semDivisor }) {
  const IconComp = ICONE_MAP[icone]
  const pct      = Math.min((count / MAX_BAR) * 100, 100)

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 0' }}>
        {/* Ícone */}
        <div style={{
          width: 38, height: 38, borderRadius: 8,
          backgroundColor: 'rgba(0,0,0,0.05)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          {IconComp && <IconComp size={18} color="#666" />}
        </div>

        {/* Texto + barra */}
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7 }}>
            <span style={{
              fontFamily: fontPoppins, fontSize: 12,
              fontWeight: 500, color: '#272835',
            }}>
              {tipo}
            </span>
            <span style={{
              fontFamily: fontNunito, fontSize: 11,
              fontWeight: 600, color: '#9CA3AF',
            }}>
              {count} chamados
            </span>
          </div>
          <div style={{
            height: 6, borderRadius: 3,
            backgroundColor: 'rgba(0,0,0,0.08)', overflow: 'hidden',
          }}>
            <div style={{
              height: '100%', width: `${pct}%`,
              borderRadius: 3, backgroundColor: cor,
            }} />
          </div>
        </div>
      </div>
      {!semDivisor && (
        <div style={{ borderTop: '0.4px solid rgba(0,0,0,0.07)' }} />
      )}
    </>
  )
}

// ─── Tooltip customizado do gráfico ──────────────────────────────────────────
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: '#fff',
      border: 'none',
      borderRadius: 8,
      padding: '8px 14px',
      boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
      fontFamily: fontPoppins,
      fontSize: 11,
    }}>
      <p style={{ margin: '0 0 2px', color: '#9CA3AF' }}>{label}</p>
      <p style={{ margin: 0, fontWeight: 700, color: '#6366F1' }}>
        {payload[0].value} chamados
      </p>
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function ChamadosPage({ chamados = [], onChamadosChange }) {
  const [chamadoSelecionado, setChamadoSelecionado] = useState(null)
  const [filtro, setFiltro]       = useState(null)
  const [selecionados, setSelecionados] = useState(new Set())
  const checkboxTodosRef = useRef(null)

  const agora = new Date()
  const chamadosAbertos   = getChamadosAbertos(chamados)
  const dadosChamados48h  = getDadosChamados48h(chamados, agora)
  const resumoChamados48h = getResumoChamados48h(chamados, agora)

  const chamadosFiltrados = filtro
    ? chamadosAbertos.filter(c => c.status === filtro)
    : chamadosAbertos

  const todosSelecionados  = chamadosFiltrados.length > 0 && chamadosFiltrados.every(c => selecionados.has(c.id))
  const algunsSelecionados = chamadosFiltrados.some(c => selecionados.has(c.id)) && !todosSelecionados

  // Atualiza estado indeterminate do checkbox de cabeçalho
  useEffect(() => {
    if (checkboxTodosRef.current) {
      checkboxTodosRef.current.indeterminate = algunsSelecionados
    }
  }, [algunsSelecionados])

  function toggleTodos() {
    setSelecionados(prev => {
      const next = new Set(prev)
      if (todosSelecionados) {
        chamadosFiltrados.forEach(c => next.delete(c.id))
      } else {
        chamadosFiltrados.forEach(c => next.add(c.id))
      }
      return next
    })
  }

  function toggleLinha(id, e) {
    e.stopPropagation()
    setSelecionados(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function handleResolver() {
    const ids = [...selecionados]
    await Promise.all(ids.map(id => resolverOcorrencia(id)))
    onChamadosChange(prev => prev.map(c => ids.includes(c.id) ? { ...c, aberto: false } : c))
    setSelecionados(new Set())
  }

  return (
    <>
    <div style={{
      padding: '40px',
      display: 'flex',
      flexDirection: 'column',
      gap: 24,
      minHeight: '100%',
    }}>

      {/* ── Título ─────────────────────────────────────────────────────────── */}
      <h1 style={{
        fontFamily: fontPoppins,
        fontSize: 30,
        fontWeight: 800,
        margin: 0,
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
        background: 'linear-gradient(90deg, #F97316 0%, #EF4444 100%)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
      }}>
        Chamados de Ajuda
      </h1>


      {/* ── Resumo 48h + Gráfico ────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 20, alignItems: 'stretch' }}>

        {/* Card resumo */}
        <div style={{
          width: '38%', flexShrink: 0,
          background: '#fff', borderRadius: 12,
          padding: '18px 22px',
          boxShadow: '0 1px 4px rgba(0,0,0,0.07), 0 4px 16px rgba(0,0,0,0.04)',
        }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            alignItems: 'center', marginBottom: 4,
          }}>
            <h3 style={{
              fontFamily: fontPoppins, fontSize: 14,
              fontWeight: 500, color: '#272835', margin: 0,
            }}>
              Resumo - últimas 48h
            </h3>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <Filter size={14} color="#BDBDBD" />
              <span style={{ fontSize: 18, color: '#BDBDBD', letterSpacing: 2, cursor: 'pointer', lineHeight: 1 }}>···</span>
            </div>
          </div>

          {resumoChamados48h.map((item, idx) => (
            <ResumoItem
              key={item.tipo}
              {...item}
              semDivisor={idx === resumoChamados48h.length - 1}
            />
          ))}
        </div>

        {/* Gráfico linha */}
        <div style={{
          flex: 1,
          background: '#fff', borderRadius: 12,
          padding: '18px 22px',
          boxShadow: '0 1px 4px rgba(0,0,0,0.07), 0 4px 16px rgba(0,0,0,0.04)',
        }}>
          <h3 style={{
            fontFamily: fontPoppins, fontSize: 14,
            fontWeight: 500, color: '#272835',
            margin: '0 0 6px',
          }}>
            Número de Chamados
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16 }}>
            <div style={{
              width: 8, height: 8, borderRadius: '50%',
              backgroundColor: '#6366F1',
            }} />
            <span style={{ fontFamily: fontNunito, fontSize: 11, color: '#9CA3AF' }}>
              Últimas 48h
            </span>
          </div>

          <ResponsiveContainer width="100%" height={210}>
            <AreaChart
              data={dadosChamados48h}
              margin={{ top: 4, right: 8, left: -24, bottom: 0 }}
            >
              <defs>
                <linearGradient id="gradChamados" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#6366F1" stopOpacity={0.18} />
                  <stop offset="95%" stopColor="#6366F1" stopOpacity={0.02} />
                </linearGradient>
              </defs>

              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(0,0,0,0.06)"
                vertical={false}
              />
              <XAxis
                dataKey="hora"
                tick={{ fontSize: 10, fontFamily: fontNunito, fill: '#9CA3AF' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fontFamily: fontNunito, fill: '#9CA3AF' }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="chamados"
                stroke="#6366F1"
                strokeWidth={2.2}
                fill="url(#gradChamados)"
                dot={{ r: 3.5, fill: '#6366F1', strokeWidth: 0 }}
                activeDot={{ r: 5, fill: '#6366F1' }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Tabela chamados abertos ─────────────────────────────────────────── */}
      <div style={{ fontFamily: fontNunito }}>
        <div style={{
          background: '#fff', borderRadius: 12,
          boxShadow: '0 1px 4px rgba(0,0,0,0.07), 0 4px 16px rgba(0,0,0,0.04)',
          overflow: 'hidden',
        }}>
          {/* Cabeçalho do card — fixo, fora do scroll */}
          <div style={{
            display: 'flex', alignItems: 'center',
            justifyContent: 'space-between',
            padding: '18px 22px 10px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h2 style={{
                fontFamily: fontPoppins, fontSize: 16,
                fontWeight: 500, color: '#272835', margin: 0,
              }}>
                Chamados abertos
              </h2>
              <span style={{
                fontFamily: fontNunito, fontSize: 11, fontWeight: 600,
                color: '#fff', background: '#F97316',
                borderRadius: 20, padding: '2px 9px',
              }}>
                {chamadosAbertos.length}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <Filter size={14} color="#BDBDBD" />
              <span style={{ fontSize: 18, color: '#BDBDBD', letterSpacing: 2, cursor: 'pointer' }}>···</span>
            </div>
          </div>

          {/* Pills de filtro + botão Enviar comunicação */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 22px 12px' }}>
            <div style={{ display: 'flex', gap: 6 }}>
              {FILTROS.map(({ label, value, bg, cor }) => {
                const ativo = filtro === value
                return (
                  <button
                    key={label}
                    onClick={() => setFiltro(value)}
                    style={{
                      padding: '4px 12px',
                      borderRadius: 20,
                      border: `1.5px solid ${ativo ? cor : 'transparent'}`,
                      background: ativo ? bg : 'rgba(0,0,0,0.04)',
                      color: ativo ? cor : '#9CA3AF',
                      fontFamily: fontNunito,
                      fontSize: 11, fontWeight: 700,
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                  >
                    {label}
                  </button>
                )
              })}
            </div>

            {/* Botão Enviar comunicação */}
            <button
              disabled={selecionados.size === 0}
              onClick={handleResolver}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '7px 16px', borderRadius: 8, border: 'none',
                fontFamily: fontPoppins, fontSize: 12, fontWeight: 600,
                cursor: selecionados.size > 0 ? 'pointer' : 'not-allowed',
                background: selecionados.size > 0 ? '#00936C' : 'rgba(0,0,0,0.06)',
                color: selecionados.size > 0 ? '#fff' : '#BDBDBD',
                transition: 'all 0.2s',
                boxShadow: selecionados.size > 0 ? '0 2px 8px rgba(0,147,108,0.25)' : 'none',
              }}
            >
              <CheckCircle size={13} />
              Marcar como resolvido
              {selecionados.size > 0 && (
                <span style={{
                  background: 'rgba(255,255,255,0.25)',
                  borderRadius: 10, padding: '1px 7px',
                  fontSize: 10, fontWeight: 700,
                }}>
                  {selecionados.size}
                </span>
              )}
            </button>
          </div>

          {/* Wrapper com scroll — thead sticky, tbody rola */}
          <div style={{ maxHeight: '420px', overflowY: 'auto', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
              <tr style={{ background: '#FCFDFD', borderBottom: '0.6px solid #D5D5D5' }}>
                {/* Coluna checkbox */}
                <th style={{ padding: '12px 8px 12px 22px', background: '#FCFDFD', width: 36 }}>
                  <input
                    ref={checkboxTodosRef}
                    type="checkbox"
                    checked={todosSelecionados}
                    onChange={toggleTodos}
                    style={{ width: 14, height: 14, cursor: 'pointer', accentColor: '#00936C' }}
                  />
                </th>
                {colunas.map(col => (
                  <th key={col} style={{
                    padding: '12px 16px', textAlign: 'left',
                    fontSize: 10, fontWeight: 800,
                    color: 'rgba(32,34,36,0.9)',
                    fontFamily: fontNunito,
                    whiteSpace: 'nowrap',
                    background: '#FCFDFD',
                  }}>
                    {col}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {chamadosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{
                    padding: '32px', textAlign: 'center',
                    fontFamily: fontPoppins, fontSize: 13, color: '#9CA3AF',
                  }}>
                    Nenhum chamado com status "{filtro}"
                  </td>
                </tr>
              ) : (
                chamadosFiltrados.map((chamado, idx) => {
                  const marcado = selecionados.has(chamado.id)
                  return (
                    <React.Fragment key={chamado.id}>
                      <tr
                        onClick={() => setChamadoSelecionado(chamado)}
                        style={{
                          cursor: 'pointer', transition: 'background 0.15s',
                          background: marcado ? 'rgba(0,147,108,0.04)' : 'transparent',
                        }}
                        onMouseEnter={e => { if (!marcado) e.currentTarget.style.background = '#FAFAFA' }}
                        onMouseLeave={e => { e.currentTarget.style.background = marcado ? 'rgba(0,147,108,0.04)' : 'transparent' }}
                      >
                        {/* Checkbox da linha */}
                        <td style={{ padding: '14px 8px 14px 22px' }} onClick={e => toggleLinha(chamado.id, e)}>
                          <input
                            type="checkbox"
                            checked={marcado}
                            onChange={() => {}}
                            style={{ width: 14, height: 14, cursor: 'pointer', accentColor: '#00936C' }}
                          />
                        </td>
                        <td style={{ padding: '14px 16px', fontSize: 10, fontWeight: 600, color: 'rgba(32,34,36,0.9)', fontFamily: fontNunito }}>
                          {chamado.id}
                        </td>
                        <td style={{ padding: '14px 16px', fontSize: 10, fontWeight: 600, color: 'rgba(32,34,36,0.9)', fontFamily: fontNunito, whiteSpace: 'nowrap' }}>
                          {chamado.nome}
                        </td>
                        <td style={{ padding: '14px 16px', fontSize: 10, fontWeight: 600, color: 'rgba(32,34,36,0.9)', fontFamily: fontNunito }}>
                          {chamado.localizacao}
                        </td>
                        <td style={{ padding: '14px 16px', fontSize: 10, fontWeight: 600, color: 'rgba(32,34,36,0.9)', fontFamily: fontNunito, whiteSpace: 'nowrap' }}>
                          {chamado.data}
                        </td>
                        <td style={{ padding: '14px 16px', fontSize: 10, fontWeight: 600, color: 'rgba(32,34,36,0.9)', fontFamily: fontNunito }}>
                          {chamado.tipo}
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <Badge status={chamado.status} />
                        </td>
                      </tr>
                      {idx < chamadosFiltrados.length - 1 && (
                        <tr>
                          <td colSpan={7} style={{ padding: '0 22px' }}>
                            <div style={{ borderTop: '0.4px solid rgba(151,151,151,0.4)' }} />
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  )
                })
              )}
            </tbody>
          </table>
          </div>{/* fim scroll wrapper */}
        </div>
      </div>

    </div>

      {/* Modal de detalhes */}
      {chamadoSelecionado && (
        <ChamadoModal
          chamado={chamadoSelecionado}
          onClose={() => setChamadoSelecionado(null)}
        />
      )}
    </>
  )
}
