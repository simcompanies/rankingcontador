from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
import re, shutil, subprocess, os

root=Path('/mnt/data/v24work')
assets=root/'assets'/'logo-vectors'
assets.mkdir(parents=True, exist_ok=True)

# Generate clean vector outlines for R/G from a bold sans font. These are converted to paths
# so the final logo is self-contained and does not depend on installed fonts.
font=TTFont('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf')
cmap=font.getBestCmap()

def glyph_path(ch):
    glyphset=font.getGlyphSet()
    pen=SVGPathPen(glyphset)
    glyphset[cmap[ord(ch)]].draw(pen)
    return pen.getCommands()

R_PATH=glyph_path('R')
G_PATH=glyph_path('G')

svg=f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" role="img" aria-labelledby="rgTitle rgDesc">
  <title id="rgTitle">Ranking Geral</title>
  <desc id="rgDesc">Símbolo oficial com arcos, barras de crescimento, letras R e G, setas e pódio.</desc>
  <defs>
    <linearGradient id="rgCyan" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#39E7F3"/><stop offset="1" stop-color="#01AACA"/></linearGradient>
    <linearGradient id="rgBlue" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#173E63"/><stop offset="1" stop-color="#012443"/></linearGradient>
    <linearGradient id="rgViolet" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#C9B7FF"/><stop offset="1" stop-color="#8F70FF"/></linearGradient>
    <linearGradient id="rgPink" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FF86C0"/><stop offset="1" stop-color="#FF5FAD"/></linearGradient>
    <linearGradient id="rgDown" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FF8A35"/><stop offset="1" stop-color="#FF4E18"/></linearGradient>
    <filter id="rgSoftGlow" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="18"/></filter>
  </defs>

  <!-- guias sutis de construção -->
  <g id="construction-guides" fill="none" stroke="#2E6C96" stroke-width="3" opacity=".15">
    <circle cx="500" cy="500" r="390"/>
    <circle cx="500" cy="500" r="300"/>
    <path d="M120 500h760M500 120v760"/>
  </g>

  <!-- brilho ambiente -->
  <circle cx="500" cy="500" r="270" fill="#01AACA" opacity=".08" filter="url(#rgSoftGlow)"/>

  <!-- arcos da identidade -->
  <g id="arcs" fill="none" stroke-linecap="round">
    <path id="arc-left" d="M160 520 A340 340 0 0 1 500 160" stroke="url(#rgCyan)" stroke-width="42" pathLength="1"/>
    <path id="arc-top" d="M250 265 A340 340 0 0 1 760 245" stroke="url(#rgViolet)" stroke-width="22" pathLength="1"/>
    <path id="arc-right" d="M815 285 A340 340 0 0 1 845 665" stroke="url(#rgCyan)" stroke-width="32" pathLength="1"/>
    <path id="arc-bottom" d="M180 700 A340 340 0 0 0 820 735" stroke="url(#rgViolet)" stroke-width="22" pathLength="1"/>
  </g>

  <!-- barras do gráfico -->
  <g id="bars" fill="url(#rgCyan)">
    <rect id="bar-1" x="360" y="300" width="54" height="145" rx="14"/>
    <rect id="bar-2" x="425" y="255" width="54" height="190" rx="14"/>
    <rect id="bar-3" x="490" y="205" width="54" height="240" rx="14"/>
    <rect id="bar-4" x="555" y="150" width="54" height="295" rx="14"/>
  </g>

  <!-- R -->
  <g id="letter-r" transform="translate(285 675) scale(.255 -.255)" fill="url(#rgBlue)" stroke="#082F4F" stroke-width="8" stroke-linejoin="round" pathLength="1">
    <path id="r-glyph" d="{R_PATH}"/>
  </g>

  <!-- G -->
  <g id="letter-g" fill="none" stroke="url(#rgCyan)" stroke-width="82" stroke-linecap="round" stroke-linejoin="round">
    <path id="g-ring" d="M710 485 A190 190 0 1 1 690 320" fill="none" pathLength="1"/>
    <path id="g-bar" d="M665 485h115" fill="none" pathLength="1"/>
  </g>

  <!-- seta de crescimento -->
  <g id="arrow-up" fill="url(#rgCyan)" stroke="#2ADDEA" stroke-linecap="round" stroke-linejoin="round">
    <path id="arrow-up-shaft" d="M470 590 L745 315" fill="none" stroke-width="40" pathLength="1"/>
    <path id="arrow-up-head" d="M704 300 L780 270 L752 347 Z" stroke-width="4"/>
  </g>

  <!-- seta de queda -->
  <g id="arrow-down" fill="url(#rgDown)" stroke="#FF6B29" stroke-linecap="round" stroke-linejoin="round">
    <path id="arrow-down-shaft" d="M845 340 A250 250 0 0 1 860 635" fill="none" stroke-width="28" pathLength="1"/>
    <path id="arrow-down-head" d="M835 625 L862 690 L892 628 Z" stroke-width="4"/>
  </g>

  <!-- pódio e participantes -->
  <g id="podium">
    <path id="podium-base-left" d="M265 820 H480 L420 870 H230 Z" fill="url(#rgBlue)"/>
    <path id="podium-base-right" d="M520 820 H735 L770 870 H580 Z" fill="url(#rgViolet)"/>
    <rect id="podium-left" x="285" y="785" width="135" height="110" rx="18" fill="url(#rgBlue)"/>
    <rect id="podium-center" x="430" y="745" width="140" height="150" rx="20" fill="url(#rgCyan)"/>
    <rect id="podium-right" x="580" y="785" width="135" height="110" rx="18" fill="url(#rgBlue)"/>
  </g>
  <g id="people" fill="#EAF5FF">
    <g id="person-left"><circle cx="350" cy="740" r="30"/><path d="M300 775 Q350 735 400 775 V805 H300Z" fill="#123B5D"/></g>
    <g id="person-center"><circle cx="500" cy="700" r="34" fill="#D8FBFF"/><path d="M445 745 Q500 698 555 745 V780 H445Z" fill="#01AACA"/></g>
    <g id="person-right"><circle cx="650" cy="740" r="30"/><path d="M600 775 Q650 735 700 775 V805 H600Z" fill="#123B5D"/></g>
  </g>

  <!-- acabamento -->
  <path id="accent-pink" d="M180 640 L250 580 L305 640" fill="none" stroke="url(#rgPink)" stroke-width="28" stroke-linecap="round" stroke-linejoin="round" pathLength="1"/>
