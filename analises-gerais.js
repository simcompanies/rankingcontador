/* ============================================================================
   analises-gerais.js
   ----------------------------------------------------------------------------
   Cartões de estatística geral do Módulo 2 (dias lançados, nº de
   participantes por faixa, líder de cada faixa — para TODAS as faixas
   dinâmicas, não só X/Y). O ranking filtrável por período/dias que aparece
   nessa mesma tela vive em filtros.js — os dois arquivos juntos formam o
   conteúdo do Módulo 2 (modulo-2.html).

   Depende de: estado-global.js (state, obterTodasDivisoes), participantes.js
   (sortDivision), texto-do-resumo.js (ptsTag).
   ============================================================================ */

/* Preenche os cartões do topo de Análises Gerais: total de dias lançados,
   e para cada faixa — quantos participantes ela tem e quem lidera o
   acumulado (via sortDivision, de participantes.js). */
function renderStatsGrid(){
  const grid = document.getElementById('stats-grid');
  if(!grid) return;

  let html = `<div class="stat-card"><span class="stat-value">${state.days}</span><span class="stat-label">dias lançados</span></div>`;

  obterTodasDivisoes().forEach(div=>{
    const acc = sortDivision(div.id);
    const qtd = (div.participantes || []).length;
    const lider = acc.length ? `${acc[0].name} (${ptsTag(acc[0].total)})` : '—';
    html += `<div class="stat-card"><span class="stat-value">${qtd}</span><span class="stat-label">participantes ${div.titulo}</span></div>`;
    html += `<div class="stat-card"><span class="stat-value stat-value-sm">${lider}</span><span class="stat-label">líder ${div.titulo}</span></div>`;
  });

  grid.innerHTML = html;
}
