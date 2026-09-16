/* ============================================================================
   faixas-dinamicas.js
   ----------------------------------------------------------------------------
   CRUD da FAIXA em si — criar, renomear, remover uma divisão inteira — e o
   painel "Gerenciar faixas" (Configurações Gerais) que usa esse CRUD.

   IMPORTANTE: o CRUD de PARTICIPANTE dentro de uma faixa (adicionar,
   remover, renomear, editar pontuação) continua em participantes.js — não é
   duplicado aqui, para não ter duas fontes de verdade para a mesma coisa.
   obterDivisao()/obterTodasDivisoes() também não moram aqui: são helpers de
   estado puro usados por quase todo o app, então ficam em estado-global.js.

   Depende de: estado-global.js (state, obterDivisao, obterTodasDivisoes,
   souAdmin, exigirAdministrador), planilha-mestra.js (saveState),
   renderizacao.js (render).
   ============================================================================ */

// Paleta base do sistema. Uma nova faixa nunca recebe uma cor que já esteja
// sendo usada por outra faixa ATIVA. As seis primeiras mantêm a identidade
// visual original; depois disso o sistema gera novas cores de forma
// determinística e perceptualmente espaçada. Uma cor só pode voltar a ser
// usada depois que a faixa que a utilizava for removida.
const CORES_FAIXA_DISPONIVEIS = [
  '--x-color', '--y-color', '--chart-3', '--chart-4', '--chart-5', '--chart-6',
  '#16b8a6', '#4f8df7', '#e7648d', '#9a6fe8', '#d39a2c', '#00a6c8',
  '#ef6c57', '#69ad45', '#c45bd6', '#d8792d', '#5376d8', '#32a36d',
  '#d44c63', '#7a8f2c', '#5b72e8', '#b85c9e', '#1aa5a5', '#c77920'
];

function hslParaHexFaixa(h, s, l){
  const sat = Math.max(0, Math.min(100, Number(s))) / 100;
  const lig = Math.max(0, Math.min(100, Number(l))) / 100;
  const c = (1 - Math.abs(2 * lig - 1)) * sat;
  const hp = (((Number(h) % 360) + 360) % 360) / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r=0,g=0,b=0;
  if(hp < 1){ r=c; g=x; }
  else if(hp < 2){ r=x; g=c; }
  else if(hp < 3){ g=c; b=x; }
  else if(hp < 4){ g=x; b=c; }
  else if(hp < 5){ r=x; b=c; }
  else { r=c; b=x; }
  const m = lig - c/2;
  const hex = v => Math.round((v+m)*255).toString(16).padStart(2,'0');
  return '#' + hex(r) + hex(g) + hex(b);
}

function proximaCorFaixa(){
  const usadas = new Set(
    obterTodasDivisoes()
      .map(div => String(div && div.cor || '').trim().toLowerCase())
      .filter(Boolean)
  );

  // Primeiro procura uma cor pronta ainda livre.
  for(const cor of CORES_FAIXA_DISPONIVEIS){
    if(!usadas.has(String(cor).toLowerCase())) return cor;
  }

  // Paleta virtual praticamente ilimitada. O ângulo áureo distribui os tons
  // ao redor do círculo cromático e evita blocos de cores muito parecidas.
  const ANGULO_AUREO = 137.508;
  for(let i=0; i<720; i++){
    const hue = (18 + i * ANGULO_AUREO) % 360;
    const sat = 68 + (i % 3) * 5;   // 68, 73, 78
    const lig = 48 + (i % 2) * 8;   // 48, 56
    const cor = hslParaHexFaixa(hue, sat, lig);
    if(!usadas.has(cor.toLowerCase())) return cor;
  }

  // Fallback extremo: ainda preserva unicidade textual para um volume de
  // faixas muito acima do uso normal do aplicativo.
  let n = obterTodasDivisoes().length + 1;
  while(n < 10000){
    const cor = hslParaHexFaixa((n * 53) % 360, 74, 52);
    if(!usadas.has(cor.toLowerCase())) return cor;
    n++;
  }
  return '#22c7d6';
}

/* --------------------------------------------------------------------------
   CRUD DE FAIXA
   -------------------------------------------------------------------------- */

/* Cria uma nova faixa (divisão) no ranking. Chamada pelo formulário "Criar
   nova faixa" em Configurações Gerais (handleCriarFaixa, abaixo). Valida:
   - ID único, começando com letra, só letras minúsculas/números/underscore
     (é o mesmo valor usado em ids de DOM e na coluna "Divisao" da planilha)
   - Título não vazio
   - Intervalo é opcional (só texto exibido, não afeta cálculo nenhum) */
function criarFaixa(id, titulo, intervalo){
  if(!exigirAdministrador()) return false;

  const idNorm = (id || '').trim().toLowerCase();
  const tituloNorm = (titulo || '').trim();
  const intervaloNorm = (intervalo || '').trim();

  if(!idNorm){ alert('Informe um ID para a faixa (ex: faixa_premium).'); return false; }
  if(!tituloNorm){ alert('Informe um título para a faixa.'); return false; }
  if(obterDivisao(idNorm)){ alert('Já existe uma faixa com esse ID. Use outro.'); return false; }
  if(!/^[a-z][a-z0-9_]*$/.test(idNorm)){
    alert('ID deve começar com uma letra e conter só letras minúsculas, números e underscore (_).');
    return false;
  }

  if(!state.divisoes) state.divisoes = [];
  state.divisoes.push({
    id: idNorm,
    titulo: tituloNorm,
    intervalo: intervaloNorm,
    cor: proximaCorFaixa(),
    participantes: []
  });

  saveState({ immediate:true });
  render();
  alert(`Faixa "${tituloNorm}" criada com sucesso!`);
  return true;
}

