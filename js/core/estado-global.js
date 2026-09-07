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

/* --------------------------------------------------------------------------
   Escape de saída para HTML — usado por toda função de renderização que
   insere dado dinâmico (nome de participante, nome/e-mail de usuário,
   texto de resumo salvo etc.) dentro de innerHTML via template string.

   Sem isso, um nome de participante ou de usuário contendo algo como
   `<img src=x onerror=...>` seria interpretado como HTML de verdade pelo
   navegador (XSS armazenado) assim que qualquer tela redesenhasse aquele
   nome — inclusive o painel de administração de Usuários, o que é
   especialmente grave (rodaria com a sessão do administrador).

   Use contexto:'texto' (padrão) para conteúdo de texto normal entre tags
   (ex.: ${escapeHtml(p.name)} dentro de <td>...</td>), e contexto:'atributo'
   quando o valor vai dentro de um atributo entre aspas (ex.: value="${...}"
   ou dentro de um onclick="...('${...}')"), pois esse contexto também
   precisa escapar aspas simples/duplas para não permitir que o valor
   "escape" do atributo. -------------------------------------------------------------------------- */
function escapeHtml(valor, contexto = 'texto'){
  if(valor === null || valor === undefined) return '';

  let resultado = String(valor)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  if(contexto === 'atributo'){
    resultado = resultado
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/`/g, '&#96;');
  }

  return resultado;
}
