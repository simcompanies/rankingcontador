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

// Desenha a lista completa de resumos salvos (Configurações Gerais), do mais recente para o mais antigo.
function renderResumosSalvos(){
  const wrap = document.getElementById('resumos-salvos-lista');
  if(!wrap) return;
  if(!resumosSalvos.length){
    wrap.innerHTML = '<div class="empty-hint">Nenhum resumo salvo ainda.</div>';
    return;
  }
  wrap.innerHTML = resumosSalvos.map(function(r, i){
    const data = r.dataHora ? new Date(r.dataHora).toLocaleString('pt-BR') : '—';
    return `<div class="resumo-card">
      <div class="resumo-header">
        <span class="day-tag">Dia ${r.dia}</span>
        <span class="resumo-data">${data}</span>
        <button type="button" onclick="copiarResumoSalvo(${i})">Copiar</button>
      </div>
      <pre class="resumo-body">${r.texto}</pre>
    </div>`;
  }).join('');
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
  const r = resumosSalvos[0];
  const data = r.dataHora ? new Date(r.dataHora).toLocaleString('pt-BR') : '—';
  wrap.innerHTML = `<div class="resumo-card">
    <div class="resumo-header">
      <span class="day-tag">Dia ${r.dia}</span>
      <span class="resumo-data">${data}</span>
      <button type="button" onclick="copiarResumoSalvo(0)">Copiar</button>
    </div>
    <pre class="resumo-body">${r.texto}</pre>
  </div>`;
}

// Copia o texto de um resumo salvo (pelo índice na lista atual) para a área de transferência.
function copiarResumoSalvo(i){
  const texto = resumosSalvos[i] ? resumosSalvos[i].texto : '';
  if(!texto) return;
  if(navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(texto);
}
