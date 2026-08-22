/* ============================================================================
   colagem.js
   ----------------------------------------------------------------------------
   Fluxo da aba "Colar" do módulo Lançar Pontuação: interpretar o texto
   colado no formato "Nome, Pontuação;", deixar o usuário conferir/corrigir
   linha a linha (inclusive escolher a FAIXA de participantes novos, dentre
   TODAS as faixas existentes) e só então confirmar a gravação no ranking.

   A leitura de print com ajuda do Gemini chat (link + regras prontas pra
   copiar e colar — que também termina preenchendo esta mesma caixa de
   texto) fica em colagem-gemini.js.

   Depende de: estado-global.js (state, obterDivisao, obterTodasDivisoes,
   pendingImport, pendingDayMode), participantes.js (não usado diretamente —
   confirmImport grava direto no array de participantes da faixa), dias.js
   (mesmo comentário), navegacao.js (switchLaunchTab), planilha-mestra.js
   (saveState), renderizacao.js (render).
   ============================================================================ */

// Procura em qual faixa um nome de participante já existe (comparação sem
// diferenciar maiúsc./minúsc.), varrendo TODAS as faixas cadastradas.
// Devolve o id da faixa ou null.
function findDivision(name){
  const norm = name.toLowerCase();
  const divisoes = obterTodasDivisoes();
  for(const div of divisoes){
    if((div.participantes || []).some(p=>p.name.toLowerCase()===norm)) return div.id;
  }
  return null;
}

// Faz o parse de UM chunk "Nome, Pontuação" dividindo por TODAS as vírgulas,
// e decide qual vírgula é a "de verdade" (separador nome/pontuação) — a
// vírgula BR também pode ser decimal DENTRO da própria pontuação (ex.
// "Grupo Alfa, 8,5"), e nomes também podem legitimamente conter vírgula
// (ex. "Silva, João, 8"). Devolve {name, valueStr} ou null.
//   - Se as DUAS últimas partes, sozinhas, parecem "inteiro" + "casas
//     decimais" (ex. "8" e "5"), trata as duas juntas como um único valor
//     decimal — cobre "Grupo Alfa, 8,5" -> nome "Grupo Alfa", valor "8.5".
//   - Senão, se só a ÚLTIMA parte sozinha já é um número completo (com
//     ponto, vírgula ou nenhum decimal), usa só ela como valor — cobre
//     "Silva, João, 8" (nome com vírgula) e "João, 8" (caso simples).
function separarNomeValorDaLinha(chunk){
  const partes = chunk.split(',').map(s => s.trim());
  if(partes.length < 2) return null;

  const ultima = partes[partes.length - 1];
  const penultima = partes[partes.length - 2];

  // "8,5": penúltima é a parte inteira (sinal opcional), última é só a
  // casa decimal (nunca tem sinal próprio — o sinal pertence ao inteiro).
  if(/^-?\d+$/.test(penultima) && /^\d+$/.test(ultima)){
    return { name: partes.slice(0, -2).join(', ').trim(), valueStr: penultima + '.' + ultima };
  }

  // "Silva, João, 8" ou "João, 8": última parte sozinha já é um número
  // válido — o resto (vírgulas internas incluídas) é o nome.
  if(/^-?\d+(?:[.,]\d+)?$/.test(ultima)){
    return { name: partes.slice(0, -1).join(', ').trim(), valueStr: ultima };
  }

  return null;
}

