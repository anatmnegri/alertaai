import React, { useState } from 'react'
import { getChamadosAbertos } from '../services/chamadosService'
import Badge from './ui/Badge'
import ChamadoModal from './ChamadoModal'

const fontTable   = "'Nunito Sans', sans-serif"
const fontVerTudo = "'Montserrat', sans-serif"
const colunas     = ['ID', 'NAME', 'LOCALIZAÇÃO', 'DATA', 'TIPO', 'STATUS']

export default function ChamadosTable({ chamados = [], onVerTudo }) {
  const [chamadoSelecionado, setChamadoSelecionado] = useState(null)
  const todosAbertos = getChamadosAbertos(chamados).slice(0, 6)

  return (
    <div style={{ fontFamily: fontTable }}>
      <div style={{
        background: '#fff',
        borderRadius: 10,
        overflow: 'hidden',
        boxShadow: '0 1px 4px rgba(0,0,0,0.07), 0 4px 16px rgba(0,0,0,0.05)',
      }}>

        {/* Título */}
        <div style={{
          display: 'flex', alignItems: 'center',
          justifyContent: 'space-between',
          padding: '18px 22px 12px',
        }}>
          <h2 style={{
            fontFamily: "'Poppins', sans-serif",
            fontSize: 18, fontWeight: 500,
            color: '#272835', margin: 0, lineHeight: '20px',
          }}>
            Chamados abertos
          </h2>
          <span style={{ fontSize: 20, color: '#00000033', letterSpacing: 2, cursor: 'pointer' }}>···</span>
        </div>

        {/* Tabela */}
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#FCFDFD', borderBottom: '0.6px solid #D5D5D5' }}>
              {colunas.map(col => (
                <th key={col} style={{
                  padding: '12px 16px', textAlign: 'left',
                  fontSize: 10, fontWeight: 800,
                  color: 'rgba(32,34,36,0.9)',
                  fontFamily: fontTable, whiteSpace: 'nowrap',
                }}>
                  {col}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {todosAbertos.map((chamado, idx) => (
              <React.Fragment key={chamado.id}>
                <tr
                  onClick={() => setChamadoSelecionado(chamado)}
                  style={{ cursor: 'pointer', transition: 'background 0.15s' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#F9FAFB'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <td style={{ padding: '14px 16px', fontSize: 10, fontWeight: 600, color: 'rgba(32,34,36,0.9)', fontFamily: fontTable }}>
                    {chamado.id}
                  </td>
                  <td style={{ padding: '14px 16px', fontSize: 10, fontWeight: 600, color: 'rgba(32,34,36,0.9)', fontFamily: fontTable, whiteSpace: 'nowrap' }}>
                    {chamado.nome}
                  </td>
                  <td style={{ padding: '14px 16px', fontSize: 10, fontWeight: 600, color: 'rgba(32,34,36,0.9)', fontFamily: fontTable }}>
                    {chamado.localizacao}
                  </td>
                  <td style={{ padding: '14px 16px', fontSize: 10, fontWeight: 600, color: 'rgba(32,34,36,0.9)', fontFamily: fontTable, whiteSpace: 'nowrap' }}>
                    {chamado.data}
                  </td>
                  <td style={{ padding: '14px 16px', fontSize: 10, fontWeight: 600, color: 'rgba(32,34,36,0.9)', fontFamily: fontTable }}>
                    {chamado.tipo}
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <Badge status={chamado.status} />
                  </td>
                </tr>
                {idx < todosAbertos.length - 1 && (
                  <tr>
                    <td colSpan={6} style={{ padding: '0 22px' }}>
                      <div style={{ borderTop: '0.4px solid rgba(151,151,151,0.4)' }} />
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>

        {/* Rodapé "Ver tudo" */}
        <div style={{
          display: 'flex', justifyContent: 'flex-end', alignItems: 'center',
          gap: 6, padding: '10px 16px',
          borderTop: '0.4px solid rgba(151,151,151,0.3)',
        }}>
          <button
            onClick={onVerTudo}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'none', border: 'none', cursor: 'pointer',
              fontFamily: fontVerTudo, fontSize: 10, fontWeight: 600, color: '#3A3C40',
            }}
          >
            Ver tudo
            <svg width="14" height="12" viewBox="0 0 14 12" fill="none">
              <path d="M1 6H13M13 6L8 1M13 6L8 11" stroke="#3A3C40" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </div>

      {chamadoSelecionado && (
        <ChamadoModal
          chamado={chamadoSelecionado}
          onClose={() => setChamadoSelecionado(null)}
        />
      )}
    </div>
  )
}
