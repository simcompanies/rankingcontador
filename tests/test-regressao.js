'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
let total = 0, falhas = 0;
function ok(desc, cond, detalhe){
  total++;
  if(cond) console.log('OK  ' + desc);
  else { falhas++; console.error('FALHA ' + desc + (detalhe ? ' — ' + detalhe : '')); }
}
function eq(desc, got, expected){
  const a = JSON.stringify(got), b = JSON.stringify(expected);
  ok(desc, a === b, `esperado ${b}, obtido ${a}`);
}
function el(){
  return {
    value:'', innerHTML:'', textContent:'', style:{}, dataset:{}, disabled:false,
    classList:{add(){},remove(){},toggle(){}},
    setAttribute(){}, removeAttribute(){}, toggleAttribute(){},
    appendChild(){}, addEventListener(){}, querySelectorAll(){return []}, closest(){return null}
  };
}
const elems = new Map();
function getEl(id){ if(!elems.has(id)) elems.set(id, el()); return elems.get(id); }
const alerts=[];
const confirms=[];
const ctx = {
  console, crypto:crypto.webcrypto,
  window:null,
  navigator:{onLine:true},
  location:{protocol:'https:',hostname:'example.invalid'},
  alert:(m)=>alerts.push(String(m)),
  confirm:(m)=>{ confirms.push(String(m)); return true; },
  prompt:()=>null,
  document:{
    getElementById:getEl,
    querySelectorAll:()=>[],
    createElement:()=>el(),
    body:el(),
    addEventListener(){}
  },
  setTimeout, clearTimeout, requestAnimationFrame:(fn)=>fn(),
};
ctx.window=ctx;
vm.createContext(ctx);
function load(rel){ vm.runInContext(fs.readFileSync(path.join(ROOT, rel),'utf8'), ctx, {filename:rel}); }
function run(code){ return vm.runInContext(code,ctx); }

load('js/core/estado-global.js');
load('js/features/filtros.js');
load('js/features/analises-dashboard.js');
load('js/features/participantes.js');
load('js/features/colagem.js');

// Stubs only for side effects outside the logic under test.
ctx.saveState=()=>true;
ctx.renderDivision=()=>{};
ctx.render=()=>{};
ctx.autoSalvarResumoDoDia=()=>{};
ctx.switchLaunchTab=()=>{};
ctx.exigirAdministrador=()=>true;
ctx.souAdmin=()=>true;
ctx.scoreTag=(v)=>(v>=0?'+':'')+v;

console.log('=== Regra autoritativa de pontuação ===');
const back={console}; vm.createContext(back); vm.runInContext(fs.readFileSync(path.join(ROOT,'Code.gs'),'utf8'),back);
let divergencias=0, casos=0;
for(let n=1;n<=100;n++) for(let p=1;p<=n;p++){
  casos++;
  if(ctx.pontosPorPosicaoLeitura(p,n)!==back.pontosPorPosicao(p,n)) divergencias++;
}
eq('5.050 casos front-end x backend sem divergência', [casos,divergencias], [5050,0]);
eq('regra 14 participantes', [11,12,13,14].map(p=>ctx.pontosPorPosicaoLeitura(p,14)), [0,-1,-2,-3]);
eq('regra 17 participantes', [11,12,13,14,15,16,17].map(p=>ctx.pontosPorPosicaoLeitura(p,17)), [0,-1,-1,-2,-2,-3,-3]);
const backendOk={revision:0,days:1,dayDates:['2026-09-15T10:00:00.000'],dayIds:['d1'],seriesMeta:{currentId:'s1',currentNumber:1,maxDays:7},divisoes:[{id:'x',titulo:'X',intervalo:'',cor:'--x',participantes:[{id:'p1',name:'Ana',createdAt:'2026-09-01T10:00:00.000',scores:[10]}]}]};
ok('backend aceita snapshot íntegro', !!back.validarSnapshotRankingBackend(backendOk));
let backendRejeitou=false; try{ back.validarSnapshotRankingBackend({...backendOk,divisoes:[{...backendOk.divisoes[0],participantes:[{...backendOk.divisoes[0].participantes[0],scores:[11]}]}]}); }catch(e){ backendRejeitou=true; }
ok('backend rejeita pontuação acima de +10', backendRejeitou);

