/* ============================================================================
   participantes.js
   ----------------------------------------------------------------------------
   Tudo que gira em torno de UM participante: criar, remover, renomear,
   editar a pontuação de um dia específico, e o cálculo de ranking (total
   acumulado, critério de desempate e ordenação de uma divisão) que
   alimenta tanto o quadro de classificação (renderDivision, em
   renderizacao.js) quanto o texto de resumo (texto-do-resumo.js).

   FAIXAS DINÂMICAS: `div`/`divId` deixou de significar só 'x' ou 'y' — pode
   ser o id de qualquer faixa criada em Configurações Gerais (ver
   faixas-dinamicas.js). Todas as funções abaixo mantêm exatamente os mesmos
   NOMES e a mesma ASSINATURA de antes (addParticipant, removeParticipant,
   renameParticipant, updateScore, total, tiebreakDay, sortDivision) — só a
   implementação por dentro passou a usar obterDivisao(divId).participantes
   em vez de state[div]. Isso é proposital: todo o resto do app (renderizacao.js,
   analises-gerais.js, filtros.js, analises-dashboard.js, texto-do-resumo.js,
   colagem.js) já chama essas funções por esses nomes e não precisou mudar
   uma linha por causa desta refatoração.

   Depende de: estado-global.js (state, obterDivisao), planilha-mestra.js
   (saveState), renderizacao.js (render, renderDivision).
   ============================================================================ */

// Cadastra um novo participante numa faixa, com pontuação zerada em todos os dias já lançados.
function addParticipant(divId){
  if(!exigirAdministrador()) return;
  const div = obterDivisao(divId);
  if(!div){ alert('Faixa não encontrada.'); return; }

  const name = prompt('Nome do participante:');
  if(!name) return;

  if(!div.participantes) div.participantes = [];
  div.participantes.push({ name: name.trim(), scores: Array(state.days).fill(null) });
  saveState(); render();
}

// Remove um participante de uma faixa.
function removeParticipant(divId, idx){
  if(!exigirAdministrador()) return;
  const div = obterDivisao(divId);
  if(!div || !div.participantes) return;

  div.participantes.splice(idx,1);
  saveState(); render();
}

// Renomeia um participante (prompt simples, com validação de nome vazio).
function renameParticipant(divId, idx){
  if(!exigirAdministrador()) return;
  const div = obterDivisao(divId);
  if(!div || !div.participantes || !div.participantes[idx]) return;

  const current = div.participantes[idx].name;
  const name = prompt('Novo nome:', current);
  if(!name || !name.trim() || name.trim() === current) return;
  div.participantes[idx].name = name.trim();
  saveState(); render();
}

// Atualiza a pontuação de um participante num dia específico (campo editável da tabela).
function updateScore(divId, idx, dayIdx, value){
  if(!exigirAdministrador()) return;
  const div = obterDivisao(divId);
  if(!div || !div.participantes || !div.participantes[idx]) return;

  let v = value.trim();
  let num = v === '' ? null : parseFloat(v);
  if(num !== null && isNaN(num)) num = null;
  if(num !== null && num > 10) num = 10; // ganho máximo diário
  div.participantes[idx].scores[dayIdx] = num;
  saveState();
  renderDivision(divId);
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

// Ordena os participantes de uma faixa por total acumulado, aplicando tiebreakDay em caso de empate.
function sortDivision(divId){
  const div = obterDivisao(divId);
  const participantes = (div && div.participantes) || [];
  const list = participantes.map((p,i)=>({...p, idx:i, total: total(p)}));
  list.sort((a,b)=>{
    if(b.total !== a.total) return b.total - a.total;
    const d = tiebreakDay(a,b);
    if(d === null) return 0;
    return (b.scores[d] ?? 0) - (a.scores[d] ?? 0);
  });
  return list;
}
