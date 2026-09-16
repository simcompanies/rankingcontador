/* ============================================================================
   inicializacao.js
   ----------------------------------------------------------------------------
   Ponto de entrada da aplicação. ÚLTIMO script a carregar (depois de todos
   os outros, que só declaram funções/estado e não executam nada sozinhos).

   Faz, nesta ordem, ao evento DOMContentLoaded:
     1) carregarModulosHtml() — busca (fetch) o HTML de cada módulo
        (modulo-0.html, modulo-1.html... troca-de-senha.html,
        configuracoes-de-conta.html) e injeta cada um no seu slot dentro de
        index.html. Isso é infraestrutura NOVA desta refatoração: no
        arquivo monolítico original esse HTML já vinha todo embutido na
        página, então nada precisava ser buscado antes de iniciar.
     2) iniciarApp() — o início original do app (restaura a sidebar
        recolhida, tenta restaurar uma sessão salva, carrega o ranking).
        Só pode rodar DEPOIS do passo 1, pois usa elementos como #auth-gate
        que só existem depois de modulo-0.html ser injetado.

   Depende de literalmente todos os outros arquivos JS (é o único que
   chama funções de módulos de UI específicos) — por isso deve ser o
   ÚLTIMO <script src="..."> antes do fechamento de </body> em index.html.

   ATENÇÃO AO TESTAR LOCALMENTE: como carregarModulosHtml() usa fetch()
   para buscar os .html, abrir o index.html direto do disco (file://) faz
   o navegador bloquear essas requisições por segurança (CORS), e os
   módulos não aparecem. Sirva a pasta com um servidor local simples, por
   exemplo "python -m http.server" ou a extensão "Live Server" do VS Code,
   e acesse via http://localhost — em qualquer hospedagem HTTP real
   (GitHub Pages incluso) isso já funciona sem nenhum passo extra.
   ============================================================================ */

// Cada entrada liga um arquivo de módulo HTML ao <div id="..."> (o "slot")
// de index.html onde seu conteúdo deve ser injetado. Os ids de slot aqui
// precisam bater exatamente com os ids usados em index.html.
let modulosHtmlComFalha = [];
let modulosHtmlPromise = Promise.resolve([]);
window.rgModulosPromise = modulosHtmlPromise;

// v57 consolidada: todos os módulos essenciais já estão embutidos no index.html.
// Mantemos esta função por compatibilidade com testes/código legado, mas ela não
// faz rede nem altera o DOM. Isso elimina desaparecimento de telas por falha de fetch.
function sanitizarFragmentoHtmlModulo(html){
  const bruto = String(html == null ? '' : html);
  try{
    const tpl = document.createElement('template');
    tpl.innerHTML = bruto;
    tpl.content.querySelectorAll('script').forEach(function(script){ script.remove(); });
    return tpl.innerHTML;
  }catch(erro){
    return bruto.replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, '');
  }
}
window.sanitizarFragmentoHtmlModulo = sanitizarFragmentoHtmlModulo;
async function carregarModulosHtml(){
  try{ window.dispatchEvent(new CustomEvent('rg:modules-loaded', {detail:{falhas:[]}})); }catch(_){ }
  return [];
}

async function obterBootstrapSessao(token){
  // v47: tenta a rota combinada (1 viagem ao Apps Script). Se o backend ainda
  // não foi republicado, usa sessão + ranking em paralelo em vez de sequencial.
  try{
    const combinado = await chamarAPIGet({ action:'bootstrap', token:token });
    if(combinado && combinado.sucesso && combinado.dados && combinado.dados.sessao && combinado.dados.ranking){
      return combinado.dados;
    }
    if(combinado && combinado.codigo === 'SESSAO_EXPIRADA') throw new Error('Sessão expirada');
  }catch(erro){
    console.warn('Bootstrap combinado indisponível; usando compatibilidade paralela.', erro && erro.message ? erro.message : erro);
  }

  const resultados = await Promise.all([
    chamarAPIGet({ action:'verificarSessao', token:token }),
    chamarAPIGet({ action:'listarRanking', token:token })
  ]);
  const sessao = resultados[0], ranking = resultados[1];
  if(!sessao || !sessao.sucesso) throw new Error((sessao && sessao.erro) || 'Sessão inválida');
  if(!ranking || !ranking.sucesso) throw new Error((ranking && ranking.erro) || 'Não foi possível carregar o ranking');
  return { sessao:sessao.dados, ranking:ranking.dados };
}