/* Remove uma faixa inteira (com confirmação). Todos os participantes dessa
   faixa são perdidos; os dias em si (e as demais faixas) não são afetados.
   Nunca deixa o ranking sem nenhuma faixa. */
async function removerFaixa(divId){
  if(!exigirAdministrador()) return false;

  const div = obterDivisao(divId);
  if(!div){ alert('Faixa não encontrada.'); return false; }
  if(obterTodasDivisoes().length <= 1){ alert('Não é possível remover a última faixa.'); return false; }

  const qtd = (div.participantes || []).length;
  if(qtd > 0){
    alert(`A faixa "${div.titulo}" possui ${qtd} participante(s). Para proteger o histórico, mova ou remova esses participantes antes de excluir a faixa.`);
    return false;
  }
  if(!await uiConfirm(`Remover a faixa \"${div.titulo}\"?`, { title:'Remover faixa', variant:'danger', confirmText:'Remover faixa' })) return false;

  cancelarEstadoPendenteEstrutural('uma faixa foi removida');
  state.divisoes = state.divisoes.filter(d => d.id !== divId);
  if(draft) delete draft[divId];
  if(draftNew) delete draftNew[divId];
  saveState({ immediate:true });
  render();
  return true;
}

/* Renomeia uma faixa existente (título e intervalo — o id nunca muda). */
function renomearFaixa(divId, novoTitulo, novoIntervalo){
  if(!exigirAdministrador()) return false;

  const div = obterDivisao(divId);
  if(!div){ alert('Faixa não encontrada.'); return false; }

  const tituloNorm = (novoTitulo || '').trim();
  if(!tituloNorm){ alert('Informe um título para a faixa.'); return false; }

  div.titulo = tituloNorm;
  div.intervalo = (novoIntervalo || '').trim();

  saveState({ immediate:true });
  render();
  return true;
}

/* --------------------------------------------------------------------------
   PAINEL "GERENCIAR FAIXAS" (Configurações Gerais → modulo-4.html)
   -------------------------------------------------------------------------- */

// Desenha a lista de faixas existentes, cada uma com botão de renomear/
// remover — chamada por render() (renderizacao.js) a cada mudança de estado,
// igual ao resto dos painéis do app.
function renderGerenciarFaixas(){
  const lista = document.getElementById('faixas-lista');
  if(!lista) return;

  const divisoes = obterTodasDivisoes();
  if(!divisoes.length){
    lista.innerHTML = '<div class="empty-hint">Nenhuma faixa cadastrada ainda.</div>';
    return;
  }

  const admin = souAdmin();
  lista.innerHTML = divisoes.map(div=>{
    const qtd = (div.participantes || []).length;
    const podeRemover = admin && divisoes.length > 1;
    return `<div class="faixa-card" style="--div-accent:${corCssFaixa(div.cor, 'var(--panel-2)')}">
      <div class="faixa-header">
        <div>
          <div class="faixa-titulo">${escapeHtml(div.titulo)}</div>
          <div class="faixa-intervalo">${escapeHtml(div.intervalo) || '(sem intervalo definido)'}</div>
          <div class="faixa-id">ID: <code>${div.id}</code></div>
        </div>
        <div class="faixa-stats">${qtd} participante${qtd === 1 ? '' : 's'}</div>
      </div>
      <div class="faixa-acoes">
        <button type="button" onclick="handleRenomearFaixa('${div.id}')" ${admin ? '' : 'disabled'} title="Renomear">Renomear</button>
        <button type="button" onclick="handleRemoverFaixa('${div.id}')" ${podeRemover ? '' : 'disabled'} title="Remover faixa">Remover</button>
      </div>
    </div>`;
  }).join('');
}

/* Lê o formulário "Criar nova faixa" e chama criarFaixa(); limpa os campos
   se a criação for bem-sucedida. */
function handleCriarFaixa(){
  const idEl = document.getElementById('nova-faixa-id');
  const tituloEl = document.getElementById('nova-faixa-titulo');
  const intervaloEl = document.getElementById('nova-faixa-intervalo');
  if(!idEl || !tituloEl) return;

  if(criarFaixa(idEl.value, tituloEl.value, intervaloEl ? intervaloEl.value : '')){
    idEl.value = '';
    tituloEl.value = '';
    if(intervaloEl) intervaloEl.value = '';
  }
}

// Botão de renomear de um card de faixa: usa o diálogo visual do aplicativo
// para editar título e intervalo sem recorrer a caixas nativas do navegador.
async function handleRenomearFaixa(divId){
  if(!exigirAdministrador()) return;
  const div = obterDivisao(divId);
  if(!div) return;

  const novoTitulo = await uiPrompt('Defina o novo título da faixa.', div.titulo, { title:'Renomear faixa', inputLabel:'Título da faixa', confirmText:'Continuar' });
  if(!novoTitulo) return;
  const novoIntervalo = await uiPrompt('Atualize o intervalo exibido para esta faixa, se necessário.', div.intervalo || '', { title:'Intervalo da faixa', inputLabel:'Intervalo (opcional)', confirmText:'Salvar faixa' });
  if(novoIntervalo === null) return;

  renomearFaixa(divId, novoTitulo, novoIntervalo);
}

// Botão de remover de um card de faixa (confirmação já embutida em removerFaixa).
async function handleRemoverFaixa(divId){
  await removerFaixa(divId);
}
