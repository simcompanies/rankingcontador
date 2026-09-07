/* ============================================================================
   sw.js — Service Worker do "Ranking Geral"
   ----------------------------------------------------------------------------
   Objetivo simples e seguro: cachear o "app shell" (HTML/CSS/JS/fragmentos
   de módulo) para que o app abra rápido e funcione mesmo com internet
   instável ou offline. NÃO cacheia chamadas à API (Google Apps Script) —
   login, salvar ranking etc. sempre precisam de rede, e interceptar essas
   respostas poderia mostrar dado desatualizado ou quebrar o fluxo de sessão.

   Ao alterar qualquer arquivo do app shell, troque o número da versão em
   CACHE_NAME (ex.: 'ranking-geral-v27-static-logo') — isso força os usuários a
   baixarem a versão nova em vez de continuarem presos no cache antigo.
   ============================================================================ */

const CACHE_NAME = 'ranking-contador-v27-static-logo-static-logo';

const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './assets/css/style.css',
  './modules/modulo-0.html',
  './modules/troca-de-senha.html',
  './modules/modulo-1.html',
  './modules/modulo-2.html',
  './modules/modulo-3.html',
  './modules/modulo-4.html',
  './modules/configuracoes-de-conta.html',
  './modulo-0.html',
  './troca-de-senha.html',
  './modulo-1.html',
  './modulo-2.html',
  './modulo-3.html',
  './modulo-4.html',
  './configuracoes-de-conta.html',
  './js/a11y/a11y.js',
  './js/a11y/acessibilidade.js',
  './js/core/config-api.js',
  './js/core/estado-global.js',
  './js/core/identidade.js',
  './js/core/navegacao.js',
  './js/core/sidebar.js',
  './js/core/renderizacao.js',
  './js/core/inicializacao.js',
  './js/features/configuracoes-de-conta.js',
  './js/features/modulo-0.js',
  './js/features/texto-do-resumo.js',
  './js/features/colagem.js',
  './js/features/colagem-ocr.js',
  './js/features/planilha-mestra.js',
  './js/features/participantes.js',
  './js/features/dias.js',
  './js/features/formulario-lancamento-dia.js',
  './js/features/analises-gerais.js',
  './js/features/filtros.js',
  './js/features/analises-dashboard.js',
  './js/features/gerenciar-dias-lancados.js',
  './js/features/resumos-salvos.js',
  './js/features/usuarios.js',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/icon-maskable-512.png',
  './assets/logo-ranking-geral.png',
];

self.addEventListener('install', (evento) => {
  evento.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches.keys().then((nomes) =>
      Promise.all(
        nomes
          .filter((nome) => nome !== CACHE_NAME)
          .map((nome) => caches.delete(nome))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (evento) => {
  const url = new URL(evento.request.url);

  // Só intercepta GET do mesmo domínio (o app shell). Chamadas à API do
  // Google Apps Script (outro domínio) e requisições não-GET passam direto
  // pela rede, sem cache — são sempre lançamento/leitura de dado ao vivo.
  if (evento.request.method !== 'GET' || url.origin !== self.location.origin) {
    return;
  }

  const isCritical = url.pathname.endsWith('/index.html') || url.pathname.endsWith('/sw.js') || url.pathname.endsWith('/manifest.webmanifest');
  if(isCritical){
    evento.respondWith(
      fetch(evento.request).then((respostaRede) => {
        if(respostaRede && respostaRede.ok){
          const copia = respostaRede.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(evento.request, copia));
        }
        return respostaRede;
      }).catch(() => caches.match(evento.request))
    );
    return;
  }

  evento.respondWith(
    caches.match(evento.request).then((respostaCache) => {
      const buscaRede = fetch(evento.request)
        .then((respostaRede) => {
          if (respostaRede && respostaRede.ok) {
            const copia = respostaRede.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(evento.request, copia));
          }
          return respostaRede;
        })
        .catch(() => respostaCache);
      return respostaCache || buscaRede;
    })
  );
});