</svg>'''
(assets/'logo-oficial-desenho-zero.svg').write_text(svg, encoding='utf-8')

# Generate a flat preview
import cairosvg
cairosvg.svg2png(bytestring=svg.encode('utf-8'), write_to=str(assets/'logo-oficial-desenho-zero-preview.png'), output_width=700, output_height=700)

# Replace splash block in index
index=root/'index.html'
text=index.read_text(encoding='utf-8')
start=text.index('  <!-- Splash de inicialização')
end=text.index('  <!-- ============================================================================\n       MENU DE ACESSIBILIDADE', start)

splash=f'''  <!-- Splash de inicialização — construção vetorial nativa da logo oficial. -->
  <div id="rg-startup" aria-hidden="true">
    <div class="rg-startup-stage">
      <div class="rg-startup-lockup">
        <svg class="rg-build-svg" viewBox="0 0 1000 1000" role="img" aria-label="Construção do logo Ranking Geral">
          <g class="rg-build-guides" fill="none" stroke="#2E6C96" stroke-width="3">
            <circle cx="500" cy="500" r="390"/>
            <circle cx="500" cy="500" r="300"/>
            <path d="M120 500h760M500 120v760"/>
          </g>
          <g class="rg-build-glow" aria-hidden="true"><circle cx="500" cy="500" r="240" fill="#01AACA" opacity=".09"/></g>
          <g class="rg-build-arcs" fill="none" stroke-linecap="round">
            <path class="draw" data-delay="0" d="M160 520 A340 340 0 0 1 500 160" stroke="#01AACA" stroke-width="42" pathLength="1"/>
            <path class="draw" data-delay="260" d="M250 265 A340 340 0 0 1 760 245" stroke="#A98BFA" stroke-width="22" pathLength="1"/>
            <path class="draw" data-delay="500" d="M815 285 A340 340 0 0 1 845 665" stroke="#01AACA" stroke-width="32" pathLength="1"/>
            <path class="draw" data-delay="760" d="M180 700 A340 340 0 0 0 820 735" stroke="#A98BFA" stroke-width="22" pathLength="1"/>
          </g>
          <g class="rg-build-bars" fill="#01AACA">
            <rect data-delay="720" x="360" y="300" width="54" height="145" rx="14"/>
            <rect data-delay="860" x="425" y="255" width="54" height="190" rx="14"/>
            <rect data-delay="1000" x="490" y="205" width="54" height="240" rx="14"/>
            <rect data-delay="1140" x="555" y="150" width="54" height="295" rx="14"/>
          </g>
          <g class="rg-build-r" transform="translate(285 675) scale(.255 -.255)" fill="#012443" stroke="#082F4F" stroke-width="8" stroke-linejoin="round" pathLength="1">
            <path data-delay="1280" class="draw" d="{R_PATH}"/>
          </g>
          <g class="rg-build-g" fill="none" stroke="#01AACA" stroke-width="82" stroke-linecap="round" stroke-linejoin="round">
            <path data-delay="1460" class="draw" d="M710 485 A190 190 0 1 1 690 320" pathLength="1"/>
            <path data-delay="1640" class="draw" d="M665 485h115" pathLength="1"/>
          </g>
          <g class="rg-build-arrow-up" fill="#01AACA" stroke="#2ADDEA" stroke-linecap="round" stroke-linejoin="round">
            <path data-delay="1700" class="draw" d="M470 590 L745 315" fill="none" stroke-width="40" pathLength="1"/>
            <path data-delay="1840" class="rise-small" d="M704 300 L780 270 L752 347 Z"/>
          </g>
          <g class="rg-build-arrow-down" fill="#FF5A1A" stroke="#FF6B29" stroke-linecap="round" stroke-linejoin="round">
            <path data-delay="1920" class="draw" d="M845 340 A250 250 0 0 1 860 635" fill="none" stroke-width="28" pathLength="1"/>
            <path data-delay="2060" class="rise-small" d="M835 625 L862 690 L892 628 Z"/>
          </g>
          <g class="rg-build-podium">
            <path data-delay="2220" class="rise" d="M265 820 H480 L420 870 H230 Z" fill="#173E63"/>
            <path data-delay="2320" class="rise" d="M520 820 H735 L770 870 H580 Z" fill="#8F70FF"/>
            <rect data-delay="2420" class="rise" x="285" y="785" width="135" height="110" rx="18" fill="#012443"/>
            <rect data-delay="2520" class="rise" x="430" y="745" width="140" height="150" rx="20" fill="#01AACA"/>
            <rect data-delay="2620" class="rise" x="580" y="785" width="135" height="110" rx="18" fill="#012443"/>
          </g>
          <g class="rg-build-people" fill="#EAF5FF">
            <g data-delay="2660" class="rise"><circle cx="350" cy="740" r="30"/><path d="M300 775 Q350 735 400 775 V805 H300Z" fill="#123B5D"/></g>
            <g data-delay="2800" class="rise"><circle cx="500" cy="700" r="34" fill="#D8FBFF"/><path d="M445 745 Q500 698 555 745 V780 H445Z" fill="#01AACA"/></g>
            <g data-delay="2940" class="rise"><circle cx="650" cy="740" r="30"/><path d="M600 775 Q650 735 700 775 V805 H600Z" fill="#123B5D"/></g>
          </g>
          <path data-delay="3080" class="rg-build-accent draw" d="M180 640 L250 580 L305 640" fill="none" stroke="#FF6FB4" stroke-width="28" stroke-linecap="round" stroke-linejoin="round" pathLength="1"/>
        </svg>
        <div class="rg-build-wordmark"><span>RANKING</span> <strong>GERAL</strong></div>
      </div>
    </div>
  </div>

