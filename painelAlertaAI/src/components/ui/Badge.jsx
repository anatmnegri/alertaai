// Tag visual de nível de risco — usada nos cards/tabelas do dashboard.
// Verde = Leve · Amarelo/Âmbar = Moderado (Atenção) · Vermelho = Crítico.
const config = {
  Leve:     { bg: 'rgba(0, 182, 155, 0.16)',  color: '#00936C', dot: '#00B69B' },
  Moderado: { bg: 'rgba(245, 158, 11, 0.18)', color: '#B45309', dot: '#F59E0B' },
  Crítico:  { bg: 'rgba(239, 56, 38, 0.16)',  color: '#DC2626', dot: '#EF3826' },
}

export default function Badge({ status }) {
  const cfg = config[status] ?? { bg: 'rgba(0,0,0,0.08)', color: '#555', dot: '#999' }
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '3px 11px',
        borderRadius: 6,
        backgroundColor: cfg.bg,
        color: cfg.color,
        fontFamily: "'Nunito Sans', sans-serif",
        fontSize: 12,
        fontWeight: 700,
        lineHeight: '16px',
        whiteSpace: 'nowrap',
      }}
    >
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: '50%',
          backgroundColor: cfg.dot,
          flexShrink: 0,
        }}
      />
      {status}
    </span>
  )
}
