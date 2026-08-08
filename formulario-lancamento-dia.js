/* ============================================================================
   formulario-lancamento-dia.js
   ----------------------------------------------------------------------------
   Lógica da aba "Preencher" do módulo Lançar Pontuação: formulário guiado
   (um campo de pontuação por participante existente, navegação com Enter/Tab
   entre campos, barra de progresso "quantos já preenchidos") mais a lista
   dinâmica de participantes NOVOS a criar junto com o lançamento do dia.

   Depende de: estado-global.js (draft, draftNew, state), planilha-mestra.js
   (saveState), texto-do-resumo.js (autoSalvarResumoDoDia), renderizacao.js
   (render). Observação: launchDayForm() NÃO chama addDay()/addParticipant()
   (dias.js/participantes.js) — ele repete a mesma lógica de criar o dia e
   os participantes novos diretamente, já no formato do lançamento em lote.
   Isso já era assim no arquivo original; mantido aqui sem alteração.
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
  ['x','y'].forEach(div=>{
    state[div].forEach((p,i)=>{
      totalCount++;
      if(draft[div][i] !== undefined && draft[div][i] !== '') filled++;
    });
    draftNew[div].forEach(r=>{
      if(r.name.trim()){ totalCount++; if(r.value !== '') filled++; }
    });
    const countEl = document.getElementById('launch-count-'+div);
    if(countEl) countEl.textContent = `${state[div].length} cadastrado${state[div].length===1?'':'s'}`;
  });
  const el = document.getElementById('launch-progress');
  if(el){
    el.textContent = totalCount
      ? `${filled} de ${totalCount} preenchidos`
      : 'Nenhum participante cadastrado ainda — use "+ novo participante"';
  }
}

// Redesenha a lista de linhas de participantes NOVOS sendo adicionados junto com este lançamento.
function renderDraftNewRows(div){
  const wrap = document.getElementById('launch-new-'+div);
  if(!wrap) return;
  wrap.innerHTML = draftNew[div].map((row,i)=>`
    <div class="launch-row launch-row-new">
      <input class="launch-name-input" type="text" placeholder="Novo participante"
        value="${row.name}" oninput="draftNew.${div}[${i}].name=this.value; updateLaunchProgress();">
      <input class="launch-input" type="text" inputmode="numeric" pattern="-?[0-9]*" placeholder="pts"
        value="${row.value}"
        oninput="draftNew.${div}[${i}].value=this.value; styleLaunchInput(this); updateLaunchProgress();"
        onkeydown="if(event.key==='Enter'){event.preventDefault(); focusNextLaunch(this);}">
      <button type="button" class="del-x-btn" onclick="removeDraftRow('${div}', ${i})" title="Remover">✕</button>
    </div>
  `).join('');
}

// Adiciona uma linha em branco para cadastrar mais um participante novo direto no formulário de lançamento.
function addDraftRow(div){
  draftNew[div].push({ name:'', value:'' });
  renderDraftNewRows(div);
  updateLaunchProgress();
  requestAnimationFrame(()=>{
    const wrap = document.getElementById('launch-new-'+div);
    const inputs = wrap ? wrap.querySelectorAll('.launch-name-input') : [];
    if(inputs.length) inputs[inputs.length-1].focus();
  });
}

// Remove uma linha de participante novo ainda não confirmada.
function removeDraftRow(div, idx){
  draftNew[div].splice(idx,1);
  renderDraftNewRows(div);
  updateLaunchProgress();
}

// (Re)desenha o formulário completo: um campo por participante existente de cada divisão, mais as linhas de novos.
function renderLaunchForm(){
  draft = { x:{}, y:{} };
  draftNew = { x:[], y:[] };
  ['x','y'].forEach(div=>{
    const listEl = document.getElementById('launch-list-'+div);
    if(!listEl) return;
    listEl.innerHTML = state[div].length
      ? state[div].map((p,i)=>`
        <div class="launch-row">
          <span class="launch-name">${p.name}</span>
          <input class="launch-input" type="text" inputmode="numeric" pattern="-?[0-9]*" placeholder="—"
            oninput="draft.${div}[${i}]=this.value; styleLaunchInput(this); updateLaunchProgress();"
            onkeydown="if(event.key==='Enter'){event.preventDefault(); focusNextLaunch(this);}"
            onfocus="this.select()">
        </div>
      `).join('')
      : '<div class="empty-hint" style="padding:8px 0;">Nenhum participante ainda.</div>';
    renderDraftNewRows(div);
  });
  updateLaunchDayLabel();
  updateLaunchProgress();
}

// Botão "Lançar dia": cria os participantes novos pendentes, adiciona um
// dia (addDay) com a pontuação preenchida para todo mundo, salva
// (saveState), dispara o auto-save do resumo do dia e limpa o rascunho.
function launchDayForm(){
  if(!exigirAdministrador()) return;
  let hasAny = false;
  ['x','y'].forEach(div=>{
    if(Object.values(draft[div]).some(v => v !== undefined && v !== '')) hasAny = true;
    if(draftNew[div].some(r => r.name.trim() && r.value !== '')) hasAny = true;
  });
  if(!hasAny){ alert('Preencha ao menos uma pontuação antes de lançar o dia.'); return; }

  state.days += 1;
  state.x.forEach(p=>p.scores.push(null));
  state.y.forEach(p=>p.scores.push(null));
  state.dayDates.push(new Date().toISOString());
  const newIdx = state.days - 1;

  ['x','y'].forEach(div=>{
    state[div].forEach((p,i)=>{
      const raw = draft[div][i];
      if(raw === undefined || raw === '') return;
      let num = parseFloat(String(raw).replace(',', '.'));
      if(isNaN(num)) return;
      if(num > 10) num = 10;
      p.scores[newIdx] = num;
    });
    draftNew[div].forEach(row=>{
      const name = row.name.trim();
      if(!name || row.value === '') return;
      let num = parseFloat(String(row.value).replace(',', '.'));
      if(isNaN(num)) return;
      if(num > 10) num = 10;
      let p = state[div].find(pp => pp.name.toLowerCase() === name.toLowerCase());
      if(!p){
        p = { name, scores: Array(state.days).fill(null) };
        state[div].push(p);
      }
      p.scores[newIdx] = num;
    });
  });

  saveState();
  render();
  autoSalvarResumoDoDia(newIdx);
}
