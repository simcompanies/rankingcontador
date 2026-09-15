'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const ROOT=path.resolve(__dirname,'..'); let total=0,falhas=0;
function ok(d,c,x){total++; if(c)console.log('OK  '+d);else{falhas++;console.error('FALHA '+d+(x?' — '+x:''));}}
(async()=>{
const alerts=[],confirms=[];
const ctx={console,alert:m=>alerts.push(String(m)),uiConfirm:async m=>{confirms.push(String(m));return true;},uiPrompt:async()=>null,crypto:{randomUUID:()=>Math.random().toString(36).slice(2)},document:{getElementById:()=>null,querySelectorAll:()=>[]},window:null};ctx.window=ctx;
vm.createContext(ctx);
for(const f of ['js/core/estado-global.js','js/features/faixas-dinamicas.js']) vm.runInContext(fs.readFileSync(path.join(ROOT,f),'utf8'),ctx,{filename:f});
ctx.souAdmin=()=>true;ctx.exigirAdministrador=()=>true;ctx.saveState=()=>true;ctx.render=()=>{};ctx.cancelarEstadoPendenteEstrutural=()=>{};
vm.runInContext(`state={revision:0,days:1,dayDates:['2026-09-15'],dayIds:['d1'],divisoes:[{id:'x',titulo:'Faixa X',intervalo:'',cor:'--x-color',participantes:[]},{id:'y',titulo:'Faixa Y',intervalo:'',cor:'--y-color',participantes:[]}]}; draft={}; draftNew={};`,ctx);
for(let i=1;i<=6;i++) ctx.criarFaixa('f'+i,'Faixa '+i,'intervalo '+i);
const qtd=vm.runInContext('state.divisoes.length',ctx); ok('aceita mais que X/Y',qtd===8,'qtd='+qtd);
const ids=vm.runInContext('state.divisoes.map(d=>d.id)',ctx); ok('IDs das faixas permanecem únicos',new Set(ids).size===ids.length);
ok('ID inválido é recusado',ctx.criarFaixa('1invalida','Inválida','')===false);
vm.runInContext(`state.divisoes.find(d=>d.id==='f1').participantes.push({id:'p1',name:'Ana',scores:[10]});`,ctx);
alerts.length=0; const rem=await ctx.removerFaixa('f1');
ok('faixa com participante não pode ser removida destrutivamente',rem===false && alerts.some(a=>a.includes('proteger o histórico')));
vm.runInContext(`state.divisoes.find(d=>d.id==='f1').participantes=[];`,ctx); alerts.length=0;
ok('faixa vazia pode ser removida',(await ctx.removerFaixa('f1'))===true && !vm.runInContext(`state.divisoes.some(d=>d.id==='f1')`,ctx));
console.log('\nRESULTADO FAIXAS: '+(total-falhas)+'/'+total+' passaram; '+falhas+' falha(s).');process.exit(falhas?1:0);
})().catch(err=>{console.error(err);process.exit(1)});
