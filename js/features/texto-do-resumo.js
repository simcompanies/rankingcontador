/* ============================================================================
   texto-do-resumo.js
   ----------------------------------------------------------------------------
   Geração do texto de resumo (o bloco de texto pronto para colar no grupo,
   com a classificação de um dia específico ou o acumulado) — usado tanto
   pelo botão "Gerar resumo" quanto pelo auto-save de resumo ao lançar um dia.

   Depende de: estado-global.js (state), participantes.js (total, tiebreakDay,
   sortDivision — cálculo do ranking que o texto descreve), config-api.js
   (chamarAPI, para o auto-save gravar o resumo no backend).
   ============================================================================ */

/* --------------------------------------------------------------------------
   Pequenos formatadores de texto: tag textual da colocação (🥇, "2º" etc.)
   e tag textual da pontuação do dia (+10, -1, 0...).
   -------------------------------------------------------------------------- */
function scoreTag(v){
  const n = v ?? 0;
  return n >= 0 ? `+${n}` : `${n}`;
}

function ptsTag(v){
  const abs = Math.abs(v);
  return `${v} ${abs === 1 ? 'pt' : 'pts'}`;
}

// Ordena os participantes de UMA divisão pela pontuação de UM dia específico
// (não pelo acumulado) — usado para montar o resumo "do dia".
function rankDivisionForDay(div, dayIdx){
  const list = state[div].filter(p => p.scores[dayIdx] !== null && p.scores[dayIdx] !== undefined);
  list.sort((a,b)=>{
    const av = a.scores[dayIdx] ?? 0;
    const bv = b.scores[dayIdx] ?? 0;
    if(bv !== av) return bv - av;
    return a.name.localeCompare(b.name, 'pt-BR');
  });
  return list;
}

// Monta o bloco de texto de uma divisão (cabeçalho + uma linha por
// participante) para um dado ranking já ordenado — reaproveitado tanto no
// resumo "do dia" quanto no "acumulado".
function buildDivisionBlock(title, range, emoji, entries, formatFn){
  const bar = '━━━━━━━━━━━━━━━━━━';
  let out = `${bar} \n${emoji} ${title} • ${range} \n${bar}\n`;
  out += entries.map((e, i) => `${i+1}° ${e.name} — ${formatFn(e)}`).join('\n');
  return out;
}

// Monta o texto completo do resumo: cabeçalho com a data, bloco da Faixa X
// e bloco da Faixa Y, escolhendo ranking do dia ou acumulado conforme o modo.
function textoResumoParaDia(dayIdx){
  const xDay = rankDivisionForDay('x', dayIdx);
  const yDay = rankDivisionForDay('y', dayIdx);
  const xAcc = sortDivision('x');
  const yAcc = sortDivision('y');

  let text = `🏆 RANKING DIA ${dayIdx+1}\n`;
  text += buildDivisionBlock('FAIXA X', '0 ~ 19.999M', '📗', xDay, e => scoreTag(e.scores[dayIdx]));
  text += '\n';
  text += buildDivisionBlock('FAIXA Y', '20M ~ ∞', '📘', yDay, e => scoreTag(e.scores[dayIdx]));
  text += '\n🏆 RANKING ACUMULADO\n';
  text += buildDivisionBlock('FAIXA X', '0 ~ 19.999M', '📗', xAcc, e => ptsTag(e.total));
  text += '\n';
  text += buildDivisionBlock('FAIXA Y', '20M ~ ∞', '📘', yAcc, e => ptsTag(e.total));
  return text;
}

// Preenche o <select> de "escolher o dia" usado nos resumos com os dias já lançados.
function populateDaySelect(){
  const sel = document.getElementById('summary-day');
  if(!sel) return;
  sel.innerHTML = '';
  for(let d = 0; d < state.days; d++){
    const opt = document.createElement('option');
    opt.value = d;
    opt.textContent = `Dia ${d+1}`;
    sel.appendChild(opt);
  }
  if(state.days > 0) sel.value = state.days - 1;
}

// Botão "Gerar resumo": monta o texto (via textoResumoParaDia) e mostra na caixa de pré-visualização.
function generateSummary(){
  const out = document.getElementById('summary-output');
  if(!out) return;
  if(state.days === 0){ out.value = ''; return; }
  const dayIdx = parseInt(document.getElementById('summary-day').value, 10);
  out.value = textoResumoParaDia(dayIdx);
}

// Botão "Copiar": copia o texto gerado para a área de transferência, com fallback se a Clipboard API falhar.
function copySummary(){
  const el = document.getElementById('summary-output');
  if(!el.value){ generateSummary(); }
  if(!el.value) return;
  el.select();
  const btn = document.getElementById('copy-btn');
  const finish = () => {
    const old = btn.textContent;
    btn.textContent = 'Copiado!';
    btn.classList.add('copy-flash');
    setTimeout(()=>{ btn.textContent = old; btn.classList.remove('copy-flash'); }, 1500);
  };
  if(navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(el.value).then(finish).catch(()=>{ document.execCommand('copy'); finish(); });
  } else {
    document.execCommand('copy'); finish();
  }
}

// Botão "Salvar este resumo": grava o texto atual no histórico de resumos
// salvos no backend (aba não editável da planilha) e atualiza a lista local.
async function handleSalvarResumoAtual(){
  if(!exigirAdministrador()) return;
  if(state.days === 0){ alert('Lance ao menos um dia antes de salvar um resumo.'); return; }
  const dayIdx = parseInt(document.getElementById('summary-day').value, 10);
  if(!document.getElementById('summary-output').value) generateSummary();
  const btn = document.getElementById('save-resumo-btn');
  definirCarregando(btn, true, '💾 Salvar no histórico');
  try{
    const resposta = await chamarAPI({
      action:'salvarResumo', token:sessaoUsuario.token,
      dia: dayIdx+1, texto: document.getElementById('summary-output').value
    });
    if(!resposta.sucesso){ if(tratarErroSessaoOuPermissao(resposta)) return; alert(resposta.erro || 'Não foi possível salvar.'); return; }
    resumosCarregado = false;
    alert('Resumo salvo no histórico!');
  }catch(erro){
    console.error(erro);
    alert('Erro de conexão ao salvar o resumo.');
  }finally{
    definirCarregando(btn, false, '💾 Salvar no histórico');
  }
}

// Auto-save silencioso do resumo do dia, disparado logo depois que um dia é
// lançado com sucesso (ver formulario-lancamento-dia.js: launchDayForm) —
// mesma gravação de handleSalvarResumoAtual, mas sem depender de a caixa de
// pré-visualização estar preenchida, e sem interromper o fluxo com alertas.
async function autoSalvarResumoDoDia(dayIdx){
  if(!souAdmin()) return;
  try{
    await chamarAPI({
      action:'salvarResumo', token:sessaoUsuario.token,
      dia: dayIdx+1, texto: textoResumoParaDia(dayIdx)
    });
    resumosCarregado = false;
  }catch(erro){
    console.error('Erro ao salvar resumo automático', erro);
  }
}
