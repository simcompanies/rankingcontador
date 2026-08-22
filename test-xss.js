/* ============================================================================
   test-xss.js
   ----------------------------------------------------------------------------
   Confirma (ou não, após corrigido) a vulnerabilidade de XSS armazenado —
   carrega o CÓDIGO REAL (estado-global.js, participantes.js,
   renderizacao.js) com jsdom simulando o DOM, injeta um nome de
   participante E um título de faixa maliciosos
   (`<img src=x onerror="...">`), roda renderBoard() de verdade e verifica
   que nenhum <img> real chega a existir no DOM (o que provaria que o
   escape funcionou) — a mesma validação pedida no passo 5 do prompt da
   Fase 0.1 do plano de ação.

   Depende de jsdom: `npm install jsdom` antes de rodar.
   ============================================================================ */
'use strict';
const fs = require('fs');
const { JSDOM } = require('jsdom');

let falhas = 0, total = 0;
function verificar(desc, condicao){
  total++;
  if(condicao){ console.log(`✅ ${desc}`); }
  else { falhas++; console.log(`❌ ${desc}`); }
}

const dom = new JSDOM(`<!doctype html><html><body>
  <div class="board" id="board-container"></div>
</body></html>`, { url: 'https://exemplo.invalid/', runScripts: 'outside-only' });
const { window } = dom;

// Carrega o CÓDIGO REAL do projeto, na mesma ordem de dependência de
// index.html: estado-global.js primeiro (define escapeHtml/obterDivisao/
// obterTodasDivisoes/souAdmin/o `state` em si), depois participantes.js
// (sortDivision/tiebreakDay/total) e renderizacao.js (renderBoard/
// renderDivision) — não são reimplementações. Os três + a montagem do
// estado de teste precisam ir num ÚNICO window.eval(): cada eval() separado
// cria seu próprio escopo léxico pra `let`/`const` (diferente de
// `function`, que vira propriedade real de window), então um `let state`
// declarado num eval não seria visível para uma atribuição feita noutro.
const PAYLOAD_NOME = '<img src=x onerror="window.__xss_participante=true">';
const PAYLOAD_TITULO = '<img src=x onerror="window.__xss_titulo=true">';

const codigoReal = [
  fs.readFileSync('estado-global.js', 'utf8'),
  fs.readFileSync('participantes.js', 'utf8'),
  fs.readFileSync('renderizacao.js', 'utf8')
].join('\n;\n');

const setupEstadoTeste = `
  state.days = 1;
  state.dayDates = ['2026-08-19T22:00:00.000'];
  state.divisoes = [
    { id: 'x', titulo: ${JSON.stringify(PAYLOAD_TITULO)}, intervalo: 'intervalo normal', cor: '--x-color',
      participantes: [
        { name: ${JSON.stringify(PAYLOAD_NOME)}, scores: [5] },
        { name: 'Empresa Normal', scores: [3] }
      ] },
    { id: 'y', titulo: 'Faixa Y', intervalo: '', cor: '--y-color', participantes: [] }
  ];
`;

window.eval(codigoReal + '\n;\n' + setupEstadoTeste);

console.log('=== Teste de XSS armazenado: título de faixa + nome de participante maliciosos ===\n');

window.renderBoard();

verificar('nenhuma tag <img> real foi parar no DOM (payload deveria virar texto, não elemento)',
  window.document.querySelectorAll('img').length === 0);

verificar('onerror do NOME de participante não disparou (window.__xss_participante nunca setado)',
  window.__xss_participante !== true);

verificar('onerror do TÍTULO de faixa não disparou (window.__xss_titulo nunca setado)',
  window.__xss_titulo !== true);

const divX = window.document.getElementById('div-x');
const tituloEl = divX ? divX.querySelector('.division-title') : null;
verificar('título malicioso da faixa aparece como TEXTO literal (via textContent), igual ao original',
  !!tituloEl && tituloEl.textContent === PAYLOAD_TITULO);

const nomesNaTabela = Array.from(window.document.querySelectorAll('#body-x td.name')).map(td => td.textContent);
verificar('nome malicioso do participante aparece como TEXTO literal (via textContent), igual ao original',
  nomesNaTabela.includes(PAYLOAD_NOME));

verificar('participante legítimo ("Empresa Normal") continua aparecendo normalmente',
  nomesNaTabela.includes('Empresa Normal'));

console.log(`\n${'='.repeat(70)}`);
if(falhas === 0){
  console.log('✅ Sem XSS neste caminho: escapeHtml() está aplicado corretamente em renderBoard()/renderDivision().');
} else {
  console.log('🚨 XSS CONFIRMADO em pelo menos um ponto — ver falhas acima.');
}
console.log(`RESULTADO: ${total - falhas}/${total} passaram, ${falhas} falha(s)`);
console.log('='.repeat(70));

/* ----------------------------------------------------------------------
   2. Ponto crítico separado: quebra de atributo value="" em
   formulario-lancamento-dia.js (renderDraftNewRows) — o mais perigoso dos
   pontos citados no prompt da Fase 0.1, porque um nome com aspas duplas
   pode injetar um handler de evento NOVO no HTML (não só texto malicioso).
   Roda num DOM/eval separado pra não interferir no estado montado acima.
   ---------------------------------------------------------------------- */
console.log('\n=== Ponto crítico: quebra de atributo value="" (formulario-lancamento-dia.js) ===\n');

const dom2 = new JSDOM(`<!doctype html><html><body><div id="launch-new-x"></div></body></html>`,
  { url: 'https://exemplo.invalid/', runScripts: 'outside-only' });
const w2 = dom2.window;

const PAYLOAD_ATRIBUTO = 'x" onmouseover="window.__xss_atributo=true';
w2.eval([
  fs.readFileSync('estado-global.js', 'utf8'),
  fs.readFileSync('formulario-lancamento-dia.js', 'utf8'),
  `draftNew = { x: [ { name: ${JSON.stringify(PAYLOAD_ATRIBUTO)}, value: '5' } ] };`
].join('\n;\n'));

w2.renderDraftNewRows('x');

const inputNome = w2.document.querySelector('#launch-new-x .launch-name-input');

verificar('o <input> do nome novo foi renderizado (a quebra de atributo não impediu o parse)',
  !!inputNome);

verificar('input.value bate exatamente com o payload — não quebrou pra fora do atributo value=""',
  !!inputNome && inputNome.value === PAYLOAD_ATRIBUTO);

verificar('nenhum atributo onmouseover foi injetado em elemento nenhum',
  w2.document.querySelectorAll('[onmouseover]').length === 0);

verificar('onmouseover do payload não disparou (window.__xss_atributo nunca setado)',
  w2.__xss_atributo !== true);

console.log(`\n${'='.repeat(70)}`);
console.log(`RESULTADO FINAL: ${total - falhas}/${total} passaram, ${falhas} falha(s)`);
console.log('='.repeat(70));
process.exit(falhas > 0 ? 1 : 0);