console.log('\n=== Parsing e validação de pontuação ===');
eq('8,5 vira 8.5', ctx.parsePontuacao('8,5'), 8.5);
eq('-2,5 vira -2.5', ctx.parsePontuacao('-2,5'), -2.5);
eq('+10 é limite superior', ctx.parsePontuacao('12'), 10);
ok('texto inválido vira NaN', Number.isNaN(ctx.parsePontuacao('abc')));

console.log('\n=== Invariantes estruturais ===');
const base={revision:2,days:2,dayDates:['2026-09-01','2026-09-02'],dayIds:['d1','d2'],seriesMeta:{currentId:'s1',currentNumber:1,maxDays:7},divisoes:[{id:'x',titulo:'X',intervalo:'',cor:'--x',participantes:[{id:'p1',name:'Ana',createdAt:'2026-08-01',scores:[10,-1]}]}]};
ok('snapshot válido é aceito', ctx.validarInvariantesRanking(base).ok);
ok('Day_ID duplicado é recusado', !ctx.validarInvariantesRanking({...base,dayIds:['d1','d1']}).ok);
ok('Participant_ID duplicado é recusado', !ctx.validarInvariantesRanking({...base,divisoes:[{...base.divisoes[0],participantes:[base.divisoes[0].participantes[0],{id:'p1',name:'Bia',scores:[1,2]}]}]}).ok);
ok('pontuação não numérica é recusada', !ctx.validarInvariantesRanking({...base,divisoes:[{...base.divisoes[0],participantes:[{id:'p1',name:'Ana',scores:[10,'abc']}]}]}).ok);
ok('pontuação acima de +10 recebida do servidor é recusada', !ctx.validarInvariantesRanking({...base,divisoes:[{...base.divisoes[0],participantes:[{id:'p1',name:'Ana',scores:[10,11]}]}]}).ok);

console.log('\n=== Ranking filtrado e análise ===');
run(`state = {revision:0,days:2,dayDates:['2026-09-01','2026-09-02'],dayIds:['d1','d2'],seriesMeta:{currentId:'s1',currentNumber:1,maxDays:7},divisoes:[{id:'x',titulo:'X',intervalo:'',cor:'--x',participantes:[
{id:'a',name:'Alfa',scores:[10,0]},
{id:'z',name:'Zeta',scores:[0,10]}
]}]}; loaded=true; rankingBloqueado=false;`);
const ordem=run(`rankingFiltrado('x',[0,1]).map(p=>p.name)`);
eq('empate filtrado usa o dia mais recente', Array.from(ordem), ['Zeta','Alfa']);
const destaquesPositivos=ctx.calcularDestaques([0]);
eq('sem valor negativo não inventa "queda"', destaquesPositivos.queda, null);

console.log('\n=== Edição direta e identidade ===');
run(`state.divisoes[0].participantes=[{id:'p1',name:'Ana',scores:[null,null]}];`);
ctx.updateScore('x',0,0,'8,5');
eq('edição direta aceita vírgula decimal', run(`state.divisoes[0].participantes[0].scores[0]`), 8.5);

console.log('\n=== Colagem ===');
elems.clear(); alerts.length=0; confirms.length=0;
getEl('paste-area').value='Ana, 10;\nAna, 3;';
ctx.processPaste();
ok('nome repetido na própria colagem é bloqueado', alerts.some(a=>a.toLowerCase().includes('repetidos')));

