/* ============================================================================
   renderizacao.js
   ----------------------------------------------------------------------------
   Funções de renderização COMPARTILHADAS/ORQUESTRADORAS: o board de faixas
   (renderBoard, NOVO — monta uma div.division por faixa dinamicamente),
   o quadro de classificação de UMA faixa (renderDivision), o render() geral
   que redesenha a tela inteira após qualquer mutação de estado, e o
   utilitário de arrastar-para-rolar das tabelas horizontais.

   IMPORTANTE: a renderização específica de cada feature (lista de
   usuários, resumos salvos, formulário de lançamento, conferência da
   colagem etc.) fica junto da lógica daquela feature, no arquivo dela
   (usuarios.js, resumos-salvos.js, formulario-lancamento-dia.js,
   colagem.js...) — não aqui — para manter cada tela e seu comportamento
   no mesmo lugar. Este arquivo é só o que não tem dono específico.

   FAIXAS DINÂMICAS: antes, modulo-1.html vinha com dois <div class="division">
   fixos (x e y) e render() chamava renderDivision('x')/renderDivision('y')
   direto. Agora modulo-1.html só tem um container vazio (#board-container)
   e renderBoard() constrói uma div.division por faixa em obterTodasDivisoes(),
   incluindo a cor de destaque de cada uma via a variável CSS --div-accent
   (ver style.css: .division-head/.division-title usam
   var(--div-accent, ...) como fallback).

   Depende de: estado-global.js (state, loaded, obterDivisao,
   obterTodasDivisoes), participantes.js (sortDivision, tiebreakDay,
   total), faixas-dinamicas.js (renderGerenciarFaixas), e, dentro de
   render(), praticamente todas as funções de renderização específicas
   citadas acima — por isso inicializacao.js carrega este arquivo por
   último, depois de todos eles.
   ============================================================================ */

/* Monta o HTML de UMA div.division por faixa dentro de #board-container
   (Módulo 1) e então preenche cada uma via renderDivision(). Chamada no
   início de render() — antes, portanto, de qualquer outra função que
   dependa dos elementos "head-<id>"/"body-<id>"/"empty-<id>" existirem. */
function renderBoard(){
  const board = document.getElementById('board-container');
  if(!board) return;

  board.innerHTML = obterTodasDivisoes().map(div => `
    <div class="division" id="div-${div.id}" data-div-id="${div.id}" style="--div-accent:var(${div.cor || '--muted'})">
      <div class="division-head">
        <div>
          <div class="division-title">${escapeHtml(div.titulo)}</div>
          <div class="division-range">${escapeHtml(div.intervalo || '')}</div>
        </div>
      </div>
      <div class="table-wrap"><table><thead><tr id="head-${div.id}"></tr></thead><tbody id="body-${div.id}"></tbody></table></div>
      <div class="empty-hint" id="empty-${div.id}" style="display:none;">Nenhum participante ainda.</div>
      <div class="row-actions hidden">
        <button onclick="addParticipant('${div.id}')">+ Participante</button>
        <button onclick="addDay()">+ Dia em branco</button>
      </div>
    </div>
  `).join('');

  obterTodasDivisoes().forEach(div => renderDivision(div.id));
}

/* Redesenha a tabela de UMA faixa: cabeçalho com uma coluna por dia
   lançado, uma linha por participante (já ordenada pelo ranking, via
   sortDivision), com campos editáveis para administrador ou texto simples
   para membro, e a etiqueta de "desempate" quando dois participantes
   vizinhos no ranking empatam no total. */
function renderDivision(divId){
  const div = obterDivisao(divId);
  if(!div) return;

  const head = document.getElementById('head-'+divId);
  const body = document.getElementById('body-'+divId);
  const empty = document.getElementById('empty-'+divId);
  if(!head || !body || !empty) return;
  const admin = souAdmin();

  let headHtml = '<th class="rank-h">#</th><th class="name-h" style="text-align:left;">Nome</th>';
  for(let d=0; d<state.days; d++) headHtml += `<th>D${d+1}</th>`;
  headHtml += '<th>Total</th>' + (admin ? '<th></th>' : '');
  head.innerHTML = headHtml;

  const sorted = sortDivision(divId);
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
            onchange="updateScore('${divId}', ${p.idx}, ${d}, this.value)"></td>`
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
      <td class="name">${escapeHtml(p.name)}${tieTag}</td>
      ${cells}
      <td class="total">${p.total}</td>
      ${admin ? `<td><div class="row-btns">
        <button class="del-x-btn" onclick="renameParticipant('${divId}', ${p.idx})" title="Renomear">Renomear</button>
        <button class="del-x-btn" onclick="removeParticipant('${divId}', ${p.idx})" title="Remover">Remover</button>
      </div></td>` : ''}
    </tr>`;
  }).join('');
}

/* Redesenha TUDO que depende do estado atual — chamada depois de qualquer
   ação que altere o ranking (salvar pontuação, adicionar/remover dia,
   participante ou faixa, importar colagem...). Não faz nada até o primeiro
   loadState() terminar (guard `if(!loaded) return`). */
function render(){
  if(!loaded) return;

  renderBoard();
  populateDaySelect();
  generateSummary();
  renderStatsGrid();
  renderGerenciarDias();
  popularFiltroDias();
  aplicarFiltroAnalises();
  renderUsuarios();
  renderGerenciarFaixas();
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