async function iniciarApp(promessaModulos){
  document.body.setAttribute('data-app-screen', 'auth');
  if(localStorage.getItem('rankingGeral_sidebarCollapsed') === '1') toggleSidebarCollapse();

  const tokenSalvo = sessionStorage.getItem('rankingGeral_token');
  if(!tokenSalvo){
    document.getElementById('auth-gate')?.classList.remove('hidden');
    if(window.RGStartup){ window.RGStartup.status('Interface pronta', 100); window.RGStartup.done('Pronto para entrar'); }
    return;
  }

  try{
    if(window.RGStartup) window.RGStartup.status('Restaurando sua sessão…', 32);
    // Rede e HTML dos módulos carregam ao mesmo tempo durante a animação.
    const bootstrapPromise = obterBootstrapSessao(tokenSalvo);
    const resultados = await Promise.all([bootstrapPromise, promessaModulos || Promise.resolve([])]);
    const bootstrap = resultados[0];
    if(window.RGStartup) window.RGStartup.status('Montando seu painel…', 86);

    const perfil = bootstrap.sessao || {};
    sessaoUsuario = {
      token: tokenSalvo,
      idUsuario: perfil.idUsuario,
      nome: perfil.nome,
      email: perfil.email,
      papel: perfil.papel
    };
    document.getElementById('auth-gate')?.classList.add('hidden');
    document.getElementById('app-shell')?.classList.remove('hidden');
    document.body.setAttribute('data-app-screen', 'app');
    aplicarPermissoesPapel();
    atualizarBarraIdentidade();
    mostrarView('faixas');

    const ok = aplicarRankingRecebido(bootstrap.ranking);
    if(!ok) throw new Error(ultimoErroCarga || 'Não foi possível aplicar os dados do ranking.');
    if(window.RGStartup) window.RGStartup.done('Painel pronto');
  }catch(erro){
    console.error('Sessão salva inválida ou expirada', erro);
    encerrarSessaoLocal();
    if(window.RGStartup) window.RGStartup.done('Faça login para continuar');
  }
}

// Ponto de entrada real, ligado ao DOMContentLoaded lá embaixo: primeiro
// monta o HTML dos módulos, só então roda a inicialização original do app.
async function registrarServiceWorker(){
  if(!('serviceWorker' in navigator)) return;
  if(location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') return;
  try{
    const registro = await navigator.serviceWorker.register('./sw.js', { scope:'./' });
    // Força a checagem do SW novo sem recarregar a página durante a abertura.
    registro.update().catch(()=>{});
  }catch(erro){
    console.warn('Service Worker não pôde ser registrado.', erro);
  }
}

function atualizarEstadoRede(){
  const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
  document.body?.toggleAttribute('data-offline', offline);
  if(offline){
    setStatus('offline — alterações bloqueadas', false);
    return;
  }
  if(loaded && !rankingBloqueado && !syncConflict) setStatus('sincronizado · rev. ' + (state.revision || 0), true);
}

function configurarViewportPWA(){
  const aplicar = function(){
    const vv = window.visualViewport;
    const altura = vv ? vv.height : window.innerHeight;
    document.documentElement.style.setProperty('--rg-viewport-height', Math.round(altura) + 'px');
    const teclado = vv ? (window.innerHeight - vv.height > 140) : false;
    document.body && document.body.toggleAttribute('data-keyboard-open', !!teclado);
  };
  aplicar();
  window.addEventListener('resize', aplicar, {passive:true});
  window.addEventListener('orientationchange', aplicar, {passive:true});
  if(window.visualViewport){
    window.visualViewport.addEventListener('resize', aplicar, {passive:true});
    window.visualViewport.addEventListener('scroll', aplicar, {passive:true});
  }
}

async function iniciarAplicacao(){
  configurarViewportPWA();
  // v57: o HTML essencial já está no DOM; inicializamos sessão/dados imediatamente.
  modulosHtmlPromise = carregarModulosHtml();
  window.rgModulosPromise = modulosHtmlPromise;
  registrarServiceWorker();
  await iniciarApp(modulosHtmlPromise);
  atualizarEstadoRede();
}

function flushAoOcultar(){
  if(typeof flushPendingSave === 'function') flushPendingSave({ keepalive:true, suppressUI:true }).catch(()=>{});
}

if(document.readyState === 'loading'){
  // O script já está no fim do <body>: todos os slots necessários já existem.
  // Inicia na próxima microtarefa para antecipar rede/módulos enquanto a animação roda.
  Promise.resolve().then(iniciarAplicacao);
}else{
  iniciarAplicacao();
}
window.addEventListener('beforeunload', flushAoOcultar);
window.addEventListener('pagehide', flushAoOcultar);
document.addEventListener('visibilitychange', ()=>{ if(document.visibilityState==='hidden') flushAoOcultar(); });
window.addEventListener('online', atualizarEstadoRede);
window.addEventListener('offline', atualizarEstadoRede);
