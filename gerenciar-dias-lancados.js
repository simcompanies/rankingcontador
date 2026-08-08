/* ============================================================================
   gerenciar-dias-lancados.js
   ----------------------------------------------------------------------------
   Lista de dias lançados com botão de remover cada um — aparece em dois
   lugares da interface ao mesmo tempo (painel #day-list, no Módulo 3, e
   #day-list-config, no Módulo 4), por isso a função escreve o mesmo HTML
   nos dois elementos.

   Depende de: estado-global.js (state), estado-global.js/souAdmin (para
   decidir se o botão de remover aparece habilitado), dias.js (removeDay,
   chamada pelo botão renderizado aqui).
   ============================================================================ */

/* Desenha a lista de dias lançados (do mais recente para o mais antigo),
   cada um com um botão "remover" — desabilitado (mas visível) para quem
   não é administrador. Atualiza os dois painéis que mostram essa lista
   (Lançar Pontuação e Configurações Gerais) de uma vez. */
function renderGerenciarDias(){
  const admin = souAdmin();
  let html;
  if(!state.days){
    html = '<div class="empty-hint">Nenhum dia lançado ainda.</div>';
  } else {
    html = '';
    for(let d = state.days - 1; d >= 0; d--){
      html += `<div class="day-row">
        <span class="day-row-label">Dia ${d+1}</span>
        <button class="del-x-btn day-remove-btn" ${admin ? '' : 'disabled'} onclick="removeDay(${d})" title="Remover Dia ${d+1}">✕ remover</button>
      </div>`;
    }
  }
  ['day-list','day-list-config'].forEach(function(id){
    const el = document.getElementById(id);
    if(el) el.innerHTML = html;
  });
}
