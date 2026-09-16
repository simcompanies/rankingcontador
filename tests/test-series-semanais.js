'use strict';
const fs=require('fs'), path=require('path'), vm=require('vm'), crypto=require('crypto');
const ROOT=path.resolve(__dirname,'..');
let total=0, falhas=0;
function ok(desc,cond,det){total++; if(cond) console.log('OK  '+desc); else {falhas++; console.error('FALHA '+desc+(det?' — '+det:''));}}
function eq(desc,a,b){ok(desc,JSON.stringify(a)===JSON.stringify(b),`esperado ${JSON.stringify(b)}, obtido ${JSON.stringify(a)}`)}
function elem(v=''){return {value:v,innerHTML:'',textContent:'',style:{},dataset:{},classList:{add(){},remove(){},toggle(){}},setAttribute(){},removeAttribute(){},toggleAttribute(){},querySelectorAll(){return[]}}}
const elements=new Map();
const document={getElementById(id){if(!elements.has(id)) elements.set(id,elem()); return elements.get(id)},querySelectorAll(){return[]},querySelector(){return null},body:elem()};
const ctx={console,crypto:crypto.webcrypto,document,navigator:{onLine:true},window:null,alert(){},confirm(){return true},setTimeout:(fn)=>{fn();return 1},clearTimeout(){}}; ctx.window=ctx;
vm.createContext(ctx);
for(const f of ['js/core/estado-global.js','js/features/series-semanais.js']) vm.runInContext(fs.readFileSync(path.join(ROOT,f),'utf8'),ctx,{filename:f});

console.log('=== Data retroativa ===');
eq('data escolhida vira ISO local ao meio-dia',ctx.dataReferenciaISO('2026-08-22'),'2026-08-22T12:00:00.000');
eq('data malformada é recusada',ctx.dataReferenciaISO('22/08/2026'),null);
elements.set('launch-reference-date',elem('2026-08-22'));
eq('lançamento usa a data escolhida, não a data atual',ctx.obterDataReferenciaLancamento(),'2026-08-22T12:00:00.000');

console.log('\n=== Limite de 7 dias ===');
vm.runInContext("state={revision:1,days:6,dayDates:[],dayIds:[],seriesMeta:{currentId:'s1',currentNumber:1,maxDays:7},divisoes:[]};",ctx);
ok('6 dias ainda não fecha a série',!ctx.serieAtualCompleta());
vm.runInContext('state.days=7',ctx); ok('7 dias fecha a série',ctx.serieAtualCompleta());

console.log('\n=== Acumulado Geral ===');
const ranking=ctx.consolidarCrescimento([
 {participantId:'p1',name:'Ana',divId:'x',divTitle:'Faixa X',score:10,date:'2026-08-01',seriesId:'s1'},
 {participantId:'p1',name:'Ana',divId:'x',divTitle:'Faixa X',score:-2,date:'2026-08-02',seriesId:'s1'},
 {participantId:'p1',name:'Ana Souza',divId:'x',divTitle:'Faixa X',score:5,date:'2026-08-10',seriesId:'s2'},
 {participantId:'p2',name:'Bia',divId:'y',divTitle:'Faixa Y',score:9,date:'2026-08-01',seriesId:'s1'}
]);
eq('mesmo Participant_ID soma séries anteriores e atuais',ranking.find(p=>p.id==='p1').total,13);
eq('nome mais recente acompanha o mesmo ID',ranking.find(p=>p.id==='p1').name,'Ana Souza');
eq('ranking geral ordena pelo crescimento líquido',ranking.map(p=>p.id),['p1','p2']);

