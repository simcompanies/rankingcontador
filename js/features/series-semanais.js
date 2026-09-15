/* ==========================================================================
   series-semanais.js — encapsulamento em séries de até 7 lançamentos.
   --------------------------------------------------------------------------
   - O 8º lançamento é bloqueado.
   - Ao atingir 7 dias, o administrador decide arquivar ou descartar o bloco.
   - Arquivar envia o snapshot sincronizado ao backend, que grava a série em
     HistoricoSeries e reinicia o ranking ativo preservando faixas/pessoas.
   - Descartar reinicia o ranking ativo sem alimentar o histórico.
   - A aba Acumulado Geral combina séries arquivadas + série atual e permite
     filtrar por data real de referência, inclusive lançamentos retroativos.
   ========================================================================== */

function obterDataReferenciaLancamento(){
  const el = document.getElementById('launch-reference-date');
  const valor = el && el.value ? el.value : hojeLocalYMD();
  return dataReferenciaISO(valor);
}

function garantirDataReferenciaLancamento(){
  const el = document.getElementById('launch-reference-date');
  if(el && !el.value) el.value = hojeLocalYMD();
}

function podeCriarNovoDia(){
  if(!serieAtualCompleta()) return true;
  mostrarModalEncerramentoSerie();
  alert('A série atual já atingiu 7 lançamentos. Encerre a série antes de criar um novo dia.');
  return false;
}

function mostrarModalEncerramentoSerie(){
  if(!souAdmin() || !loaded || !serieAtualCompleta()) return;
  const modal = document.getElementById('series-close-modal');
  if(!modal) return;
  const numero = state.seriesMeta && state.seriesMeta.currentNumber ? state.seriesMeta.currentNumber : 1;
  const qtd = Math.min(7, Number(state.days)||0);
  const datas = (state.dayDates || []).slice(0,qtd).filter(Boolean).map(formatarDataCurta);
  const label = document.getElementById('series-close-description');
  if(label){
    const faixa = datas.length ? (datas[0] + ' a ' + datas[datas.length-1]) : 'datas não informadas';
    label.textContent = `A Série ${numero} completou ${qtd} lançamentos (${faixa}). Escolha como iniciar a próxima série.`;
  }
  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden','false');
}

function esconderModalEncerramentoSerie(){
  const modal = document.getElementById('series-close-modal');
  if(!modal) return;
  modal.classList.add('hidden');
  modal.setAttribute('aria-hidden','true');
}

function verificarEncerramentoSerie(){
  if(souAdmin() && loaded && serieAtualCompleta() && !encerramentoSerieEmAndamento){
    setTimeout(mostrarModalEncerramentoSerie, 0);
  }else if(!serieAtualCompleta()){
    esconderModalEncerramentoSerie();
  }
}

