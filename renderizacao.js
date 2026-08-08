/* ============================================================================
   renderizacao.js
   ----------------------------------------------------------------------------
   Funções de renderização COMPARTILHADAS/ORQUESTRADORAS: o quadro de
   classificação de uma divisão (renderDivision — não tem um arquivo de
   "módulo" próprio, por isso mora aqui), o render() geral que redesenha a
   tela inteira após qualquer mutação de estado, e o utilitário de
   arrastar-para-rolar das tabelas horizontais.

   IMPORTANTE: a renderização específica de cada feature (lista de
   usuários, resumos salvos, formulário de lançamento, conferência da
   colagem etc.) fica junto da lógica daquela feature, no arquivo dela
   (usuarios.js, resumos-salvos.js, formulario-lancamento-dia.js,
   colagem.js...) — não aqui — para manter cada tela e seu comportamento
   no mesmo lugar. Este arquivo é só o que não tem dono específico.

   Depende de: estado-global.js (state, loaded), participantes.js
   (sortDivision, tiebreakDay), e, dentro de render(), praticamente todas
   as funções de renderização específicas citadas acima — por isso
   inicializacao.js carrega este arquivo por último, depois de todos eles.
   ============================================================================ */

/* Redesenha a tabela de UMA divisão (Faixa X ou Y): cabeçalho com uma
   coluna por dia lançado, uma linha por participante (já ordenada pelo
   ranking, via sortDivision), com campos editáveis para administrador ou
   texto simples para membro, e a etiqueta de "desempate" quando dois
   participantes vizinhos no ranking empatam no total. */
function renderDivision(div){
  const head = document.getElementById('head-'+div);
  const body = document.getElementById('body-'+div);
  const empty = document.getElementById('empty-'+div);
  const admin = souAdmin();

  let headHtml = '<th class="rank-h">#</th><th class="name-h" style="text-align:left;">Nome</th>';
  for(let d=0; d<state.days; d++) headHtml += `<th>D${d+1}</th>`;
  headHtml += '<th>Total</th>' + (admin ? '<th></th>' : '');
  head.innerHTML = headHtml;

  const sorted = sortDivision(div);
  empty.style.display = sorted.length ? 'none' : 'block';

  body.innerHTML = sorted.map((p, rank)=>{
    const rankClass = rank===0?'top1':rank===1?'top2':rank===2?'top3':'';
    let cells = '';
    for(let d=0; d<state.days; d++){
      const val = p.scores[d];
      const cls = val === null ? '' : (val < 0 ? 'val-neg' : val > 0 ? 'val-pos' : '');
      cells += admin
        ? `<td><input class="score ${cls}" type="text" inputmode="numeric" pattern="-?[0-9]*"
            value="${val === null ? '' : val}"
            onchange="updateScore('${div}', ${p.idx}, ${d}, this.value)"></td>`
        : `<td class="${cls}">${val === null ? '—' : val}</td>`;
    }
    let tieTag = '';
    if(rank < sorted.length - 1){
      const next = sorted[rank+1];
      if(next.total === p.total){
        const d = tiebreakDay(p, next);
        if(d !== null) tieTag = `<span class="tiebadge">desempate D${d+1}</span>`;
      }
    }
    return `<tr class="${rankClass}">
      <td class="rank">${rank+1}</td>
      <td class="name">${p.name}${tieTag}</td>
      ${cells}
      <td class="total">${p.total}</td>
      ${admin ? `<td><div class="row-btns">
        <button class="del-x-btn" onclick="renameParticipant('${div}', ${p.idx})" title="Renomear">✎</button>
        <button class="del-x-btn" onclick="removeParticipant('${div}', ${p.idx})" title="Remover">✕</button>
      </div></td>` : ''}
    </tr>`;
  }).join('');
}

/* Redesenha TUDO que depende do estado atual — chamada depois de qualquer
   ação que altere o ranking (salvar pontuação, adicionar/remover dia ou
   participante, importar colagem...). Não faz nada até o primeiro
   loadState() terminar (guard `if(!loaded) return`). */
function render(){
  if(!loaded) return;

  renderDivision('x');
  renderDivision('y');
  populateDaySelect();
  generateSummary();
  renderStatsGrid();
  renderGerenciarDias();
  popularFiltroDias();
  aplicarFiltroAnalises();
  renderUsuarios();
  if(souAdmin()) renderLaunchForm();

  document.querySelectorAll('.row-actions').forEach(el => el.classList.toggle('hidden', !souAdmin()));
  document.getElementById('save-resumo-btn').classList.toggle('hidden', !souAdmin());

  bindDragScroll();
}

/* Ativa "arrastar para rolar horizontalmente com o mouse" num contêiner de
   tabela (útil em telas largas sem trackpad/touch). Marca o elemento com
   data-drag-bound para nunca religar os mesmos listeners duas vezes. */
function enableDragScroll(el){
  if(!el || el.dataset.dragBound) return;
  el.dataset.dragBound = '1';
  let isDown = false, startX = 0, startScroll = 0;
  el.addEventListener('mousedown', (e)=>{
    isDown = true;
    el.classList.add('dragging');
    startX = e.pageX;
    startScroll = el.scrollLeft;
  });
  window.addEventListener('mouseup', ()=>{ isDown = false; el.classList.remove('dragging'); });
  window.addEventListener('mousemove', (e)=>{
    if(!isDown) return;
    e.preventDefault();
    el.scrollLeft = startScroll - (e.pageX - startX);
  });
}

// Aplica enableDragScroll a todo contêiner de tabela (.table-wrap) presente na página.
function bindDragScroll(){
  document.querySelectorAll('.table-wrap').forEach(enableDragScroll);
}
