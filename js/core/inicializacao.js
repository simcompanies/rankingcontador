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
let modulosHtmlPromise = null;
window.rgModulosPromise = null;

const MODULOS_HTML = [
  { arquivo: 'modules/modulo-0.html',               fallback: 'modulo-0.html',               slot: 'slot-modulo-0' },
  { arquivo: 'modules/troca-de-senha.html',         fallback: 'troca-de-senha.html',         slot: 'slot-troca-senha' },
  { arquivo: 'modules/modulo-1.html',               fallback: 'modulo-1.html',               slot: 'slot-modulo-1' },
  { arquivo: 'modules/modulo-2.html',               fallback: 'modulo-2.html',               slot: 'slot-modulo-2' },
  { arquivo: 'modules/modulo-5.html',               fallback: 'modulo-5.html',               slot: 'slot-modulo-5' },
  { arquivo: 'modules/modulo-3.html',               fallback: 'modulo-3.html',               slot: 'slot-modulo-3' },
  { arquivo: 'modules/modulo-4.html',               fallback: 'modulo-4.html',               slot: 'slot-modulo-4' },
  { arquivo: 'modules/conteudo.html',               fallback: 'conteudo.html',               slot: 'slot-conteudo' },
  { arquivo: 'modules/configuracoes-de-conta.html', fallback: 'configuracoes-de-conta.html', slot: 'slot-configuracoes-conta' },
];

// Busca todos os fragmentos de HTML em paralelo (nenhum depende do
// conteúdo de outro) e injeta cada um no seu slot. Se algum fetch falhar
// (ex.: rodando via file:// sem servidor local — ver aviso acima), mostra
// uma mensagem de erro visível naquele slot em vez de deixar a tela em
// branco silenciosamente.
async function carregarModulosHtml(){
  modulosHtmlComFalha = [];
  await Promise.all(MODULOS_HTML.map(async function(modulo){
    const el = document.getElementById(modulo.slot);
    if(!el) return;

    // Login e troca de senha são críticos para o primeiro carregamento.
    // Eles já vêm embutidos no index.html para não depender de fetch assíncrono.
    if((modulo.slot === 'slot-modulo-0' && document.getElementById('auth-gate')) ||
       (modulo.slot === 'slot-troca-senha' && document.getElementById('modal-nova-senha'))) return;

    try{
      let resposta = await fetch('./' + modulo.arquivo, { cache: 'default', credentials: 'same-origin' });
      if(!resposta.ok && modulo.fallback){
        resposta = await fetch('./' + modulo.fallback, { cache: 'default', credentials: 'same-origin' });
      }
      if(!resposta.ok) throw new Error('HTTP ' + resposta.status);
      el.innerHTML = await resposta.text();
    }catch(erro){
      console.error('Falha ao carregar ' + modulo.arquivo, erro);
      modulosHtmlComFalha.push(modulo.arquivo);
      el.innerHTML = '<p style="padding:24px;color:#c0392b;font-family:monospace;">'
        + 'Não foi possível carregar o módulo HTML. Verifique se os arquivos existem na publicação do GitHub Pages.'
        + '</p>';
    }
  }));
  return modulosHtmlComFalha.slice();
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
    await navigator.serviceWorker.register('./sw.js', { scope:'./' });
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
  // Não esperamos os fragmentos para começar a restaurar sessão/dados.
  // A animação cobre a montagem enquanto rede e interface trabalham em paralelo.
  modulosHtmlPromise = carregarModulosHtml();
  window.rgModulosPromise = modulosHtmlPromise;
  modulosHtmlPromise.then(function(falhas){
    if(falhas.length) console.error('Interface incompleta; módulos não carregados:', falhas);
  });

  registrarServiceWorker();
  await iniciarApp(modulosHtmlPromise);
  atualizarEstadoRede();
}

function flushAoOcultar(){
  if(typeof flushPendingSave === 'function') flushPendingSave({ keepalive:true, suppressUI:true }).catch(()=>{});
}

document.addEventListener('DOMContentLoaded', iniciarAplicacao);
window.addEventListener('beforeunload', flushAoOcultar);
window.addEventListener('pagehide', flushAoOcultar);
document.addEventListener('visibilitychange', ()=>{ if(document.visibilityState==='hidden') flushAoOcultar(); });
window.addEventListener('online', atualizarEstadoRede);
window.addEventListener('offline', atualizarEstadoRede);