async function encerrarSerieAtual(modo){
  if(!exigirAdministrador()) return;
  if(encerramentoSerieEmAndamento) return;
  if(modo !== 'arquivar' && modo !== 'descartar') return;
  if(!serieAtualCompleta()){
    esconderModalEncerramentoSerie();
    return;
  }

  const mensagem = modo === 'arquivar'
    ? 'Arquivar os 7 dias desta série no histórico e iniciar uma nova série? Os participantes e faixas serão preservados, mas as pontuações da série ativa serão zeradas.'
    : 'Descartar os 7 dias desta série e iniciar uma nova série? Esses 7 dias NÃO entrarão no Acumulado Geral. Os participantes e faixas serão preservados.';
  if(!await uiConfirm(mensagem, { title: modo === 'arquivar' ? 'Arquivar série' : 'Descartar série', variant: modo === 'arquivar' ? 'warning' : 'danger', confirmText: modo === 'arquivar' ? 'Arquivar e continuar' : 'Descartar série' })) return;

  encerramentoSerieEmAndamento = true;
  const botoes = document.querySelectorAll('#series-close-modal button');
  botoes.forEach(b=>b.disabled=true);
  try{
    const sincronizado = await flushPendingSave();
    if(!sincronizado) throw new Error('Não foi possível sincronizar a série antes do encerramento.');

    const resposta = await chamarAPI({
      action:'encerrarSerie',
      token:sessaoUsuario.token,
      modo,
      estado:clonarSnapshotRanking()
    });
    if(!resposta.sucesso){
      if(tratarErroSessaoOuPermissao(resposta)) return;
      if(resposta.codigo === 'REVISION_CONFLICT' || resposta.codigo === 'SERIES_META_CONFLICT'){
        syncConflict = true;
        rankingBloqueado = true;
        atualizarBloqueioDados();
      }
      throw new Error(resposta.erro || 'Não foi possível encerrar a série.');
    }

    const validacao = validarInvariantesRanking(resposta.dados && resposta.dados.estado);
    if(!validacao.ok) throw new Error('O servidor devolveu a nova série em estado inválido: ' + validacao.erro);
    state = validacao.state;
    stateDirty = false;
    syncConflict = false;
    rankingBloqueado = false;
    pendingImport = null;
    pendingDayMode = 'new';
    draft = {};
    draftNew = {};
    if(typeof filtroDiasSelecionados !== 'undefined' && filtroDiasSelecionados.clear) filtroDiasSelecionados.clear();
    historicoSeriesCarregado = false;
    historicoSeries = [];
    esconderModalEncerramentoSerie();
    setStatus('sincronizado · rev. ' + (state.revision || 0), true);
    render();
    await carregarHistoricoSeries(true).catch(()=>{});
    const acao = modo === 'arquivar' ? 'arquivada no Acumulado Geral' : 'descartada';
    alert('Série encerrada e ' + acao + '. A nova série foi iniciada com os mesmos participantes e faixas.');
    verificarEncerramentoSerie(); // legado com >14 dias pode exigir novo bloco.
  }catch(erro){
    console.error('Erro ao encerrar série', erro);
    alert(erro.message || 'Erro ao encerrar a série.');
  }finally{
    encerramentoSerieEmAndamento = false;
    botoes.forEach(b=>b.disabled=false);
  }
}

async function carregarHistoricoSeries(forcar){
  if(!sessaoUsuario) return;
  if(historicoSeriesCarregado && !forcar){
    renderAcumuladoGeral();
    return;
  }
  const status = document.getElementById('acumulado-status');
  if(status) status.textContent = 'Carregando séries anteriores...';
  try{
    const resposta = await chamarAPIGet({ action:'listarHistoricoSeries', token:sessaoUsuario.token });
    if(!resposta.sucesso){
      if(tratarErroSessaoOuPermissao(resposta)) return;
      throw new Error(resposta.erro || 'Falha ao carregar histórico.');
    }
    historicoSeries = Array.isArray(resposta.dados) ? resposta.dados : [];
    historicoSeriesCarregado = true;
    renderAcumuladoGeral();
  }catch(erro){
    console.error('Erro ao carregar histórico de séries', erro);
    if(status) status.textContent = 'Não foi possível carregar as séries anteriores.';
  }
}

function serieAtualComoHistorico(){
  const meta = state.seriesMeta || { currentId:'serie-atual', currentNumber:1 };
  return {
    id:String(meta.currentId || 'serie-atual'),
    numero:Number(meta.currentNumber)||1,
    atual:true,
    arquivadaEm:null,
    arquivadaPor:'',
    days:Array.from({length:state.days},(_,i)=>({
      index:i,
      numero:i+1,
      dayId:(state.dayIds||[])[i] || '',
      date:(state.dayDates||[])[i] || null
    })),
    participantes:obterTodasDivisoes().flatMap(div=>(div.participantes||[]).map(p=>({
      id:p.id,
      name:p.name,
      divId:div.id,
      divTitle:div.titulo,
      scores:Array.from({length:state.days},(_,i)=>p.scores[i] == null ? null : Number(p.scores[i]))
    })))
  };
}

function todasSeriesParaAnalise(){
  const anteriores = Array.isArray(historicoSeries) ? historicoSeries.slice() : [];
  anteriores.sort((a,b)=>(Number(a.numero)||0)-(Number(b.numero)||0));
  if(state && state.days) anteriores.push(serieAtualComoHistorico());
  return anteriores;
}