'''
text=text[:start]+splash+text[end:]

# Replace startup critical style and boot script, remove old V23+ CSS block
text=re.sub(r'<style id="rg-startup-critical">.*?</style>', '''<style id="rg-startup-critical">#rg-startup{position:fixed;inset:0;z-index:99999;display:grid;place-items:center;opacity:1;visibility:visible;pointer-events:auto}#rg-startup.rg-startup-hide{opacity:0;visibility:hidden;pointer-events:none}</style>''', text, flags=re.S)

# Replace existing rg startup controller inline script
old_start=text.index('<script>\n(function(){\n  var inicio=Date.now(), duracao=6400, escondida=false;')
old_end=text.index('</script>', old_start)+len('</script>')
boot='''<script>
(function(){
  const start=performance.now();
  const DURATION=6400;
  let hidden=false;
  const root=document.documentElement;
  const splash=document.getElementById('rg-startup');
  const prefersReduced=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  root.classList.toggle('rg-reduced-motion',prefersReduced);
  function ease(t){return t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;}
  function playBuild(){
    if(!splash) return;
    const q=splash.querySelectorAll('[data-delay]');
    q.forEach(el=>{
      const delay=Number(el.dataset.delay||0);
      if(el.classList.contains('draw')){
        el.style.strokeDasharray='1'; el.style.strokeDashoffset='1';
        el.animate([{strokeDashoffset:'1'},{strokeDashoffset:'0'}],{duration:620,delay,easing:'cubic-bezier(.16,1,.3,1)',fill:'forwards'});
      } else if(el.classList.contains('rise-small')){
        el.style.opacity='0';
        el.animate([{opacity:0,transform:'translateY(34px) scale(.92)'},{opacity:1,transform:'translateY(0) scale(1)'}],{duration:520,delay,easing:'cubic-bezier(.22,1,.36,1)',fill:'forwards'});
      } else {
        el.style.transformOrigin=el.tagName==='rect'?'50% 100%':'50% 100%';
        el.animate([{opacity:0,transform:'translateY(80px) scaleY(.05)'},{opacity:1,transform:'translateY(-6px) scaleY(1.035)'},{opacity:1,transform:'translateY(0) scaleY(1)'}],{duration:720,delay,easing:'cubic-bezier(.22,1,.36,1)',fill:'forwards'});
      }
    });
    const guides=splash.querySelector('.rg-build-guides');
    if(guides){ guides.animate([{opacity:0,transform:'scale(.96)'},{opacity:.45,transform:'scale(1)'}],{duration:760,easing:'cubic-bezier(.22,1,.36,1)',fill:'forwards'}); }
    const glow=splash.querySelector('.rg-build-glow');
    if(glow){ glow.animate([{opacity:0,transform:'scale(.7)'},{opacity:.9,transform:'scale(1)'},{opacity:.55,transform:'scale(1.04)'}],{duration:4300,delay:900,easing:'ease-out',fill:'forwards'}); }
    const word=splash.querySelector('.rg-build-wordmark');
    if(word){ word.animate([{opacity:0,transform:'translateY(18px)'},{opacity:1,transform:'translateY(0)'}],{duration:760,delay:5000,easing:'cubic-bezier(.22,1,.36,1)',fill:'forwards'}); }
    const lock=splash.querySelector('.rg-startup-lockup');
    if(lock){ lock.animate([{transform:'scale(.985)'},{transform:'scale(1.012)',offset:.86},{transform:'scale(1)'}],{duration:850,delay:5350,easing:'cubic-bezier(.22,1,.36,1)',fill:'forwards'}); }
  }
  function hide(){ if(hidden||!splash)return; hidden=true; splash.classList.add('rg-startup-hide'); setTimeout(()=>splash.remove(),720); }
  window.rgStartup={status:function(){},hide:function(){setTimeout(hide,Math.max(0,DURATION-(performance.now()-start)))},forceHide:hide,elapsed:function(){return performance.now()-start}};
  if(prefersReduced){
    const word=splash?.querySelector('.rg-build-wordmark'); if(word) word.style.opacity='1';
    const all=splash?.querySelectorAll('[data-delay]'); all?.forEach(el=>{el.style.opacity='1';el.style.strokeDashoffset='0';el.style.transform='none'});
    setTimeout(hide,1100);
  } else { playBuild(); setTimeout(hide,DURATION); }
})();
</script>'''
text=text[:old_start]+boot+text[old_end:]
index.write_text(text,encoding='utf-8')

