const BASE_URL = 'http://localhost:5019'

const SEVERIDADE_MAP = {
  Alta: 'Crítico',
  Media: 'Moderado',
  Baixa: 'Leve',
}

const CATEGORIA_MAP = {
  Deslizamento: 'Deslizamento',
  Enchente: 'Alagamento',
  Incendio: 'Incêndio',
  Acidente: 'Acidente',
  Terremoto: 'Terremoto',
  Tremor: 'Tremor',
  Tempestade: 'Tempestade',
  Outros: 'Outros',
}

const ORIGEM_LABEL = {
  whatsapp_gps: 'GPS WhatsApp',
  geocode_texto: 'Texto (geocodificado)',
}

function formatarLocalizacao(o) {
  const via = [o.endereco, o.numero, o.bairro].filter(Boolean).join(', ')
  const municipio =
    o.cidade && o.uf ? `${o.cidade} - ${o.uf}` : o.cidade || o.uf || null
  const partes = [via, municipio].filter(Boolean)
  return partes.length > 0 ? partes.join(', ') : 'Localização não informada'
}

function formatarData(isoString) {
  const d = new Date(isoString)
  const dia = d.getDate().toString().padStart(2, '0')
  const mes = d.toLocaleString('pt-BR', { month: 'short' }).replace('.', '')
  const mesCapital = mes.charAt(0).toUpperCase() + mes.slice(1)
  const ano = d.getFullYear()
  const hh = d.getHours().toString().padStart(2, '0')
  const mm = d.getMinutes().toString().padStart(2, '0')
  return `${dia} ${mesCapital} ${ano}, ${hh}h${mm}`
}

export function mapearOcorrencia(o) {
  const localizacao = formatarLocalizacao(o)

  return {
    id: String(o.id).padStart(5, '0'),
    aberto: o.aberto ?? true,
    nome: o.telefone,
    telefone: o.telefone,
    nomeContato: o.nomeContato,
    localizacao,
    endereco: o.endereco ?? null,
    bairro: o.bairro ?? null,
    numero: o.numero ?? null,
    cidade: o.cidade ?? null,
    uf: o.uf ?? null,
    origemLocalizacao: o.origemLocalizacao ?? null,
    origemLocalizacaoLabel:
      ORIGEM_LABEL[o.origemLocalizacao] ?? null,
    lat: o.latitude ?? null,
    lng: o.longitude ?? null,
    dataISO: o.dataOcorrencia,
    data: formatarData(o.dataOcorrencia),
    tipo: CATEGORIA_MAP[o.categoria] ?? o.categoria,
    status: SEVERIDADE_MAP[o.severidade] ?? o.severidade,
    transcricao: o.resumo || o.mensagemOriginal,
    acaoRecomendada: o.acaoRecomendada,
    mensagemOriginal: o.mensagemOriginal,
    imagem: null,
    anexos: o.mediaUrlsJson ? JSON.parse(o.mediaUrlsJson) : [],
  }
}

export async function fetchOcorrencias() {
  const res = await fetch(`${BASE_URL}/api/ocorrencias`)
  if (!res.ok) throw new Error(`Erro ao buscar ocorrências: ${res.status}`)
  const data = await res.json()
  return data.map(mapearOcorrencia)
}

export async function resolverOcorrencia(id) {
  const res = await fetch(`${BASE_URL}/api/ocorrencias/${id}/resolver`, {
    method: 'PATCH',
  })
  if (!res.ok) throw new Error(`Erro ao resolver ocorrência: ${res.status}`)
}
