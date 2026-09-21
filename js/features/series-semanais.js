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
  if(Number(state && state.days || 0) >= limiteDiasSerie() && ultimoDiaIncompleto()){
    alert('Complete o último dia lançado em todas as faixas antes de criar outro dia.');
    return false;
  }
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


function mostrarModalReinicioSerie(){
  if(!exigirAdministrador()) return;
  if(!loaded || encerramentoSerieEmAndamento) return;
  const modal = document.getElementById('series-reset-modal');
  if(!modal) return;
  const numero = state.seriesMeta && state.seriesMeta.currentNumber ? Number(state.seriesMeta.currentNumber) : 1;
  const dias = Math.max(0, Number(state.days)||0);
  const descricao = document.getElementById('series-reset-description');
  const info = document.getElementById('series-reset-current');
  const btnArquivar = document.getElementById('series-reset-archive-btn');
  if(descricao){
    descricao.textContent = dias
      ? `A Série ${numero} possui ${dias} de 7 lançamentos. Escolha como reiniciar o ciclo.`
      : `A Série ${numero} ainda não possui lançamentos. Você pode reiniciá-la ou avançar para a próxima série.`;
  }
  if(info){
    const datas = (state.dayDates||[]).slice(0,dias).filter(Boolean).map(formatarDataCurta);
    const periodo = datas.length ? `${datas[0]}${datas.length>1 ? ' a ' + datas[datas.length-1] : ''}` : 'sem período registrado';
    info.textContent = `${dias} lançamento${dias===1?'':'s'} · ${periodo}`;
  }
  if(btnArquivar){
    btnArquivar.disabled = dias === 0;
    btnArquivar.title = dias === 0 ? 'Não há lançamentos para arquivar.' : '';
  }
  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden','false');
}

function esconderModalReinicioSerie(){
  const modal = document.getElementById('series-reset-modal');
  if(!modal) return;
  modal.classList.add('hidden');
  modal.setAttribute('aria-hidden','true');
}

