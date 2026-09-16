#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path');
const ROOT=path.resolve(__dirname,'..');
const read=r=>fs.readFileSync(path.join(ROOT,r),'utf8');
let total=0,fail=0;
function ok(d,c){total++; if(c)console.log('OK  '+d); else{fail++;console.error('FALHA '+d);}}
const index=read('index.html'), startup=read('js/core/startup-motion.js'), motion=read('js/core/rg-motion.js'), sw=read('sw.js'), nav=read('js/core/navegacao.js'), api=read('js/core/config-api.js'), mod3=read('modules/modulo-3.html');
ok('renderer aprovado da animação foi integrado', /RGMotion/.test(motion) && /DURATION\s*=\s*6\.4/.test(motion));
ok('abertura usa canvas e logo oficial como fallback', /rg-startup-canvas/.test(index) && /assets\/logo-ranking-geral\.png/.test(index));
ok('configuração intensa usa glow 1', /INTENSE_GLOW\s*=\s*1/.test(startup));
ok('dados podem carregar enquanto a animação está ativa', /rgModulosPromise/.test(read('js/core/inicializacao.js')) && /Promise\.all\(\[rankingPromise, interfacePromise\]\)/.test(read('js/core/identidade.js')));
ok('pronto acelera o fim em vez de impor 6,4 s de espera', /finishMs\s*=\s*Math\.max\(260, Math\.min\(850/.test(startup));
ok('preferência de movimento do sistema é respeitada', /prefers-reduced-motion/.test(startup) && /A11Y\.estado\.motion/.test(startup));
ok('há ação acessível para pular a animação', /id="rg-startup-skip"/.test(index) && /Pular animação/.test(index));
ok('há live region e progressbar semântico', /role="status"/.test(index) && /role="progressbar"/.test(index));
ok('há link de salto e landmark principal focável', /class="skip-link"/.test(index) && /id="main-content" tabindex="-1"/.test(index));
ok('navegação informa aria-current', /aria-current/.test(nav));
ok('abas de lançamento têm semântica tablist/tab/tabpanel', /role="tablist"/.test(mod3) && /role="tab"/.test(mod3) && /role="tabpanel"/.test(mod3));
ok('service worker inclui motor e controlador da animação', /rg-motion\.js/.test(sw) && /startup-motion\.js/.test(sw));
ok('cache foi versionado para v50', /v50-intense-startup-a11y/.test(sw));
ok('API aponta para a nova implantação', /AKfycbypHFgogRlqWGo00tNOyDNRqnzces3kUT7c_MQ81w8GlbFqHATie2uIW34R0UDWWFdfLw/.test(api));
console.log(`\nRESULTADO STARTUP/A11Y: ${total-fail}/${total} passaram; ${fail} falha(s).`);
if(fail)process.exit(1);
