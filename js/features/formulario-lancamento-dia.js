/* ============================================================================
   formulario-lancamento-dia.js
   ----------------------------------------------------------------------------
   Lógica da aba "Preencher" do módulo Lançar Pontuação: formulário guiado
   (um campo de pontuação por participante existente, navegação com Enter/Tab
   entre campos, barra de progresso "quantos já preenchidos") mais a lista
   dinâmica de participantes NOVOS a criar junto com o lançamento do dia.

   FAIXAS DINÂMICAS: o formulário tinha duas colunas fixas (Faixa X / Faixa
   Y). Agora renderLaunchColumns() monta UMA coluna por faixa existente
   dentro de #launch-columns-container (ver modulo-3.html), e draft/draftNew
   são objetos indexados pelo id de cada faixa (draft[divId], não mais
   draft.x/draft.y). Os templates usam notação de colchete
   (draft['${divId}']) em vez de ponto (draft.${divId}) de propósito: um id
   de faixa é validado para começar com letra e só ter [a-z0-9_], mas
   notação de colchete é sempre seguro independente disso.

   Depende de: estado-global.js (draft, draftNew, state, obterTodasDivisoes),
   planilha-mestra.js (saveState), texto-do-resumo.js (autoSalvarResumoDoDia),
   renderizacao.js (render). Observação: launchDayForm() NÃO chama
   addDay()/addParticipant() (dias.js/participantes.js) — ele repete a mesma
   lógica de criar o dia e os participantes novos diretamente, já no formato
   do lançamento em lote. Isso já era assim no arquivo original; mantido
   aqui sem alteração de comportamento.
   ============================================================================ */

// Atualiza o rótulo "Lançando o dia N" / data mostrado no topo do formulário.
function updateLaunchDayLabel(){
  const el = document.getElementById('launch-day-label');
  if(el) el.textContent = `Dia ${state.days + 1}`;
}

// Aplica um estilo visual (preenchido/vazio) a um campo de pontuação conforme o usuário digita.
function styleLaunchInput(el){
  el.classList.remove('val-pos','val-neg');
  const v = parseFloat(String(el.value).replace(',', '.'));
  if(!isNaN(v)){
    if(v > 0) el.classList.add('val-pos');
    else if(v < 0) el.classList.add('val-neg');
  }
}

// Move o foco para o próximo campo de pontuação ao apertar Enter/Tab, agilizando o preenchimento sequencial.
function focusNextLaunch(el){
  const all = Array.from(document.querySelectorAll('#launch-view-form input'));
  const idx = all.indexOf(el);
  if(idx > -1 && idx < all.length - 1) all[idx+1].focus();
  else el.blur();
}

// Recalcula e desenha a barra de progresso "X de Y participantes preenchidos".
function updateLaunchProgress(){
  let filled = 0, totalCount = 0;
  obterTodasDivisoes().forEach(div=>{
    const divId = div.id;
    const participantes = div.participantes || [];
    participantes.forEach((p,i)=>{
      totalCount++;
      if(draft[divId] && draft[divId][i] !== undefined && draft[divId][i] !== '') filled++;
    });
    (draftNew[divId] || []).forEach(r=>{
      if(r.name.trim()){ totalCount++; if(r.value !== '') filled++; }
    });
    const countEl = document.getElementById('launch-count-'+divId);
    if(countEl) countEl.textContent = `${participantes.length} cadastrado${participantes.length===1?'':'s'}`;
  });
  const el = document.getElementById('launch-progress');
  if(el){
    el.textContent = totalCount
      ? `${filled} de ${totalCount} preenchidos`
      : 'Nenhum participante cadastrado ainda — use "+ novo participante"';
  }
}

// Redesenha a lista de linhas de participantes NOVOS sendo adicionados junto com este lançamento, para UMA faixa.
function renderDraftNewRows(divId){
  const wrap = document.getElementById('launch-new-'+divId);
  if(!wrap) return;
  const linhas = draftNew[divId] || [];
  wrap.innerHTML = linhas.map((row,i)=>`
    <div class="launch-row launch-row-new">
      <input class="launch-name-input" type="text" placeholder="Novo participante"
        value="${escapeHtml(row.name)}" oninput="draftNew['${divId}'][${i}].name=this.value; updateLaunchProgress();">
      <input class="launch-input" type="text" inputmode="numeric" pattern="-?[0-9]*" placeholder="pts"
        value="${escapeHtml(row.value)}"
        oninput="draftNew['${divId}'][${i}].value=this.value; styleLaunchInput(this); updateLaunchProgress();"
        onkeydown="if(event.key==='Enter'){event.preventDefault(); focusNextLaunch(this);}">
      <button type="button" class="del-x-btn" onclick="removeDraftRow('${divId}', ${i})" title="Remover">Remover</button>
    </div>
  `).join('');
}

