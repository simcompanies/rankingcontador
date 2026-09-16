#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const ROOT=path.resolve(__dirname,'..'), read=r=>fs.readFileSync(path.join(ROOT,r),'utf8');
let total=0,fail=0;function ok(d,c){total++;if(c)console.log('OK  '+d);else{fail++;console.error('FALHA '+d);}}
const index=read('index.html'),startup=read('js/core/startup-motion-v56.js'),motion=read('js/core/rg-motion-v56.js'),sw=read('sw.js'),api=read('js/core/config-api-v56.js'),mod3=read('modules/modulo-3.html'),nav=read('js/core/navegacao.js');
ok('motor original mantém duração 6,4 s',/DURATION\s*=\s*6\.4/.test(motion));
ok('splash contém somente canvas, fallback e pular abertura',/rg-startup-canvas/.test(index)&&/Pular abertura/.test(index)&&!/Posição da animação/.test(index)&&!/id="timeline"/.test(index)&&!/id="theme"/.test(index)&&!/id="glow"/.test(index)&&!/id="speed"/.test(index));
ok('não existe player de demonstração no pacote',!fs.existsSync(path.join(ROOT,'referencias','animacao-ranking-geral-aprovada.html')));
ok('splash ocupa a viewport inteira em desktop e mobile',/#rg-startup\{[^}]*width:100vw[^}]*height:100dvh/.test(index)&&/\.rg-startup-stage\{[^}]*width:100vw[^}]*height:100dvh/.test(index));
ok('DPR máximo 2 igual ao player original',/Math\.min\(2,window\.devicePixelRatio\|\|1\)/.test(startup));
ok('tema escuro, glow intenso e velocidade 1x',/theme:'dark',glow:INTENSE_GLOW/.test(startup)&&/INTENSE_GLOW=1/.test(startup)&&/time\+\(now-last\)\/1000/.test(startup));
ok('primeiro quadro é pintado antes do relógio avançar',/Duplo RAF/.test(startup)&&/time=0;[\s\S]*paint\(\);[\s\S]*requestAnimationFrame/.test(startup));
ok('motion=false explícito impede salto indevido ao quadro final',/explicitMotion===false\) return false/.test(startup));
ok('sem escolha explícita, preferência do sistema continua respeitada',/explicitMotion===null/.test(startup)&&/motionMedia&&motionMedia\.matches/.test(startup));
ok('animação não reabre no login/cadastro',/show:function\(text\)\{announce/.test(startup));
ok('app pronto só fecha após animação ou skip/reduced',/\(finished\|\|skipped\|\|shouldReduce\(\)\)&&appReady/.test(startup));
ok('carregamento em paralelo permanece',/rgModulosPromise/.test(read('js/core/inicializacao.js'))&&/Promise\.all\(\[rankingPromise, interfacePromise\]\)/.test(read('js/core/identidade.js')));
ok('Escape e redução de movimento são suportados',/prefers-reduced-motion/.test(startup)&&/e\.key==='Escape'/.test(startup));
ok('há live region e botão acessível de pular',/role="status"/.test(index)&&/aria-label="Pular animação de abertura"/.test(index));
ok('link de salto fica oculto até foco de teclado',/\.skip-link\{[^}]*transform:translateY/.test(index)&&/\.skip-link:focus-visible/.test(index));
ok('abas de lançamento preservam semântica',/role="tablist"/.test(mod3)&&/role="tabpanel"/.test(mod3));
ok('index usa nomes físicos v56 para escapar do cache antigo',/rg-motion-v56\.js/.test(index)&&/startup-motion-v56\.js/.test(index)&&/config-api-v56\.js/.test(index)&&/style-v56\.css/.test(index));
ok('service worker v56 trata boot crítico em network-first',/v56-live-server-paste-fix/.test(sw)&&/rg-motion-v56\.js/.test(sw)&&/startup-motion-v56\.js/.test(sw)&&/config-api-v56\.js/.test(sw)&&/if\(isCritical\)[\s\S]*fetch\(evento\.request\)/.test(sw));
ok('API atual preservada no arquivo físico v56',/AKfycbypHFgogRlqWGo00tNOyDNRqnzces3kUT7c_MQ81w8GlbFqHATie2uIW34R0UDWWFdfLw/.test(api));
ok('fallback oculto não cobre o canvas animado',/\.rg-startup-fallback\[hidden\]\{display:none!important\}/.test(index));
console.log(`\nRESULTADO STARTUP/A11Y: ${total-fail}/${total} passaram; ${fail} falha(s).`);if(fail)process.exit(1);