// Botão "Ler colagem": faz o parse do texto colado (uma entrada
// "Nome, Pontuação;" por linha ou separada por ;), casa cada nome com um
// participante existente (via findDivision) ou marca como "novo" para o
// usuário escolher a faixa, e guarda tudo em pendingImport para revisão.
function processPaste(){
  if(!exigirAdministrador()) return;
  const text = document.getElementById('paste-area').value;
  const chunks = text.split(/[;\n]+/).map(s=>s.trim()).filter(Boolean);
  const parsed = [];
  const skipped = [];
  for(const chunk of chunks){
    let name, valueStr;
    const porVirgula = separarNomeValorDaLinha(chunk);
    if(porVirgula){
      name = porVirgula.name;
      valueStr = porVirgula.valueStr;
    } else {
      const m = chunk.match(/^(.+?)[\s\t]+(-?\d+(?:[.,]\d+)?)\s*$/);
      if(!m){ skipped.push(chunk); continue; }
      name = m[1].trim();
      valueStr = m[2];
    }
    if(!name){ skipped.push(chunk); continue; }
    const value = parseFloat(valueStr.replace(',', '.'));
    if(isNaN(value)){ skipped.push(chunk); continue; }
    parsed.push({ name, value: Math.min(value, 10) });
  }
  if(!parsed.length){
    alert('Não consegui ler nenhum participante. Use o formato: Nome, Pontuação; um por ponto e vírgula ou por linha.');
    return;
  }
  const divisoes = obterTodasDivisoes();
  const fallbackDiv = divisoes.length ? divisoes[0].id : 'x';
  pendingImport = parsed.map(e=>{
    const known = findDivision(e.name);
    return { ...e, knownDiv: known, div: known || fallbackDiv };
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

// Preenche o <select> "Faixa para todos" com TODAS as faixas cadastradas
// (antes era hardcoded para Faixa X / Faixa Y).
function populatePendingBulkDivSelect(){
  const sel = document.getElementById('pending-bulk-div');
  if(!sel) return;
  const atual = sel.value;
  let opts = '<option value="">— escolher —</option>';
  obterTodasDivisoes().forEach(div=>{
    opts += `<option value="${div.id}">${escapeHtml(div.titulo)}</option>`;
  });
  sel.innerHTML = opts;
  sel.value = atual && obterDivisao(atual) ? atual : '';
}

// Aplica de uma vez a mesma faixa escolhida no seletor em massa a todos os
// participantes "novos" pendentes de revisão.
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
  populatePendingBulkDivSelect();
  const divisoes = obterTodasDivisoes();
  list.innerHTML = pendingImport.map((e, i)=>{
    const valClass = e.value < 0 ? 'val-neg' : e.value > 0 ? 'val-pos' : '';
    const divConhecida = e.knownDiv ? obterDivisao(e.knownDiv) : null;
    const tag = divConhecida
      ? `<span class="tag-known">já em ${escapeHtml(divConhecida.titulo)}</span>`
      : `<span class="tag-known" style="color:var(--y-color);">novo</span>`;
    const opcoes = divisoes.map(div=>
      `<option value="${div.id}" ${e.div===div.id?'selected':''}>${escapeHtml(div.titulo)}</option>`
    ).join('');
    return `<div class="pending-row">
      <span class="pname">${escapeHtml(e.name)}</span>
      <span class="pval ${valClass}">${scoreTag(e.value)}</span>
      ${tag}
      <select onchange="pendingImport[${i}].div=this.value">
        ${opcoes}
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

// Botão "Confirmar e lançar": valida que todo participante novo tem faixa
// escolhida, cria os participantes que ainda não existiam, grava a
// pontuação de cada um no dia alvo (novo ou existente), salva (saveState) e
// volta para a aba "Preencher" já com o resultado.
function confirmImport(){
  if(!exigirAdministrador()) return;
  if(!pendingImport || !pendingImport.length) return;

  let dayIdx;
  if(pendingDayMode === 'new'){
    state.days += 1;
    obterTodasDivisoes().forEach(div=>{ (div.participantes || []).forEach(p=>p.scores.push(null)); });
    state.dayDates.push(dataLocalISO());
    dayIdx = state.days - 1;
  } else {
    dayIdx = pendingDayMode;
  }

  const divisoes = obterTodasDivisoes();
  const fallbackDiv = divisoes.length ? divisoes[0].id : 'x';

  pendingImport.forEach(e=>{
    const div = obterDivisao(e.div || fallbackDiv);
    if(!div) return;
    if(!div.participantes) div.participantes = [];
    let p = div.participantes.find(pp => pp.name.toLowerCase() === e.name.toLowerCase());
    if(!p){
      p = { name: e.name, scores: Array(state.days).fill(null) };
      div.participantes.push(p);
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
