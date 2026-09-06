
/* V104 — compatibilidade de transporte:
   mantém state.x/state.y e toda a mecânica existente do front-end, mas adapta
   apenas a fronteira com o backend que agora exige estado.divisoes. */
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

    // O backend oficial mais recente devolve `divisoes`, enquanto esta camada
    // visual continua usando internamente o estado legado x/y. Fazemos a
    // conversão somente na fronteira da API, sem alterar a mecânica restante.
    if(carregado && typeof carregado.days === "number" && Array.isArray(carregado.divisoes)){
      const faixaX = carregado.divisoes.find(d => String(d && d.id).toLowerCase() === 'x');
      const faixaY = carregado.divisoes.find(d => String(d && d.id).toLowerCase() === 'y');
      state = {
        days: carregado.days,
        dayDates: Array.isArray(carregado.dayDates) ? carregado.dayDates : new Array(carregado.days).fill(null),
        x: faixaX && Array.isArray(faixaX.participantes) ? faixaX.participantes : [],
        y: faixaY && Array.isArray(faixaY.participantes) ? faixaY.participantes : []
      };
    } else if(carregado && typeof carregado.days === "number" && Array.isArray(carregado.x) && Array.isArray(carregado.y)){
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
    // O backend atual exige estado.divisoes. Para preservar toda a mecânica
    // interna existente (state.x/state.y), adaptamos somente o payload enviado.
    const estadoParaServidor = {
      days: Number(state.days) || 0,
      dayDates: Array.isArray(state.dayDates) ? state.dayDates : [],
      divisoes: [
        { id:'x', titulo:'Faixa X', intervalo:'0 a 19.999M', cor:'--x-color', participantes:Array.isArray(state.x) ? state.x : [] },
        { id:'y', titulo:'Faixa Y', intervalo:'20M ou mais', cor:'--y-color', participantes:Array.isArray(state.y) ? state.y : [] }
      ]
    };
    const resposta = await chamarAPI({ action:'salvarRanking', token:sessaoUsuario.token, estado: estadoParaServidor });
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
