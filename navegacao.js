/* ============================================================================
   navegacao.js
   ----------------------------------------------------------------------------
   Controle de rotas internas da SPA: troca de módulo/tela principal
   (mostrarView) e troca de aba dentro do módulo "Lançar Pontuação"
   (switchLaunchTab, entre "Preencher" e "Colar").

   Depende de: estado-global.js (souAdmin), identidade.js/usuarios.js/
   resumos-salvos.js/gerenciar-dias-lancados.js (as telas chamam funções de
   carregamento sob demanda ao entrar em cada view — ver mostrarView).
   ============================================================================ */

// Lista de ids de <section class="view"> que qualquer usuário logado pode
// ver, e a lista estendida (VIEWS_ADMIN) que inclui a view exclusiva de
// administrador ("config" = Configurações Gerais / painel de usuários).
const VIEWS = ['faixas','analises','lancar','config','conta'];

const VIEWS_ADMIN = ['lancar','config'];

// Troca o módulo principal visível: esconde todas as views, mostra só
// `nome`, marca o item correspondente na sidebar como ativo e, para as
// views que dependem de dado carregado sob demanda (resumos, usuários,
// dias lançados), dispara o carregamento na hora em que a view é aberta.
function mostrarView(nome){
  if(VIEWS_ADMIN.indexOf(nome) !== -1 && !souAdmin()) nome = 'faixas';
  VIEWS.forEach(function(v){
    const el = document.getElementById('view-'+v);
    if(el) el.classList.toggle('hidden', v !== nome);
  });
  document.querySelectorAll('.side-link').forEach(function(btn){
    btn.classList.toggle('active', btn.dataset.view === nome);
  });
  if(nome === 'config') carregarUsuariosSeNecessario();
  if(nome === 'config' || nome === 'analises') carregarResumosSeNecessario();
  if(nome === 'analises'){ popularFiltroDias(); aplicarFiltroAnalises(); }
  if(nome === 'conta') renderContaView();
  toggleSidebarMobile(false);
}

// Alterna entre as abas "Preencher formulário" e "Colar" dentro do módulo
// Lançar Pontuação — puramente visual (mostra/esconde), sem tocar em dado.
function switchLaunchTab(tab){
  const formView = document.getElementById('launch-view-form');
  const pasteView = document.getElementById('launch-view-paste');
  const tabForm = document.getElementById('tab-form');
  const tabPaste = document.getElementById('tab-paste');
  if(tab === 'paste'){
    formView.style.display = 'none';
    pasteView.style.display = '';
    tabForm.classList.remove('active');
    tabPaste.classList.add('active');
  } else {
    formView.style.display = '';
    pasteView.style.display = 'none';
    tabForm.classList.add('active');
    tabPaste.classList.remove('active');
  }
}
