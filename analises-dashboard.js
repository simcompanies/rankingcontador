/* ============================================================================
   analises-dashboard.js
   ----------------------------------------------------------------------------
   Camada mais profunda de Análises Gerais, além dos 5 cartões básicos
   (analises-gerais.js) e do mini-ranking filtrado (filtros.js): destaques do
   período (recorde, maior queda, mais consistente, média), um gráfico de
   evolução acumulada (SVG, sem biblioteca externa) para os 5 melhores de
   cada Faixa, e um mapa de desempenho (participante × dia, em cores).

   As três peças SEMPRE respeitam o filtro ativo (por período ou por dias
   específicos) — recebem `dias` já calculado por diasFiltrados() e são
   chamadas de dentro de aplicarFiltroAnalises() (ver filtros.js), então
   atualizam sozinhas toda vez que o filtro muda ou o ranking é alterado.

   Depende de: estado-global.js (state), participantes.js (sortDivision),
   texto-do-resumo.js (scoreTag, ptsTag), filtros.js (chama as funções daqui
   de dentro de aplicarFiltroAnalises, passando diasFiltrados()).
   ============================================================================ */

/* --------------------------------------------------------------------------
   1. DESTAQUES — recorde do período, maior queda, participante mais
   consistente (menor desvio-padrão entre os dias com lançamento) e a média
   por lançamento, considerando as duas Faixas juntas dentro de `dias`.
   -------------------------------------------------------------------------- */
function calcularDestaques(dias){
  let recorde = null;   // { name, div, day, value }
  let queda = null;     // { name, div, day, value }
  let consistente = null; // { name, div, desvio }
  let soma = 0, contagem = 0;

  ['x','y'].forEach(div=>{
    state[div].forEach(p=>{
      const valores = [];
      dias.forEach(d=>{
        const v = p.scores[d];
        if(v === null || v === undefined) return;
        valores.push(v);
        soma += v; contagem++;
        if(!recorde || v > recorde.value) recorde = { name:p.name, div, day:d, value:v };
        if(!queda   || v < queda.value)   queda   = { name:p.name, div, day:d, value:v };
      });
      if(valores.length >= 2){
        const media = valores.reduce((s,v)=>s+v,0) / valores.length;
        const variancia = valores.reduce((s,v)=> s + (v-media)*(v-media), 0) / valores.length;
        const desvio = Math.sqrt(variancia);
        if(!consistente || desvio < consistente.desvio) consistente = { name:p.name, div, desvio };
      }
    });
  });

  return { recorde, queda, consistente, media: contagem ? (soma/contagem) : null };
}

// Monta um cartão de destaque (mesmo formato dos 4, usado por renderDestaques).
function destaqueCard(icone, rotulo, valor, detalhe){
  return `<div class="destaque-card">
    <div class="destaque-icone">${icone}</div>
    <div>
      <div class="destaque-rotulo">${rotulo}</div>
      <div class="destaque-valor">${valor}</div>
      <div class="destaque-detalhe">${detalhe}</div>
    </div>
  </div>`;
}

// Redesenha a grade de 4 cartões de destaque conforme os dias filtrados.
function renderDestaques(dias){
  const grid = document.getElementById('destaques-grid');
  if(!grid) return;

  if(!dias.length){
    grid.innerHTML = '<div class="empty-hint">Nenhum dia no período selecionado.</div>';
    return;
  }

  const d = calcularDestaques(dias);

  const cRecorde = d.recorde
    ? destaqueCard('🏆', 'Recorde do período', d.recorde.name,
        `${scoreTag(d.recorde.value)} · Dia ${d.recorde.day+1} · Faixa ${d.recorde.div.toUpperCase()}`)
    : destaqueCard('🏆', 'Recorde do período', '—', 'Nenhum lançamento ainda.');

  const cQueda = d.queda
    ? destaqueCard('📉', 'Maior queda', d.queda.name,
        `${scoreTag(d.queda.value)} · Dia ${d.queda.day+1} · Faixa ${d.queda.div.toUpperCase()}`)
    : destaqueCard('📉', 'Maior queda', '—', 'Nenhum lançamento ainda.');

  const cConsistente = d.consistente
    ? destaqueCard('🎯', 'Mais consistente', d.consistente.name,
        `desvio médio de ${d.consistente.desvio.toFixed(1)} pts · Faixa ${d.consistente.div.toUpperCase()}`)
    : destaqueCard('🎯', 'Mais consistente', '—', 'Precisa de ao menos 2 dias lançados p/ alguém.');

  const cMedia = d.media !== null
    ? destaqueCard('⚖️', 'Média por lançamento', `${d.media >= 0 ? '+' : ''}${d.media.toFixed(2)}`,
        'considerando todo mundo, no período selecionado')
    : destaqueCard('⚖️', 'Média por lançamento', '—', 'Nenhum lançamento ainda.');

  grid.innerHTML = cRecorde + cQueda + cConsistente + cMedia;
}

