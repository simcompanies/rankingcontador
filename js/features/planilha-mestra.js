/* ==========================================================================
   planilha-mestra.js — carga e persistência robustas do ranking.
   - nunca transforma falha de rede em ranking vazio editável;
   - serializa gravações;
   - usa revisão otimista para impedir "última gravação vence";
   - valida invariantes antes de enviar;
   - permite flush imediato antes de logout/ocultação da página.
   ========================================================================== */

function estadoVazioPadrao(){
  return {
    revision: 0,
    days: 0,
    dayDates: [],
    dayIds: [],
    seriesMeta: { currentId:'s_inicial', currentNumber:1, maxDays:7 },
    divisoes: [
      { id: 'x', titulo: 'Faixa X', intervalo: '0 a 19.999M', cor: '--x-color', participantes: [] },
      { id: 'y', titulo: 'Faixa Y', intervalo: '20M ou mais', cor: '--y-color', participantes: [] }
    ]
  };
}

function setStatus(text, ok){
  const el = document.getElementById('sync-status');
  if(el) el.textContent = text;
  const dot = document.getElementById('status-dot');
  if(dot) dot.style.background = ok === false ? 'var(--neg)' : (ok === 'busy' ? 'var(--y-color)' : 'var(--x-color)');
}

function atualizarBloqueioDados(){
  const shell = document.getElementById('app-shell');
  if(shell) shell.toggleAttribute('data-ranking-bloqueado', !!rankingBloqueado);
  document.querySelectorAll('[data-papel="administrador"] button, [data-papel="administrador"] input, [data-papel="administrador"] select, [data-papel="administrador"] textarea').forEach(el=>{
    if(el.closest('#identity-bar')) return;
    if(rankingBloqueado) el.setAttribute('data-ranking-disabled','1');
    else el.removeAttribute('data-ranking-disabled');
  });
}

async function loadState(){
  if(!sessaoUsuario) return false;
  rankingBloqueado = true;
  loaded = false;
  ultimoErroCarga = null;
  atualizarBloqueioDados();
  setStatus('carregando dados...', 'busy');

  try{
    const resposta = await chamarAPIGet({ action:'listarRanking', token: sessaoUsuario.token });
    if(!resposta.sucesso){
      if(tratarErroSessaoOuPermissao(resposta)) return false;
      throw new Error(resposta.erro || 'Falha ao carregar');
    }

    let carregado = migrarEstadoAntigo(resposta.dados);
    const validacao = validarInvariantesRanking(carregado);
    if(!validacao.ok) throw new Error('O servidor devolveu um ranking inconsistente: ' + validacao.erro);

    state = validacao.state;
    loaded = true;
    rankingBloqueado = !!(typeof modulosHtmlComFalha !== 'undefined' && modulosHtmlComFalha.length);
    syncConflict = false;
    ultimoErroCarga = null;
    stateDirty = false;
    setStatus(rankingBloqueado ? 'interface incompleta — edição bloqueada' : ('sincronizado · rev. ' + (state.revision || 0)), rankingBloqueado ? false : true);
    atualizarBloqueioDados();
    render();
    return true;
  }catch(e){
    console.error('Erro ao carregar dados', e);
    // IMPORTANTE: não substitui `state` por vazio. Mantém em memória o último
    // snapshot conhecido e bloqueia toda mutação até uma carga válida.
    ultimoErroCarga = e && e.message ? e.message : String(e);
    loaded = false;
    rankingBloqueado = true;
    setStatus('dados não carregados — edição bloqueada', false);
    atualizarBloqueioDados();
    return false;
  }
}

let saveTimeout = null;
let saveInFlight = null;
let saveRequested = false;
let stateDirty = false;
let conflitoAvisado = false;

function clonarSnapshotRanking(){
  return JSON.parse(JSON.stringify(state));
}

