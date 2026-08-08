/* ============================================================================
   analises-gerais.js
   ----------------------------------------------------------------------------
   Cartões de estatística geral do Módulo 2 (dias lançados, nº de
   participantes por divisão, líder de cada divisão). O ranking filtrável
   por período/dias que aparece nessa mesma tela vive em filtros.js — os
   dois arquivos juntos formam o conteúdo do Módulo 2 (modulo-2.html).

   Depende de: estado-global.js (state), participantes.js (sortDivision,
   usado indiretamente via total já calculado), texto-do-resumo.js (ptsTag).
   ============================================================================ */

/* Preenche os 5 cartões do topo de Análises Gerais: total de dias
   lançados, quantos participantes cada divisão tem, e quem lidera o
   acumulado em cada uma (via sortDivision, de participantes.js). */
function renderStatsGrid(){
  const grid = document.getElementById('stats-grid');
  if(!grid) return;
  const xAcc = sortDivision('x');
  const yAcc = sortDivision('y');
  const liderX = xAcc.length ? `${xAcc[0].name} (${ptsTag(xAcc[0].total)})` : '—';
  const liderY = yAcc.length ? `${yAcc[0].name} (${ptsTag(yAcc[0].total)})` : '—';
  grid.innerHTML = `
    <div class="stat-card"><span class="stat-value">${state.days}</span><span class="stat-label">dias lançados</span></div>
    <div class="stat-card"><span class="stat-value">${state.x.length}</span><span class="stat-label">participantes Faixa X</span></div>
    <div class="stat-card"><span class="stat-value">${state.y.length}</span><span class="stat-label">participantes Faixa Y</span></div>
    <div class="stat-card"><span class="stat-value stat-value-sm">${liderX}</span><span class="stat-label">líder Faixa X</span></div>
    <div class="stat-card"><span class="stat-value stat-value-sm">${liderY}</span><span class="stat-label">líder Faixa Y</span></div>
  `;
}
