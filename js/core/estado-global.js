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
  days: 0,
  dayDates: [],
  divisoes: [
    { id: 'x', titulo: 'Faixa X', intervalo: '0 a 19.999M', cor: '--x-color', participantes: [] },
    { id: 'y', titulo: 'Faixa Y', intervalo: '20M ou mais', cor: '--y-color', participantes: [] }
  ]
};

// true assim que o primeiro carregamento de state (loadState, em planilha-mestra.js) terminar.
let loaded = false;

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
    days: estadoAntigo.days || 0,
    dayDates: estadoAntigo.dayDates || [],
    divisoes: [
      { id: 'x', titulo: 'Faixa X', intervalo: '0 a 19.999M', cor: '--x-color', participantes: estadoAntigo.x || [] },
      { id: 'y', titulo: 'Faixa Y', intervalo: '20M ou mais', cor: '--y-color', participantes: estadoAntigo.y || [] }
    ]
  };
}