// Adiciona uma linha em branco para cadastrar mais um participante novo direto no formulário de lançamento.
function addDraftRow(divId){
  if(!draftNew[divId]) draftNew[divId] = [];
  draftNew[divId].push({ name:'', value:'' });
  renderDraftNewRows(divId);
  updateLaunchProgress();
  requestAnimationFrame(()=>{
    const wrap = document.getElementById('launch-new-'+divId);
    const inputs = wrap ? wrap.querySelectorAll('.launch-name-input') : [];
    if(inputs.length) inputs[inputs.length-1].focus();
  });
}

// Remove uma linha de participante novo ainda não confirmada.
function removeDraftRow(divId, idx){
  if(!draftNew[divId]) return;
  draftNew[divId].splice(idx,1);
  renderDraftNewRows(divId);
  updateLaunchProgress();
}

// Monta o esqueleto (uma coluna por faixa) dentro de #launch-columns-container.
// Chamada por renderLaunchForm() ANTES de preencher cada coluna, igual ao
// padrão de renderBoard() em renderizacao.js.
function renderLaunchColumns(){
  const container = document.getElementById('launch-columns-container');
  if(!container) return;
  container.innerHTML = obterTodasDivisoes().map(div => `
    <div class="launch-col" data-div-id="${div.id}" style="--div-accent:var(${div.cor || '--muted'})">
      <div class="launch-col-head">
        <span class="launch-col-title">${escapeHtml(div.titulo)}</span>
        <span class="launch-col-count" id="launch-count-${div.id}"></span>
      </div>
      <div class="launch-list" id="launch-list-${div.id}"></div>
      <div id="launch-new-${div.id}"></div>
      <div class="launch-add-row"><button type="button" onclick="addDraftRow('${div.id}')">+ novo participante</button></div>
    </div>
  `).join('');
}

// (Re)desenha o formulário completo: uma coluna por faixa, um campo por participante existente, mais as linhas de novos.
function renderLaunchForm(){
  draft = {};
  draftNew = {};
  obterTodasDivisoes().forEach(div=>{ draft[div.id] = {}; draftNew[div.id] = []; });

  renderLaunchColumns();

  obterTodasDivisoes().forEach(div=>{
    const divId = div.id;
    const listEl = document.getElementById('launch-list-'+divId);
    if(!listEl) return;
    const participantes = div.participantes || [];
    listEl.innerHTML = participantes.length
      ? participantes.map((p,i)=>`
        <div class="launch-row">
          <span class="launch-name">${escapeHtml(p.name)}</span>
          <input class="launch-input" type="text" inputmode="numeric" pattern="-?[0-9]*" placeholder="—"
            oninput="draft['${divId}'][${i}]=this.value; styleLaunchInput(this); updateLaunchProgress();"
            onkeydown="if(event.key==='Enter'){event.preventDefault(); focusNextLaunch(this);}"
            onfocus="this.select()">
        </div>
      `).join('')
      : '<div class="empty-hint" style="padding:8px 0;">Nenhum participante ainda.</div>';
    renderDraftNewRows(divId);
  });
  updateLaunchDayLabel();
  updateLaunchProgress();
}

// Botão "Lançar dia": cria os participantes novos pendentes, adiciona um
// dia com a pontuação preenchida para todo mundo em TODAS as faixas, salva
// (saveState), dispara o auto-save do resumo do dia e limpa o rascunho.
function launchDayForm(){
  if(!exigirAdministrador()) return;
  let hasAny = false;
  obterTodasDivisoes().forEach(div=>{
    const divId = div.id;
    if(Object.values(draft[divId] || {}).some(v => v !== undefined && v !== '')) hasAny = true;
    if((draftNew[divId] || []).some(r => r.name.trim() && r.value !== '')) hasAny = true;
  });
  if(!hasAny){ alert('Preencha ao menos uma pontuação antes de lançar o dia.'); return; }

  state.days += 1;
  obterTodasDivisoes().forEach(div=>{ (div.participantes || []).forEach(p=>p.scores.push(null)); });
  state.dayDates.push(dataLocalISO());
  const newIdx = state.days - 1;

  obterTodasDivisoes().forEach(div=>{
    const divId = div.id;
    if(!div.participantes) div.participantes = [];
    div.participantes.forEach((p,i)=>{
      const raw = (draft[divId] || {})[i];
      if(raw === undefined || raw === '') return;
      let num = parseFloat(String(raw).replace(',', '.'));
      if(isNaN(num)) return;
      if(num > 10) num = 10;
      p.scores[newIdx] = num;
    });
    (draftNew[divId] || []).forEach(row=>{
      const name = row.name.trim();
      if(!name || row.value === '') return;
      let num = parseFloat(String(row.value).replace(',', '.'));
      if(isNaN(num)) return;
      if(num > 10) num = 10;
      let p = div.participantes.find(pp => pp.name.toLowerCase() === name.toLowerCase());
      if(!p){
        p = { name, scores: Array(state.days).fill(null) };
        div.participantes.push(p);
      }
      p.scores[newIdx] = num;
    });
  });

  saveState();
  render();
  autoSalvarResumoDoDia(newIdx);
}
