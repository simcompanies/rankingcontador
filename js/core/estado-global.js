/* ============================================================================
   estado-global.js
   ----------------------------------------------------------------------------
   Único lugar onde vivem as variáveis de estado verdadeiramente GLOBAIS da
   aplicação — ou seja, dado que mais de um módulo/tela precisa ler ou
   escrever (sessão do usuário logado, o ranking em si, rascunhos do
   formulário de lançamento, listas carregadas do backend).

   Convenção adotada nesta refatoração: estado que pertence a UMA única
   feature (ex.: os filtros de Análises Gerais, ou o timer de auto-save da
   Planilha Mestra) fica declarado dentro do próprio arquivo daquela feature,
   para manter a coesão — só o que é realmente compartilhado mora aqui.

   ----------------------------------------------------------------------------
   FAIXAS DINÂMICAS (v2) — mudança de arquitetura
   ----------------------------------------------------------------------------
   Antes, o ranking vivia hardcoded em duas propriedades fixas: state.x e
   state.y. Agora state.divisoes é um ARRAY de tamanho variável — cada item é
   uma "faixa": { id, titulo, intervalo, cor, participantes }. Isso é o que
   permite criar/renomear/remover faixas em tempo de execução (ver
   faixas-dinamicas.js) sem tocar em nenhum outro arquivo.

   `id` é o identificador ESTÁVEL usado em toda a aplicação (chaves de DOM
   como "head-<id>", chaves de draft, o valor gravado na coluna "Divisao" da
   planilha). `titulo`/`intervalo`/`cor` são só para exibição e podem mudar
   livremente (renomearFaixa). As duas faixas padrão ('x' e 'y') continuam
   existindo por padrão — nada muda para quem nunca criar uma faixa nova.

   obterDivisao()/obterTodasDivisoes(), abaixo, são os dois helpers que TODO
   o resto do app usa para nunca precisar saber quantas faixas existem ou
   quais são seus ids — troque `state.x`/`state.y` por
   `obterDivisao('x').participantes` sempre que for mexer em código antigo.

   Depende de: nada (é puro estado, sem lógica de UI). Deve carregar logo
   após config-api.js e antes de qualquer script que leia/altere estas
   variáveis.
   ============================================================================ */

// Sessão do usuário autenticado (token, id, nome, e-mail, papel).
// null enquanto ninguém está logado. Preenchida por aplicarSessao()
// (identidade.js) e limpa por encerrarSessaoLocal() (identidade.js).
let sessaoUsuario = null; // { token, idUsuario, nome, email, papel }

/* --------------------------------------------------------------------------
   Estado do ranking (a "planilha" em memória) e flags de carregamento geral.
   `divisoes` começa com Faixa X / Faixa Y (o padrão histórico do app) — isso
   é só o valor usado antes do primeiro loadState() responder; assim que a
   sessão carrega, este objeto é substituído pelo que vier do backend (ver
   loadState, em planilha-mestra.js).
   -------------------------------------------------------------------------- */
let state = {
  revision: 0,
  days: 0,
  dayDates: [],
  dayIds: [],
  seriesMeta: { currentId: 's_inicial', currentNumber: 1, maxDays: 7 },
  divisoes: [
    { id: 'x', titulo: 'Faixa X', intervalo: '0 a 19.999M', cor: '--x-color', participantes: [] },
    { id: 'y', titulo: 'Faixa Y', intervalo: '20M ou mais', cor: '--y-color', participantes: [] }
  ]
};

// true assim que o primeiro carregamento de state (loadState, em planilha-mestra.js) terminar.
let loaded = false;

// Enquanto true, nenhuma mutação do ranking é permitida. Só é liberado após
// loadState() concluir com um snapshot válido. Também é ativado em conflito
// de revisão para impedir sobrescrita silenciosa.
let rankingBloqueado = true;
let syncConflict = false;
let ultimoErroCarga = null;

// Linhas coladas na aba "Colar" ainda não confirmadas pelo usuário (ver colagem.js).
let pendingImport = null;

// Para onde o próximo processPaste()/confirmImport() vai gravar: 'new' ou o índice de um dia existente.
let pendingDayMode = 'new';

// Rascunho (não salvo) do formulário de lançamento do dia — ver
// formulario-lancamento-dia.js. Agora indexado pelo id de cada faixa, e não
// mais por 'x'/'y' fixos: draft[divId] = { participantIndex: valorDigitado },
// draftNew[divId] = [ {name, value}, ... ]. Populado por renderLaunchForm()
// a cada render(), então começa como objeto vazio.
let draft = {};

let draftNew = {};