function preencherFiltroSeriesAcumulado(series){
  const sel = document.getElementById('acum-serie');
  if(!sel) return;
  const anterior = sel.value || 'all';
  let html = '<option value="all">Todas as séries</option>';
  series.forEach(s=>{
    html += `<option value="${escapeHtml(s.id)}">Série ${Number(s.numero)||'?'}${s.atual?' · atual':''}</option>`;
  });
  sel.innerHTML = html;
  sel.value = Array.from(sel.options).some(o=>o.value===anterior) ? anterior : 'all';
}

function serieNoFiltroAcumulado(serie){
  const sel = document.getElementById('acum-serie');
  const alvo = sel ? sel.value : 'all';
  return alvo === 'all' || String(serie.id) === alvo;
}

function registrosAcumuladosFiltrados(series){
  const de = document.getElementById('acum-data-de')?.value || '';
  const ate = document.getElementById('acum-data-ate')?.value || '';
  const registros = [];
  series.forEach(serie=>{
    if(!serieNoFiltroAcumulado(serie)) return;
    const dias = Array.isArray(serie.days) ? serie.days : [];
    (serie.participantes || []).forEach(p=>{
      dias.forEach((d,i)=>{
        const ymd = d && d.date ? String(d.date).slice(0,10) : '';
        if((de || ate) && !ymd) return;
        if(de && ymd < de) return;
        if(ate && ymd > ate) return;
        const raw = (p.scores || [])[i];
        if(raw === null || raw === undefined || raw === '') return;
        const valor = Number(raw);
        if(!Number.isFinite(valor)) return;
        registros.push({
          participantId:String(p.id||''), name:String(p.name||''), divId:String(p.divId||''), divTitle:String(p.divTitle||p.divId||''),
          score:valor, date:ymd, dayId:d.dayId||'', dayNumber:d.numero||i+1,
          seriesId:String(serie.id||''), seriesNumber:Number(serie.numero)||0, atual:!!serie.atual
        });
      });
    });
  });
  return registros;
}

function consolidarCrescimento(registros){
  const mapa = new Map();
  registros.forEach(r=>{
    const chave = r.participantId || ('nome:' + normalizarNomeParticipante(r.name));
    if(!mapa.has(chave)) mapa.set(chave, {
      id:chave, name:r.name, divId:r.divId, divTitle:r.divTitle,
      total:0, ganhos:0, perdas:0, lancamentos:0, ultimoValor:0, ultimaData:'', series:new Set()
    });
    const item = mapa.get(chave);
    // Dados mais recentes vencem para nome/faixa visual, preservando o ID.
    if(!item.ultimaData || (r.date && r.date >= item.ultimaData)){
      item.name = r.name || item.name;
      item.divId = r.divId || item.divId;
      item.divTitle = r.divTitle || item.divTitle;
      item.ultimoValor = r.score;
      item.ultimaData = r.date || item.ultimaData;
    }
    item.total += r.score;
    if(r.score > 0) item.ganhos += r.score;
    if(r.score < 0) item.perdas += r.score;
    item.lancamentos++;
    item.series.add(r.seriesId);
  });
  return Array.from(mapa.values()).map(i=>({
    ...i, seriesCount:i.series.size, media:i.lancamentos ? i.total/i.lancamentos : 0
  })).sort((a,b)=> b.total-a.total || b.ganhos-a.ganhos || b.ultimoValor-a.ultimoValor || a.name.localeCompare(b.name,'pt-BR'));
}

function renderHistoricoSeries(series){
  const wrap = document.getElementById('acumulado-series-lista');
  if(!wrap) return;
  if(!series.length){
    wrap.innerHTML = '<div class="empty-hint">Nenhuma série arquivada ainda. A primeira poderá ser salva quando a série ativa completar 7 lançamentos.</div>';
    return;
  }
  wrap.innerHTML = series.slice().reverse().map(s=>{
    const dias = s.days || [];
    const datas = dias.filter(d=>d.date).map(d=>String(d.date).slice(0,10));
    const periodo = datas.length ? `${formatarDataCurta(datas[0])} — ${formatarDataCurta(datas[datas.length-1])}` : 'sem datas de referência';
    const pessoas = (s.participantes || []).length;
    return `<div class="series-history-row">
      <div><strong>Série ${Number(s.numero)||'?'}</strong><span>${escapeHtml(periodo)}</span></div>
      <div><span>${dias.length} dia(s)</span><span>${pessoas} participante(s)</span></div>
    </div>`;
  }).join('');
}

