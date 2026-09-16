#!/usr/bin/env node
'use strict';
const fs=require('fs'), path=require('path');
const ROOT=path.resolve(__dirname,'..');
let pass=0,fail=0;
function ok(c,m){if(c){pass++;console.log('OK ',m)}else{fail++;console.error('FALHA',m)}}
const r=f=>fs.readFileSync(path.join(ROOT,f),'utf8');
const overview=r('modules/modulo-1.html');
const launch=r('modules/modulo-3.html');
const admin=r('modules/modulo-4.html');
const help=r('modules/conteudo.html');
const idx=r('index.html');
const render=r('js/core/renderizacao.js');
const org=r('js/features/organizacao-ui.js');
ok(!overview.includes('Regra de pontuação') && !overview.includes('Regras de desempate'),'Visão Geral não carrega blocos explicativos longos');
ok(!overview.includes('+ Dia em branco'),'Dia em branco saiu das faixas');
ok(launch.includes('+ Dia em branco') && launch.includes('Lançamentos desta série'),'gestão de dias ficou em Lançamentos');
ok(launch.includes('resumos-salvos-lista'),'histórico de resumos ficou em Lançamentos');
ok(help.includes('Regras e Ajuda') && help.includes('Pontuação por colocação') && help.includes('Regras de desempate'),'regras foram movidas para Regras e Ajuda');
ok(['participantes','faixas','usuarios','atividade','sistema'].every(x=>admin.includes(`data-admin-tab="${x}"`)),'Administração foi dividida por intenção');
ok(!admin.includes('day-list-config') && !admin.includes('resumos-salvos-lista'),'Administração não duplica dias nem resumos');
ok(idx.includes('topbar-series-context') && idx.includes('topbar-last-launch'),'topbar mostra contexto persistente da série');
ok(!render.includes('<button onclick="addDay()">+ Dia em branco</button>'),'board dinâmico não recria botão de dia');
ok(org.includes('renderGerenciarParticipantes') && org.includes('testarSistemaBasico'),'gestão central e diagnóstico têm implementação');
console.log(`\nRESULTADO ORGANIZAÇÃO: ${pass}/${pass+fail} passaram; ${fail} falha(s).`);
process.exitCode=fail?1:0;