/* --------------------------------------------------------------------------
   Cache dos dados do painel "Usuários" (Configurações Gerais) — ver usuarios.js.
   -------------------------------------------------------------------------- */
let usuariosRoster = [];

let atividadeLog = [];

// Evita recarregar a lista de usuários toda vez que a aba é aberta.
let usuariosCarregado = false;

/* --------------------------------------------------------------------------
   Cache do histórico de resumos salvos — ver resumos-salvos.js.
   -------------------------------------------------------------------------- */
let resumosSalvos = [];

// Evita recarregar o histórico de resumos toda vez que a aba é aberta.
let resumosCarregado = false;


/* Histórico de séries semanais encapsuladas (7 dias). Carregado sob demanda
   pela nova aba "Acumulado Geral". Não faz parte do snapshot editável do
   ranking atual: séries arquivadas são imutáveis no backend. */
let historicoSeries = [];
let historicoSeriesCarregado = false;
let encerramentoSerieEmAndamento = false;

function limiteDiasSerie(){
  return 7;
}

function serieAtualCompleta(){
  return Number(state && state.days || 0) >= limiteDiasSerie();
}

function dataReferenciaISO(valor){
  const texto = String(valor || '').trim();
  if(!/^\d{4}-\d{2}-\d{2}$/.test(texto)) return null;
  const d = new Date(texto + 'T12:00:00');
  if(Number.isNaN(d.getTime())) return null;
  return texto + 'T12:00:00.000';
}

function hojeLocalYMD(){
  const d = new Date();
  const pad = n => String(n).padStart(2,'0');
  return d.getFullYear() + '-' + pad(d.getMonth()+1) + '-' + pad(d.getDate());
}

