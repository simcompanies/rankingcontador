/* ============================================================================
   dias.js
   ----------------------------------------------------------------------------
   Adicionar e remover um "dia" do ranking (cada dia é uma coluna de
   pontuação, com sua própria data, replicada para todos os participantes de
   TODAS as faixas existentes no momento — ver estado-global.js/obterTodasDivisoes).

   Depende de: estado-global.js (state, obterTodasDivisoes), planilha-mestra.js
   (saveState), renderizacao.js (render).
   ============================================================================ */

// Adiciona um novo dia (nova coluna de pontuação, com data) a TODAS as faixas, pontuação inicial zerada para todos.
function addDay(){
  if(!exigirAdministrador()) return;
  state.days += 1;
  obterTodasDivisoes().forEach(div=>{
    (div.participantes || []).forEach(p=>p.scores.push(null));
  });
  state.dayDates.push(new Date().toISOString());
  saveState(); render();
}

// Remove um dia específico (por índice) de TODAS as faixas, inclusive sua data — usado no painel "Gerenciar dias lançados".
function removeDay(dayIdx){
  if(!exigirAdministrador()) return;
  if(dayIdx < 0 || dayIdx >= state.days) return;
  if(!confirm(`Remover o Dia ${dayIdx+1}? Os dias seguintes serão renumerados.`)) return;
  obterTodasDivisoes().forEach(div=>{
    (div.participantes || []).forEach(p=>p.scores.splice(dayIdx,1));
  });
  state.dayDates.splice(dayIdx,1);
  state.days -= 1;
  saveState(); render();
}
