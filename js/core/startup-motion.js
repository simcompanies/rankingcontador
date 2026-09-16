/* ============================================================================
   startup-motion.js — integração real da animação aprovada no Ranking Geral
   ----------------------------------------------------------------------------
   - usa o RGMotion original, sem player de demonstração;
   - usa a mesma imagem original da animação enviada;
   - 6,4 s, velocidade 1x, tema escuro e glow = 1;
   - o app carrega por trás da abertura;
   - a animação só ocorre na abertura inicial desta página;
   - login/cadastro posteriores não reabrem o splash;
   - reduced-motion usa o quadro final estático.
   ============================================================================ */
(function(){
  'use strict';
  const splash=document.getElementById('rg-startup');
  const canvas=document.getElementById('rg-startup-canvas');
  const fallback=document.getElementById('rg-startup-fallback');
  const skip=document.getElementById('rg-startup-skip');
  const live=document.getElementById('rg-startup-live');
  if(!splash||!canvas) return;

  const ctx=canvas.getContext('2d');
  const DURATION=(window.RGMotion&&Number(window.RGMotion.DURATION))||6.4;
  const INTENSE_GLOW=1;
  const motionMedia=window.matchMedia?window.matchMedia('(prefers-reduced-motion: reduce)'):null;
  const image=new Image();
  const factory=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;};

  let renderer=null,time=0,last=0,raf=0;
  let appReady=false,finished=false,skipped=false,visible=true;
  let initialIntro=true;

  function reduced(){
    return !!((motionMedia&&motionMedia.matches)||(window.A11Y&&window.A11Y.estado&&window.A11Y.estado.motion));
  }
  function announce(text){if(live&&text&&live.textContent!==text)live.textContent=text;}
  function inertUnderlying(on){
    ['slot-modulo-0','app-shell','a11y-toggle-btn'].forEach(id=>{
      const el=document.getElementById(id);if(!el)return;
      try{el.inert=!!on;}catch(_){if(on)el.setAttribute('aria-hidden','true');else el.removeAttribute('aria-hidden');}
    });
  }
  function fitCanvas(){
    const r=canvas.getBoundingClientRect();if(!r.width||!r.height)return;
    const dpr=Math.min(2,window.devicePixelRatio||1);
    const w=Math.max(1,Math.round(r.width*dpr)),h=Math.max(1,Math.round(r.height*dpr));
    if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
    paint();
  }
  function paint(){
    if(renderer){
      renderer.draw(ctx,canvas.width,canvas.height,(reduced()||skipped)?DURATION:time,{theme:'dark',glow:INTENSE_GLOW});
      if(fallback)fallback.hidden=true;
    }else if((reduced()||skipped)&&fallback){fallback.hidden=false;}
  }
  function stop(){if(raf){cancelAnimationFrame(raf);raf=0;}}
  function hide(){
    if(!visible)return;visible=false;stop();
    splash.classList.add('rg-startup-hide');splash.setAttribute('aria-hidden','true');
    if(skip)skip.setAttribute('tabindex','-1');
    document.body&&document.body.removeAttribute('data-startup-visible');
    inertUnderlying(false);announce('Ranking Geral pronto.');
  }
  function maybeFinish(){
    if(!visible)return;
    if((finished||skipped||reduced())&&appReady)window.setTimeout(hide,100);
  }
  function tick(now){
    if(!visible||skipped||reduced())return;
    if(last)time=Math.min(DURATION,time+(now-last)/1000);
    last=now;paint();
    if(time>=DURATION){time=DURATION;finished=true;paint();announce('Animação concluída.');maybeFinish();return;}
    raf=requestAnimationFrame(tick);
  }
  function start(){stop();last=0;raf=requestAnimationFrame(tick);}

  // API consumida pelo restante do projeto. Após a abertura inicial, show/status/done
  // não reabrem a animação: login e cadastro permanecem rápidos.
  window.RGStartup={
    show:function(text){announce(text||'Carregando…');},
    status:function(text){announce(text||'Carregando…');},
    done:function(text){appReady=true;announce(text||'Painel pronto.');maybeFinish();},
    isVisible:function(){return visible;},
    reduceMotion:function(){skipped=true;time=DURATION;stop();paint();maybeFinish();}
  };

  document.body&&document.body.setAttribute('data-startup-visible','true');
  document.addEventListener('DOMContentLoaded',()=>inertUnderlying(visible));

  if(skip)skip.addEventListener('click',()=>{skipped=true;time=DURATION;stop();paint();announce('Animação pulada.');maybeFinish();});
  document.addEventListener('keydown',e=>{if(visible&&e.key==='Escape'&&!e.defaultPrevented){skipped=true;time=DURATION;stop();paint();maybeFinish();}});
  if(motionMedia&&motionMedia.addEventListener)motionMedia.addEventListener('change',()=>{if(reduced()){skipped=true;time=DURATION;stop();paint();maybeFinish();}});
  window.addEventListener('a11y:change',()=>{if(reduced()){skipped=true;time=DURATION;stop();paint();maybeFinish();}});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();else if(visible&&!finished&&!skipped&&!reduced()&&renderer){last=0;start();}});
  if(window.ResizeObserver)new ResizeObserver(fitCanvas).observe(canvas);else window.addEventListener('resize',fitCanvas,{passive:true});

  image.onload=()=>{
    try{
      renderer=window.RGMotion.createRenderer(image,factory);
      time=reduced()?DURATION:0;fitCanvas();
      if(reduced()){finished=true;paint();maybeFinish();}
      else start();
    }catch(err){
      console.warn('Falha ao preparar animação de abertura; usando logo estática.',err);
      if(fallback)fallback.hidden=false;finished=true;maybeFinish();
    }
  };
  image.onerror=()=>{if(fallback)fallback.hidden=false;finished=true;maybeFinish();};
  image.src='./assets/logo-ranking-geral.png';
})();