# Replace tail CSS after V23 marker with V24 clean splash styles
css=root/'style.css'
ct=css.read_text(encoding='utf-8')
marker='/* ============================================================\n   V23 — CONSTRUÇÃO CINÉTICA VETORIAL POR COMPONENTES'
if marker in ct:
    ct=ct[:ct.index(marker)]
newcss='''
/* ============================================================
   V24 — LOGO OFICIAL DESENHADA EM SVG + CONSTRUÇÃO CINÉTICA
   ============================================================ */
#rg-startup{position:fixed!important;inset:0!important;z-index:99999!important;display:grid!important;place-items:center!important;overflow:hidden!important;background:radial-gradient(circle at 50% 45%,#0c1a28 0%,#071019 52%,#050b10 100%)!important;opacity:1!important;visibility:visible!important;pointer-events:auto!important;transition:opacity .72s cubic-bezier(.22,1,.36,1),visibility .72s linear!important}
#rg-startup.rg-startup-hide{opacity:0!important;visibility:hidden!important;pointer-events:none!important}
#rg-startup .rg-startup-stage{width:min(94vw,860px);height:min(92vh,860px);display:grid;place-items:center}
#rg-startup .rg-startup-lockup{position:relative;width:min(72vw,570px);aspect-ratio:1;display:grid;place-items:center}
#rg-startup .rg-build-svg{width:100%;height:100%;overflow:visible;shape-rendering:geometricPrecision}
#rg-startup .rg-build-guides{opacity:0;transform-box:fill-box;transform-origin:center}
#rg-startup .rg-build-glow{opacity:0;transform-box:fill-box;transform-origin:center}
#rg-startup .rg-build-bars rect,#rg-startup .rg-build-podium > * ,#rg-startup .rg-build-people > g{opacity:0;transform-box:fill-box;transform-origin:center bottom}
#rg-startup .draw{stroke-dasharray:1;stroke-dashoffset:1}
#rg-startup .rg-build-wordmark{position:absolute;left:50%;bottom:-7%;transform:translate(-50%,18px);opacity:0;white-space:nowrap;font-weight:900;font-size:clamp(18px,3vw,30px);letter-spacing:.12em;color:#f4f8fb;text-shadow:0 12px 30px rgba(0,0,0,.35)}
#rg-startup .rg-build-wordmark strong{color:#39E7F3;font-weight:950}
#rg-startup .rg-build-svg *{vector-effect:non-scaling-stroke}
#rg-startup .rg-build-svg #r-glyph{vector-effect:none}
@media(max-width:760px){#rg-startup .rg-startup-stage{width:96vw;height:84vh}#rg-startup .rg-startup-lockup{width:min(82vw,450px)}#rg-startup .rg-build-wordmark{bottom:-9%;font-size:20px}}
.rg-reduced-motion #rg-startup *{animation:none!important;transition:none!important}
'''
ct+=newcss
css.write_text(ct,encoding='utf-8')
# mirror CSS
shutil.copy2(css, root/'assets'/'css'/'style.css')

