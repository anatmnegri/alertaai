import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { getDadosPrioridade } from '../services/chamadosService'

const font = "'Poppins', sans-serif"

const coresPie = ['#FF4A4A', '#FFAD47', '#3BA94A']
const coresLegenda = ['#FF3A29', '#FFB200', '#3BA94A']

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    return (
      <div style={{
        background: '#fff',
        border: '1px solid #E8E8E8',
        borderRadius: 8,
        padding: '6px 12px',
        fontFamily: font,
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      }}>
        <p style={{ fontSize: 11, fontWeight: 600, color: '#272835', margin: 0 }}>{payload[0].name}</p>
        <p style={{ fontSize: 11, fontWeight: 700, color: payload[0].payload.color, margin: 0 }}>
          {payload[0].value}%
        </p>
      </div>
    )
  }
  return null
}

export default function PieChartCard({ chamados = [] }) {
  const dadosPrioridade = getDadosPrioridade(chamados)
  const dadosAtualizados = dadosPrioridade.map((d, i) => ({ ...d, color: coresPie[i] }))

  return (
    <div
      style={{
        backgroundColor: '#fff',
        borderRadius: 10,
        padding: '18px 22px 16px',
        width: 229,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 1px 4px rgba(0,0,0,0.07), 0 4px 16px rgba(0,0,0,0.05)',
        fontFamily: font,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <h2 style={{ fontSize: 18, fontWeight: 500, color: '#272835', margin: 0, lineHeight: '27px' }}>
          Prioridade
        </h2>
        <span style={{ fontSize: 20, color: '#00000033', letterSpacing: 2, cursor: 'pointer' }}>···</span>
      </div>

      {/* Pie chart centralizado */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <ResponsiveContainer width="100%" height={180}>
          <PieChart>
            <Pie
              data={dadosAtualizados}
              cx="50%"
              cy="50%"
              innerRadius={0}
              outerRadius={75}
              paddingAngle={2}
              dataKey="value"
              startAngle={90}
              endAngle={-270}
            >
              {dadosAtualizados.map((entry, i) => (
                <Cell key={i} fill={entry.color} stroke="none" />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Legenda no rodapé */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, paddingTop: 12, borderTop: '1px solid #F0F0F0' }}>
        {dadosPrioridade.map((item, i) => (
          <div key={item.name} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{
              width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
              backgroundColor: coresLegenda[i],
            }} />
            <span style={{ fontSize: 10, fontWeight: 400, color: '#000', fontFamily: font }}>
              {item.name}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