console.log('\n=== Encapsulamento backend ===');
let uuidN=0;
const back={console,Utilities:{getUuid(){return 'uuid'+(++uuidN)}},isFinite,Date,Math,JSON,Object,String,Number,Array,Session:{getScriptTimeZone(){return 'America/Bahia'}}};
vm.createContext(back); vm.runInContext(fs.readFileSync(path.join(ROOT,'Code.gs'),'utf8'),back,{filename:'Code.gs'});
const estado={revision:8,days:9,dayDates:Array.from({length:9},(_,i)=>`2026-08-${String(i+1).padStart(2,'0')}T12:00:00.000`),dayIds:Array.from({length:9},(_,i)=>'d'+(i+1)),seriesMeta:{currentId:'s1',currentNumber:3,maxDays:7},divisoes:[{id:'x',titulo:'Faixa X',intervalo:'',cor:'--x',participantes:[{id:'p1',name:'Ana',createdAt:'2026-01-01',scores:[10,9,8,7,6,5,4,3,2]}]}]};
const valid=back.validarSnapshotRankingBackend(estado); ok('snapshot de série com IDs/datas é válido',!!valid);
const novo=back.estadoDepoisDeEncerrarSerie(estado,7,9);
eq('encerrar primeiro bloco mantém apenas o excedente legado',novo.days,2);
eq('pontuações restantes são deslocadas para a nova série',novo.divisoes[0].participantes[0].scores,[3,2]);
eq('datas restantes também são deslocadas',novo.dayIds,['d8','d9']);
eq('número da série avança',novo.seriesMeta.currentNumber,4);
ok('nova série recebe novo ID',novo.seriesMeta.currentId!=='s1');
const reinicio=back.estadoDepoisDeReiniciarSerie({revision:9,days:3,dayDates:['2026-09-01T12:00:00.000','2026-09-02T12:00:00.000','2026-09-03T12:00:00.000'],dayIds:['a','b','c'],seriesMeta:{currentId:'s9',currentNumber:5,maxDays:7},divisoes:[{id:'x',titulo:'Faixa X',intervalo:'',cor:'--x',participantes:[{id:'p1',name:'Ana',createdAt:'2026-01-01',scores:[4,3,2]}]}]},10,false);
eq('reiniciar série limpa todos os dias ativos',reinicio.days,0);
eq('reiniciar série limpa as pontuações ativas',reinicio.divisoes[0].participantes[0].scores,[]);
eq('reiniciar série mantém a numeração',reinicio.seriesMeta.currentNumber,5);
ok('reiniciar série troca o ID interno',reinicio.seriesMeta.currentId!=='s9');
const proxima=back.estadoDepoisDeReiniciarSerie({revision:10,days:2,dayDates:['2026-09-01T12:00:00.000','2026-09-02T12:00:00.000'],dayIds:['a','b'],seriesMeta:{currentId:'s10',currentNumber:5,maxDays:7},divisoes:[]},11,true);
eq('arquivar/descartar manualmente avança a série',proxima.seriesMeta.currentNumber,6);
const linhas=back.linhasHistoricoSerie(estado,{nome:'Admin'},7);
eq('um participante gera sete linhas históricas',linhas.length,7);
eq('linha histórica guarda Participant_ID e dia', [linhas[0][4],linhas[0][8],linhas[0][11]], ['p1',1,10]);

console.log('\n=== Preservação do contrato ===');
eq('pontuação 17 participantes continua intacta',[11,12,13,14,15,16,17].map(p=>back.pontosPorPosicao(p,17)),[0,-1,-1,-2,-2,-3,-3]);
const code=fs.readFileSync(path.join(ROOT,'Code.gs'),'utf8');
const index=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
const mod3=fs.readFileSync(path.join(ROOT,'modules/modulo-3.html'),'utf8');
ok('backend possui aba HistoricoSeries',code.includes("ABA_HISTORICO_SERIES = 'HistoricoSeries'"));
ok('backend possui ações de arquivar/listar séries',code.includes("case 'encerrarSerie'")&&code.includes("action === 'listarHistoricoSeries'"));
ok('interface possui aba Acumulado Geral',index.includes('data-view="acumulado"')&&index.includes('slot-modulo-5'));
ok('lançamento possui seletor de data de referência',mod3.includes('id="launch-reference-date"'));
ok('modal oferece arquivar ou descartar',mod3.includes("encerrarSerieAtual('arquivar')")&&mod3.includes("encerrarSerieAtual('descartar')"));
ok('reiniciador manual está disponível em Lançamentos',mod3.includes('id="series-reset-btn"')&&mod3.includes('id="series-reset-modal"'));
ok('reiniciador oferece manter número, arquivar ou descartar',mod3.includes("reiniciarSerieAtualManual('reiniciar')")&&mod3.includes("reiniciarSerieAtualManual('arquivar')")&&mod3.includes("reiniciarSerieAtualManual('descartar')"));
ok('backend expõe ação reiniciarSerie',code.includes("case 'reiniciarSerie'")&&code.includes('function reiniciarSerie(token, modo, estado)'));

console.log('\n'+'='.repeat(72));
console.log(`RESULTADO SÉRIES: ${total-falhas}/${total} passaram; ${falhas} falha(s).`);
console.log('='.repeat(72));
process.exit(falhas?1:0);
