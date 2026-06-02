const config = {
  Leve:     { bg: 'rgba(0, 182, 155, 0.2)',  color: '#00B69B' },
  Moderado: { bg: 'rgba(98, 38, 239, 0.2)',  color: '#6226EF' },
  Crítico:  { bg: 'rgba(239, 56, 38, 0.2)',  color: '#EF3826' },
}

export default function Badge({ status }) {
  const cfg = config[status] ?? { bg: 'rgba(0,0,0,0.08)', color: '#555' }
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2px 10px',
        borderRadius: 4.5,
        backgroundColor: cfg.bg,
        color: cfg.color,
        fontFamily: "'Nunito Sans', sans-serif",
        fontSize: 12,
        fontWeight: 700,
        lineHeight: '16px',
        whiteSpace: 'nowrap',
      }}
    >
      {status}
    </span>
  )
}
