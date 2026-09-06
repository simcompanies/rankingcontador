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

   Depende de: nada (é puro estado, sem lógica). Deve carregar logo após
   config-api.js e antes de qualquer script que leia/altere estas variáveis.
   ============================================================================ */

// Sessão do usuário autenticado (token, id, nome, e-mail, papel).
// null enquanto ninguém está logado. Preenchida por aplicarSessao()
// (identidade.js) e limpa por encerrarSessaoLocal() (identidade.js).
let sessaoUsuario = null; // { token, idUsuario, nome, email, papel }

/* --------------------------------------------------------------------------
   Estado do ranking (a "planilha" em memória) e flags de carregamento geral.
   -------------------------------------------------------------------------- */
let state = { days: 0, x: [], y: [], dayDates: [] };

// true assim que o primeiro carregamento de state (loadState, em planilha-mestra.js) terminar.
let loaded = false;

// Linhas coladas na aba "Colar" ainda não confirmadas pelo usuário (ver colagem.js).
let pendingImport = null;

// Para onde o próximo processPaste()/confirmImport() vai gravar: 'new' ou o índice de um dia existente.
let pendingDayMode = 'new';

// Rascunho (não salvo) do formulário de lançamento do dia — ver
// formulario-lancamento-dia.js. draft = valores digitados para participantes
// já cadastrados; draftNew = linhas de participantes novos sendo criados.
let draft = { x:{}, y:{} };

let draftNew = { x:[], y:[] };

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
