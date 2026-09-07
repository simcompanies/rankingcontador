/* ============================================================================
   planilha-mestra.js
   ----------------------------------------------------------------------------
   Ponte entre o estado em memória (state, em estado-global.js) e a Planilha
   Google mestra (via Apps Script): carregar o ranking ao entrar no app,
   salvar depois de qualquer alteração (com debounce, para não disparar uma
   chamada de rede a cada tecla) e sincronizar sob demanda.

   Uma única planilha compartilhada — nada fica salvo no navegador, exceto
   o token de sessão (sessionStorage, some ao fechar a aba).

   FAIXAS DINÂMICAS: o backend pode devolver o ranking em dois formatos —
   o novo (`dados.divisoes`, se o Code.gs já foi atualizado nesta versão) ou
   o antigo (`dados.x`/`dados.y`, formato usado antes desta refatoração).
   migrarEstadoAntigo() (estado-global.js) normaliza os dois para o mesmo
   formato interno, então o resto do app nunca precisa saber qual dos dois
   o backend realmente devolveu.

   Depende de: config-api.js (chamarAPI, chamarAPIGet, tratarErroSessaoOuPermissao),
   estado-global.js (state, loaded, migrarEstadoAntigo), renderizacao.js (render).
   ============================================================================ */

// Estado inicial "vazio" (Faixa X / Faixa Y sem participantes) — usado tanto
// como fallback de erro quanto quando o backend não devolve nada aproveitável.
function estadoVazioPadrao(){
  return {
    days: 0,
    dayDates: [],
    divisoes: [
      { id: 'x', titulo: 'Faixa X', intervalo: '0 a 19.999M', cor: '--x-color', participantes: [] },
      { id: 'y', titulo: 'Faixa Y', intervalo: '20M ou mais', cor: '--y-color', participantes: [] }
    ]
  };
}

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
    const formatoValido = carregado && typeof carregado.days === "number" &&
      (Array.isArray(carregado.divisoes) || (Array.isArray(carregado.x) && Array.isArray(carregado.y)));

    if(formatoValido){
      state = migrarEstadoAntigo(carregado);
      if(!Array.isArray(state.dayDates)) state.dayDates = new Array(state.days).fill(null);
      if(!Array.isArray(state.divisoes) || !state.divisoes.length){
        state.divisoes = estadoVazioPadrao().divisoes;
      }
    } else {
      state = estadoVazioPadrao();
    }
    setStatus('sincronizado ✓', true);
  }catch(e){
    console.error("Erro ao carregar dados", e);
    state = estadoVazioPadrao();
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
// chamada pelo setTimeout agendado em saveState(), nunca diretamente. Envia
// `state` inteiro, agora com `divisoes` no lugar de `x`/`y` — exige que o
// Code.gs publicado já esteja na versão que entende `estado.divisoes` (ver
// nota no topo do arquivo e o resumo de implementação).
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