/* --------------------------------------------------------------------------
   2. GRÁFICO DE EVOLUÇÃO ACUMULADA — SVG construído na mão (sem lib
   externa), um gráfico por Faixa, com os 5 participantes de maior total
   dentro do período filtrado. O total "acumulado" aqui nasce em 0 no
   primeiro dia filtrado (mesma semântica de rankingFiltrado, em filtros.js:
   soma só os dias que estão dentro do filtro).
   -------------------------------------------------------------------------- */
const CORES_GRAFICO = ['var(--chart-1)','var(--chart-2)','var(--chart-3)','var(--chart-4)','var(--chart-5)','var(--chart-6)'];
const TOP_N_EVOLUCAO = 5;

function renderEvolucaoChart(div, dias){
  const wrap = document.getElementById('evolucao-chart-' + div);
  if(!wrap) return;

  if(!dias.length || !state[div].length){
    wrap.innerHTML = '<div class="empty-hint">Sem dados suficientes para o gráfico.</div>';
    return;
  }

  const serie = state[div].map(p=>{
    let acumulado = 0;
    const pontos = dias.map(d=>{ acumulado += (p.scores[d] ?? 0); return acumulado; });
    return { name: p.name, pontos, total: acumulado };
  });
  const top = [...serie].sort((a,b)=> b.total - a.total).slice(0, TOP_N_EVOLUCAO);

  const W = 560, H = 210, padL = 34, padR = 10, padT = 12, padB = 24;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const n = dias.length;

  let minV = 0, maxV = 0;
  top.forEach(s => s.pontos.forEach(v=>{ if(v < minV) minV = v; if(v > maxV) maxV = v; }));
  if(minV === maxV){ minV -= 1; maxV += 1; }
  const folga = (maxV - minV) * 0.1;
  minV -= folga; maxV += folga;

  const xFor = i => n <= 1 ? padL + plotW/2 : padL + (plotW * i / (n-1));
  const yFor = v => padT + plotH - ((v - minV) / (maxV - minV)) * plotH;

  // Linhas de grade horizontais + rótulos do eixo Y.
  const NUM_GRADES = 4;
  let gradesSvg = '';
  for(let g=0; g<=NUM_GRADES; g++){
    const valor = minV + (maxV - minV) * (g / NUM_GRADES);
    const y = yFor(valor);
    gradesSvg += `<line x1="${padL}" y1="${y.toFixed(1)}" x2="${W-padR}" y2="${y.toFixed(1)}" class="chart-grid-line"/>`;
    gradesSvg += `<text x="${padL-6}" y="${(y+3).toFixed(1)}" class="chart-axis-label" text-anchor="end">${Math.round(valor)}</text>`;
  }

  // Rótulos do eixo X — só um subconjunto quando há muitos dias, pra não poluir.
  const maxLabels = 6;
  const passo = Math.max(1, Math.ceil(n / maxLabels));
  let labelsSvg = '';
  dias.forEach((d,i)=>{
    if(i % passo !== 0 && i !== n-1) return;
    labelsSvg += `<text x="${xFor(i).toFixed(1)}" y="${H-6}" class="chart-axis-label" text-anchor="middle">D${d+1}</text>`;
  });

  const linhasSvg = top.map((s,idx)=>{
    const cor = CORES_GRAFICO[idx % CORES_GRAFICO.length];
    const pontosSvg = s.pontos.map((v,i)=> `${xFor(i).toFixed(1)},${yFor(v).toFixed(1)}`).join(' ');
    const linha = s.pontos.length > 1
      ? `<polyline points="${pontosSvg}" fill="none" stroke="${cor}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>`
      : '';
    const bolinhas = s.pontos.map((v,i)=>
      `<circle cx="${xFor(i).toFixed(1)}" cy="${yFor(v).toFixed(1)}" r="${s.pontos.length>1?3:4}" fill="${cor}"><title>${s.name} · D${dias[i]+1}: ${ptsTag(v)}</title></circle>`
    ).join('');
    return linha + bolinhas;
  }).join('');

  const zeroY = yFor(0).toFixed(1);

  const legenda = top.map((s,idx)=>{
    const cor = CORES_GRAFICO[idx % CORES_GRAFICO.length];
    return `<span class="chart-legend-item"><span class="chart-legend-dot" style="background:${cor}"></span>${s.name} <b>${ptsTag(s.total)}</b></span>`;
  }).join('');

  wrap.innerHTML = `
    <svg viewBox="0 0 ${W} ${H}" class="chart-svg" role="img" aria-label="Evolução acumulada da Faixa ${div.toUpperCase()} no período selecionado">
      ${gradesSvg}
      <line x1="${padL}" y1="${zeroY}" x2="${W-padR}" y2="${zeroY}" class="chart-zero-line"/>
      ${linhasSvg}
      ${labelsSvg}
    </svg>
    <div class="chart-legend">${legenda || '<span class="chart-legend-item">Nenhum participante ainda.</span>'}</div>
  `;
}

