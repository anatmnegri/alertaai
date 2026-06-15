export function getChamadosAbertos(chamados) {
  return chamados.filter(c => c.aberto)
}

export function getChamadosEncerrados(chamados) {
  return chamados.filter(c => !c.aberto)
}

export function getDadosChamados48h(chamados, agora) {
  return Array.from({ length: 13 }, (_, i) => {
    const horaLabel = i * 4
    if (i === 0) return { hora: '0h', chamados: 0 }
    // bucket "Xh" = mensagens que chegaram há (X-4)h até Xh atrás
    const fim = new Date(agora.getTime() - (horaLabel - 4) * 3_600_000)
    const ini = new Date(agora.getTime() - horaLabel * 3_600_000)
    const count = chamados.filter(c => {
      const d = new Date(c.dataISO)
      return d > ini && d <= fim
    }).length
    return { hora: `${horaLabel}h`, chamados: count }
  })
}

export function getResumoChamados48h(chamados, agora) {
  const limite = new Date(agora.getTime() - 48 * 3_600_000)
  const recentes = chamados.filter(c => new Date(c.dataISO) >= limite)
  return [
    { tipo: 'Desabamentos',      _match: 'Desabamento',    cor: '#F97316', icone: 'home'     },
    { tipo: 'Quedas de árvores', _match: 'Queda de árvore', cor: '#22C55E', icone: 'tree'    },
    { tipo: 'Deslizamentos',     _match: 'Deslizamento',   cor: '#FBBF24', icone: 'mountain' },
    { tipo: 'Alagamentos',       _match: 'Alagamento',     cor: '#EF4444', icone: 'waves'    },
  ].map(({ _match, ...resto }) => ({
    ...resto,
    count: recentes.filter(c => c.tipo === _match).length,
  }))
}

export function getDadosPrioridade(chamados) {
  const total = chamados.length
  if (total === 0) return []
  return [
    { name: 'Crítico',  color: '#FF4A4A', _match: 'Crítico'  },
    { name: 'Moderado', color: '#FFAD47', _match: 'Moderado' },
    { name: 'Leve',     color: '#3BA94A', _match: 'Leve'     },
  ].map(({ _match, ...resto }) => ({
    ...resto,
    value: Math.round(chamados.filter(c => c.status === _match).length / total * 100),
  }))
}

export function getDadosChamadosMensais(chamados) {
  const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  
  // Acha o mês atual e pega os últimos 7 meses
  const hoje = new Date();
  const ultimosMeses = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
    ultimosMeses.push(meses[d.getMonth()]);
  }

  const map = {};
  ultimosMeses.forEach(m => map[m] = 0);

  chamados.forEach(c => {
    const d = new Date(c.dataISO);
    if (!isNaN(d.getTime())) {
      const nomeMes = meses[d.getMonth()];
      if (map[nomeMes] !== undefined) {
        map[nomeMes] += 1;
      }
    }
  });

  return ultimosMeses.map(m => ({ mes: m, quantidade: map[m] }));
}
