/* ============================================================================
   resumos-salvos.js
   ----------------------------------------------------------------------------
   Histórico de resumos salvos no backend. A aba continua protegida e os
   resumos antigos permanecem preservados; a interface organiza a leitura por
   série e dia e mantém a cópia integral do texto sempre disponível.

   Depende de: config-api.js (chamarAPIGet), estado-global.js
   (resumosSalvos, resumosCarregado, sessaoUsuario, state).
   ============================================================================ */

let resumoFiltros = {
  busca: '', serie: 'all', dia: 'all', status: 'all', ordenacao: 'recentes'
};
let resumoModalIndice = -1;
let resumoModalConfigurado = false;

async function carregarResumosSeNecessario(forcar){
  if(!sessaoUsuario) return;
  if(resumosCarregado && !forcar) return;
  const wrap = document.getElementById('resumos-salvos-lista');
  if(wrap) wrap.innerHTML = '<div class="empty-hint">Carregando...</div>';
  try{
    const resposta = await chamarAPIGet({ action:'listarResumosSalvos', token: sessaoUsuario.token });
    if(!resposta.sucesso){
      if(tratarErroSessaoOuPermissao(resposta)) return;
      throw new Error(resposta.erro || 'Falha ao carregar');
    }
    resumosSalvos = Array.isArray(resposta.dados) ? resposta.dados : [];
    resumosCarregado = true;
  }catch(e){
    console.error('Erro ao carregar resumos salvos', e);
    resumosSalvos = [];
  }
  renderResumosSalvos();
  renderUltimoResumo();
}

function resumoTimestamp(valor){
  const t = valor ? new Date(valor).getTime() : 0;
  return Number.isFinite(t) ? t : 0;
}

function resumoStatusLabel(status){
  return ({
    atualizado: 'Dados atualizados',
    renumerado: 'Dia renumerado',
    dia_removido: 'Dia removido',
    historico: 'Série encerrada'
  })[status] || '';
}

function resumoStatusClasse(status){
  return ({
    atualizado: 'resumo-status-atualizado',
    renumerado: 'resumo-status-renumerado',
    dia_removido: 'resumo-status-removido',
    historico: 'resumo-status-historico'
  })[status] || '';
}

function resumoDiaAtual(r){
  const idxAtual = r.dayId && state && Array.isArray(state.dayIds)
    ? state.dayIds.indexOf(String(r.dayId)) : -1;
  if(Number(r.diaAtual) > 0) return Number(r.diaAtual);
  return idxAtual >= 0 ? idxAtual + 1 : (Number(r.dia) || 0);
}

