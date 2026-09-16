/* ============================================================================
   startup-motion.js — abertura acessível e não bloqueante do Ranking Geral
   ----------------------------------------------------------------------------
   Usa o renderer RGMotion fornecido pela animação aprovada pelo usuário.
   - Preserva a imagem oficial da marca (assets/logo-ranking-geral.png).
   - Efeitos em configuração INTENSA (glow = 1).
   - A aplicação carrega em paralelo: RGStartup.done() acelera suavemente o
     restante da animação e nunca transforma a abertura em espera longa.
   - Respeita prefers-reduced-motion e a preferência persistente A11Y.motion.
   - Permite "Pular animação" sem liberar a interface antes de os dados estarem
     realmente prontos: nesse caso mantém o quadro final estático.
   ============================================================================ */
(function(){
  'use strict';

  const splash = document.getElementById('rg-startup');
  const canvas = document.getElementById('rg-startup-canvas');
  const fallback = document.getElementById('rg-startup-fallback');
  const statusEl = document.getElementById('rg-startup-status');
  const liveEl = document.getElementById('rg-startup-live');
  const progress = document.getElementById('rg-startup-progress');
  const bar = document.getElementById('rg-startup-progress-bar');
  const skipBtn = document.getElementById('rg-startup-skip');
  if(!splash || !canvas) return;

  const ctx = canvas.getContext('2d', { alpha:true, desynchronized:true });
  const DURATION = (window.RGMotion && Number(window.RGMotion.DURATION)) || 6.4;
  const INTENSE_GLOW = 1;
  const motionMedia = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  const image = new Image();
  const canvasFactory = (w,h)=>{ const c=document.createElement('canvas'); c.width=w; c.height=h; return c; };

  let renderer = null;
  let frame = 0;
  let last = 0;
  let time = 0;
  let visible = true;
  let ready = false;
  let skipped = false;
  let finishing = false;
  let finishStart = 0;
  let finishFrom = 0;
  let finishMs = 0;
  let hiddenTimer = 0;
  let playbackGeneration = 0;

  function appPrefersReducedMotion(){
    return !!((motionMedia && motionMedia.matches) || (window.A11Y && window.A11Y.estado && window.A11Y.estado.motion));
  }


  function toggleUnderlyingInert(on){
    ['slot-modulo-0','app-shell','a11y-toggle-btn'].forEach(function(id){
      const el=document.getElementById(id); if(!el) return;
      try{ el.inert=!!on; }catch(e){ if(on) el.setAttribute('aria-hidden','true'); else el.removeAttribute('aria-hidden'); }
    });
  }

  function setStatus(text, percent){
    if(statusEl && text) statusEl.textContent = text;
    if(liveEl && text && liveEl.textContent !== text) liveEl.textContent = text;
    if(Number.isFinite(percent)){
      const p = Math.max(0, Math.min(100, percent));
      if(bar) bar.style.width = p + '%';
      if(progress){
        progress.setAttribute('aria-valuenow', String(Math.round(p)));
        progress.setAttribute('aria-valuetext', Math.round(p) + '% — ' + (text || 'Carregando'));
      }
    }
  }

  function fitCanvas(){
    const rect = canvas.getBoundingClientRect();
    if(!rect.width || !rect.height) return;
    const mobile = Math.min(window.innerWidth || 9999, window.innerHeight || 9999) < 700;
    const dpr = Math.min(mobile ? 1.35 : 1.7, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.round(rect.width * dpr));
    const h = Math.max(1, Math.round(rect.height * dpr));
    if(canvas.width !== w || canvas.height !== h){ canvas.width=w; canvas.height=h; }
    paint();
  }

  function paint(){
    if(!ctx) return;
    if(renderer){
      const reduced = appPrefersReducedMotion() || skipped;
      const drawTime = reduced ? DURATION : time;
      renderer.draw(ctx, canvas.width, canvas.height, drawTime, { theme:'dark', glow:INTENSE_GLOW });
      if(fallback) fallback.hidden = true;
    }else if(fallback){
      fallback.hidden = false;
    }
  }

  function stopFrame(){ if(frame){ cancelAnimationFrame(frame); frame=0; } }

  function hideSplash(delay){
    if(!visible) return;
    clearTimeout(hiddenTimer);
    hiddenTimer = window.setTimeout(function(){
      visible = false;
      stopFrame();
      splash.classList.add('rg-startup-hide');
      splash.setAttribute('aria-hidden','true');
      if(skipBtn) skipBtn.setAttribute('tabindex','-1');
      document.body && document.body.removeAttribute('data-startup-visible');
      toggleUnderlyingInert(false);
    }, Math.max(0, delay || 0));
  }

  function tick(now){
    if(!visible) return;
    if(appPrefersReducedMotion() || skipped){
      time = DURATION;
      paint();
      if(ready) hideSplash(90);
      return;
    }

    if(finishing){
      const q = Math.min(1, (now - finishStart) / Math.max(1, finishMs));
      const ease = 1 - Math.pow(1-q, 3);
      time = finishFrom + (DURATION - finishFrom) * ease;
      paint();
      if(q >= 1){
        finishing = false;
        hideSplash(115);
        return;
      }
    }else{
      if(last) time = Math.min(DURATION, time + (now-last)/1000);
      last = now;
      paint();
      // Se o carregamento ainda não acabou, o último quadro permanece estático.
      if(time >= DURATION){
        time = DURATION;
        paint();
        if(ready){ hideSplash(115); return; }
      }
    }
    frame = requestAnimationFrame(tick);
  }

  function startFrames(){
    stopFrame();
    last = 0;
    frame = requestAnimationFrame(tick);
  }

  function show(text, percent){
    playbackGeneration++;
    clearTimeout(hiddenTimer);
    visible = true;
    ready = false;
    skipped = false;
    finishing = false;
    finishStart = finishFrom = finishMs = 0;
    time = appPrefersReducedMotion() ? DURATION : 0;
    splash.classList.remove('rg-startup-hide');
    splash.setAttribute('aria-hidden','false');
    if(skipBtn) skipBtn.removeAttribute('tabindex');
    document.body && document.body.setAttribute('data-startup-visible','true');
    toggleUnderlyingInert(true);
    setStatus(text || 'Preparando interface…', Number.isFinite(percent) ? percent : 10);
    fitCanvas();
    startFrames();
  }

  function finishAnimation(){
    if(!visible) return;
    ready = true;
    if(appPrefersReducedMotion() || skipped){
      time = DURATION;
      paint();
      hideSplash(90);
      return;
    }
    if(!renderer){
      // Nunca segure a aplicação apenas porque o renderer gráfico demorou.
      hideSplash(180);
      return;
    }
    if(time >= DURATION - 0.03){ hideSplash(115); return; }
    finishing = true;
    finishStart = performance.now();
    finishFrom = time;
    // Mostra todo o restante da sequência, mas acrescenta no máximo ~0,85 s.
    const remaining = Math.max(0, DURATION-time);
    finishMs = Math.max(260, Math.min(850, remaining * 155));
    startFrames();
  }

  window.RGStartup = {
    show,
    status:setStatus,
    done:function(text){ setStatus(text || 'Painel pronto', 100); finishAnimation(); },
    isVisible:function(){ return visible; },
    reduceMotion:function(){ skipped=true; time=DURATION; paint(); if(ready) hideSplash(90); }
  };

  if(skipBtn){
    skipBtn.addEventListener('click', function(){
      skipped = true;
      time = DURATION;
      paint();
      skipBtn.disabled = true;
      skipBtn.textContent = 'Animação reduzida';
      setStatus(ready ? 'Painel pronto' : 'Carregando dados…', ready ? 100 : Number(progress?.getAttribute('aria-valuenow') || 55));
      if(ready) hideSplash(90);
    });
  }

  if(motionMedia && motionMedia.addEventListener){
    motionMedia.addEventListener('change', function(){
      if(appPrefersReducedMotion()){
        time=DURATION; paint();
        if(ready) hideSplash(90);
      }else if(visible && !skipped){ startFrames(); }
    });
  }
  window.addEventListener('a11y:change', function(){
    if(appPrefersReducedMotion()){
      time=DURATION; paint();
      if(ready) hideSplash(90);
    }else if(visible && !skipped){ startFrames(); }
  });

  document.addEventListener('visibilitychange', function(){
    if(document.hidden){ stopFrame(); }
    else if(visible && !appPrefersReducedMotion() && !skipped){ last=0; startFrames(); }
  });

  if(window.ResizeObserver){ new ResizeObserver(fitCanvas).observe(canvas); }
  else window.addEventListener('resize', fitCanvas, {passive:true});

  image.onload = function(){
    try{
      if(window.RGMotion){ renderer = window.RGMotion.createRenderer(image, canvasFactory); }
      paint();
    }catch(error){
      console.warn('A animação da marca não pôde ser preparada; usando logo estática.', error);
      renderer = null;
      if(fallback) fallback.hidden = false;
    }
  };
  image.onerror = function(){
    console.warn('A imagem oficial da marca não pôde ser carregada para a abertura.');
    if(fallback) fallback.hidden = false;
  };
  image.src = './assets/logo-ranking-geral.png';

  document.addEventListener('DOMContentLoaded', function(){ if(visible) toggleUnderlyingInert(true); }, {once:true});

  // A abertura começa imediatamente; a inicialização real da aplicação ocorre
  // em paralelo quando inicializacao.js chega ao DOMContentLoaded.
  show('Preparando interface…', 10);
})();
