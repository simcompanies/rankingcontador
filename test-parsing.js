/* ============================================================================
   test-parsing.js
   ----------------------------------------------------------------------------
   Valida o parser da colagem em massa (colagem.js) — carrega o CÓDIGO REAL
   do arquivo via vm (não é uma reimplementação), com um DOM mínimo falso
   (sem jsdom) só o suficiente pra processPaste()/renderPending() rodarem
   sem estourar. Cobre principalmente a correção do item 0.3 do plano de
   ação (decimal com vírgula na colagem em massa).

   Sem dependências — roda com `node test-parsing.js`.
   ============================================================================ */
'use strict';
const fs = require('fs');
const vm = require('vm');

let falhas = 0, total = 0;
function assertEq(desc, obtido, esperado){
  total++;
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if(!ok){
    falhas++;
    console.log(`❌ ${desc}`);
    console.log(`   esperado: ${JSON.stringify(esperado)}`);
    console.log(`   obtido:   ${JSON.stringify(obtido)}`);
  } else {
    console.log(`✅ ${desc}`);
  }
}

/* --------------------------------------------------------------------------
   DOM falso mínimo — só o suficiente pra processPaste()/renderPending()/
   populatePendingDaySelect()/populatePendingBulkDivSelect() não quebrarem.
   -------------------------------------------------------------------------- */
function criarElementoFake(){
  return {
    value: '', innerHTML: '', style: {}, onchange: null,
    appendChild(){}, querySelectorAll(){ return []; }, addEventListener(){},
    classList: { toggle(){}, add(){}, remove(){} }, setAttribute(){}
  };
}
const elementosFake = {};
function getElementByIdFake(id){
  if(!elementosFake[id]) elementosFake[id] = criarElementoFake();
  return elementosFake[id];
}

const ctx = {
  console,
  document: {
    getElementById: getElementByIdFake,
    querySelectorAll: () => [],
    createElement: () => criarElementoFake()
  },
  alert: (msg) => { ctx.__ultimoAlert = msg; },
  scoreTag: (v) => (v >= 0 ? '+' : '') + v,
  escapeHtml: (s) => s, // não é o foco deste teste — ver test-xss.js
  state: {
    days: 0,
    dayDates: [],
    divisoes: [
      { id: 'x', titulo: 'Faixa X', intervalo: '', cor: '--x-color', participantes: [] },
      { id: 'y', titulo: 'Faixa Y', intervalo: '', cor: '--y-color', participantes: [] }
    ]
  },
  pendingImport: null,
  pendingDayMode: 'new',
  souAdmin: () => true,
  exigirAdministrador: () => true
};
ctx.obterTodasDivisoes = () => ctx.state.divisoes;
ctx.obterDivisao = (id) => ctx.state.divisoes.find(d => d.id === id) || null;
ctx.window = ctx;

vm.createContext(ctx);
vm.runInContext(fs.readFileSync('colagem.js', 'utf8'), ctx);

/* --------------------------------------------------------------------------
   1. separarNomeValorDaLinha — teste unitário direto da função nova
      (item 0.3 do plano: casos exatos do prompt + regressão dos que já
      funcionavam).
   -------------------------------------------------------------------------- */
console.log('=== separarNomeValorDaLinha (parsing decimal — item 0.3) ===');

assertEq('"Grupo Alfa, 8,5" -> nome+valor corretos (decimal com vírgula)',
  ctx.separarNomeValorDaLinha('Grupo Alfa, 8,5'), { name: 'Grupo Alfa', valueStr: '8.5' });

assertEq('"Silva, João, 8" -> nome com vírgula interna preservado (não regride)',
  ctx.separarNomeValorDaLinha('Silva, João, 8'), { name: 'Silva, João', valueStr: '8' });

assertEq('"Empresa, -2,5" -> decimal negativo com vírgula',
  ctx.separarNomeValorDaLinha('Empresa, -2,5'), { name: 'Empresa', valueStr: '-2.5' });

assertEq('"João, 8" -> caso simples não quebra',
  ctx.separarNomeValorDaLinha('João, 8'), { name: 'João', valueStr: '8' });

assertEq('"Empresa, 8.5" -> decimal com ponto (não só vírgula) continua ok',
  ctx.separarNomeValorDaLinha('Empresa, 8.5'), { name: 'Empresa', valueStr: '8.5' });

assertEq('"Café & Companhia Ltda, 3" -> nome com caractere especial',
  ctx.separarNomeValorDaLinha('Café & Companhia Ltda, 3'), { name: 'Café & Companhia Ltda', valueStr: '3' });

assertEq('"João" (sem vírgula nenhuma) -> null, cai no fallback de espaço',
  ctx.separarNomeValorDaLinha('João'), null);

/* --------------------------------------------------------------------------
   2. processPaste() de ponta a ponta — roda o fluxo real (parse + monta
      pendingImport), com uma colagem de várias linhas misturando os casos
      acima, exatamente como o prompt do plano pede pra validar.
   -------------------------------------------------------------------------- */
console.log('\n=== processPaste() ponta a ponta (código real, DOM falso) ===');

getElementByIdFake('paste-area').value =
  'Grupo Alfa, 8,5;\nSilva, João, 8;\nEmpresa, -2,5;\nJoão, 8;\nMaria 5;\n8;';

ctx.processPaste();

const nomesEValores = (ctx.pendingImport || []).map(e => ({ name: e.name, value: e.value }));
assertEq('processPaste() produz as 5 entradas válidas, na ordem, com os valores certos',
  nomesEValores,
  [
    { name: 'Grupo Alfa', value: 8.5 },
    { name: 'Silva, João', value: 8 },
    { name: 'Empresa', value: -2.5 },
    { name: 'João', value: 8 },
    { name: 'Maria', value: 5 }
  ]);
// "8;" sozinho (sem nome) deve ter sido pulado (skipped), não deve aparecer
// em pendingImport nem quebrar o parse das outras linhas.

console.log(`\n${'='.repeat(70)}`);
console.log(`RESULTADO: ${total - falhas}/${total} passaram, ${falhas} falha(s)`);
console.log('='.repeat(70));
process.exit(falhas > 0 ? 1 : 0);