# Update standalone official SVG to be used where possible; keep PNG intact as fallback.
# write a simple monochrome source too
mono=svg.replace('url(#rgCyan)','#FFFFFF').replace('url(#rgViolet)','#FFFFFF').replace('url(#rgBlue)','#FFFFFF').replace('url(#rgPink)','#FFFFFF').replace('url(#rgDown)','#FFFFFF').replace('stroke="#01AACA"','#FFFFFF').replace('stroke="#2ADDEA"','#FFFFFF').replace('stroke="#FF6B29"','#FFFFFF').replace('stroke="#FF5A1A"','#FFFFFF')
(assets/'logo-oficial-monocromatica.svg').write_text(mono,encoding='utf-8')

# README update
readme=root/'LEIA-ME.md'
rt=readme.read_text(encoding='utf-8') if readme.exists() else ''
rt += '\n\nV24 — LOGO SVG DESENHADA DO ZERO\n- assets/logo-vectors/logo-oficial-desenho-zero.svg: fonte vetorial limpa da marca.\n- assets/logo-vectors/logo-oficial-monocromatica.svg: variante monocromática.\n- index.html: splash único com construção cinética em SVG, sem rastreio de imagem/clip-path.\n- A abertura permanece por cerca de 6,4 s e respeita prefers-reduced-motion.\n'
readme.write_text(rt,encoding='utf-8')

# Syntax check all js
js=list(root.rglob('*.js'))
failed=[]
for p in js:
    r=subprocess.run(['node','--check',str(p)],stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
    if r.returncode: failed.append((str(p),r.stderr))
print('JS count',len(js),'failed',len(failed))
for f,e in failed: print(f,e)
