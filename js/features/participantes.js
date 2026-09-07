/* ============================================================================
   participantes.js
   ----------------------------------------------------------------------------
   Tudo que gira em torno de UM participante: criar, remover, renomear,
   editar a pontuação de um dia específico, e o cálculo de ranking (total
   acumulado, critério de desempate e ordenação de uma divisão) que
   alimenta tanto o quadro de classificação (renderDivision, em
   renderizacao.js) quanto o texto de resumo (texto-do-resumo.js).

   Depende de: estado-global.js (state), planilha-mestra.js (saveState),
   renderizacao.js (render).
   ============================================================================ */

// Cadastra um novo participante numa divisão (Faixa X ou Y), com pontuação zerada em todos os dias já lançados.
function addParticipant(div){
  if(!exigirAdministrador()) return;
  const name = prompt('Nome do participante:');
  if(!name) return;
  const list = state[div];
  list.push({ name: name.trim(), scores: Array(state.days).fill(null) });
  saveState(); render();
}

// Remove um participante de uma divisão (com confirmação do usuário).
function removeParticipant(div, idx){
  if(!exigirAdministrador()) return;
  state[div].splice(idx,1);
  saveState(); render();
}

// Renomeia um participante (prompt simples, com validação de nome vazio).
function renameParticipant(div, idx){
  if(!exigirAdministrador()) return;
  const current = state[div][idx].name;
  const name = prompt('Novo nome:', current);
  if(!name || !name.trim() || name.trim() === current) return;
  state[div][idx].name = name.trim();
  saveState(); render();
}

// Atualiza a pontuação de um participante num dia específico (campo editável da tabela).
function updateScore(div, idx, dayIdx, value){
  if(!exigirAdministrador()) return;
  let v = value.trim();
  let num = v === '' ? null : parseFloat(v);
  if(num !== null && isNaN(num)) num = null;
  if(num !== null && num > 10) num = 10; // ganho máximo diário
  state[div][idx].scores[dayIdx] = num;
  saveState();
  renderDivision(div);
}

/* --------------------------------------------------------------------------
   Cálculo de ranking: total acumulado, critério de desempate do dia e
   ordenação de uma divisão inteira. Funções puras (não mexem no DOM) —
   quem desenha o resultado na tela é renderDivision, em renderizacao.js.
   -------------------------------------------------------------------------- */
function total(p){
  return p.scores.reduce((s,v)=> s + (v ?? 0), 0);
}

// Critério de desempate: quem teve a melhor pontuação NO dia mais recente lançado vence o empate no acumulado.
function tiebreakDay(a,b){
  for(let d=state.days-1; d>=0; d--){
    const av = a.scores[d] ?? 0;
    const bv = b.scores[d] ?? 0;
    if(av !== bv) return d;
  }
  return null;
}

// Ordena os participantes de uma divisão por total acumulado, aplicando tiebreakDay em caso de empate.
function sortDivision(div){
  const list = state[div].map((p,i)=>({...p, idx:i, total: total(p)}));
  list.sort((a,b)=>{
    if(b.total !== a.total) return b.total - a.total;
    const d = tiebreakDay(a,b);
    if(d === null) return 0;
    return (b.scores[d] ?? 0) - (a.scores[d] ?? 0);
  });
  return list;
}
