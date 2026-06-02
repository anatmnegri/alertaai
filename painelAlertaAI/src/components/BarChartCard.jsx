import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import { dadosChamadosMensais } from '../data/mockData'

const font = "'Poppins', sans-serif"

// Alternância exata do Figma: escuro, claro, claro, escuro, claro, escuro, claro
const barColors = ['#13C57C', '#A1E8CB', '#A1E8CB', '#13C57C', '#A1E8CB', '#13C57C', '#A1E8CB']

const CustomTooltip = ({ active, payload, label }) => {
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
        <p style={{ fontSize: 11, fontWeight: 600, color: '#272835', margin: 0 }}>{label}</p>
        <p style={{ fontSize: 11, fontWeight: 700, color: '#13C57C', margin: 0 }}>{payload[0].value} chamados</p>
      </div>
    )
  }
  return null
}

export default function BarChartCard() {
  return (
    <div
      style={{
        backgroundColor: '#fff',
        borderRadius: 10,
        padding: '18px 22px 16px',
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 1px 4px rgba(0,0,0,0.07), 0 4px 16px rgba(0,0,0,0.05)',
        fontFamily: font,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2 style={{ fontSize: 18, fontWeight: 500, color: '#272835', margin: 0, lineHeight: '20px' }}>
          Quantidade de Chamados
        </h2>
        <span style={{ fontSize: 20, color: '#00000033', letterSpacing: 2, cursor: 'pointer' }}>···</span>
      </div>

      <div style={{ height: 220 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={dadosChamadosMensais}
            margin={{ top: 5, right: 8, left: -18, bottom: 0 }}
            barSize={12}
          >
            <CartesianGrid
              vertical={false}
              stroke="#000"
              strokeOpacity={0.08}
              strokeDasharray="0"
            />
            <XAxis
              dataKey="mes"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 10, fill: '#000', fontFamily: font, opacity: 0.4 }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 10, fill: '#000', fontFamily: font, opacity: 0.4 }}
              ticks={[0, 50, 100, 150, 200, 250]}
              domain={[0, 250]}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,0.03)' }} />
            <Bar dataKey="quantidade" radius={[71, 71, 71, 71]}>
              {dadosChamadosMensais.map((_, i) => (
                <Cell key={i} fill={barColors[i % barColors.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
