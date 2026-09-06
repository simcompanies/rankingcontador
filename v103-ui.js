/* Camada exclusivamente visual da nova interface mobile.
   Não altera estado, regras, API, autenticação, ranking ou persistência.
   A navegação usa as funções oficiais já existentes (mostrarView/switchLaunchTab).
*/
(function(){
  const nav = document.getElementById('v102-bottom-nav');
  const ctx = document.getElementById('v102-context-bar');
  if(!nav || !ctx) return;

  const context = {
    faixas: [
      ['Visão geral', "document.getElementById('view-faixas')?.scrollIntoView({behavior:'smooth', block:'start'})"],
      ['Faixa X', "document.getElementById('div-x')?.scrollIntoView({behavior:'smooth', block:'start'})"],
      ['Faixa Y', "document.getElementById('div-y')?.scrollIntoView({behavior:'smooth', block:'start'})"]
    ],
    analises: [
      ['Visão geral', "document.getElementById('view-analises')?.scrollIntoView({behavior:'smooth', block:'start'})"],
      ['Período', "document.getElementById('filtro-modo-periodo')?.click()"],
      ['Dias específicos', "document.getElementById('filtro-modo-dias')?.click()"],
      ['Evolução', "document.getElementById('evolucao-chart-x')?.scrollIntoView({behavior:'smooth', block:'center'})"],
      ['Mapa de desempenho', "document.getElementById('heatmap-wrap-x')?.scrollIntoView({behavior:'smooth', block:'center'})"],
      ['Resumos salvos', "document.getElementById('ultimo-resumo-wrap')?.scrollIntoView({behavior:'smooth', block:'center'})"]
    ],
    lancar: [
      ['Preencher', "typeof switchLaunchTab==='function' && switchLaunchTab('form')"],
      ['Colar dados', "typeof switchLaunchTab==='function' && switchLaunchTab('paste')"],
      ['OCR', "document.getElementById('ocr-file-input')?.click()"],
      ['Resumo do dia', "document.getElementById('summary-output')?.scrollIntoView({behavior:'smooth', block:'center'})"],
      ['Dias lançados', "document.getElementById('day-list')?.scrollIntoView({behavior:'smooth', block:'center'})"]
    ],
    config: [
      ['Configurações gerais', "document.getElementById('view-config')?.scrollIntoView({behavior:'smooth', block:'start'})"],
      ['Minha conta', "typeof mostrarView==='function' && mostrarView('conta')"],
      ['Usuários', "document.getElementById('user-list')?.scrollIntoView({behavior:'smooth', block:'center'})"],
      ['Atividade recente', "document.getElementById('log-list')?.scrollIntoView({behavior:'smooth', block:'center'})"],
      ['Resumos salvos', "document.getElementById('resumos-salvos-lista')?.scrollIntoView({behavior:'smooth', block:'center'})"]
    ]
  };

  function activeView(){
    return ['faixas','analises','lancar','config','conta'].find(v=>{
      const el=document.getElementById('view-'+v);
      return el && !el.classList.contains('hidden');
    }) || 'faixas';
  }

  function isLogged(){
    const login = document.getElementById('view-modulo-0');
    return !login || login.classList.contains('hidden');
  }

  function render(view){
    const normalized = view === 'conta' ? 'config' : view;
    nav.querySelectorAll('.v102-nav-btn').forEach(btn=>{
      btn.classList.toggle('active', btn.dataset.v102View === normalized);
    });
    const items = context[normalized] || [];
    ctx.dataset.count = String(items.length);
    ctx.innerHTML = items.map((item, i)=>
      `<button type="button" class="v102-context-btn${i===0?' active':''}" data-context-index="${i}">${item[0]}</button>`
    ).join('');
    ctx.querySelectorAll('.v102-context-btn').forEach(btn=>btn.addEventListener('click',()=>{
      ctx.querySelectorAll('.v102-context-btn').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      const item = items[Number(btn.dataset.contextIndex)];
      if(item && item[1]){
        try { (0,eval)(item[1]); } catch(e) { console.warn('Ação visual contextual indisponível', e); }
      }
    }));
  }

  nav.querySelectorAll('.v102-nav-btn').forEach(btn=>btn.addEventListener('click',()=>{
    const view=btn.dataset.v102View;
    if(typeof window.mostrarView==='function') window.mostrarView(view);
  }));

  const obs = new MutationObserver(()=>{
    if(isLogged()) render(activeView());
    nav.style.display = isLogged() ? '' : 'none';
    ctx.style.display = isLogged() ? 'flex' : 'none';
  });
  obs.observe(document.body,{subtree:true,attributes:true,attributeFilter:['class']});
  window.addEventListener('load',()=>setTimeout(()=>{if(isLogged()) render(activeView());},250));
})();
