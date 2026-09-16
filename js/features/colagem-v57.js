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

// Regra autoritativa de pontuação usada na versão de 22/08/2026.
// Mantida neste módulo porque também é usada para recalcular, com segurança,
// listas posicionais produzidas pelo fluxo manual assistido do Gemini.
function pontosPorPosicaoLeitura(posicao, totalParticipantes){
  if(posicao <= 10) return 11 - posicao;
  if(posicao === 11) return 0;
  if(totalParticipantes <= 14) return -(posicao - 11);
  return -(Math.floor((posicao - 12) / 2) + 1);
}

function findDivision(name){
  const achados = encontrarParticipantesPorNome(name);
  return achados.length === 1 ? achados[0].div.id : null;
}

function localizarCorrespondenciaImportacao(name){
  const achados = encontrarParticipantesPorNome(name);
  if(achados.length === 1){
    return { knownDiv:achados[0].div.id, knownId:achados[0].participante.id, ambiguous:false };
  }
  if(achados.length > 1) return { knownDiv:null, knownId:null, ambiguous:true };
  return { knownDiv:null, knownId:null, ambiguous:false };
}

// Proteção adicional para desenvolvimento local: se um texto copiado contiver
// o código que o VS Code Live Server injeta para recarga automática, mantemos
// apenas entradas que realmente se parecem com "Nome, Pontuação" / OBS:.
function limparRuidoLiveServerDaColagem(texto){
  const bruto = String(texto == null ? '' : texto)
    .replace(/\u200B|\u200C|\u200D|\uFEFF/g, '')
    .replace(/\r\n?/g, '\n');
  const contaminado = /For SVG support|refreshCSS\s*\(|Live reload enabled|Live-Reloading|new WebSocket\s*\(/i.test(bruto);
  if(!contaminado) return { texto:bruto, removido:false };

  // Remove blocos <script> quando o clipboard veio como fonte HTML.
  let limpo = bruto.replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, '\n');
  const candidatos = limpo.split(/[;\n]+/).map(s=>s.trim()).filter(Boolean);
  const validos = candidatos.filter(function(chunk){
    if(/^OBS\s*:/i.test(chunk)) return true;
    if(separarNomeValorDaLinha(chunk)) return true;
    return /^(.+?)[\s\t]+-?\d+(?:[.,]\d+)?\s*$/.test(chunk);
  });
  return { texto:validos.map(v=>v.replace(/;\s*$/,'')).join(';\n') + (validos.length ? ';' : ''), removido:true };
}

function prepararCampoColagemContraRuido(){
  const area = document.getElementById('paste-area');
  if(!area || area.dataset.pasteGuard === '1') return;
  area.dataset.pasteGuard = '1';
  area.addEventListener('paste', function(evento){
    const clip = evento.clipboardData && evento.clipboardData.getData ? evento.clipboardData.getData('text/plain') : '';
    if(!clip) return;
    const resultado = limparRuidoLiveServerDaColagem(clip);
    if(!resultado.removido) return;
    evento.preventDefault();
    const inicio = typeof area.selectionStart === 'number' ? area.selectionStart : area.value.length;
    const fim = typeof area.selectionEnd === 'number' ? area.selectionEnd : inicio;
    area.setRangeText(resultado.texto, inicio, fim, 'end');
    const aviso = document.getElementById('paste-sanitize-status');
    if(aviso){
      aviso.hidden = false;
      aviso.textContent = resultado.texto.trim()
        ? 'Código de recarga do Live Server removido automaticamente. Confira a lista antes de ler.'
        : 'A colagem continha apenas código do Live Server e foi descartada.';
    }
  });
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
    return { name: partes.slice(0, -2).join(', ').trim(), valueStr: penultima + '.' + ultima, ambiguous:true };
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
async function processPaste(){
  if(!exigirAdministrador()) return;
  const area = document.getElementById('paste-area');
  const limpeza = limparRuidoLiveServerDaColagem(area.value);
  const text = limpeza.texto;
  if(limpeza.removido && text !== area.value) area.value = text;
  const chunks = text.split(/[;\n]+/).map(s=>s.trim()).filter(Boolean);
  const parsed = [];
  const skipped = [];
  const nomesVistos = new Map();
  const duplicados = new Set();
  const origem = area.dataset.leituraOrigem || window.rankingPasteSource || '';

  for(const chunk of chunks){
    if(/^OBS\s*:/i.test(chunk)){ skipped.push(chunk); continue; }
    let name, valueStr;
    const porVirgula = separarNomeValorDaLinha(chunk);
    if(porVirgula){
      name = porVirgula.name; valueStr = porVirgula.valueStr;
      if(porVirgula.ambiguous && !origem){
        const ok = await uiConfirm('A linha "' + chunk + '" é ambígua por usar vírgula entre dois trechos numéricos. Ela será interpretada como nome "' + name + '" e pontuação ' + valueStr + '. Se o número fizer parte do nome, cancele e corrija a linha antes de continuar.', { title:'Conferir leitura', variant:'warning', confirmText:'Usar esta interpretação' });
        if(!ok) return;
      }
    } else {
      const m = chunk.match(/^(.+?)[\s\t]+(-?\d+(?:[.,]\d+)?)\s*$/);
      if(!m){ skipped.push(chunk); continue; }
      name = m[1].trim(); valueStr = m[2];
    }
    name = String(name || '').trim().replace(/\s+/g,' ');
    if(!name){ skipped.push(chunk); continue; }
    const value = parsePontuacao(valueStr);
    if(Number.isNaN(value)){ skipped.push(chunk); continue; }
    const norm = normalizarNomeParticipante(name);
    if(nomesVistos.has(norm)) duplicados.add(name);
    nomesVistos.set(norm, true);
    parsed.push({ name, value });
  }

  if(!parsed.length){
    alert('Não consegui ler nenhum participante. Use o formato: Nome, Pontuação; um por ponto e vírgula ou por linha.');
    return;
  }
  if(duplicados.size){
    alert('A colagem contém nomes repetidos: ' + Array.from(duplicados).join(', ') + '. Corrija a lista antes de continuar para evitar sobrescrita de pontuação.');
    return;
  }

  // Quando a origem é o fluxo manual assistido do Gemini, a ordem é autoritativa
  // e a pontuação é recalculada localmente pela mesma regra de 22/08, ignorando
  // qualquer aritmética eventualmente incorreta produzida fora do aplicativo.
  if(origem === 'gemini' && typeof pontosPorPosicaoLeitura === 'function'){
    parsed.forEach((e,i)=>{ e.value = pontosPorPosicaoLeitura(i+1, parsed.length); });
  }

  const divisoes = obterTodasDivisoes();
  const fallbackDiv = divisoes.length ? divisoes[0].id : 'x';
  pendingImport = parsed.map(e=>{
    const match = localizarCorrespondenciaImportacao(e.name);
    return { ...e, ...match, div: match.knownDiv || fallbackDiv };
  });
  if(pendingImport.some(e=>e.ambiguous)){
    alert('Há participante(s) com o mesmo nome cadastrado(s) em mais de uma faixa. Renomeie essas duplicidades no ranking antes de importar, para que a pontuação não seja associada à pessoa errada.');
    pendingImport = null;
    return;
  }
  pendingDayMode = 'new';
  renderPending();
  if(skipped.length) console.warn('Linhas não reconhecidas/observações ignoradas na colagem:', skipped);
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
    if(typeof sincronizarDataReferenciaComDiaPendente === 'function') sincronizarDataReferenciaComDiaPendente();
  };
  if(typeof sincronizarDataReferenciaComDiaPendente === 'function') sincronizarDataReferenciaComDiaPendente();
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
  pendingImport.forEach(e => { if(!e.knownId) e.div = value; });
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
      <select onchange="pendingImport[${i}].div=this.value" ${e.knownId?'disabled title="Participante já cadastrado; a faixa não pode ser alterada nesta importação."':''}>
        ${opcoes}
      </select>
    </div>`;
  }).join('');
}

// Botão "Cancelar" da tela de conferência: descarta pendingImport sem gravar nada.
function cancelImport(){
  pendingImport = null;
  pendingDayMode = 'new';
  const panel = document.getElementById('pending-panel');
  if(panel) panel.style.display = 'none';
}

// Botão "Confirmar e lançar": valida que todo participante novo tem faixa
// escolhida, cria os participantes que ainda não existiam, grava a
// pontuação de cada um no dia alvo (novo ou existente), salva (saveState) e
// volta para a aba "Preencher" já com o resultado.
async function confirmImport(){
  if(!exigirAdministrador()) return;
  if(!pendingImport || !pendingImport.length) return;
  if(pendingImport.some(e=>e.ambiguous)){
    alert('A importação contém nomes ambíguos. Corrija as duplicidades antes de continuar.');
    return;
  }

  // Valida tudo ANTES de alterar days/scores.
  for(const e of pendingImport){
    if(e.knownId){
      if(!encontrarParticipantePorId(e.knownId)){
        alert('O participante "' + e.name + '" mudou ou foi removido desde a leitura. Leia a colagem novamente.');
        cancelImport(); return;
      }
    }else if(!obterDivisao(e.div)){
      alert('A faixa escolhida para "' + e.name + '" não existe mais. Leia a colagem novamente.');
      cancelImport(); return;
    }else if(nomeParticipanteEmUso(e.name)){
      alert('O nome "' + e.name + '" passou a existir no ranking desde a leitura. Leia a colagem novamente.');
      cancelImport(); return;
    }
  }

  let dayIdx;
  if(pendingDayMode === 'new'){
    if(typeof podeCriarNovoDia === 'function' && !podeCriarNovoDia()) return;
    dayIdx = state.days;
  }else{
    dayIdx = Number(pendingDayMode);
    if(!Number.isInteger(dayIdx) || dayIdx < 0 || dayIdx >= state.days){
      alert('O dia selecionado não existe mais. A importação foi cancelada para proteger os dados.');
      cancelImport(); return;
    }
  }

  const dataReferencia = typeof obterDataReferenciaLancamento === 'function' ? obterDataReferenciaLancamento() : dataLocalISO();
  if(!dataReferencia){ alert('Escolha uma data válida para a contagem.'); return; }

  if(pendingDayMode === 'new'){
    state.days += 1;
    obterTodasDivisoes().forEach(div=>{ (div.participantes || []).forEach(p=>p.scores.push(null)); });
    state.dayDates.push(dataReferencia);
    if(!Array.isArray(state.dayIds)) state.dayIds = [];
    state.dayIds.push('d_' + gerarParticipantId().replace(/^p_/, ''));
  }else{
    state.dayDates[dayIdx] = dataReferencia;
  }

  pendingImport.forEach(e=>{
    let p;
    if(e.knownId){
      p = encontrarParticipantePorId(e.knownId).participante;
    }else{
      const div = obterDivisao(e.div);
      if(!div.participantes) div.participantes = [];
      p = criarParticipante(e.name, state.days);
      div.participantes.push(p);
    }
    p.scores[dayIdx] = e.value;
  });

  pendingImport = null;
  pendingDayMode = 'new';
  const panel = document.getElementById('pending-panel'); if(panel) panel.style.display = 'none';
  const area = document.getElementById('paste-area');
  if(area){ area.value = ''; delete area.dataset.leituraOrigem; delete area.dataset.revisaoPosicionalObrigatoria; }
  window.rankingPasteSource = '';
  switchLaunchTab('form');
  const salvo = await saveState({ immediate:true }); render();
  if(salvo !== false) await autoSalvarResumoDoDia(dayIdx);
  if(typeof verificarEncerramentoSerie === 'function') verificarEncerramentoSerie();
}

// O módulo pode ser injetado por fetch depois do carregamento do script.
if(typeof document !== 'undefined' && document.addEventListener) document.addEventListener('DOMContentLoaded', prepararCampoColagemContraRuido);
if(typeof window !== 'undefined' && window.addEventListener) window.addEventListener('rg:modules-loaded', prepararCampoColagemContraRuido);
