/* ============================================================================
   planilha-mestra.js
   ----------------------------------------------------------------------------
   Ponte entre o estado em memória (state, em estado-global.js) e a Planilha
   Google mestra (via Apps Script): carregar o ranking ao entrar no app,
   salvar depois de qualquer alteração (com debounce, para não disparar uma
   chamada de rede a cada tecla) e sincronizar sob demanda.

   Uma única planilha compartilhada — nada fica salvo no navegador, exceto
   o token de sessão (sessionStorage, some ao fechar a aba).

   Depende de: config-api.js (chamarAPI, chamarAPIGet, tratarErroSessaoOuPermissao),
   estado-global.js (state, loaded), renderizacao.js (render).
   ============================================================================ */

// Atualiza o texto de status exibido perto do botão de salvar/sincronizar (ex.: "Salvando...", "Salvo").
function setStatus(text, ok){
  const el = document.getElementById('sync-status');
  if(el) el.textContent = text;
  const dot = document.getElementById('status-dot');
  if(dot) dot.style.background = ok === false ? 'var(--neg)' : (ok === 'busy' ? 'var(--y-color)' : 'var(--x-color)');
}

// Carrega o ranking da planilha mestra ao iniciar o app (ou ao trocar de sessão) e desenha a tela.
async function loadState(){
  if(!sessaoUsuario) return;
  setStatus('carregando dados...', 'busy');
  try{
    const resposta = await chamarAPIGet({ action:'listarRanking', token: sessaoUsuario.token });
    if(!resposta.sucesso){
      if(tratarErroSessaoOuPermissao(resposta)) return;
      throw new Error(resposta.erro || 'Falha ao carregar');
    }
    const carregado = resposta.dados;
    if(carregado && typeof carregado.days === "number" && Array.isArray(carregado.x) && Array.isArray(carregado.y)){
      state = carregado;
      if(!Array.isArray(state.dayDates)) state.dayDates = new Array(state.days).fill(null);
    } else {
      state = { days: 0, x: [], y: [], dayDates: [] };
    }
    setStatus('sincronizado ✓', true);
  }catch(e){
    console.error("Erro ao carregar dados", e);
    state = { days: 0, x: [], y: [], dayDates: [] };
    setStatus('erro ao carregar — recarregue a página para tentar de novo', false);
  }
  loaded = true;
  render();
}

// Timer do debounce de saveState — evita disparar uma gravação a cada pequena alteração.
let saveTimeout = null;

// Agenda a gravação do estado atual na planilha mestra (debounce de 600ms).
// Também é chamada diretamente, sem debounce relevante, pelos listeners de
// saída de página (beforeunload/pagehide/blur/visibilitychange) — ver
// inicializacao.js — para não perder alterações ao fechar/trocar de aba.
function saveState(){
  if(!souAdmin()) return;
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(syncToServer, 900);
}

// Execução de fato da gravação na planilha (POST via chamarAPI) — só é
// chamada pelo setTimeout agendado em saveState(), nunca diretamente.
async function syncToServer(){
  if(!souAdmin()) return;
  setStatus('salvando...', 'busy');
  try{
    const resposta = await chamarAPI({ action:'salvarRanking', token:sessaoUsuario.token, estado: state });
    if(!resposta.sucesso){
      if(tratarErroSessaoOuPermissao(resposta)) return;
      throw new Error(resposta.erro || 'Falha ao salvar');
    }
    setStatus('sincronizado ✓', true);
  }catch(e){
    console.error("Erro ao salvar no servidor", e);
    setStatus('erro ao sincronizar — suas últimas alterações podem não ter sido salvas', false);
  }
}
