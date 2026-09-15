/* ============================================================================
   organizacao-ui.js — organização de informação e contexto operacional v46
   ----------------------------------------------------------------------------
   Não altera a regra de pontuação nem a persistência. Apenas concentra dados
   nos locais mais adequados da interface: visão geral, lançamentos e gestão.
   ============================================================================ */

function formatarDataUI(valor){
  if(!valor) return '';
  const s = String(valor).slice(0,10);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : s;
}

function totalParticipantesUI(){
  return obterTodasDivisoes().reduce((acc, div)=> acc + ((div.participantes || []).length), 0);
}

function renderContextoOperacional(){
  if(typeof state === 'undefined' || !state) return;
  const meta = state.seriesMeta || {};
  const serieNumero = Number(meta.currentNumber) || 1;
  const maxDias = Number(meta.maxDays) || 7;
  const dias = Number(state.days) || 0;
  const ultimaData = dias > 0 && Array.isArray(state.dayDates) ? state.dayDates[dias - 1] : null;
  const ultimaDataFmt = formatarDataUI(ultimaData);
  const participantes = totalParticipantesUI();
  const faixas = obterTodasDivisoes().length;

  const setText = (id, texto)=>{ const el=document.getElementById(id); if(el) el.textContent=texto; };
  setText('overview-series', `Série ${serieNumero}`);
  setText('overview-launches', `${dias}/${maxDias} lançamentos`);
  setText('overview-last-date', ultimaDataFmt ? `Último lançamento: ${ultimaDataFmt}` : 'Nenhum lançamento registrado na série atual.');
  setText('overview-participants', String(participantes));
  setText('overview-faixas', String(faixas));
  setText('overview-days', `${dias}/${maxDias}`);
  setText('overview-series-number', String(serieNumero));

  setText('launch-series-title', `Série ${serieNumero}`);
  setText('launch-series-last', ultimaDataFmt ? `Último lançamento: ${ultimaDataFmt}` : 'Nenhum lançamento registrado nesta série.');
  setText('launch-series-count', `${dias}/${maxDias}`);

  const dots = document.getElementById('launch-series-dots');
  if(dots){
    dots.innerHTML = Array.from({length:maxDias}, (_,i)=>
      `<span class="series-progress-dot ${i < dias ? 'done' : ''}" title="${i < dias ? `Dia ${i+1} lançado` : `Dia ${i+1} pendente`}" aria-hidden="true"></span>`
    ).join('');
    dots.setAttribute('aria-label', `Série ${serieNumero}: ${dias} de ${maxDias} lançamentos concluídos`);
  }

  setText('topbar-series-context', `Série ${serieNumero} · ${dias}/${maxDias}`);
  setText('topbar-last-launch', ultimaDataFmt ? `Último: ${ultimaDataFmt}` : 'Sem lançamentos');
  renderSistemaAdmin();
}

function switchAdminSection(nome){
  const valido = ['participantes','faixas','usuarios','atividade','sistema'].includes(nome) ? nome : 'participantes';
  document.querySelectorAll('[data-admin-panel]').forEach(el=>el.classList.toggle('hidden', el.dataset.adminPanel !== valido));
  document.querySelectorAll('[data-admin-tab]').forEach(el=>el.classList.toggle('active', el.dataset.adminTab === valido));
  if(valido === 'participantes') renderGerenciarParticipantes();
  if(valido === 'faixas' && typeof renderGerenciarFaixas === 'function') renderGerenciarFaixas();
  if(valido === 'usuarios' && typeof carregarUsuariosSeNecessario === 'function') carregarUsuariosSeNecessario();
  if(valido === 'atividade' && typeof carregarUsuariosSeNecessario === 'function') carregarUsuariosSeNecessario();
  if(valido === 'sistema') renderSistemaAdmin();
}

function localizarParticipanteAdmin(participantId){
  for(const div of obterTodasDivisoes()){
    const idx = (div.participantes || []).findIndex(p=>p && p.id === participantId);
    if(idx >= 0) return { div, idx, participante: div.participantes[idx] };
  }
  return null;
}

