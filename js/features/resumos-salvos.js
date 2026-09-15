/* ============================================================================
   resumos-salvos.js
   ----------------------------------------------------------------------------
   Histórico de resumos salvos no backend (aba não editável da planilha —
   sobrevive mesmo se os dados do dia a dia forem limpos). O histórico
   completo aparece em Configurações Gerais; só o mais recente também
   aparece em Análises Gerais (renderUltimoResumo).

   Depende de: config-api.js (chamarAPIGet), estado-global.js
   (resumosSalvos, resumosCarregado, sessaoUsuario).
   ============================================================================ */

/* Busca o histórico de resumos salvos no backend, uma vez só por sessão
   (cacheado em resumosCarregado) a menos que `forcar` seja true. Chamada
   ao entrar em Análises Gerais ou em Configurações Gerais (ver
   navegacao.js: mostrarView). */
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
    resumosSalvos = resposta.dados || [];
    resumosCarregado = true;
  }catch(e){
    console.error('Erro ao carregar resumos salvos', e);
    resumosSalvos = [];
  }
  renderResumosSalvos();
  renderUltimoResumo();
}

function resumoHistoricoHtml(r, i){
  const data = r.dataHora ? new Date(r.dataHora).toLocaleString('pt-BR') : '—';
  const dataDia = r.dayDate ? String(r.dayDate).slice(0,10).split('-').reverse().join('/') : '';
  const idxAtual = r.dayId && state && Array.isArray(state.dayIds) ? state.dayIds.indexOf(String(r.dayId)) : -1;
  let rotuloDia;
  if(idxAtual >= 0){
    const serieAtual = state.seriesMeta && state.seriesMeta.currentNumber ? state.seriesMeta.currentNumber : null;
    rotuloDia = `${serieAtual ? 'Série ' + serieAtual + ' · ' : ''}Dia ${idxAtual + 1}${dataDia ? ' · ' + dataDia : ''}`;
    if(Number(r.dia) && Number(r.dia) !== idxAtual + 1) rotuloDia += ` · histórico: Dia ${r.dia}`;
  }else{
    rotuloDia = `${r.seriesNumber ? 'Série ' + r.seriesNumber + ' · ' : ''}Dia histórico ${r.dia || '—'}${dataDia ? ' · ' + dataDia : ''}`;
  }
  return `<div class="resumo-card">
    <div class="resumo-header">
      <span class="day-tag" title="${escapeHtml(r.dayId || '')}">${escapeHtml(rotuloDia)}</span>
      <span class="resumo-data">${data}</span>
      <button type="button" onclick="copiarResumoSalvo(${i})">Copiar</button>
    </div>
    <pre class="resumo-body">${escapeHtml(r.texto)}</pre>
  </div>`;
}

// Desenha a lista completa de resumos salvos (Configurações Gerais), do mais recente para o mais antigo.
function renderResumosSalvos(){
  const alvos = [document.getElementById('resumos-salvos-lista'), document.getElementById('resumos-conteudo-lista')].filter(Boolean);
  if(!alvos.length) return;
  const html = resumosSalvos.length
    ? resumosSalvos.map((r,i)=>resumoHistoricoHtml(r,i)).join('')
    : '<div class="empty-hint">Nenhum resumo salvo ainda.</div>';
  alvos.forEach(wrap=>{ wrap.innerHTML = html; });
}

/* Mostra só o resumo mais recente (resumosSalvos[0] — o backend devolve a
   lista já ordenada do mais novo para o mais antigo) na tela de Análises
   Gerais, como atalho sem precisar abrir o histórico completo. */
function renderUltimoResumo(){
  const wrap = document.getElementById('ultimo-resumo-wrap');
  if(!wrap) return;
  if(!resumosSalvos.length){
    wrap.innerHTML = '<div class="empty-hint">Nenhum resumo salvo ainda.</div>';
    return;
  }
  wrap.innerHTML = resumoHistoricoHtml(resumosSalvos[0], 0);
}

// Copia o texto de um resumo salvo (pelo índice na lista atual) para a área de transferência.
function copiarResumoSalvo(i){
  const texto = resumosSalvos[i] ? resumosSalvos[i].texto : '';
  if(!texto) return;
  if(navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(texto);
}
