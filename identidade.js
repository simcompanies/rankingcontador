/* ============================================================================
   identidade.js
   ----------------------------------------------------------------------------
   "Serviço" de identidade/sessão, usado pelo app inteiro (não só pela tela
   de login): aplicar uma sessão recém-obtida, encerrar sessão (logout local),
   aplicar as permissões do papel do usuário na interface, e manter a barra
   de identidade do topo (nome + papel + botão sair) atualizada.

   As telas de login/cadastro/esqueci-senha em si (os formulários do
   Módulo 0) ficam em modulo-0.js — este arquivo é a camada de sessão que
   modulo-0.js, navegacao.js e o botão "Sair" do topbar consomem.

   Depende de: config-api.js (chamarAPI/mostrarMsg), estado-global.js
   (sessaoUsuario, souAdmin), navegacao.js (mostrarView, VIEWS).
   ============================================================================ */

// Chamada ao concluir login/cadastro com sucesso: grava a sessão em memória
// e em sessionStorage (sobrevive a F5, mas não a fechar a aba), some com a
// tela de login e mostra a casca do app já no módulo correto para o papel.
function aplicarSessao(dados){
  sessaoUsuario = { token: dados.token, idUsuario: dados.idUsuario, nome: dados.nome, email: dados.email, papel: dados.papel };
  sessionStorage.setItem('rankingGeral_token', dados.token);
  document.getElementById('auth-gate').classList.add('hidden');
  document.getElementById('app-shell').classList.remove('hidden');
  aplicarPermissoesPapel();
  atualizarBarraIdentidade();
  mostrarView('faixas');
  loadState();
}

// Clique em "Sair" no topbar: confirma, avisa o backend (best-effort) e
// limpa a sessão local, voltando para a tela de login.
async function handleLogout(){
  const token = sessaoUsuario ? sessaoUsuario.token : null;
  encerrarSessaoLocal();
  if(token){
    try{ await chamarAPI({ action:'logout', token:token }); }catch(erro){ /* já saímos localmente, sem problema */ }
  }
}

// Limpa toda vestígio da sessão no front-end (memória + sessionStorage) e
// devolve a UI para o estado "deslogado". Também é chamada quando o backend
// informa que o token expirou (ver tratarErroSessaoOuPermissao, config-api.js).
function encerrarSessaoLocal(){
  sessaoUsuario = null;
  loaded = false;
  sessionStorage.removeItem('rankingGeral_token');
  document.getElementById('app-shell').classList.add('hidden');
  document.getElementById('modal-nova-senha').classList.add('hidden');
  document.getElementById('auth-gate').classList.remove('hidden');
  mostrarAuthView('login');
}

// Esconde da interface tudo o que é exclusivo de administrador quando o
// usuário logado tem papel "membro" (ex.: botões de editar/remover,
// o módulo de Usuários). Chamada logo após aplicarSessao().
function aplicarPermissoesPapel(){
  const admin = souAdmin();
  document.querySelectorAll('[data-papel="administrador"]').forEach(function(el){
    el.classList.toggle('hidden', !admin);
  });
}

// Atualiza o trecho "Fulano · papel" no topbar. Chamada logo após uma
// sessão ser estabelecida — tanto em aplicarSessao() (login/cadastro
// novos) quanto em iniciarApp() (restauração de sessão salva ao recarregar
// a página), então nunca é chamada sem sessaoUsuario já preenchido.
function atualizarBarraIdentidade(){
  const el = document.getElementById('identity-status-texto');
  if(el && sessaoUsuario) el.textContent = sessaoUsuario.nome + ' · ' + sessaoUsuario.papel;
}