function renderGerenciarParticipantes(){
  const wrap = document.getElementById('admin-participantes-lista');
  if(!wrap) return;
  const divisoes = obterTodasDivisoes();
  const total = totalParticipantesUI();
  if(!divisoes.length){ wrap.innerHTML='<div class="empty-hint">Nenhuma faixa cadastrada.</div>'; return; }

  wrap.innerHTML = `
    <div class="admin-participant-summary"><strong>${total}</strong><span>participante${total===1?'':'s'} em ${divisoes.length} faixa${divisoes.length===1?'':'s'}</span></div>
    <div class="admin-participant-groups">${divisoes.map(div=>{
      const participantes = (div.participantes || []);
      return `<section class="admin-participant-group" style="--div-accent:var(${div.cor || '--muted'})">
        <div class="admin-participant-group-head">
          <div><strong>${escapeHtml(div.titulo)}</strong><span>${escapeHtml(div.intervalo || '')}</span></div>
          <button type="button" onclick="addParticipant('${div.id}')">+ Participante</button>
        </div>
        <div class="admin-participant-list">${participantes.length ? participantes.map((p,idx)=>`
          <div class="admin-participant-row">
            <div class="admin-participant-name"><strong>${escapeHtml(p.name)}</strong><span>ID ${escapeHtml(String(p.id || '').slice(-8) || '—')}</span></div>
            <label class="admin-move-field"><span>Mover para</span><select onchange="handleMoverParticipante('${p.id}', this.value)">
              <option value="${div.id}">${escapeHtml(div.titulo)} (atual)</option>
              ${divisoes.filter(d=>d.id!==div.id).map(d=>`<option value="${d.id}">${escapeHtml(d.titulo)}</option>`).join('')}
            </select></label>
            <div class="admin-participant-actions">
              <button type="button" onclick="renameParticipant('${div.id}', ${idx})">Renomear</button>
              <button type="button" class="danger-outline" onclick="handleRemoverParticipanteAdmin('${p.id}')">Remover</button>
            </div>
          </div>`).join('') : '<div class="empty-hint compact">Nenhum participante nesta faixa.</div>'}</div>
      </section>`;
    }).join('')}</div>`;
}

async function handleMoverParticipante(participantId, destinoId){
  if(!exigirAdministrador()) return false;
  const local = localizarParticipanteAdmin(participantId);
  const destino = obterDivisao(destinoId);
  if(!local || !destino){ alert('Participante ou faixa de destino não encontrado.'); renderGerenciarParticipantes(); return false; }
  if(local.div.id === destino.id){ renderGerenciarParticipantes(); return false; }
  const ok = await uiConfirm(`Mover ${local.participante.name} de ${local.div.titulo} para ${destino.titulo}?`, {title:'Mover participante', confirmText:'Mover'});
  if(!ok){ renderGerenciarParticipantes(); return false; }
  const [participante] = local.div.participantes.splice(local.idx,1);
  destino.participantes = destino.participantes || [];
  destino.participantes.push(participante);
  cancelarEstadoPendenteEstrutural('um participante mudou de faixa');
  saveState({immediate:true});
  render();
  return true;
}

async function handleRemoverParticipanteAdmin(participantId){
  if(!exigirAdministrador()) return false;
  const local = localizarParticipanteAdmin(participantId);
  if(!local) return false;
  const ok = await uiConfirm(`Remover ${local.participante.name} do ranking? O histórico ativo desse participante será removido da série atual.`, {title:'Remover participante', variant:'danger', confirmText:'Remover'});
  if(!ok) return false;
  local.div.participantes.splice(local.idx,1);
  saveState({immediate:true});
  render();
  return true;
}

function renderSistemaAdmin(){
  const setText=(id,txt)=>{const el=document.getElementById(id);if(el)el.textContent=txt;};
  const build=document.querySelector('meta[name="app-build"]')?.getAttribute('content') || 'v46';
  setText('admin-system-build', build.replace(/^20260915-/,'').replace(/-/g,' '));
  setText('admin-system-state', (typeof loaded !== 'undefined' && loaded) ? (typeof rankingBloqueado !== 'undefined' && rankingBloqueado ? 'Bloqueado' : 'Carregado') : 'Carregando');
  setText('admin-system-revision', state && Number.isFinite(Number(state.revision)) ? String(state.revision) : '—');
  const meta = state && state.seriesMeta ? state.seriesMeta : {};
  setText('admin-system-series', `Série ${Number(meta.currentNumber)||1} · ${Number(state?.days)||0}/${Number(meta.maxDays)||7}`);
  try{
    const u = new URL(API_URL);
    const token = u.pathname.split('/').filter(Boolean).slice(-2,-1)[0] || '';
    setText('admin-system-api', `${u.hostname} · ${token ? token.slice(0,8)+'…'+token.slice(-6) : 'configurada'}`);
  }catch(_){ setText('admin-system-api','Configurada'); }
}

async function testarSistemaBasico(){
  const out = document.getElementById('admin-system-diagnostic');
  if(out){ out.className='system-diagnostic checking'; out.textContent='Testando sessão e API...'; }
  try{
    if(!sessaoUsuario || !sessaoUsuario.token) throw new Error('Sessão local não encontrada.');
    const resposta = await chamarAPIGet({action:'verificarSessao', token:sessaoUsuario.token});
    if(!resposta || !resposta.sucesso) throw new Error((resposta && resposta.erro) || 'A API não confirmou a sessão.');
    if(out){ out.className='system-diagnostic ok'; out.textContent='Conexão confirmada: API acessível, sessão válida e estado local carregado.'; }
  }catch(erro){
    if(out){ out.className='system-diagnostic error'; out.textContent='Falha no diagnóstico: ' + (erro && erro.message ? erro.message : 'erro desconhecido'); }
  }
}