function saveState(opcoes){
  if(!souAdmin()) return;
  stateDirty = true;
  if(!loaded || rankingBloqueado) return;
  clearTimeout(saveTimeout);
  const imediato = !!(opcoes && opcoes.immediate);
  if(imediato){
    saveTimeout = null;
    return syncToServer(opcoes);
  }
  saveTimeout = setTimeout(()=>{
    saveTimeout = null;
    syncToServer().catch(()=>{});
  }, 250);
}

async function syncToServer(opcoes){
  const opts = opcoes || {};
  if(!souAdmin() || !loaded || rankingBloqueado) return false;
  if(saveInFlight){
    saveRequested = true;
    return saveInFlight;
  }
  if(!stateDirty) return true;

  saveInFlight = (async function(){
    let sucessoGeral = true;
    do{
      saveRequested = false;
      if(!stateDirty) break;

      const validacao = validarInvariantesRanking(state);
      if(!validacao.ok){
        rankingBloqueado = true;
        atualizarBloqueioDados();
        setStatus('estado inconsistente — gravação bloqueada', false);
        console.error('Snapshot inválido antes de salvar:', validacao.erro);
        return false;
      }

      const snapshot = clonarSnapshotRanking();
      const revisaoEnviada = Number(snapshot.revision) || 0;
      stateDirty = false;
      if(!opts.suppressUI) setStatus('salvando...', 'busy');

      try{
        const resposta = await chamarAPI(
          { action:'salvarRanking', token:sessaoUsuario.token, estado:snapshot },
          { keepalive: !!opts.keepalive }
        );
        if(!resposta.sucesso){
          if(tratarErroSessaoOuPermissao(resposta)) return false;
          if(resposta.codigo === 'REVISION_CONFLICT' || resposta.codigo === 'SERIES_META_CONFLICT'){
            syncConflict = true;
            rankingBloqueado = true;
            stateDirty = true;
            atualizarBloqueioDados();
            setStatus('conflito de versão — recarregue os dados', false);
            if(!conflitoAvisado && !opts.suppressUI){
              conflitoAvisado = true;
              alert('O ranking foi alterado por outra sessão. Para proteger os dados, a edição foi bloqueada. Recarregue a página para obter a versão mais recente antes de continuar.');
            }
            return false;
          }
          throw new Error(resposta.erro || 'Falha ao salvar');
        }

        const novaRevisao = Number(resposta.revision != null ? resposta.revision : (resposta.dados && resposta.dados.revision));
        if(Number.isFinite(novaRevisao) && novaRevisao >= revisaoEnviada) state.revision = novaRevisao;
        conflitoAvisado = false;
        if(!opts.suppressUI) setStatus('sincronizado · rev. ' + (state.revision || 0), true);
      }catch(e){
        sucessoGeral = false;
        stateDirty = true;
        console.error('Erro ao salvar no servidor', e);
        if(!opts.suppressUI) setStatus('erro ao sincronizar — alterações mantidas localmente', false);
        break;
      }
    }while(saveRequested || stateDirty);
    return sucessoGeral;
  })();

  try{
    return await saveInFlight;
  }finally{
    saveInFlight = null;
    if((saveRequested || stateDirty) && loaded && !rankingBloqueado && !opts.keepalive){
      saveRequested = false;
      syncToServer().catch(()=>{});
    }
  }
}

async function flushPendingSave(opcoes){
  clearTimeout(saveTimeout);
  saveTimeout = null;
  if(!stateDirty && !saveInFlight) return true;
  if(saveInFlight){
    try{ await saveInFlight; }catch(e){ /* segue para eventual nova tentativa */ }
  }
  if(!stateDirty) return true;
  return syncToServer(Object.assign({ immediate:true }, opcoes || {}));
}

async function recarregarRankingSeguro(){
  if(stateDirty && !await uiConfirm('Existem alterações locais ainda não sincronizadas. Recarregar descartará essas alterações.', { title:'Recarregar dados', variant:'danger', confirmText:'Descartar e recarregar' })) return false;
  return loadState();
}
