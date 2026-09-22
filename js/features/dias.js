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
async function addDay(){
  if(!exigirAdministrador()) return;
  if(typeof podeCriarNovoDia === 'function' && !podeCriarNovoDia()) return;
  const dataReferencia = typeof obterDataReferenciaLancamento === 'function' ? obterDataReferenciaLancamento() : dataLocalISO();
  if(!dataReferencia){ alert('Escolha uma data válida para o novo dia.'); return; }
  state.days += 1;
  obterTodasDivisoes().forEach(div=>{
    (div.participantes || []).forEach(p=>p.scores.push(null));
  });
  state.dayDates.push(dataReferencia);
  if(!Array.isArray(state.dayIds)) state.dayIds = [];
  state.dayIds.push('d_' + gerarParticipantId().replace(/^p_/, ''));
  await saveState({ immediate:true }); render();
  if(typeof verificarEncerramentoSerie === 'function') verificarEncerramentoSerie();
}

// Remove um dia específico (por índice) de TODAS as faixas, inclusive sua data — usado no painel "Gerenciar dias lançados".
async function removeDay(dayIdx){
  if(!exigirAdministrador()) return;
  if(dayIdx < 0 || dayIdx >= state.days) return;
  if(!await uiConfirm(`Remover o Dia ${dayIdx+1}? Os dias seguintes serão renumerados.`, { title:'Remover lançamento', variant:'danger', confirmText:'Remover dia' })) return;
  cancelarEstadoPendenteEstrutural('um dia foi removido');
  obterTodasDivisoes().forEach(div=>{
    (div.participantes || []).forEach(p=>p.scores.splice(dayIdx,1));
  });
  state.dayDates.splice(dayIdx,1);
  if(Array.isArray(state.dayIds)) state.dayIds.splice(dayIdx,1);
  state.days -= 1;
  if(typeof ajustarFiltroAposRemoverDia === 'function') ajustarFiltroAposRemoverDia(dayIdx);
  const salvo = await saveState({ immediate:true });
  render();

  // A remoção renumera os dias seguintes. Regenera todos os resumos para que
  // texto, data, colocação e acumulado acompanhem os novos índices. O
  // resumo do Day_ID removido permanece preservado na aba, mas o backend o
  // devolve com a situação "dia_removido".
  if(salvo !== false && typeof sincronizarResumosAposAlteracaoRanking === 'function'){
    await sincronizarResumosAposAlteracaoRanking();
  }
}