function renderAcumuladoGeral(){
  const rankingWrap = document.getElementById('acumulado-ranking');
  if(!rankingWrap) return;
  const series = todasSeriesParaAnalise();
  preencherFiltroSeriesAcumulado(series);
  const registros = registrosAcumuladosFiltrados(series);
  const ranking = consolidarCrescimento(registros);

  const seriesUsadas = new Set(registros.map(r=>r.seriesId));
  const diasUsados = new Set(registros.map(r=>r.seriesId+'||'+r.dayId+'||'+r.date));
  const stats = document.getElementById('acumulado-stats');
  if(stats){
    stats.innerHTML = `
      <div class="stat-card"><span class="stat-value">${seriesUsadas.size}</span><span class="stat-label">séries no filtro</span></div>
      <div class="stat-card"><span class="stat-value">${diasUsados.size}</span><span class="stat-label">dias contabilizados</span></div>
      <div class="stat-card"><span class="stat-value">${ranking.length}</span><span class="stat-label">participantes</span></div>
      <div class="stat-card"><span class="stat-value">${state.days}/7</span><span class="stat-label">série atual</span></div>`;
  }

  const status = document.getElementById('acumulado-status');
  if(status){
    const meta = state.seriesMeta || {};
    status.textContent = `Série atual: ${meta.currentNumber || 1} · ${state.days}/7 lançamento(s). O crescimento líquido é a soma das pontuações do período filtrado.`;
  }

  rankingWrap.innerHTML = ranking.length ? `
    <div class="table-wrap"><table class="acumulado-table">
      <thead><tr><th>#</th><th style="text-align:left">Participante</th><th style="text-align:left">Faixa atual/mais recente</th><th>Crescimento líquido</th><th>Ganhos</th><th>Perdas</th><th>Lançamentos</th><th>Média</th></tr></thead>
      <tbody>${ranking.map((p,i)=>`<tr class="${i<3?'top'+(i+1):''}">
        <td class="rank">${i+1}</td><td class="name">${escapeHtml(p.name)}</td><td>${escapeHtml(p.divTitle||p.divId||'—')}</td>
        <td class="total ${p.total<0?'val-neg':p.total>0?'val-pos':''}">${ptsTag(p.total)}</td>
        <td class="val-pos">${ptsTag(p.ganhos)}</td><td class="${p.perdas<0?'val-neg':''}">${ptsTag(p.perdas)}</td>
        <td>${p.lancamentos}</td><td>${p.media.toFixed(2).replace('.',',')}</td>
      </tr>`).join('')}</tbody></table></div>`
    : '<div class="empty-hint">Nenhuma pontuação encontrada para o período/série selecionados.</div>';

  renderHistoricoSeries((historicoSeries||[]));
  if(typeof bindDragScroll === 'function') bindDragScroll();
}

function limparFiltrosAcumulado(){
  const de=document.getElementById('acum-data-de'); if(de) de.value='';
  const ate=document.getElementById('acum-data-ate'); if(ate) ate.value='';
  const s=document.getElementById('acum-serie'); if(s) s.value='all';
  renderAcumuladoGeral();
}

function sincronizarDataReferenciaComDiaPendente(){
  const el = document.getElementById('launch-reference-date');
  if(!el) return;
  if(pendingDayMode === 'new'){
    if(!el.value) el.value = hojeLocalYMD();
    return;
  }
  const idx = Number(pendingDayMode);
  if(Number.isInteger(idx) && idx >= 0 && idx < state.days){
    const valor = state.dayDates && state.dayDates[idx];
    el.value = valor ? String(valor).slice(0,10) : hojeLocalYMD();
  }
}
