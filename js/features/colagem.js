/* ============================================================================
   colagem.js
   ----------------------------------------------------------------------------
   Fluxo da aba "Colar" do módulo Lançar Pontuação: interpretar o texto
   colado no formato "Nome, Pontuação;", deixar o usuário conferir/corrigir
   linha a linha (inclusive escolher a divisão de participantes novos) e só
   então confirmar a gravação no ranking.

   A leitura de print via OCR (que também termina preenchendo esta mesma
   caixa de texto) fica em colagem-ocr.js.

   Depende de: estado-global.js (state, pendingImport, pendingDayMode),
   participantes.js (addParticipant), dias.js (addDay), navegacao.js
   (switchLaunchTab), planilha-mestra.js (saveState), renderizacao.js (render).
   ============================================================================ */

// Procura em qual divisão (Faixa X ou Y) um nome de participante já existe
// (comparação sem diferenciar maiúsc./minúsc.); devolve {div, idx} ou null.
function findDivision(name){
  const norm = name.toLowerCase();
  if(state.x.some(p=>p.name.toLowerCase()===norm)) return 'x';
  if(state.y.some(p=>p.name.toLowerCase()===norm)) return 'y';
  return null;
}

// Botão "Ler colagem": faz o parse do texto colado (uma entrada
// "Nome, Pontuação;" por linha ou separada por ;), casa cada nome com um
// participante existente (via findDivision) ou marca como "novo" para o
// usuário escolher a divisão, e guarda tudo em pendingImport para revisão.
function processPaste(){
  if(!exigirAdministrador()) return;
  const text = document.getElementById('paste-area').value;
  const chunks = text.split(/[;\n]+/).map(s=>s.trim()).filter(Boolean);
  const parsed = [];
  const skipped = [];
  for(const chunk of chunks){
    let m = chunk.match(/^(.+),\s*(-?\d+(?:[.,]\d+)?)\s*$/);
    if(!m) m = chunk.match(/^(.+?)[\s\t]+(-?\d+(?:[.,]\d+)?)\s*$/);
    if(!m){ skipped.push(chunk); continue; }
    const value = parseFloat(m[2].replace(',', '.'));
    if(isNaN(value)){ skipped.push(chunk); continue; }
    parsed.push({ name: m[1].trim(), value: Math.min(value, 10) });
  }
  if(!parsed.length){
    alert('Não consegui ler nenhum participante. Use o formato: Nome, Pontuação; um por ponto e vírgula ou por linha.');
    return;
  }
  pendingImport = parsed.map(e=>{
    const known = findDivision(e.name);
    return { ...e, knownDiv: known, div: known || 'x' };
  });
  pendingDayMode = 'new';
  renderPending();
  if(skipped.length){
    console.warn('Linhas não reconhecidas na colagem:', skipped);
  }
}

// Preenche o <select> de "para qual dia" da tela de conferência da colagem.
function populatePendingDaySelect(){
  const sel = document.getElementById('pending-day-select');
  if(!sel) return;
  let opts = `<option value="new">Novo dia (Dia ${state.days + 1})</option>`;
  for(let d = state.days - 1; d >= 0; d--){
    opts += `<option value="${d}">Dia ${d+1} (substituir)</option>`;
  }
  sel.innerHTML = opts;
  sel.value = pendingDayMode === 'new' ? 'new' : String(pendingDayMode);
  sel.onchange = () => {
    pendingDayMode = sel.value === 'new' ? 'new' : parseInt(sel.value, 10);
  };
}

// Aplica de uma vez a mesma divisão (X ou Y) escolhida no seletor em massa
// a todos os participantes "novos" pendentes de revisão.
function applyBulkDiv(value){
  if(!value || !pendingImport) return;
  pendingImport.forEach(e => e.div = value);
  renderPending();
  document.getElementById('pending-bulk-div').value = value;
}

// Redesenha a lista de conferência da colagem (pendingImport) na tela.
function renderPending(){
  const panel = document.getElementById('pending-panel');
  const list = document.getElementById('pending-list');
  if(!pendingImport || !pendingImport.length){ panel.style.display='none'; return; }
  panel.style.display = 'block';
  populatePendingDaySelect();
  list.innerHTML = pendingImport.map((e, i)=>{
    const valClass = e.value < 0 ? 'val-neg' : e.value > 0 ? 'val-pos' : '';
    const tag = e.knownDiv
      ? `<span class="tag-known">já em Faixa ${e.knownDiv.toUpperCase()}</span>`
      : `<span class="tag-known" style="color:var(--y-color);">novo</span>`;
    return `<div class="pending-row">
      <span class="pname">${e.name}</span>
      <span class="pval ${valClass}">${scoreTag(e.value)}</span>
      ${tag}
      <select onchange="pendingImport[${i}].div=this.value">
        <option value="x" ${e.div==='x'?'selected':''}>Faixa X</option>
        <option value="y" ${e.div==='y'?'selected':''}>Faixa Y</option>
      </select>
    </div>`;
  }).join('');
}

// Botão "Cancelar" da tela de conferência: descarta pendingImport sem gravar nada.
function cancelImport(){
  pendingImport = null;
  pendingDayMode = 'new';
  document.getElementById('pending-panel').style.display = 'none';
}

// Botão "Confirmar e lançar": valida que todo participante novo tem divisão
// escolhida, cria os participantes que ainda não existiam (addParticipant),
// grava a pontuação de cada um no dia alvo (novo ou existente), salva
// (saveState) e volta para a aba "Preencher" já com o resultado.
function confirmImport(){
  if(!exigirAdministrador()) return;
  if(!pendingImport || !pendingImport.length) return;

  let dayIdx;
  if(pendingDayMode === 'new'){
    state.days += 1;
    state.x.forEach(p=>p.scores.push(null));
    state.y.forEach(p=>p.scores.push(null));
    state.dayDates.push(new Date().toISOString());
    dayIdx = state.days - 1;
  } else {
    dayIdx = pendingDayMode;
  }

  pendingImport.forEach(e=>{
    const div = e.div || 'x';
    const list = state[div];
    let p = list.find(pp => pp.name.toLowerCase() === e.name.toLowerCase());
    if(!p){
      p = { name: e.name, scores: Array(state.days).fill(null) };
      list.push(p);
    }
    p.scores[dayIdx] = e.value;
  });

  pendingImport = null;
  pendingDayMode = 'new';
  document.getElementById('pending-panel').style.display = 'none';
  document.getElementById('paste-area').value = '';
  switchLaunchTab('form');
  saveState(); render();
  autoSalvarResumoDoDia(dayIdx);
}
