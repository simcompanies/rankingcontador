/* ============================================================================
   filtros.js
   ----------------------------------------------------------------------------
   Filtro do ranking exibido em Análises Gerais: por período de datas (Data
   de.../até...) ou por uma seleção manual de dias específicos, mutuamente
   exclusivos (o modo ativo é filtroModo). Sem nenhum filtro aplicado,
   mostra o acumulado de todos os dias lançados.

   Depende de: estado-global.js (state, loaded), estado próprio deste
   arquivo (filtroModo, filtroDiasSelecionados — não centralizado em
   estado-global.js por ser específico desta feature).
   ============================================================================ */

/* --------------------------------------------------------------------------
   Estado dos filtros: qual modo está ativo ('periodo' ou 'dias') e, no
   modo "dias", quais dias (índices) estão marcados.
   -------------------------------------------------------------------------- */
let filtroModo = 'periodo'; // 'periodo' | 'dias'

// Set de índices de dia selecionados manualmente no modo 'dias'.
let filtroDiasSelecionados = new Set();

/* Botões "Por período" / "Por dias específicos": troca o modo ativo, mostra
   o bloco de campos correspondente e reaplica o filtro na hora. */
function setFiltroModo(modo){
  filtroModo = modo;
  const btnPeriodo = document.getElementById('filtro-modo-periodo');
  const btnDias = document.getElementById('filtro-modo-dias');
  if(btnPeriodo) btnPeriodo.classList.toggle('active', modo==='periodo');
  if(btnDias) btnDias.classList.toggle('active', modo==='dias');
  const campoPeriodo = document.getElementById('filtro-campos-periodo');
  const campoDias = document.getElementById('filtro-campos-dias');
  if(campoPeriodo) campoPeriodo.classList.toggle('hidden', modo!=='periodo');
  if(campoDias) campoDias.classList.toggle('hidden', modo!=='dias');
  aplicarFiltroAnalises();
}

/* Desenha os "chips" clicáveis de cada dia lançado (modo "dias"), marcando
   como selecionado quem já está em filtroDiasSelecionados. */
function popularFiltroDias(){
  const wrap = document.getElementById('filtro-dias-lista');
  if(!wrap) return;
  let html = '';
  for(let d=0; d<state.days; d++){
    const sel = filtroDiasSelecionados.has(d) ? 'selected' : '';
    html += `<button type="button" class="filtro-dia-chip ${sel}" onclick="toggleFiltroDia(${d})">Dia ${d+1}</button>`;
  }
  wrap.innerHTML = html || '<div class="empty-hint" style="padding:6px 0;">Nenhum dia lançado ainda.</div>';
}

// Marca/desmarca um dia no filtro manual e reaplica o filtro.
function toggleFiltroDia(d){
  if(filtroDiasSelecionados.has(d)) filtroDiasSelecionados.delete(d);
  else filtroDiasSelecionados.add(d);
  popularFiltroDias();
  aplicarFiltroAnalises();
}

// Botão "Limpar filtro": zera datas e seleção de dias, volta a mostrar todos os dias.
function limparFiltroAnalises(){
  const de = document.getElementById('filtro-data-de');
  const ate = document.getElementById('filtro-data-ate');
  if(de) de.value = '';
  if(ate) ate.value = '';
  filtroDiasSelecionados.clear();
  popularFiltroDias();
  aplicarFiltroAnalises();
}

/* Calcula QUAIS dias (índices) entram no ranking filtrado, conforme o modo
   ativo: seleção manual (modo 'dias', se houver algo marcado), intervalo
   de datas (modo 'periodo', usando state.dayDates), ou — sem filtro
   ativo em nenhum dos dois — todos os dias lançados. */
function diasFiltrados(){
  if(!state.days) return [];
  if(filtroModo === 'dias' && filtroDiasSelecionados.size){
    return Array.from(filtroDiasSelecionados).sort((a,b)=>a-b).filter(d => d < state.days);
  }
  const de = document.getElementById('filtro-data-de') ? document.getElementById('filtro-data-de').value : '';
  const ate = document.getElementById('filtro-data-ate') ? document.getElementById('filtro-data-ate').value : '';
  if(filtroModo === 'periodo' && (de || ate)){
    const dias = [];
    for(let d=0; d<state.days; d++){
      const iso = state.dayDates && state.dayDates[d];
      if(!iso) continue;
      const dataDia = String(iso).slice(0,10);
      if(de && dataDia < de) continue;
      if(ate && dataDia > ate) continue;
      dias.push(d);
    }
    return dias;
  }
  return Array.from({length: state.days}, (_,i)=>i); // sem filtro ativo: todos os dias
}

/* Soma, para cada participante de uma divisão, só a pontuação dos dias em
   `dias` (não o acumulado geral) e devolve a lista já ordenada. */
function rankingFiltrado(div, dias){
  const lista = state[div].map(p=>{
    const totalFiltrado = dias.reduce((s,d)=> s + (p.scores[d] ?? 0), 0);
    return { name:p.name, total: totalFiltrado };
  });
  lista.sort((a,b)=> b.total - a.total || a.name.localeCompare(b.name, 'pt-BR'));
  return lista;
}

/* Recalcula diasFiltrados(), atualiza o rótulo "N de M dia(s)" e redesenha
   o mini-ranking filtrado de cada divisão na tela de Análises Gerais. */
function aplicarFiltroAnalises(){
  if(!loaded) return;
  const dias = diasFiltrados();
  const rotulo = state.days && dias.length === state.days ? 'todos os dias' : `${dias.length} de ${state.days} dia(s)`;
  const labelX = document.getElementById('filtro-label-x');
  const labelY = document.getElementById('filtro-label-y');
  if(labelX) labelX.textContent = rotulo;
  if(labelY) labelY.textContent = rotulo;

  ['x','y'].forEach(div=>{
    const wrap = document.getElementById('analises-rank-'+div);
    if(!wrap) return;
    const ranking = rankingFiltrado(div, dias);
    wrap.innerHTML = ranking.length
      ? ranking.map((p,i)=>`<div class="mini-rank-row">
          <span class="mini-rank-pos">${i+1}°</span>
          <span class="mini-rank-name">${p.name}</span>
          <span class="mini-rank-total ${p.total<0?'val-neg':p.total>0?'val-pos':''}">${ptsTag(p.total)}</span>
        </div>`).join('')
      : '<div class="empty-hint">Nenhum participante ainda.</div>';
  });

  // Dashboards mais profundos (ver analises-dashboard.js) — sempre dentro
  // dos mesmos `dias` do filtro acima, pra tudo na tela contar a mesma história.
  renderDestaques(dias);
  renderEvolucaoChart('x', dias);
  renderEvolucaoChart('y', dias);
  renderHeatmap('x', dias);
  renderHeatmap('y', dias);
  bindDragScroll(); // religa o arrastar-pra-rolar nas tabelas do mapa de desempenho, recriadas acima
}