elems.clear(); alerts.length=0; confirms.length=0;
run(`state.divisoes[0].participantes=[]; pendingImport=null; pendingDayMode='new';`);
const pa=getEl('paste-area'); pa.value='A, 99;\nB, 99;\nC, 99;'; pa.dataset.leituraOrigem='gemini';
ctx.processPaste();
const vals=Array.from(run(`pendingImport.map(e=>e.value)`));
eq('Gemini é recalculado localmente pela posição, ignorando os pontos fornecidos', vals, [10,9,8]);

console.log('\n=== Filtros e remoção de dia ===');
run(`filtroDiasSelecionados = new Set([1,2]); ajustarFiltroAposRemoverDia(0);`);
eq('filtro de dias é reindexado ao remover dia anterior', Array.from(run(`Array.from(filtroDiasSelecionados).sort((a,b)=>a-b)`)), [0,1]);

console.log('\n=== XSS/escape ===');
const payload='<img src=x onerror="window.pwned=1">';
const escapado=ctx.escapeHtml(payload);
ok('payload HTML é escapado', !escapado.includes('<img') && escapado.includes('&lt;img'));

console.log('\n=== Verificações estáticas das correções críticas ===');
const planilha=fs.readFileSync(path.join(ROOT,'js/features/planilha-mestra.js'),'utf8');
const init=fs.readFileSync(path.join(ROOT,'js/core/inicializacao.js'),'utf8');
const sw=fs.readFileSync(path.join(ROOT,'sw.js'),'utf8');
const code=fs.readFileSync(path.join(ROOT,'Code.gs'),'utf8');
const resumos=fs.readFileSync(path.join(ROOT,'js/features/resumos-salvos.js'),'utf8');
const css=fs.readFileSync(path.join(ROOT,'style.css'),'utf8');
ok('falha de load não substitui state por estado vazio', !/catch\s*\([^)]*\)[\s\S]{0,600}state\s*=\s*estadoVazioPadrao/.test(planilha));
ok('fila serializada de saves existe', planilha.includes('saveInFlight') && planilha.includes('REVISION_CONFLICT'));
ok('Service Worker é registrado', init.includes("serviceWorker.register('./sw.js'"));
ok('SW só remove caches com prefixo próprio', sw.includes('nome.startsWith(CACHE_PREFIX)'));
ok('Conteúdo está no app shell', sw.includes("'./modules/conteudo.html'"));
ok('histórico de resumos foi concentrado em Lançamentos', resumos.includes("getElementById('resumos-salvos-lista')") && !resumos.includes("getElementById('resumos-conteudo-lista')"));
ok('credencial bootstrap não está hardcoded', !code.includes('ADMIN_PADRAO_SENHA') && code.includes('ADMIN_BOOTSTRAP_SENHA'));
ok('backend possui controle monotônico de revisão', code.includes("'Ranking_Revision'") && code.includes("codigo:'REVISION_CONFLICT'"));
ok('backend preserva Data_Adicionado recebida', code.includes('p.createdAt ? new Date(p.createdAt)'));
ok('CSS não contém sequências literais \\n no bloco de regras', !css.includes('\\n'));
ok('OCR foi removido do backend', !code.includes("case 'ocrImagem'") && !code.includes('function ocrImagem('));
const obterSessaoTrecho=(code.match(/function obterSessao\(token\)[\s\S]*?\n\}/)||[''])[0];
ok('sessão autenticada não relê a planilha Usuarios em toda requisição', !obterSessaoTrecho.includes('SpreadsheetApp.openById'));
ok('hash atual é v3 com pepper secreto e custo reduzido', code.includes("const HASH_VERSAO = 'v3'") && code.includes('PROP_PASSWORD_PEPPER') && code.includes('HASH_ITERACOES = 1500'));
ok('login não usa lock global do ranking', !/function login\(email, senha\)\s*\{\s*const lock = LockService/.test(code));


console.log('\n'+'='.repeat(72));
console.log(`RESULTADO: ${total-falhas}/${total} passaram; ${falhas} falha(s).`);
console.log('='.repeat(72));
process.exit(falhas ? 1 : 0);
