/* Camada visual da nova interface. Não substitui a mecânica oficial. */
(function(){
  const nav = document.getElementById('v102-bottom-nav');
  const ctx = document.getElementById('v102-context-bar');
  const overlay = document.getElementById('v105-sheet-overlay');
  const body = document.getElementById('v105-sheet-body');
  const title = document.getElementById('v105-sheet-title');
  const close = document.getElementById('v105-sheet-close');
  if(!nav || !ctx || !overlay || !body || !title || !close) return;

  const official = {
    faixas: {
      'Visão geral': {title:'Visão geral do ranking', text:'Exibe o ranking oficial das duas faixas e permite trabalhar diretamente sobre os dados carregados.', actions:[
        ['Abrir visão geral', ()=>scrollToId('view-faixas')],
        ['Ir para Faixa X', ()=>scrollToId('div-x')],
        ['Ir para Faixa Y', ()=>scrollToId('div-y')]
      ]},
      'Faixa X': {title:'Faixa X', text:'Faixa oficial com os participantes e pontuações correspondentes à divisão X. A ordenação e o acumulado continuam sendo calculados pelo módulo oficial de participantes.', actions:[['Abrir Faixa X',()=>scrollToId('div-x')]]},
      'Faixa Y': {title:'Faixa Y', text:'Faixa oficial com os participantes e pontuações correspondentes à divisão Y. O botão atua somente como acesso visual; a regra do ranking continua sendo a do projeto oficial.', actions:[['Abrir Faixa Y',()=>scrollToId('div-y')]]}
    },
    analises: {
      'Visão geral': {title:'Análises gerais', text:'A área oficial reúne estatísticas gerais, mini-rankings e os componentes analíticos calculados a partir dos dias lançados.', actions:[['Abrir análises',()=>scrollToId('view-analises')]]},
      'Período': {title:'Filtrar por período', text:'Usa o mecanismo oficial de filtros por data. O intervalo escolhido recalcula o ranking filtrado, destaques, evolução e mapa de desempenho.', actions:[['Usar filtro por período',()=>callOfficial(()=>window.setFiltroModo('periodo'))]]},
      'Dias específicos': {title:'Filtrar por dias específicos', text:'Permite selecionar manualmente os dias lançados que entram nas análises, usando o conjunto oficial de dias selecionados.', actions:[['Selecionar dias',()=>callOfficial(()=>window.setFiltroModo('dias'))]]},
      'Evolução': {title:'Evolução acumulada', text:'O gráfico oficial mostra a evolução acumulada dos participantes considerando os dias atualmente filtrados.', actions:[['Ver evolução',()=>scrollToId('evolucao-chart-x')],['Ver evolução da Faixa Y',()=>scrollToId('evolucao-chart-y')]]},
      'Mapa de desempenho': {title:'Mapa de desempenho', text:'O mapa oficial cruza participante e dia, mantendo os valores e o filtro aplicado pelo módulo de análises.', actions:[['Ver mapa da Faixa X',()=>scrollToId('heatmap-wrap-x')],['Ver mapa da Faixa Y',()=>scrollToId('heatmap-wrap-y')]]},
      'Resumos salvos': {title:'Resumos salvos', text:'O histórico oficial de resumos é carregado do servidor e permanece separado dos dados operacionais do ranking.', actions:[['Abrir resumos salvos',()=>scrollToId('ultimo-resumo-wrap')]]}
    },
    lancar: {
      'Preencher': {title:'Preencher lançamento', text:'Abre a aba oficial de preenchimento do dia. O formulário trabalha com as duas faixas e respeita os participantes e dias existentes no estado oficial.', actions:[['Abrir preenchimento',()=>callOfficial(()=>window.switchLaunchTab('form'))]]},
      'Colar dados': {title:'Colar dados', text:'Abre o fluxo oficial de colagem. O texto é interpretado, colocado em conferência e só depois aplicado ao dia e à faixa escolhidos.', actions:[['Abrir colagem',()=>callOfficial(()=>window.switchLaunchTab('paste'))]]},
      'OCR': {title:'Ler pontuação de um print', text:'Usa o mecanismo oficial de OCR para extrair os dados de um print e alimentar o mesmo fluxo de conferência da colagem.', actions:[['Selecionar imagem',()=>{ const el=document.getElementById('ocr-file-input'); if(el) el.click(); }]]},
      'Resumo do dia': {title:'Resumo do dia', text:'Gera o texto do resumo usando a função oficial de resumo e permite copiar ou salvar o resultado no histórico.', actions:[['Ir para resumo',()=>scrollToId('summary-output')],['Gerar resumo',()=>callOfficial(()=>window.generateSummary()))]]},
      'Dias lançados': {title:'Dias lançados', text:'Lista oficial para consultar e, quando autorizado, remover dias lançados. A remoção desloca os dias posteriores conforme a mecânica oficial.', actions:[['Abrir dias lançados',()=>scrollToId('day-list')]]}
    },
    config: {
      'Configurações gerais': {title:'Configurações gerais', text:'Área oficial de administração, histórico, dias e resumos. As permissões continuam sendo definidas pelo papel do usuário.', actions:[['Abrir configurações',()=>scrollToId('view-config')]]},
      'Minha conta': {title:'Minha conta', text:'Exibe os dados da sessão atual e usa o fluxo oficial para solicitar uma nova senha.', actions:[['Abrir minha conta',()=>callOfficial(()=>window.mostrarView('conta'))]]},
      'Usuários': {title:'Usuários', text:'Painel administrativo oficial para listar usuários e, conforme a permissão, alterar papel, enviar código temporário ou remover usuários.', actions:[['Abrir usuários',()=>scrollToId('user-list')]]},
      'Atividade recente': {title:'Atividade recente', text:'Mostra os registros de atividade retornados pelo sistema oficial.', actions:[['Abrir atividade',()=>scrollToId('log-list')]]},
      'Resumos salvos': {title:'Resumos salvos', text:'Consulta o histórico oficial persistido no servidor.', actions:[['Abrir histórico',()=>scrollToId('resumos-salvos-lista')]]}
    }
  };

  function scrollToId(id){ const el=document.getElementById(id); if(el) el.scrollIntoView({behavior:'smooth',block:'center'}); closeSheet(); }
  function callOfficial(fn){ try { fn(); } catch(e){ console.warn('Ação oficial indisponível',e); } closeSheet(); }
  function openSheet(item){
    title.textContent=item.title;
    body.innerHTML=`<p class="v105-sheet-description">${escapeHtml(item.text)}</p><div class="v105-sheet-actions">${item.actions.map((a,i)=>`<button type="button" class="v105-sheet-action" data-action-index="${i}">${escapeHtml(a[0])}</button>`).join('')}</div>`;
    const buttons=[...body.querySelectorAll('.v105-sheet-action')];
    buttons.forEach((b,i)=>b.addEventListener('click',()=>item.actions[i][1]()));
    overlay.classList.remove('hidden'); overlay.setAttribute('aria-hidden','false'); document.body.classList.add('v105-sheet-open');
  }
  function closeSheet(){ overlay.classList.add('hidden'); overlay.setAttribute('aria-hidden','true'); document.body.classList.remove('v105-sheet-open'); }
  close.addEventListener('click',closeSheet); overlay.addEventListener('click',e=>{if(e.target===overlay) closeSheet();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape') closeSheet();});
  function escapeHtml(v){return String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
  function activeView(){return ['faixas','analises','lancar','config','conta'].find(v=>{const el=document.getElementById('view-'+v);return el&&!el.classList.contains('hidden');})||'faixas';}
  function isLogged(){const login=document.getElementById('view-modulo-0');return !login||login.classList.contains('hidden');}
  function render(view){
    const normalized=view==='conta'?'config':view;
    nav.querySelectorAll('.v102-nav-btn').forEach(btn=>btn.classList.toggle('active',btn.dataset.v102View===normalized));
    const items=official[normalized]||[]; const list=Object.keys(items);
    ctx.dataset.count=String(list.length);
    ctx.innerHTML=list.map((label,i)=>`<button type="button" class="v102-context-btn${i===0?' active':''}" data-context-index="${i}">${escapeHtml(label)}</button>`).join('');
    ctx.querySelectorAll('.v102-context-btn').forEach(btn=>btn.addEventListener('click',()=>{ctx.querySelectorAll('.v102-context-btn').forEach(b=>b.classList.remove('active'));btn.classList.add('active');openSheet(items[list[Number(btn.dataset.contextIndex)]]);}));
  }
  nav.querySelectorAll('.v102-nav-btn').forEach(btn=>btn.addEventListener('click',()=>{if(typeof window.mostrarView==='function')window.mostrarView(btn.dataset.v102View);}));
  const obs=new MutationObserver(()=>{if(isLogged())render(activeView());nav.style.display=isLogged()?'':'none';ctx.style.display=isLogged()?'flex':'none';});
  obs.observe(document.body,{subtree:true,attributes:true,attributeFilter:['class']});
  window.addEventListener('load',()=>setTimeout(()=>{if(isLogged())render(activeView());},300));
})();
