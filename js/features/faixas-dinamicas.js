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

// Paleta que uma faixa nova recebe automaticamente, ciclando pelas cores de
// gráfico já existentes no projeto (as mesmas 6 usadas na Evolução
// Acumulada) — assim cada faixa nova já nasce visualmente distinta, sem
// precisar de nenhuma escolha manual de cor.
const CORES_FAIXA_DISPONIVEIS = ['--x-color', '--y-color', '--chart-3', '--chart-4', '--chart-5', '--chart-6'];

function proximaCorFaixa(){
  const usadas = obterTodasDivisoes().length;
  return CORES_FAIXA_DISPONIVEIS[usadas % CORES_FAIXA_DISPONIVEIS.length];
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

  saveState();
  render();
  alert(`Faixa "${tituloNorm}" criada com sucesso!`);
  return true;
}

/* Remove uma faixa inteira (com confirmação). Todos os participantes dessa
   faixa são perdidos; os dias em si (e as demais faixas) não são afetados.
   Nunca deixa o ranking sem nenhuma faixa. */
function removerFaixa(divId){
  if(!exigirAdministrador()) return false;

  const div = obterDivisao(divId);
  if(!div){ alert('Faixa não encontrada.'); return false; }
  if(obterTodasDivisoes().length <= 1){ alert('Não é possível remover a última faixa.'); return false; }

  const qtd = (div.participantes || []).length;
  const msg = qtd > 0
    ? `Remover "${div.titulo}"? ${qtd} participante(s) será(ão) perdido(s).`
    : `Remover "${div.titulo}"?`;
  if(!confirm(msg)) return false;

  state.divisoes = state.divisoes.filter(d => d.id !== divId);
  saveState();
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

  saveState();
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
    return `<div class="faixa-card" style="--div-accent:var(${div.cor || '--panel-2'})">
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

// Botão de renomear de um card de faixa: pede o novo título/intervalo via
// prompt() (mesmo padrão usado em renameParticipant, participantes.js).
function handleRenomearFaixa(divId){
  if(!exigirAdministrador()) return;
  const div = obterDivisao(divId);
  if(!div) return;

  const novoTitulo = prompt('Novo título:', div.titulo);
  if(!novoTitulo) return;
  const novoIntervalo = prompt('Novo intervalo (opcional):', div.intervalo || '');

  renomearFaixa(divId, novoTitulo, novoIntervalo);
}

// Botão de remover de um card de faixa (confirmação já embutida em removerFaixa).
function handleRemoverFaixa(divId){
  removerFaixa(divId);
}
