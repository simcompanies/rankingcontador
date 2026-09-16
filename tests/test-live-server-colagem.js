#!/usr/bin/env node
'use strict';
const fs=require('fs'),vm=require('vm'),path=require('path');
const ROOT=path.resolve(__dirname,'..');
const read=r=>fs.readFileSync(path.join(ROOT,r),'utf8');
let total=0,fail=0;function ok(d,c){total++;if(c)console.log('OK  '+d);else{fail++;console.error('FALHA '+d);}}

const init=read('js/core/inicializacao.js');
const gem=read('js/features/colagem-gemini.js');
const col=read('js/features/colagem.js');
const mod=read('modules/modulo-3.html');

ok('loader remove scripts antes de innerHTML',/querySelectorAll\('script'\)[\s\S]*remove\(\)/.test(init)&&/sanitizarFragmentoHtmlModulo\(htmlRecebido\)/.test(init));
ok('botão Gemini possui rótulo isolado',/data-copy-label/.test(mod));
ok('Gemini não restaura o botão inteiro via textContent',!/btn\.textContent\s*=\s*textoOriginal/.test(gem)&&/label\.textContent\s*=\s*textoOriginal/.test(gem));
ok('colagem detecta assinatura do Live Server',/For SVG support/.test(col)&&/refreshCSS/.test(col)&&/Live-Reloading/.test(col));
ok('há aviso acessível de limpeza',/paste-sanitize-status/.test(mod));

const ctx={console,window:{addEventListener(){}},document:{addEventListener(){},getElementById(){return null}},Map,Set,Number,String,Array,Math,RegExp};
vm.createContext(ctx);vm.runInContext(col,ctx);
const live=`// <-- For SVG support\nif ('WebSocket' in window) { function refreshCSS(){} var socket = new WebSocket(address); console.log('Live reload enabled.'); }\nJoão, 10;\nMaria, 9;\nOBS: nome duvidoso;`;
const r=ctx.limparRuidoLiveServerDaColagem(live);
ok('limpeza remove código do Live Server',r.removido&&!/WebSocket|refreshCSS|Live reload/i.test(r.texto));
ok('limpeza preserva linhas de ranking',/João, 10/.test(r.texto)&&/Maria, 9/.test(r.texto));
ok('limpeza preserva observações',/OBS: nome duvidoso/.test(r.texto));

console.log(`\nRESULTADO LIVE SERVER/COLAGEM: ${total-fail}/${total} passaram; ${fail} falha(s).`);if(fail)process.exit(1);