/* --------------------------------------------------------------------------
   3. MAPA DE DESEMPENHO — tabela participante × dia, cada célula colorida
   por verde (ganho) ou vermelho (perda); a intensidade da cor é
   proporcional ao valor, relativa ao maior valor absoluto do período
   filtrado NAQUELA Faixa. Reaproveita .table-wrap (mesmo arrastar-pra-
   rolar das tabelas de ranking) e a mesma ordenação de sortDivision().
   -------------------------------------------------------------------------- */
function renderHeatmap(div, dias){
  const wrap = document.getElementById('heatmap-wrap-' + div);
  if(!wrap) return;

  const lista = sortDivision(div);
  if(!dias.length || !lista.length){
    wrap.innerHTML = '<div class="empty-hint">Sem dados suficientes para o mapa de desempenho.</div>';
    return;
  }

  let maxAbs = 1;
  lista.forEach(p => dias.forEach(d=>{
    const v = p.scores[d];
    if(v !== null && v !== undefined) maxAbs = Math.max(maxAbs, Math.abs(v));
  }));

  const head = '<tr><th class="rank-h heat-name-h">Participante</th>' +
    dias.map(d=>`<th>D${d+1}</th>`).join('') + '</tr>';

  const body = lista.map(p=>{
    const celulas = dias.map(d=>{
      const v = p.scores[d];
      if(v === null || v === undefined){
        return `<td class="heat-cell heat-empty" title="${p.name} — Dia ${d+1}: sem lançamento">·</td>`;
      }
      const intensidade = (Math.min(1, Math.abs(v) / maxAbs)).toFixed(2);
      const classe = v > 0 ? 'heat-pos' : v < 0 ? 'heat-neg' : 'heat-zero';
      return `<td class="heat-cell ${classe}" style="--intensidade:${intensidade}" title="${p.name} — Dia ${d+1}: ${scoreTag(v)}">${scoreTag(v)}</td>`;
    }).join('');
    return `<tr><td class="name heat-name">${p.name}</td>${celulas}</tr>`;
  }).join('');

  wrap.innerHTML = `<div class="table-wrap heat-scroll"><table class="heat-table"><thead>${head}</thead><tbody>${body}</tbody></table></div>`;
}