async function reiniciarSerieAtualManual(modo){
  if(!exigirAdministrador()) return;
  if(encerramentoSerieEmAndamento) return;
  if(!['reiniciar','arquivar','descartar'].includes(modo)) return;

  const numero = state.seriesMeta && state.seriesMeta.currentNumber ? Number(state.seriesMeta.currentNumber) : 1;
  const dias = Math.max(0, Number(state.days)||0);
  if(dias > 7){
    await uiAlert('A série ativa possui mais de 7 dias legados. Encerre primeiro os blocos completos de 7 dias antes de usar o reiniciador manual.', {title:'Série antiga precisa ser normalizada', variant:'warning'});
    return;
  }
  if(modo === 'arquivar' && dias === 0){
    await uiAlert('A série está vazia. Não há lançamentos para arquivar.', {title:'Nada para arquivar', variant:'info'});
    return;
  }

  let titulo, mensagem, confirmar, variante;
  if(modo === 'reiniciar'){
    titulo = `Reiniciar Série ${numero}`;
    mensagem = dias
      ? `Apagar os ${dias} lançamentos ativos e recomeçar a Série ${numero} do zero? A numeração será mantida e estes dados não entrarão no Acumulado Geral.`
      : `Reiniciar a Série ${numero} do zero? A numeração será mantida.`;
    confirmar = 'Reiniciar esta série';
    variante = 'danger';
  }else if(modo === 'arquivar'){
    titulo = `Arquivar Série ${numero}`;
    mensagem = `Arquivar os ${dias} lançamentos atuais no Acumulado Geral e iniciar a Série ${numero+1}?`;
    confirmar = 'Arquivar e iniciar próxima';
    variante = 'warning';
  }else{
    titulo = `Descartar Série ${numero}`;
    mensagem = dias
      ? `Descartar os ${dias} lançamentos atuais e iniciar a Série ${numero+1}? Estes dados não entrarão no Acumulado Geral.`
      : `Avançar da Série ${numero} para a Série ${numero+1}? A série atual está vazia.`;
    confirmar = 'Descartar e iniciar próxima';
    variante = 'danger';
  }

  if(!await uiConfirm(mensagem, {title, variant:variante, confirmText:confirmar})) return;

  encerramentoSerieEmAndamento = true;
  const botoes = document.querySelectorAll('#series-reset-modal button, #series-close-modal button, #series-reset-btn');
  botoes.forEach(b=>b.disabled=true);
  try{
    const sincronizado = await flushPendingSave();
    if(!sincronizado) throw new Error('Não foi possível sincronizar a série antes do reinício.');

    const resposta = await chamarAPI({
      action:'reiniciarSerie',
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
      throw new Error(resposta.erro || 'Não foi possível reiniciar a série.');
    }

    const validacao = validarInvariantesRanking(resposta.dados && resposta.dados.estado);
    if(!validacao.ok) throw new Error('O servidor devolveu a série reiniciada em estado inválido: ' + validacao.erro);
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
    esconderModalReinicioSerie();
    esconderModalEncerramentoSerie();
    setStatus('sincronizado · rev. ' + (state.revision || 0), true);
    render();
    garantirDataReferenciaLancamento();
    await carregarHistoricoSeries(true).catch(()=>{});

    const novoNumero = state.seriesMeta && state.seriesMeta.currentNumber ? Number(state.seriesMeta.currentNumber) : numero;
    if(modo === 'reiniciar'){
      await uiAlert(`Série ${novoNumero} reiniciada. Participantes e faixas foram preservados.`, {title:'Série reiniciada', variant:'success'});
    }else if(modo === 'arquivar'){
      await uiAlert(`Série ${numero} arquivada e Série ${novoNumero} iniciada.`, {title:'Nova série iniciada', variant:'success'});
    }else{
      await uiAlert(`Série ${numero} descartada e Série ${novoNumero} iniciada.`, {title:'Nova série iniciada', variant:'success'});
    }
  }catch(erro){
    console.error('Erro ao reiniciar série', erro);
    await uiAlert(erro.message || 'Erro ao reiniciar a série.', {title:'Não foi possível reiniciar', variant:'danger'});
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
      <div><span>${dias.length} dia(s)</span><span>${pessoas} participante(s)</span>${souAdmin() ? `<button type="button" class="series-edit-trigger" data-papel="administrador" data-edit-historical="1" data-serie-id="${escapeHtml(s.id)}" aria-label="Editar dados da Série ${Number(s.numero)||'?'}">Editar dados</button>` : ''}</div>
    </div>`;
  }).join('');
  wrap.querySelectorAll('[data-edit-historical="1"]').forEach(function(btn){
    btn.addEventListener('click', function(){ abrirEditorSerieHistorica(btn.dataset.serieId); });
  });
}

function abrirEditorSerieHistorica(serieId){
  if(!exigirAdministrador()) return;
  const serie = (historicoSeries || []).find(function(item){ return String(item.id) === String(serieId); });
  if(!serie){ alert('A série histórica não foi encontrada. Atualize o histórico e tente novamente.'); return; }
  serieHistoricaEmEdicao = serie;
  serieHistoricaEdicaoBase = {};
  (serie.participantes || []).forEach(function(p){
    (serie.days || []).forEach(function(d, indice){
      const valor = p.scores && p.scores[indice] != null && p.scores[indice] !== '' ? Number(p.scores[indice]) : null;
      serieHistoricaEdicaoBase[String(p.id) + '::' + (Number(d.numero) || indice + 1)] = valor;
    });
  });
  renderEditorSerieHistorica();
  const modal = document.getElementById('series-history-edit-modal');
  if(modal){
    configurarModalEditorSerieHistorica(modal);
    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden','false');
    modal.focus({preventScroll:true});
  }
}

function configurarModalEditorSerieHistorica(modal){
  if(!modal || modal.dataset.editorBound === '1') return;
  modal.dataset.editorBound = '1';
  modal.addEventListener('mousedown', function(event){
    if(event.target === modal) fecharEditorSerieHistorica();
  });
  modal.addEventListener('keydown', function(event){
    if(event.key === 'Escape'){
      event.preventDefault();
      fecharEditorSerieHistorica();
    }
  });
}

function fecharEditorSerieHistorica(){
  serieHistoricaEmEdicao = null;
  serieHistoricaEdicaoBase = {};
  const modal = document.getElementById('series-history-edit-modal');
  if(modal){ modal.classList.add('hidden'); modal.setAttribute('aria-hidden','true'); }
}

function renderEditorSerieHistorica(){
  const serie = serieHistoricaEmEdicao;
  const tabela = document.getElementById('historico-series-editor-table');
  const titulo = document.getElementById('historico-series-editor-title');
  const descricao = document.getElementById('historico-series-editor-description');
  if(!serie || !tabela) return;
  if(titulo) titulo.textContent = `Editar Série ${Number(serie.numero) || '?'}`;
  if(descricao) descricao.textContent = 'Preencha ou corrija as pontuações. Os campos vazios permanecem sem lançamento e a alteração afeta apenas esta série arquivada.';
  const dias = Array.isArray(serie.days) ? serie.days : [];
  const cabecalhoDias = dias.map(function(d, i){
    const data = d && d.date ? formatarDataCurta(d.date) : '';
    return `<th>D${Number(d.numero) || i + 1}${data ? `<small>${escapeHtml(data.slice(0,5))}</small>` : ''}</th>`;
  }).join('');
  const linhas = (serie.participantes || []).map(function(p){
    const inputs = dias.map(function(d, i){
      const valor = p.scores && p.scores[i] != null && p.scores[i] !== '' ? p.scores[i] : '';
      return `<td><input type="text" inputmode="decimal" data-serie-score="1" data-participant-id="${escapeHtml(p.id)}" data-day-number="${Number(d.numero) || i + 1}" value="${escapeHtml(valor)}" aria-label="${escapeHtml(p.name)} Dia ${Number(d.numero) || i + 1}"></td>`;
    }).join('');
    return `<tr><td class="name">${escapeHtml(p.name)}</td><td>${escapeHtml(p.divTitle || p.divId || '')}</td>${inputs}</tr>`;
  }).join('');
  tabela.innerHTML = linhas
    ? `<div class="table-wrap"><table class="series-edit-table"><thead><tr><th>Participante</th><th>Faixa</th>${cabecalhoDias}</tr></thead><tbody>${linhas}</tbody></table></div>`
    : '<div class="empty-hint">Esta série não possui participantes registrados.</div>';
}

async function salvarEdicaoSerieHistorica(){
  if(!exigirAdministrador() || !serieHistoricaEmEdicao) return;
  const inputs = Array.from(document.querySelectorAll('#historico-series-editor-table [data-serie-score="1"]'));
  const alteracoes = [];
  for(const input of inputs){
    const raw = String(input.value || '').trim();
    const valor = raw === '' ? null : parsePontuacao(raw);
    if(Number.isNaN(valor)){
      alert('Há uma pontuação histórica inválida. Use números, por exemplo 8 ou -1.');
      input.focus();
      return;
    }
    const chave = String(input.dataset.participantId) + '::' + String(Number(input.dataset.dayNumber));
    const original = Object.prototype.hasOwnProperty.call(serieHistoricaEdicaoBase, chave) ? serieHistoricaEdicaoBase[chave] : null;
    const iguais = original === null ? valor === null : valor !== null && Number(original) === Number(valor);
    if(!iguais){
      alteracoes.push({participantId:String(input.dataset.participantId), dia:Number(input.dataset.dayNumber), pontuacao:valor});
    }
  }
  if(!alteracoes.length){
    await uiAlert('Nenhuma alteração foi feita.', {title:'Histórico sem alterações', variant:'info'});
    return;
  }
  const btn = document.getElementById('historico-series-save-btn');
  if(btn) btn.disabled = true;
  try{
    const resposta = await chamarAPI({
      action:'editarSerieHistorica',
      token:sessaoUsuario.token,
      serieId:String(serieHistoricaEmEdicao.id),
      alteracoes:alteracoes
    });
    if(!resposta.sucesso){
      if(tratarErroSessaoOuPermissao(resposta)) return;
      throw new Error(resposta.erro || 'Não foi possível salvar a série histórica.');
    }
    fecharEditorSerieHistorica();
    historicoSeriesCarregado = false;
    await carregarHistoricoSeries(true);
    await uiAlert('As pontuações da série histórica foram atualizadas.', {title:'Série atualizada', variant:'success'});
  }catch(erro){
    console.error('Erro ao editar série histórica', erro);
    await uiAlert(erro.message || 'Não foi possível salvar a série histórica.', {title:'Edição não concluída', variant:'danger'});
  }finally{
    if(btn) btn.disabled = false;
  }
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
