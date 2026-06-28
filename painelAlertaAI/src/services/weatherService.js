// Panorama climático instantâneo por coordenada.
// Fonte: API de Dados Ambientais da APAC 2.0 (Agência Pernambucana de Águas e Clima)
// https://api.apac.pe.gov.br/api.php — pública, sem chave, com CORS liberado.
// Alimenta a seção "Panorama Climático Instantâneo da APAC" nos detalhes do chamado.

const BASE = 'https://api.apac.pe.gov.br/api.php'

async function getJson(path, signal) {
  const res = await fetch(`${BASE}${path}`, { signal })
  if (!res.ok) throw new Error(`APAC ${res.status}`)
  return res.json()
}

// Variáveis atmosféricas instantâneas da estação mais próxima (temp, umidade, vento…)
async function fetchInstantaneo(lat, lon, signal) {
  const arr = await getJson(`/variaveis_atmosfericas?lat=${lat}&lon=${lon}`, signal)
  return Array.isArray(arr) ? arr[0] ?? null : null
}

// Precipitação acumulada (1h, 24h, 48h, 72h) na estação pluviométrica mais próxima
async function fetchPrecipitacao(lat, lon, signal) {
  const arr = await getJson(`/precipitacao_acumulada?lat=${lat}&lon=${lon}`, signal)
  return Array.isArray(arr) ? arr[0] ?? null : null
}

// Previsão horária do município — seleciona a entrada mais próxima de agora
async function fetchPrevisaoAtual(lat, lon, signal) {
  const arr = await getJson(`/previsao_municipio?lat=${lat}&lon=${lon}`, signal)
  if (!Array.isArray(arr) || arr.length === 0) return null
  const agora = Date.now()
  let melhor = arr[0]
  let menorDiff = Infinity
  for (const item of arr) {
    const t = new Date(String(item.data).replace(' ', 'T')).getTime()
    const diff = Math.abs(t - agora)
    if (!Number.isNaN(diff) && diff < menorDiff) {
      menorDiff = diff
      melhor = item
    }
  }
  return melhor
}

// Avisos meteorológicos vigentes da APAC (filtra por validade futura)
async function fetchAlertasVigentes(signal) {
  const arr = await getJson(`/alertas`, signal)
  if (!Array.isArray(arr)) return []
  const agora = Date.now()
  return arr.filter((a) => {
    const t = new Date(String(a.data_validade_aviso).replace(' ', 'T')).getTime()
    return Number.isNaN(t) ? false : t >= agora
  })
}

// Classifica o nível de risco climático a partir da chuva atual e acumulada em 24h.
// Espelha os níveis de risco do painel: Normal (verde) · Atenção (amarelo) · Crítico (vermelho).
export function nivelRiscoClimatico({ precipitacaoAtual = 0, acumulado24h = 0 } = {}) {
  if (precipitacaoAtual >= 7.6 || acumulado24h >= 50) {
    return { rotulo: 'Crítico', cor: '#DC2626', bg: 'rgba(239,56,38,0.14)' }
  }
  if (precipitacaoAtual >= 2.6 || acumulado24h >= 20) {
    return { rotulo: 'Atenção', cor: '#B45309', bg: 'rgba(245,158,11,0.18)' }
  }
  return { rotulo: 'Normal', cor: '#00936C', bg: 'rgba(0,182,155,0.16)' }
}

// Cores oficiais dos avisos da APAC
export function corNivelAviso(nivel) {
  const n = String(nivel ?? '').toUpperCase()
  if (n === 'VERMELHO') return { cor: '#DC2626', bg: 'rgba(239,56,38,0.14)' }
  if (n === 'LARANJA') return { cor: '#C2410C', bg: 'rgba(249,115,22,0.14)' }
  if (n === 'AMARELO') return { cor: '#B45309', bg: 'rgba(245,158,11,0.18)' }
  return { cor: '#6B7280', bg: 'rgba(0,0,0,0.06)' }
}

// Busca consolidada — cada parte é independente (allSettled) para que uma falha
// parcial não derrube o painel inteiro.
export async function fetchPanoramaAPAC(lat, lon, signal) {
  const [inst, prec, prev, alertas] = await Promise.allSettled([
    fetchInstantaneo(lat, lon, signal),
    fetchPrecipitacao(lat, lon, signal),
    fetchPrevisaoAtual(lat, lon, signal),
    fetchAlertasVigentes(signal),
  ])

  const ok = (r) => (r.status === 'fulfilled' ? r.value : null)

  const panorama = {
    instantaneo: ok(inst),
    precipitacao: ok(prec),
    previsao: ok(prev),
    alertas: ok(alertas) ?? [],
  }

  // Sem nenhum dado útil → considera falha total.
  if (!panorama.instantaneo && !panorama.precipitacao && !panorama.previsao) {
    throw new Error('Dados da APAC indisponíveis para esta localização.')
  }
  return panorama
}