function resumoDataDia(r){
  if(!r.dayDate) return '';
  const texto = String(r.dayDate).slice(0,10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(texto);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : texto;
}

function resumoRotuloDia(r){
  const idxAtual = r.dayId && state && Array.isArray(state.dayIds)
    ? state.dayIds.indexOf(String(r.dayId)) : -1;
  const diaOriginal = Number(r.dia) || 0;
  const diaAtual = resumoDiaAtual(r);
  const data = resumoDataDia(r);
  const serie = r.seriesNumber ? 'Série ' + r.seriesNumber + ' · ' : '';

  if(r.situacao === 'dia_removido'){
    return `${serie}Dia removido${diaOriginal ? ' · era o Dia ' + diaOriginal : ''}${data ? ' · ' + data : ''}`;
  }
  if(idxAtual >= 0){
    return `${serie}Dia ${diaAtual}${diaOriginal && diaOriginal !== diaAtual ? ' · antes: Dia ' + diaOriginal : ''}${data ? ' · ' + data : ''}`;
  }
  return `${serie}Dia histórico ${diaOriginal || '—'}${data ? ' · ' + data : ''}`;
}

function resumoSituacaoHtml(r){
  const label = resumoStatusLabel(r.situacao);
  if(!label) return '';
  return `<span class="resumo-status ${resumoStatusClasse(r.situacao)}">${escapeHtml(label)}</span>`;
}

function resumoHistoricoHtml(r, i, opcoes){
  const opts = opcoes || {};
  const compacto = opts.compacto !== false;
  const data = r.dataHora ? new Date(r.dataHora).toLocaleString('pt-BR') : '—';
  const texto = String(r.texto || '');
  const preview = texto.replace(/\s+/g, ' ').trim();
  const previewCortada = preview.length > 260 ? preview.slice(0,257) + '…' : preview;
  const corpo = compacto
    ? `<p class="resumo-preview">${escapeHtml(previewCortada || 'Resumo sem texto.')}</p>`
    : `<pre class="resumo-body">${escapeHtml(texto)}</pre>`;
  const classeEstado = r.situacao === 'dia_removido' ? ' resumo-card-removido' : '';
  return `<article class="resumo-card${classeEstado}">
    <div class="resumo-header">
      <div class="resumo-identificacao">
        <span class="day-tag" title="${escapeHtml(r.dayId || '')}">${escapeHtml(resumoRotuloDia(r))}</span>
        ${resumoSituacaoHtml(r)}
      </div>
      <span class="resumo-data">Atualizado em ${escapeHtml(data)}</span>
    </div>
    ${corpo}
    <div class="resumo-card-actions">
      <button type="button" onclick="abrirResumoSalvo(${i})">Abrir texto completo</button>
      <button type="button" class="resumo-copy-btn" onclick="copiarResumoSalvo(${i}, this)">Copiar resumo</button>
    </div>
  </article>`;
}

function preencherFiltroResumos(id, opcoes, valorAtual, rotuloTodos){
  const select = document.getElementById(id);
  if(!select) return;
  const valor = valorAtual || select.value || 'all';
  select.innerHTML = `<option value="all">${escapeHtml(rotuloTodos)}</option>` + opcoes.map(function(opcao){
    return `<option value="${escapeHtml(String(opcao.value))}">${escapeHtml(opcao.label)}</option>`;
  }).join('');
  select.value = opcoes.some(opcao => String(opcao.value) === String(valor)) ? String(valor) : 'all';
}

function atualizarFiltrosResumos(){
  const series = {};
  const dias = {};
  const status = {};
  resumosSalvos.forEach(function(r){
    const serieId = String(r.seriesId || ('serie-' + (r.seriesNumber || 'historica')));
    series[serieId] = { value:serieId, label:r.seriesNumber ? 'Série ' + r.seriesNumber : 'Série histórica' };
    const dia = resumoDiaAtual(r);
    if(dia) dias[dia] = { value:String(dia), label:'Dia ' + dia };
    const situacao = r.situacao || 'historico';
    status[situacao] = { value:situacao, label:resumoStatusLabel(situacao) || 'Histórico' };
  });
  const ordemSerie = Object.values(series).sort((a,b)=>a.label.localeCompare(b.label,'pt-BR',{numeric:true}));
  const ordemDia = Object.values(dias).sort((a,b)=>Number(a.value)-Number(b.value));
  const ordemStatus = Object.values(status).sort((a,b)=>a.label.localeCompare(b.label,'pt-BR'));
  preencherFiltroResumos('resumos-filtro-serie', ordemSerie, resumoFiltros.serie, 'Todas as séries');
  preencherFiltroResumos('resumos-filtro-dia', ordemDia, resumoFiltros.dia, 'Todos os dias');
  preencherFiltroResumos('resumos-filtro-status', ordemStatus, resumoFiltros.status, 'Todos os status');
}

function lerFiltrosResumos(){
  const el = id => document.getElementById(id);
  resumoFiltros.busca = String(el('resumos-busca') ? el('resumos-busca').value : '').trim().toLocaleLowerCase('pt-BR');
  resumoFiltros.serie = el('resumos-filtro-serie') ? el('resumos-filtro-serie').value : 'all';
  resumoFiltros.dia = el('resumos-filtro-dia') ? el('resumos-filtro-dia').value : 'all';
  resumoFiltros.status = el('resumos-filtro-status') ? el('resumos-filtro-status').value : 'all';
  resumoFiltros.ordenacao = el('resumos-ordenacao') ? el('resumos-ordenacao').value : 'recentes';
}

function resumoTextoPesquisa(r){
  return [r.texto, r.seriesNumber, r.seriesId, r.dia, r.diaAtual, r.dayId, r.dayDate, resumoStatusLabel(r.situacao)]
    .join(' ').toLocaleLowerCase('pt-BR');
}

function obterResumosFiltrados(){
  lerFiltrosResumos();
  const itens = resumosSalvos.map((r, indice)=>({r:r, indice:indice})).filter(function(item){
    const r = item.r;
    if(resumoFiltros.busca && !resumoTextoPesquisa(r).includes(resumoFiltros.busca)) return false;
    const serieId = String(r.seriesId || ('serie-' + (r.seriesNumber || 'historica')));
    if(resumoFiltros.serie !== 'all' && serieId !== resumoFiltros.serie) return false;
    if(resumoFiltros.dia !== 'all' && String(resumoDiaAtual(r)) !== String(resumoFiltros.dia)) return false;
    if(resumoFiltros.status !== 'all' && String(r.situacao || 'historico') !== resumoFiltros.status) return false;
    return true;
  });
  itens.sort(function(a,b){
    if(resumoFiltros.ordenacao === 'antigos') return resumoTimestamp(a.r.dataHora) - resumoTimestamp(b.r.dataHora);
    if(resumoFiltros.ordenacao === 'serie'){
      const serieA = Number(a.r.seriesNumber) || 0;
      const serieB = Number(b.r.seriesNumber) || 0;
      if(serieA !== serieB) return serieB - serieA;
      return resumoDiaAtual(a.r) - resumoDiaAtual(b.r);
    }
    return resumoTimestamp(b.r.dataHora) - resumoTimestamp(a.r.dataHora);
  });
  return itens;
}

function renderResumosSalvos(){
  const wrap = document.getElementById('resumos-salvos-lista');
  if(!wrap) return;
  atualizarFiltrosResumos();
  const itens = obterResumosFiltrados();
  const contador = document.getElementById('resumos-contagem');
  if(contador) contador.textContent = resumosSalvos.length
    ? `Exibindo ${itens.length} de ${resumosSalvos.length} resumo${resumosSalvos.length === 1 ? '' : 's'}.`
    : '';
  if(!itens.length){
    wrap.innerHTML = resumosSalvos.length
      ? '<div class="empty-hint">Nenhum resumo corresponde aos filtros atuais.</div>'
      : '<div class="empty-hint">Nenhum resumo salvo ainda.</div>';
    return;
  }

  const grupos = [];
  const porChave = {};
  itens.forEach(function(item){
    const r = item.r;
    const chave = String(r.seriesId || ('serie-' + (r.seriesNumber || 'historica')));
    if(!porChave[chave]){
      porChave[chave] = { chave:chave, numero:Number(r.seriesNumber) || 0, itens:[] };
      grupos.push(porChave[chave]);
    }
    porChave[chave].itens.push(item);
  });
  grupos.sort((a,b)=>b.numero-a.numero);
  const serieAtualId = state && state.seriesMeta ? String(state.seriesMeta.currentId || '') : '';
  wrap.innerHTML = grupos.map(function(grupo){
    const atual = grupo.chave === serieAtualId;
    const titulo = grupo.numero ? 'Série ' + grupo.numero : 'Série histórica';
    const subtitulo = atual ? 'série atual' : 'histórico preservado';
    return `<details class="resumos-serie-group" data-serie-group="${escapeHtml(grupo.chave)}"${atual ? ' open' : ''}>
      <summary><span><strong>${escapeHtml(titulo)}</strong><small>${escapeHtml(subtitulo)}</small></span><b>${grupo.itens.length} ${grupo.itens.length === 1 ? 'resumo' : 'resumos'}</b></summary>
      <div class="resumos-serie-items">${grupo.itens.map(item=>resumoHistoricoHtml(item.r,item.indice,{compacto:true})).join('')}</div>
    </details>`;
  }).join('');
}

function renderUltimoResumo(){
  const wrap = document.getElementById('ultimo-resumo-wrap');
  if(!wrap) return;
  if(!resumosSalvos.length){
    wrap.innerHTML = '<div class="empty-hint">Nenhum resumo salvo ainda.</div>';
    return;
  }
  wrap.innerHTML = resumoHistoricoHtml(resumosSalvos[0], 0, {compacto:false});
}

function aplicarFiltrosResumos(){ renderResumosSalvos(); }

function limparFiltrosResumos(){
  resumoFiltros = { busca:'', serie:'all', dia:'all', status:'all', ordenacao:'recentes' };
  ['resumos-busca','resumos-filtro-serie','resumos-filtro-dia','resumos-filtro-status','resumos-ordenacao'].forEach(function(id){
    const el = document.getElementById(id);
    if(el) el.value = id === 'resumos-ordenacao' ? 'recentes' : 'all';
  });
  renderResumosSalvos();
}

function alternarGruposResumos(abrir){
  document.querySelectorAll('#resumos-salvos-lista .resumos-serie-group').forEach(function(grupo){ grupo.open = !!abrir; });
}

function configurarModalResumoSalvo(){
  if(resumoModalConfigurado) return;
  const modal = document.getElementById('resumo-text-modal');
  if(!modal) return;
  resumoModalConfigurado = true;
  modal.addEventListener('click', function(event){ if(event.target === modal) fecharResumoSalvo(); });
  modal.addEventListener('keydown', function(event){ if(event.key === 'Escape') fecharResumoSalvo(); });
}

function abrirResumoSalvo(i){
  const resumo = resumosSalvos[i];
  const modal = document.getElementById('resumo-text-modal');
  const area = document.getElementById('resumo-text-modal-output');
  if(!resumo || !modal || !area) return;
  configurarModalResumoSalvo();
  resumoModalIndice = i;
  area.value = String(resumo.texto || '');
  const titulo = document.getElementById('resumo-text-modal-title');
  const meta = document.getElementById('resumo-text-modal-meta');
  if(titulo) titulo.textContent = resumoRotuloDia(resumo);
  if(meta) meta.textContent = 'Texto integral pronto para copiar e colar.' + (resumoStatusLabel(resumo.situacao) ? ' Status: ' + resumoStatusLabel(resumo.situacao) + '.' : '');
  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden','false');
  modal.focus({preventScroll:true});
  setTimeout(()=>area.focus({preventScroll:true}),0);
}

function fecharResumoSalvo(){
  const modal = document.getElementById('resumo-text-modal');
  if(!modal) return;
  modal.classList.add('hidden');
  modal.setAttribute('aria-hidden','true');
  resumoModalIndice = -1;
}

function selecionarResumoSalvoTexto(){
  const area = document.getElementById('resumo-text-modal-output');
  if(!area) return;
  area.focus();
  area.select();
}

async function copiarTextoResumo(texto){
  if(!texto) return false;
  if(navigator.clipboard && navigator.clipboard.writeText){
    try{ await navigator.clipboard.writeText(texto); return true; }catch(e){ /* usa o fallback */ }
  }
  const area = document.createElement('textarea');
  area.value = texto;
  area.setAttribute('readonly','');
  area.style.position = 'fixed'; area.style.opacity = '0';
  document.body.appendChild(area);
  area.focus(); area.select();
  let ok = false;
  try{ ok = document.execCommand('copy'); }catch(e){ ok = false; }
  document.body.removeChild(area);
  return ok;
}

function indicarResumoCopiado(botao, sucesso){
  if(!botao) return;
  const original = botao.dataset.copyOriginal || botao.textContent;
  botao.dataset.copyOriginal = original;
  botao.textContent = sucesso ? 'Copiado' : 'Selecione e copie';
  botao.setAttribute('aria-live','polite');
  setTimeout(function(){ if(botao.isConnected) botao.textContent = original; }, 1800);
}

async function copiarResumoSalvo(i, botao){
  const resumo = resumosSalvos[i];
  if(!resumo) return;
  const sucesso = await copiarTextoResumo(String(resumo.texto || ''));
  indicarResumoCopiado(botao, sucesso);
}

async function copiarResumoSalvoAtual(){
  if(resumoModalIndice < 0) return;
  const resumo = resumosSalvos[resumoModalIndice];
  const botao = document.getElementById('resumo-modal-copy-btn');
  const sucesso = resumo ? await copiarTextoResumo(String(resumo.texto || '')) : false;
  indicarResumoCopiado(botao, sucesso);
}
