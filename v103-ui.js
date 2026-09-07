/*
 * Nova camada visual de navegação.
 * IMPORTANTE: não substitui a mecânica oficial; apenas chama as funções oficiais.
 * Comportamento:
 *   1º clique no menu principal -> abre a respectiva página.
 *   2º clique no MESMO menu -> abre/fecha uma lista compacta de especificidades.
 *   Clique em uma especificidade -> executa a ação oficial correspondente.
 */
(function(){
  'use strict';

  function init(){
    const nav = document.getElementById('v102-bottom-nav');
    const ctx = document.getElementById('v102-context-bar');
    const overlay = document.getElementById('v105-sheet-overlay');
    const sheetBody = document.getElementById('v105-sheet-body');
    const sheetTitle = document.getElementById('v105-sheet-title');
    const sheetClose = document.getElementById('v105-sheet-close');
    if(!nav || !ctx) return;

    const official = {
      faixas: {
        'Visão geral': {title:'Visão geral do ranking', text:'Exibe o ranking oficial das duas faixas.', actions:[
          ['Abrir visão geral',()=>scrollToId('view-faixas')],
          ['Ir para Faixa X',()=>scrollToId('div-x')],
          ['Ir para Faixa Y',()=>scrollToId('div-y')]
        ]},
        'Faixa X': {title:'Faixa X', text:'Exibe os participantes e pontuações da Faixa X.', actions:[['Abrir Faixa X',()=>scrollToId('div-x')]]},
        'Faixa Y': {title:'Faixa Y', text:'Exibe os participantes e pontuações da Faixa Y.', actions:[['Abrir Faixa Y',()=>scrollToId('div-y')]]}
      },
      analises: {
        'Visão geral': {title:'Análises gerais', text:'Estatísticas, mini-rankings e componentes analíticos oficiais.', actions:[['Abrir análises',()=>scrollToId('view-analises')]]},
        'Período': {title:'Filtrar por período', text:'Filtro oficial por intervalo de datas.', actions:[['Usar filtro por período',()=>callOfficial(()=>window.setFiltroModo('periodo'))]]},
        'Dias específicos': {title:'Filtrar por dias específicos', text:'Seleciona os dias que entram nas análises.', actions:[['Selecionar dias',()=>callOfficial(()=>window.setFiltroModo('dias'))]]},
        'Evolução': {title:'Evolução acumulada', text:'Mostra a evolução acumulada dos participantes.', actions:[['Ver evolução',()=>scrollToId('evolucao-chart-x')],['Ver evolução da Faixa Y',()=>scrollToId('evolucao-chart-y')]]},
        'Mapa de desempenho': {title:'Mapa de desempenho', text:'Cruza participante e dia com os dados oficiais.', actions:[['Ver mapa da Faixa X',()=>scrollToId('heatmap-wrap-x')],['Ver mapa da Faixa Y',()=>scrollToId('heatmap-wrap-y')]]},
        'Resumos salvos': {title:'Resumos salvos', text:'Histórico oficial de resumos persistidos.', actions:[['Abrir resumos salvos',()=>scrollToId('ultimo-resumo-wrap')]]}
      },
      lancar: {
        'Preencher': {title:'Preencher lançamento', text:'Abre o formulário oficial de lançamento.', actions:[['Abrir preenchimento',()=>callOfficial(()=>window.switchLaunchTab('form'))]]},
        'Colar dados': {title:'Colar dados', text:'Abre o fluxo oficial de colagem e conferência.', actions:[['Abrir colagem',()=>callOfficial(()=>window.switchLaunchTab('paste'))]]},
        'OCR': {title:'Ler pontuação de um print', text:'Abre o seletor do mecanismo oficial de OCR.', actions:[['Selecionar imagem',()=>{const el=document.getElementById('ocr-file-input');if(el)el.click();}]]},
        'Resumo do dia': {title:'Resumo do dia', text:'Gera o resumo usando a função oficial.', actions:[['Ir para resumo',()=>scrollToId('summary-output')],['Gerar resumo',()=>callOfficial(()=>window.generateSummary())]]},
        'Dias lançados': {title:'Dias lançados', text:'Consulta os dias lançados pelo mecanismo oficial.', actions:[['Abrir dias lançados',()=>scrollToId('day-list')]]}
      },
      config: {
        'Configurações gerais': {title:'Configurações gerais', text:'Área oficial de configurações e administração.', actions:[['Abrir configurações',()=>scrollToId('view-config')]]},
        'Minha conta': {title:'Minha conta', text:'Dados da sessão e gerenciamento da conta.', actions:[['Abrir minha conta',()=>callOfficial(()=>window.mostrarView('conta'))]]},
        'Usuários': {title:'Usuários', text:'Painel administrativo de usuários.', actions:[['Abrir usuários',()=>scrollToId('user-list')]]},
        'Atividade recente': {title:'Atividade recente', text:'Registros de atividade do sistema.', actions:[['Abrir atividade',()=>scrollToId('log-list')]]},
        'Resumos salvos': {title:'Resumos salvos', text:'Histórico oficial de resumos.', actions:[['Abrir histórico',()=>scrollToId('resumos-salvos-lista')]]},
        'Sair': {title:'Sair da conta', text:'Encerra a sessão pelo mecanismo oficial.', actions:[['Sair da conta',()=>callOfficial(()=>{if(typeof window.handleLogout==='function')window.handleLogout();})]]}
      }
    };

    let activeView = 'faixas';
    let expanded = false;

    function escapeHtml(v){return String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
    function closeSheet(){if(!overlay)return;overlay.classList.add('hidden');overlay.setAttribute('aria-hidden','true');document.body.classList.remove('v105-sheet-open');}
    function scrollToId(id){const el=document.getElementById(id);if(el){el.scrollIntoView({behavior:'smooth',block:'center'});}closeSheet();}
    function callOfficial(fn){try{if(typeof fn==='function')fn();}catch(e){console.error('Falha na ação oficial:',e);}closeSheet();}
    function openSheet(item){
      if(!overlay||!sheetBody||!sheetTitle)return;
      sheetTitle.textContent=item.title;
      sheetBody.innerHTML='<p class="v105-sheet-description">'+escapeHtml(item.text)+'</p><div class="v105-sheet-actions">'+item.actions.map((a,i)=>'<button type="button" class="v105-sheet-action" data-action-index="'+i+'">'+escapeHtml(a[0])+'</button>').join('')+'</div>';
      overlay.classList.remove('hidden');overlay.setAttribute('aria-hidden','false');document.body.classList.add('v105-sheet-open');
    }

    function setExpanded(value){
      expanded=!!value;
      ctx.classList.toggle('v102-context-open',expanded);
      ctx.setAttribute('aria-hidden',expanded?'false':'true');
      ctx.classList.toggle('hidden',!expanded);
    }

    function renderContext(view){
      const items=official[view]||{};
      const labels=Object.keys(items);
      activeView=view;
      ctx.dataset.count=String(labels.length);
      ctx.innerHTML=labels.map((label,i)=>'<button type="button" class="v102-context-btn'+(i===0?' active':'')+'" data-context-view="'+escapeHtml(view)+'" data-context-index="'+i+'">'+escapeHtml(label)+'</button>').join('');
    }

    function renderMain(view){
      nav.querySelectorAll('.v102-nav-btn').forEach(btn=>btn.classList.toggle('active',btn.dataset.v102View===view));
      renderContext(view);
    }

    function goMain(view){
      try{
        if(typeof window.mostrarView==='function') window.mostrarView(view);
        else console.warn('mostrarView ainda não está disponível');
      }catch(e){console.error('Erro ao abrir página '+view+':',e);return;}
      renderMain(view);
    }

    function currentOfficialView(){
      const views=['faixas','analises','lancar','config','conta'];
      for(const v of views){const el=document.getElementById('view-'+v);if(el&&!el.classList.contains('hidden'))return v;}
      return 'faixas';
    }

    /* Delegação: os eventos continuam funcionando mesmo que o projeto oficial
       reconstrua partes do DOM. Não usamos MutationObserver. */
    document.addEventListener('click',function(e){
      const main=e.target.closest && e.target.closest('.v102-nav-btn');
      if(main && nav.contains(main)){
        e.preventDefault();e.stopPropagation();
        const view=main.dataset.v102View;
        if(activeView===view && !expanded){setExpanded(true);return;}
        if(activeView===view && expanded){setExpanded(false);return;}
        setExpanded(false);goMain(view);return;
      }

      const context=e.target.closest && e.target.closest('.v102-context-btn');
      if(context && ctx.contains(context)){
        e.preventDefault();e.stopPropagation();
        ctx.querySelectorAll('.v102-context-btn').forEach(b=>b.classList.remove('active'));context.classList.add('active');
        const items=official[context.dataset.contextView]||{};
        const item=items[Object.keys(items)[Number(context.dataset.contextIndex)]];
        if(item)openSheet(item);
        return;
      }

      const action=e.target.closest && e.target.closest('.v105-sheet-action');
      if(action && sheetBody && sheetBody.contains(action)){
        e.preventDefault();e.stopPropagation();
        /* Reencontra a ação a partir do botão, sem eval e sem closures perdidas. */
        const view=activeView;const items=official[view]||{};const labels=Object.keys(items);
        const current=ctx.querySelector('.v102-context-btn.active');
        const idx=current?Number(current.dataset.contextIndex):0;
        const item=items[labels[idx]];
        const ai=Number(action.dataset.actionIndex);
        if(item&&item.actions[ai])item.actions[ai][1]();
        return;
      }

      if(e.target===overlay){closeSheet();return;}
      if(e.target.closest && e.target.closest('#v105-sheet-close')){closeSheet();return;}
    },true);

    if(sheetClose)sheetClose.addEventListener('click',closeSheet);
    document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeSheet();setExpanded(false);}});

    /* Estado inicial: somente Ranking aparece; a lista contextual fica fechada.
       O primeiro clique sempre é navegação. O segundo clique no mesmo menu abre
       a lista compacta. */
    renderMain(currentOfficialView()==='conta'?'config':currentOfficialView());
    setExpanded(false);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();
