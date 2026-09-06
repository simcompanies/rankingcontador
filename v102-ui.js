(function(){
  const nav = document.getElementById('v102-bottom-nav');
  const ctx = document.getElementById('v102-context-bar');
  const maps = {
    faixas:[['Adicionar participante',"addParticipant('x')"],['Adicionar dia','addDay()'],['Regras de pontuação',"document.querySelector('#div-x')?.scrollIntoView({behavior:'smooth'})"]],
    analises:[['Por período',"document.getElementById('filtro-modo-periodo')?.click()"],['Dias específicos',"document.getElementById('filtro-modo-dias')?.click()"],['Resumo salvo',"document.getElementById('resumos-salvos')?.scrollIntoView({behavior:'smooth'})"]],
    lancar:[['Preencher',"switchLaunchTab('form')"],['Colar dados',"switchLaunchTab('paste')"],['Gerenciar dias',"document.getElementById('gerenciar-dias-lancados')?.scrollIntoView({behavior:'smooth'})"]],
    config:[['Minha conta',"mostrarView('conta')"],['Usuários',"document.getElementById('usuarios')?.scrollIntoView({behavior:'smooth'})"],['Sair','handleLogout()']]
  };
  function isLogged(){return !!window.sessaoUsuario || !!document.getElementById('view-faixas')?.classList.contains('hidden')===false;}
  function renderCtx(view){
    if(!ctx) return; const items=maps[view]||[];
    ctx.innerHTML=items.map((it,i)=>`<button type="button" class="v102-context-btn ${i===0?'active':''}" data-action="${i}">${it[0]}</button>`).join('');
    ctx.querySelectorAll('button').forEach(btn=>btn.addEventListener('click',()=>{const a=maps[view]?.[Number(btn.dataset.action)]; if(!a) return; try{new Function(a[1])()}catch(e){console.warn(e)}}));
  }
  function apply(view){
    if(!nav || !ctx) return;
    nav.querySelectorAll('.v102-nav-btn').forEach(b=>b.classList.toggle('active',b.dataset.v102View===view));
    renderCtx(view);
    const logged = !document.getElementById('view-modulo-0') || document.getElementById('view-modulo-0')?.classList.contains('hidden');
    nav.style.display = logged ? '' : 'none'; ctx.style.display = logged ? 'flex' : 'none';
  }
  const original = window.mostrarView;
  window.mostrarView=function(view){
    if((view==='lancar'||view==='config') && typeof window.souAdmin==='function' && !window.souAdmin()){view='faixas'}
    if(typeof original==='function') original(view); else {
      ['faixas','analises','lancar','config','conta'].forEach(v=>document.getElementById('view-'+v)?.classList.toggle('hidden',v!==view));
    }
    apply(view);
  };
  nav?.querySelectorAll('.v102-nav-btn').forEach(btn=>btn.addEventListener('click',()=>window.mostrarView(btn.dataset.v102View)));
  const obs=new MutationObserver(()=>{ const active=['faixas','analises','lancar','config','conta'].find(v=>!document.getElementById('view-'+v)?.classList.contains('hidden')); if(active) apply(active==='conta'?'config':active); });
  obs.observe(document.body,{subtree:true,attributes:true,attributeFilter:['class']});
  window.addEventListener('load',()=>setTimeout(()=>window.mostrarView('faixas'),250));
})();