function formatarDataCurta(valor){
  if(!valor) return 'sem data';
  const ymd = String(valor).slice(0,10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  return m ? (m[3] + '/' + m[2] + '/' + m[1]) : ymd;
}

/* --------------------------------------------------------------------------
   Helpers de papel/permissão, usados em todo o app para decidir o que
   renderizar (ex.: esconder botões de edição) e para bloquear ações restritas.
   -------------------------------------------------------------------------- */
function souAdmin(){
  return !!(sessaoUsuario && sessaoUsuario.papel === 'administrador');
}

// Bloqueia a ação corrente se o usuário logado não for administrador,
// mostrando um alerta. Devolve false quando bloqueou (quem chamou deve
// then "return" na sequência) e true quando pode prosseguir.
function exigirAdministrador(){
  if(!souAdmin()){ alert('Apenas administradores podem fazer essa alteração.'); return false; }
  if(typeof navigator !== 'undefined' && navigator.onLine === false){
    alert('Sem conexão com o servidor. Para proteger o ranking contra perda ou conflito de dados, alterações ficam bloqueadas enquanto você estiver offline.');
    return false;
  }
  if(typeof modulosHtmlComFalha !== 'undefined' && modulosHtmlComFalha.length){
    alert('A interface não foi carregada por completo. Recarregue a página antes de alterar o ranking.');
    return false;
  }
  if(!loaded || rankingBloqueado){
    alert(syncConflict
      ? 'A edição está bloqueada porque existe uma versão mais nova do ranking no servidor. Recarregue os dados antes de continuar.'
      : 'Aguarde o carregamento seguro dos dados antes de fazer alterações.');
    return false;
  }
  return true;
}

/* --------------------------------------------------------------------------
   Utilitários de segurança/formatação compartilhados por todo o app.
   -------------------------------------------------------------------------- */

// Escapa caracteres especiais de HTML (& < > " ') antes de inserir texto
// vindo do usuário (nome de participante, título de faixa, nome/e-mail de
// conta, texto de resumo...) em qualquer template usado com innerHTML —
// tanto em texto quanto dentro de atributos (value="", title=""), que são
// os dois jeitos de um nome malicioso virar HTML/JS executável (XSS
// armazenado — ver AUDITORIA_TESTES_E_MELHORIAS.md). Não mexe em quebras de
// linha (\n), então continua preservando a formatação de textos multi-linha
// (ex.: resumo dentro de <pre>). "&" precisa ser trocado primeiro, senão as
// entidades geradas pelas trocas seguintes ("&lt;") seriam escapadas de novo.
function escapeHtml(valor){
  if(valor === null || valor === undefined) return '';
  return String(valor)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Monta uma string estilo ISO (YYYY-MM-DDTHH:mm:ss.sss) a partir do horário
// LOCAL do navegador — ao contrário de `new Date().toISOString()` (sempre
// UTC), que "empurra" lançamentos feitos à noite (em fusos como UTC-3, a
// partir de ~21h) pra data do dia seguinte quando comparados com um
// <input type="date"> (que é sempre local, sem fuso — ver diasFiltrados,
// em filtros.js). Sem "Z"/offset no final, uma string com hora é
// interpretada de volta como horário LOCAL por `new Date(str)`, então o
// valor faz a ida e volta sem trocar de fuso dentro do navegador.
function dataLocalISO(data){
  const d = data instanceof Date ? data : new Date();
  const pad = (n, tamanho) => String(n).padStart(tamanho || 2, '0');
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
    'T' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds()) +
    '.' + pad(d.getMilliseconds(), 3);
}

/* --------------------------------------------------------------------------
   Helpers de DIVISÃO (faixas dinâmicas) — usados por praticamente todo o
   resto do app (participantes.js, dias.js, renderizacao.js, colagem.js,
   formulario-lancamento-dia.js, filtros.js, analises-dashboard.js,
   analises-gerais.js, texto-do-resumo.js, faixas-dinamicas.js).
   -------------------------------------------------------------------------- */

// Devolve o objeto da faixa com esse id, ou null se não existir.
function obterDivisao(divId){
  if(!state.divisoes || !Array.isArray(state.divisoes)) return null;
  return state.divisoes.find(d => d.id === divId) || null;
}

// Devolve todas as faixas como array (sempre seguro para .forEach/.map,
// mesmo que state.divisoes ainda não exista por algum motivo).
function obterTodasDivisoes(){
  return (state.divisoes && Array.isArray(state.divisoes)) ? state.divisoes : [];
}

/* Converte um `state` no formato ANTIGO (state.x / state.y — usado antes da
   v2, e ainda o formato que um backend não atualizado devolve) para o novo
   formato dinâmico (state.divisoes). Chamada por loadState() logo após
   receber os dados do backend (ver planilha-mestra.js). Se `estadoAntigo`
   já estiver no formato novo (tem state.divisoes), devolve como veio, sem
   tocar em nada. */
function migrarEstadoAntigo(estadoAntigo){
  if(!estadoAntigo) return estadoAntigo;
  if(Array.isArray(estadoAntigo.divisoes)) return estadoAntigo;
  if(!Array.isArray(estadoAntigo.x) && !Array.isArray(estadoAntigo.y)) return estadoAntigo;

  return {
    revision: Number(estadoAntigo.revision) || 0,
    days: estadoAntigo.days || 0,
    dayDates: estadoAntigo.dayDates || [],
    dayIds: estadoAntigo.dayIds || [],
    seriesMeta: estadoAntigo.seriesMeta || { currentId: 's_inicial', currentNumber: 1, maxDays: 7 },
    divisoes: [
      { id: 'x', titulo: 'Faixa X', intervalo: '0 a 19.999M', cor: '--x-color', participantes: estadoAntigo.x || [] },
      { id: 'y', titulo: 'Faixa Y', intervalo: '20M ou mais', cor: '--y-color', participantes: estadoAntigo.y || [] }
    ]
  };
}


/* --------------------------------------------------------------------------
   Integridade do snapshot e identidade estável de participantes.
   -------------------------------------------------------------------------- */
function normalizarNomeParticipante(nome){
  return String(nome || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR');
}

function gerarParticipantId(){
  if(typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'p_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2,12);
}

function criarParticipante(nome, dias, extras){
  const extra = extras || {};
  return {
    id: extra.id || gerarParticipantId(),
    name: String(nome || '').trim().replace(/\s+/g, ' '),
    createdAt: extra.createdAt || dataLocalISO(),
    scores: Array(Math.max(0, Number(dias) || 0)).fill(null)
  };
}

function encontrarParticipantePorId(participantId){
  if(!participantId) return null;
  for(const div of obterTodasDivisoes()){
    const idx = (div.participantes || []).findIndex(p => String(p.id) === String(participantId));
    if(idx >= 0) return { div, participante: div.participantes[idx], idx };
  }
  return null;
}

function encontrarParticipantesPorNome(nome){
  const alvo = normalizarNomeParticipante(nome);
  if(!alvo) return [];
  const achados = [];
  obterTodasDivisoes().forEach(div => {
    (div.participantes || []).forEach((p, idx) => {
      if(normalizarNomeParticipante(p.name) === alvo) achados.push({ div, participante:p, idx });
    });
  });
  return achados;
}

function nomeParticipanteEmUso(nome, participantIdIgnorado){
  return encontrarParticipantesPorNome(nome).some(a => String(a.participante.id) !== String(participantIdIgnorado || ''));
}

function parsePontuacao(valor){
  if(valor === null || valor === undefined) return null;
  const texto = String(valor).trim();
  if(!texto) return null;
  if(!/^-?\d+(?:[.,]\d+)?$/.test(texto)) return NaN;
  const numero = Number(texto.replace(',', '.'));
  if(!Number.isFinite(numero)) return NaN;
  return Math.min(numero, 10);
}

function normalizarSnapshotRanking(entrada){
  if(!entrada || typeof entrada !== 'object') throw new Error('Snapshot ausente.');
  const dias = Number(entrada.days);
  if(!Number.isInteger(dias) || dias < 0) throw new Error('Quantidade de dias inválida.');
  if(!Array.isArray(entrada.divisoes) || !entrada.divisoes.length) throw new Error('Nenhuma faixa válida encontrada.');

  const idsFaixa = new Set();
  const idsParticipante = new Set();
  const dayDates = Array.isArray(entrada.dayDates) ? entrada.dayDates.slice(0, dias) : [];
  while(dayDates.length < dias) dayDates.push(null);
  const dayIds = Array.isArray(entrada.dayIds) ? entrada.dayIds.slice(0, dias).map(v=>String(v||'')) : [];
  while(dayIds.length < dias) dayIds.push('d_' + gerarParticipantId().replace(/^p_/, ''));
  const dayIdSet = new Set();
  for(let i=0;i<dayIds.length;i++){
    if(!dayIds[i]) dayIds[i] = 'd_' + gerarParticipantId().replace(/^p_/, '');
    if(dayIdSet.has(dayIds[i])) throw new Error('ID de dia duplicado: ' + dayIds[i]);
    dayIdSet.add(dayIds[i]);
  }

  const metaEntrada = (entrada.seriesMeta && typeof entrada.seriesMeta === 'object') ? entrada.seriesMeta : {};
  let currentId = String(metaEntrada.currentId || '').trim();
  if(!currentId) currentId = 's_' + gerarParticipantId().replace(/^p_/, '');
  const currentNumber = Math.max(1, Math.trunc(Number(metaEntrada.currentNumber) || 1));
  const maxDays = 7;
  const seriesMeta = { currentId, currentNumber, maxDays };

  const divisoes = entrada.divisoes.map((div, ordem) => {
    const id = String(div && div.id || '').trim().toLowerCase();
    if(!/^[a-z][a-z0-9_]*$/.test(id)) throw new Error('ID de faixa inválido: ' + (id || '(vazio)'));
    if(idsFaixa.has(id)) throw new Error('ID de faixa duplicado: ' + id);
    idsFaixa.add(id);
    const participantes = Array.isArray(div.participantes) ? div.participantes.map(p => {
      const nome = String(p && p.name || '').trim().replace(/\s+/g, ' ');
      if(!nome) throw new Error('Participante com nome vazio na faixa ' + id + '.');
      let pid = String(p && p.id || '').trim();
      if(!pid) pid = gerarParticipantId();
      if(idsParticipante.has(pid)) throw new Error('ID de participante duplicado: ' + pid);
      idsParticipante.add(pid);
      const scoresIn = Array.isArray(p.scores) ? p.scores : [];
      const scores = Array.from({length:dias}, (_,i) => {
        const v = scoresIn[i];
        if(v === null || v === undefined || v === '') return null;
        const n = Number(v);
        if(!Number.isFinite(n)) throw new Error('Pontuação inválida para ' + nome + ' no dia ' + (i + 1) + '.');
        if(n > 10) throw new Error('Pontuação acima do limite (+10) para ' + nome + ' no dia ' + (i + 1) + '.');
        return n;
      });
      return { id:pid, name:nome, createdAt:p.createdAt || null, scores };
    }) : [];
    return {
      id,
      titulo: String(div.titulo || id),
      intervalo: String(div.intervalo || ''),
      cor: String(div.cor || '--panel-2'),
      participantes
    };
  });

  return {
    revision: Math.max(0, Number(entrada.revision) || 0),
    days: dias,
    dayDates,
    dayIds,
    seriesMeta,
    divisoes
  };
}

function validarInvariantesRanking(snapshot){
  try{
    const s = normalizarSnapshotRanking(snapshot);
    for(const div of s.divisoes){
      for(const p of div.participantes){
        if(p.scores.length !== s.days) throw new Error('Vetor de pontuação desalinhado.');
      }
    }
    return { ok:true, state:s };
  }catch(erro){
    return { ok:false, erro: erro.message || String(erro) };
  }
}

function cancelarEstadoPendenteEstrutural(motivo){
  if(pendingImport){
    pendingImport = null;
    pendingDayMode = 'new';
    const painel = document.getElementById('pending-panel');
    if(painel) painel.style.display = 'none';
    if(motivo) console.warn('Importação pendente cancelada:', motivo);
  }
}
