const CACHE_PREFIX='ranking-contador-';
const CACHE_NAME=CACHE_PREFIX+'v58-series-editaveis';
const APP_SHELL=[
  './','./index.html','./manifest.webmanifest','./feature-manifest.json','./assets/css/app.css',
  './js/a11y/a11y.js','./js/a11y/acessibilidade.js','./js/core/rg-motion.js','./js/core/startup-motion.js',
  './js/core/config-api.js','./js/core/dialogos.js','./js/core/estado-global.js','./js/core/identidade.js',
  './js/core/navegacao.js','./js/core/sidebar.js','./js/core/renderizacao.js','./js/core/inicializacao.js',
  './js/features/configuracoes-de-conta.js','./js/features/modulo-0.js','./js/features/texto-do-resumo.js',
  './js/features/colagem.js','./js/features/colagem-gemini.js','./js/features/planilha-mestra.js',
  './js/features/series-semanais.js','./js/features/participantes.js','./js/features/dias.js',
  './js/features/formulario-lancamento-dia.js','./js/features/analises-gerais.js','./js/features/filtros.js',
  './js/features/analises-dashboard.js','./js/features/gerenciar-dias-lancados.js','./js/features/organizacao-ui.js',
  './js/features/resumos-salvos.js','./js/features/usuarios.js','./assets/icons/icon-192.png','./assets/icons/icon-512.png',
  './assets/icons/icon-maskable-512.png','./assets/logo-ranking-geral.png'
];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE_NAME).then(c=>c.addAll(APP_SHELL)));self.skipWaiting();});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(names=>Promise.all(names.filter(n=>n.startsWith(CACHE_PREFIX)&&n!==CACHE_NAME).map(n=>caches.delete(n)))));self.clients.claim();});
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET') return;
  const u=new URL(e.request.url); if(u.origin!==self.location.origin) return;
  e.respondWith(fetch(e.request).then(r=>{if(r&&r.ok){const cp=r.clone();caches.open(CACHE_NAME).then(c=>c.put(e.request,cp));}return r;}).catch(()=>caches.match(e.request)));
});
