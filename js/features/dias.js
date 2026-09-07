/* ============================================================================
   dias.js
   ----------------------------------------------------------------------------
   Adicionar e remover um "dia" do ranking (cada dia é uma coluna de
   pontuação, com sua própria data, replicada para todos os participantes
   de ambas as divisões).

   Depende de: estado-global.js (state), planilha-mestra.js (saveState),
   renderizacao.js (render).
   ============================================================================ */

// Adiciona um novo dia (nova coluna de pontuação, com data) a ambas as divisões, pontuação inicial zerada para todos.
function addDay(){
  if(!exigirAdministrador()) return;
  state.days += 1;
  state.x.forEach(p=>p.scores.push(null));
  state.y.forEach(p=>p.scores.push(null));
  state.dayDates.push(new Date().toISOString());
  saveState(); render();
}

// Remove um dia específico (por índice) de ambas as divisões, inclusive sua data — usado no painel "Gerenciar dias lançados".
function removeDay(dayIdx){
  if(!exigirAdministrador()) return;
  if(dayIdx < 0 || dayIdx >= state.days) return;
  if(!confirm(`Remover o Dia ${dayIdx+1}? Os dias seguintes serão renumerados.`)) return;
  state.x.forEach(p=>p.scores.splice(dayIdx,1));
  state.y.forEach(p=>p.scores.splice(dayIdx,1));
  state.dayDates.splice(dayIdx,1);
  state.days -= 1;
  saveState(); render();
}
