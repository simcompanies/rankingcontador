/* Ranking Geral — original image assembly with a separate animated light pass. */
(function (scope) {
  'use strict';
  const SIZE = 1254;
  const DURATION = 6.4;
  const clamp = n => Math.max(0, Math.min(1, n));
  const smooth = n => { n = clamp(n); return n * n * (3 - 2 * n); };
  const out = n => 1 - Math.pow(1 - clamp(n), 4);
  const progress = (t, start, length) => clamp((t - start) / length);
  const parts = [
    {id:'up',start:2.12,length:1.18,mode:'arrow'},
    {id:'down',start:2.46,length:.83,mode:'reverse'},
    {id:'bar1',start:.64,length:.70,mode:'bar'},
    {id:'bar2',start:.80,length:.77,mode:'bar'},
    {id:'bar3',start:.96,length:.84,mode:'bar'},
    {id:'bar4',start:1.12,length:.91,mode:'bar'},
    {id:'bar5',start:1.28,length:.97,mode:'bar'},
    {id:'top',start:.12,length:1.34,mode:'arc',angle:-.22},
    {id:'right',start:.28,length:1.47,mode:'arc',angle:.30},
    {id:'left',start:.10,length:1.48,mode:'arc',angle:-.28},
    {id:'bottom',start:.52,length:1.24,mode:'arc',angle:.25},
    {id:'podium-left',start:3.07,length:.77,mode:'rise',dy:100},
    {id:'podium-right',start:3.24,length:.77,mode:'rise',dy:100},
    {id:'podium-center',start:3.39,length:.84,mode:'rise',dy:140},
    {id:'person-left',start:3.30,length:.72,mode:'rise',dy:42},
    {id:'person-right',start:3.44,length:.72,mode:'rise',dy:42},
    {id:'person-center',start:3.61,length:.78,mode:'rise',dy:60},
    {id:'r',start:1.40,length:1.28,mode:'letter',dx:-95,dy:28,angle:-.075},
    {id:'g',start:1.60,length:1.27,mode:'letter',dx:110,dy:24,angle:.075}
  ];

  function createRenderer(image, canvasFactory) {
    // Connected areas, rather than traced silhouettes, isolate the actual logo.
    // Every RGBA pixel belongs to exactly one piece or the original halo.
    const remainder = canvasFactory(SIZE, SIZE);
    const remaining = remainder.getContext('2d');
    remaining.drawImage(image, 0, 0, SIZE, SIZE);
    const original=remaining.getImageData(0,0,SIZE,SIZE), rgba=original.data;
    const count=SIZE*SIZE, channel=new Uint8Array(count), visited=new Uint8Array(count), owner=new Uint8Array(count), queue=new Uint32Array(count);
    const ids=Object.fromEntries(parts.map((p,i)=>[p.id,i+1]));
    for(let i=0;i<count;i++)if(rgba[i*4+3]>=128){const r=rgba[i*4],g=rgba[i*4+1];channel[i]=r>120&&r>g*1.2?3:g>=115?2:1;}
    function identify(color,minX,minY,maxX,maxY,area){
      const cx=(minX+maxX)/2;
      if(color===3)return 'down';
      if(color===2){
        if(area>60000)return 'g';
        if(minY>980)return 'podium-center';
        if(minY>850)return 'person-center';
        if(minX<200)return 'left';
        if(minX>900)return 'right';
        if(maxX-minX<100&&minY<470)return cx<550?'bar1':cx<700?'bar3':'bar5';
        return 'up';
      }
      if(maxY<500)return minX>650?'bar4':minX>500?'bar2':'top';
      if(minY>1020)return cx<627?'podium-left':'podium-right';
      if(minY>900&&maxY<1040)return cx<627?'person-left':'person-right';
      if(minY>840&&minX>800)return 'bottom';
      return 'r';
    }
    for(let seed=0;seed<count;seed++){
      if(!channel[seed]||visited[seed])continue;
      let tail=1,head=0,minX=SIZE,minY=SIZE,maxX=0,maxY=0;queue[0]=seed;visited[seed]=1;
      const color=channel[seed];
      while(head<tail){
        const v=queue[head++],x=v%SIZE,y=(v/SIZE)|0;
        minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);
        if(x>0&&!visited[v-1]&&channel[v-1]===color){visited[v-1]=1;queue[tail++]=v-1;}
        if(x<SIZE-1&&!visited[v+1]&&channel[v+1]===color){visited[v+1]=1;queue[tail++]=v+1;}
        if(y>0&&!visited[v-SIZE]&&channel[v-SIZE]===color){visited[v-SIZE]=1;queue[tail++]=v-SIZE;}
        if(y<SIZE-1&&!visited[v+SIZE]&&channel[v+SIZE]===color){visited[v+SIZE]=1;queue[tail++]=v+SIZE;}
      }
      if(tail<300)continue;
      const id=ids[identify(color,minX,minY,maxX,maxY,tail)];
      for(let i=0;i<tail;i++)owner[queue[i]]=id;
    }
    // Include antialiased boundaries without replacing or recoloring pixels.
    for(let pass=0;pass<4;pass++){
      const next=owner.slice();
      for(let y=1;y<SIZE-1;y++)for(let x=1;x<SIZE-1;x++){
        const i=y*SIZE+x;if(owner[i]||!rgba[i*4+3])continue;
        next[i]=owner[i-1]||owner[i+1]||owner[i-SIZE]||owner[i+SIZE];
      }
      owner.set(next);
    }
    const bounds=parts.map(()=>[SIZE,SIZE,0,0]);
    for(let i=0;i<count;i++)if(owner[i]){const b=bounds[owner[i]-1],x=i%SIZE,y=(i/SIZE)|0;b[0]=Math.min(b[0],x);b[1]=Math.min(b[1],y);b[2]=Math.max(b[2],x);b[3]=Math.max(b[3],y);}
    const pieces=parts.map((def,n)=>{
      const b=bounds[n],x=b[0],y=b[1],w=b[2]-x+1,h=b[3]-y+1;
      if(w<=0||h<=0)throw new Error('Logo component missing: '+def.id);
      const canvas=canvasFactory(w,h),ctx=canvas.getContext('2d'),part=ctx.createImageData(w,h);
      for(let py=0;py<h;py++)for(let px=0;px<w;px++){
        const i=(y+py)*SIZE+x+px;if(owner[i]!==n+1)continue;
        const a=i*4,k=(py*w+px)*4;
        part.data[k]=rgba[a];part.data[k+1]=rgba[a+1];part.data[k+2]=rgba[a+2];part.data[k+3]=rgba[a+3];
      }
      ctx.putImageData(part,0,0);
      // Light follows the real alpha boundary, without tracing a new logo.
      const rim=canvasFactory(w,h),rc=rim.getContext('2d'),light=rc.createImageData(w,h);
      const alphaAt=(xx,yy)=>xx<0||yy<0||xx>=w||yy>=h?0:part.data[(yy*w+xx)*4+3];
      for(let py=0;py<h;py++)for(let px=0;px<w;px++){
        const k=(py*w+px)*4,a=part.data[k+3];if(a<120)continue;
        const near=Math.min(alphaAt(px-2,py),alphaAt(px+2,py),alphaAt(px,py-2),alphaAt(px,py+2));
        const edge=Math.max(0,a-near),upper=Math.max(0,a-alphaAt(px,py-2));
        light.data[k]=def.id==='down'?255:70;
        light.data[k+1]=def.id==='down'?159:223;
        light.data[k+2]=def.id==='down'?50:255;
        light.data[k+3]=Math.min(255,edge*.55+upper*.42);
      }
      rc.putImageData(light,0,0);
      const emission=canvasFactory(w,h),gc=emission.getContext('2d'),emit=gc.createImageData(w,h);
      const warm=def.id==='down',bright=['up','g','left','right','bar1','bar3','bar5','podium-center','person-center'].includes(def.id);
      for(let k=0;k<part.data.length;k+=4){
        emit.data[k]=warm?255:0;emit.data[k+1]=warm?113:188;emit.data[k+2]=warm?10:255;
        emit.data[k+3]=part.data[k+3]*(warm?.84:bright?.69:.12);
      }
      gc.putImageData(emit,0,0);
      return {...def,canvas,rim,emission,box:[x,y,w,h],base:y+h};
    });
    for(let i=0;i<count;i++)if(owner[i])rgba[i*4+3]=0;
    remaining.putImageData(original,0,0);
    const body=canvasFactory(SIZE,SIZE), b=body.getContext('2d');
    const edges=canvasFactory(SIZE,SIZE),ec=edges.getContext('2d');
    const emissionFrame=canvasFactory(SIZE,SIZE),ef=emissionFrame.getContext('2d');
    const aura=canvasFactory(320,320),ac=aura.getContext('2d');
    const bloom=canvasFactory(320,320),bc=bloom.getContext('2d');
    const specular=canvasFactory(SIZE,SIZE),sc=specular.getContext('2d');
    let workSize=SIZE,settledBody=false,settledGlow=false;
    function fitBuffers(size){
      const target=Math.min(SIZE,Math.max(192,Math.round(size)));
      if(target===workSize)return;
      workSize=target;settledBody=false;settledGlow=false;
      for(const c of [body,edges,emissionFrame,specular]){c.width=target;c.height=target;c.getContext('2d').setTransform(target/SIZE,0,0,target/SIZE,0,0);}
    }
    function lightSprite(warm){
      const c=canvasFactory(96,96),g=c.getContext('2d'),grad=g.createRadialGradient(48,48,0,48,48,48);
      grad.addColorStop(0,'rgba(255,255,255,1)');
      grad.addColorStop(.06,warm?'rgba(255,246,199,.98)':'rgba(190,253,255,.98)');
      grad.addColorStop(.15,warm?'rgba(255,163,38,.83)':'rgba(0,205,255,.84)');
      grad.addColorStop(.38,warm?'rgba(255,85,10,.27)':'rgba(0,140,255,.28)');
      grad.addColorStop(1,warm?'rgba(255,75,0,0)':'rgba(0,100,255,0)');
      g.fillStyle=grad;g.fillRect(0,0,96,96);return c;
    }
    const cyanSprite=lightSprite(false),orangeSprite=lightSprite(true);
    // Cache the light ribbon once; frames only rotate this small texture.
    const ribbon=canvasFactory(470,580),ribbonCtx=ribbon.getContext('2d');
    ribbonCtx.translate(-744,-112);
    for(let pass=0;pass<3;pass++){
      ribbonCtx.lineCap='round';ribbonCtx.lineWidth=[13,4.8,1.25][pass];
      for(let i=0;i<48;i++){
        const q=i/48,a=-1.13+q*1.13,n=a+1.13/48;
        ribbonCtx.strokeStyle=pass===2?`rgba(190,249,255,${q*q*.92})`:`rgba(0,${pass?197:126},255,${q*q*(pass?.45:.09)})`;
        ribbonCtx.beginPath();ribbonCtx.moveTo(627+518*Math.cos(a),651+520*Math.sin(a));ribbonCtx.lineTo(627+518*Math.cos(n),651+520*Math.sin(n));ribbonCtx.stroke();
      }
    }
    let seed=104729;
    const rand=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
    const dust=Array.from({length:120},(_,i)=>({a:rand()*Math.PI*2,r:rand(),phase:rand()*6.28,speed:.07+rand()*.17,size:i%11===0?9+rand()*3:2.5+rand()*4,twinkle:.7+rand()*1.1}));
    const warmDust=Array.from({length:20},()=>({a:rand()*6.28,r:25+rand()*100,phase:rand()*6.28,size:2+rand()*3}));
    const order=['top','right','left','bottom','bar1','bar2','bar3','bar4','bar5','r','g','down','up','podium-left','podium-right','podium-center','person-left','person-right','person-center'];
    const sorted=order.map(id=>pieces.find(p=>p.id===id));
    const paintPiece = (ctx, p, time, light=false) => {
      const q = progress(time,p.start,p.length);
      if (!q) return;
      const e = out(q), [x,y,w,h] = p.box;
      ctx.save();
      ctx.globalAlpha = smooth(q/.24);
      if (p.mode === 'arc') {
        ctx.translate(SIZE/2,SIZE/2); ctx.rotate(p.angle*(1-e));
        const s = 1+.09*(1-e); ctx.scale(s,s); ctx.translate(-SIZE/2,-SIZE/2);
      } else if (p.mode === 'letter') {
        const cx=x+w/2, cy=y+h/2;
        ctx.translate(cx+p.dx*(1-e),cy+p.dy*(1-e));
        ctx.rotate(p.angle*(1-e));
        const s=1+.05*(1-e); ctx.scale(s,s); ctx.translate(-cx,-cy);
      } else if (p.mode === 'bar') {
        // A rising reveal retains the texture and perspective of every bar.
        const bottom=p.base, top=y+(bottom-y)*(1-e);
        ctx.beginPath(); ctx.rect(x-5,top,w+10,SIZE-top); ctx.clip();
        ctx.translate(0,14*(1-e));
      } else if (p.mode === 'rise') {
        const ease=1-Math.pow(1-q,3);
        const settle = q < .72 ? 0 : Math.sin((q-.72)/.28*Math.PI)*3*(1-q);
        ctx.translate(0,p.dy*(1-ease)-settle);
      } else if (p.mode === 'arrow') {
        ctx.translate(488,680); ctx.rotate(-.69);
        ctx.beginPath(); ctx.rect(-35,-120,710*smooth(q)+35,250); ctx.clip();
        ctx.rotate(.69); ctx.translate(-488,-680);
        ctx.translate(-24*(1-e),19*(1-e));
      } else if (p.mode === 'reverse') {
        ctx.beginPath(); ctx.rect(x+w*(1-smooth(q)),y,w*smooth(q)+2,h); ctx.clip();
      }
      ctx.drawImage(light===2?p.emission:light?p.rim:p.canvas,x,y); ctx.restore();
    };

    const pulse=(t,at,length)=>Math.sin(Math.PI*progress(t,at,length));
    const pointOnOrbit=a=>[627+518*Math.cos(a),651+520*Math.sin(a)];
    function dot(ctx,x,y,size,alpha,warm=false){
      if(alpha<.005)return;
      ctx.save();ctx.globalAlpha=Math.min(1,alpha);ctx.drawImage(warm?orangeSprite:cyanSprite,x-size/2,y-size/2,size,size);ctx.restore();
    }
    function flare(ctx,x,y,power,warm=false){
      if(power<=0)return;
      dot(ctx,x,y,145,power*.55,warm);dot(ctx,x,y,45,power,warm);
      ctx.save();ctx.globalAlpha=power*.64;
      ctx.drawImage(warm?orangeSprite:cyanSprite,x-115,y-6,230,12);
      ctx.drawImage(warm?orangeSprite:cyanSprite,x-5,y-49,10,98);ctx.restore();
    }
    function orbitTrail(ctx,t,offset,gain){
      const head=-2.68+t*1.06+offset;
      ctx.save();ctx.globalAlpha=Math.min(1,gain);ctx.translate(627,651);ctx.rotate(head);ctx.drawImage(ribbon,744-627,112-651);ctx.restore();
      const h=pointOnOrbit(head);flare(ctx,h[0],h[1],gain*.76);
    }
    function haze(ctx,x,y,rx,ry,power,warm=false){
      if(power<=0)return;ctx.save();ctx.translate(x,y);ctx.scale(rx,ry);
      const g=ctx.createRadialGradient(0,0,0,0,0,1);
      g.addColorStop(0,warm?`rgba(255,91,6,${power})`:`rgba(0,166,247,${power})`);
      g.addColorStop(.37,warm?`rgba(255,61,0,${power*.38})`:`rgba(0,105,222,${power*.46})`);
      g.addColorStop(1,'rgba(0,35,90,0)');ctx.fillStyle=g;ctx.fillRect(-1,-1,2,2);ctx.restore();
    }
    function backgroundLight(ctx,t,gain){
      const appear=smooth(progress(t,.08,.8));
      ctx.save();ctx.globalCompositeOperation='screen';
      haze(ctx,682,465,550,574,.23*appear*gain);
      haze(ctx,762,243,265,325,.40*smooth(progress(t,.65,1.65))*gain);
      haze(ctx,941,660,257,373,.24*smooth(progress(t,1.5,1))*gain);
      haze(ctx,232,711,155,174,.27*smooth(progress(t,2.40,.8))*gain,true);
      haze(ctx,626,1110,190,102,.19*smooth(progress(t,3.45,.8))*gain);
      // Distant particles remain behind the unmodified image layers.
      for(const p of dust){
        const a=p.a+t*p.speed*.25,rx=490+p.r*83,ry=486+p.r*91;
        const x=627+rx*Math.cos(a),y=650+ry*Math.sin(a);
        const tw=.4+.6*Math.pow(.5+.5*Math.sin(t*p.twinkle+p.phase),2);
        dot(ctx,x,y,p.size*6,tw*.78*appear*gain);
      }
      const orbitEnvelope=appear*(.52+.42*pulse(t,3.8,2.15));
      orbitTrail(ctx,t,0,orbitEnvelope*gain);
      orbitTrail(ctx,t,Math.PI,orbitEnvelope*.48*gain);
      ctx.restore();
    }
    function frontLight(ctx,t,gain){
      ctx.save();ctx.globalCompositeOperation='screen';
      const arrow=smooth(progress(t,2.14,1.18)),arrowPower=pulse(t,2.1,1.62)*gain;
      if(arrowPower>.01){
        const x=505+449*arrow,y=650-362*arrow;
        const startX=x-245,startY=y+197;
        const grad=ctx.createLinearGradient(startX,startY,x,y);
        grad.addColorStop(0,'rgba(0,148,255,0)');grad.addColorStop(.7,`rgba(0,200,255,${arrowPower*.5})`);grad.addColorStop(1,`rgba(216,253,255,${arrowPower})`);
        ctx.strokeStyle=grad;ctx.lineCap='round';ctx.lineWidth=3;
        ctx.beginPath();ctx.moveTo(startX,startY);ctx.lineTo(x,y);ctx.stroke();
        flare(ctx,x,y,arrowPower);
        for(let i=0;i<10;i++){const q=((t*1.3+i*.133)%1);dot(ctx,x-260*q+Math.sin(i*7)*20,y+210*q+Math.cos(i*4)*20,13,arrowPower*(1-q)*.65);}
      }
      const warm=smooth(progress(t,2.5,.9))*(.58+.42*pulse(t,2.6,1.1))*gain;
      for(const p of warmDust){const a=p.a+t*.17;dot(ctx,274+Math.cos(a)*p.r,688+Math.sin(a)*p.r,p.size*5,warm*(.2+.28*Math.pow(Math.sin(t+p.phase),2)),true);}
      flare(ctx,207,742,pulse(t,2.76,.87)*gain*.84,true);
      const flashes=[{at:1.16,x:498,y:302},{at:1.60,x:658,y:202},{at:1.99,x:817,y:92},{at:3.18,x:953,y:289},{at:4.02,x:624,y:1159}];
      for(const f of flashes)flare(ctx,f.x,f.y,pulse(t,f.at,.58)*gain*.80);
      // A broad reflection moves over the existing surfaces, then settles.
      const sweep=progress(t,4.45,1.45);
      if(sweep>0&&sweep<1){
        sc.clearRect(0,0,SIZE,SIZE);sc.globalCompositeOperation='source-over';sc.drawImage(body,0,0,SIZE,SIZE);
        sc.globalCompositeOperation='source-in';
        const x=-350+sweep*2150,g=sc.createLinearGradient(x-185,0,x+185,140);
        g.addColorStop(0,'rgba(95,220,255,0)');g.addColorStop(.39,'rgba(92,211,255,.16)');g.addColorStop(.50,'rgba(209,251,255,.46)');g.addColorStop(.61,'rgba(92,211,255,.16)');g.addColorStop(1,'rgba(95,220,255,0)');
        sc.fillStyle=g;sc.fillRect(0,0,SIZE,SIZE);sc.globalCompositeOperation='source-over';
        ctx.globalAlpha=Math.min(1,gain*.74);ctx.drawImage(specular,0,0,SIZE,SIZE);ctx.globalAlpha=1;
      }
      const floor=smooth(progress(t,3.7,.65))*gain;
      ctx.globalAlpha=floor*.46;ctx.drawImage(cyanSprite,393,1148,462,23);
      ctx.restore();
    }
    function draw(ctx,width,height,time,opts={}) {
      const t=Math.max(0,Math.min(DURATION,time));
      const theme=opts.theme||'dark';
      const gain=Math.max(0,Math.min(1.5,opts.glow===undefined?1:Number(opts.glow)))*(theme==='light'?.56:1);
      ctx.save(); ctx.setTransform(1,0,0,1,0,0); ctx.clearRect(0,0,width,height);
      if(theme!=='transparent') {
        const bg=ctx.createRadialGradient(width*.5,height*.43,0,width*.5,height*.43,Math.max(width,height)*.72);
        if(theme==='dark'){bg.addColorStop(0,'#021019');bg.addColorStop(.52,'#00060b');bg.addColorStop(1,'#000102');}
        else {bg.addColorStop(0,'#ffffff');bg.addColorStop(.58,'#f5f8fa');bg.addColorStop(1,'#e8eff3');}
        ctx.fillStyle=bg;ctx.fillRect(0,0,width,height);
      }
      const size=Math.min(width*.84,height*.88);
      const scale=size/SIZE;
      ctx.translate((width-size)/2,(height-size)/2); ctx.scale(scale,scale);
      if(!gain&&t>=4.60){ctx.drawImage(image,0,0,SIZE,SIZE);ctx.restore();return;}
      fitBuffers(size);
      if(t<4.60||!settledBody){
        b.clearRect(0,0,SIZE,SIZE);
        if(t>=4.60)b.drawImage(image,0,0,SIZE,SIZE);
        else{
          b.globalAlpha=smooth(progress(t,3.94,.61));b.drawImage(remainder,0,0);b.globalAlpha=1;
          sorted.forEach(p=>paintPiece(b,p,t));
        }
        settledBody=t>=4.60;
      }
      if(gain){
        backgroundLight(ctx,t,gain);
        if(t<4.60||!settledGlow){
          ec.clearRect(0,0,SIZE,SIZE);ef.clearRect(0,0,SIZE,SIZE);
          sorted.forEach(p=>{paintPiece(ec,p,t,true);paintPiece(ef,p,t,2);});
          // Small, cached bloom buffers bound the cost of the luminous halo.
          bc.clearRect(0,0,320,320);bc.filter='blur(5px)';bc.drawImage(edges,0,0,320,320);bc.filter='none';
          ac.clearRect(0,0,320,320);ac.filter='blur(10px)';ac.drawImage(emissionFrame,0,0,320,320);ac.filter='none';
          settledGlow=t>=4.60;
        }
        ctx.save();ctx.globalCompositeOperation='screen';ctx.globalAlpha=Math.min(1,gain*.94);ctx.drawImage(aura,0,0,SIZE,SIZE);
        ctx.globalAlpha=Math.min(1,gain*1.12);ctx.drawImage(bloom,0,0,SIZE,SIZE);ctx.restore();
      }
      ctx.drawImage(body,0,0,SIZE,SIZE);
      if(gain){
        ctx.save();ctx.globalCompositeOperation='screen';ctx.globalAlpha=Math.min(1,gain*.34);ctx.drawImage(aura,0,0,SIZE,SIZE);
        ctx.globalAlpha=Math.min(1,gain*.88);ctx.drawImage(bloom,0,0,SIZE,SIZE);
        ctx.globalAlpha=Math.min(1,gain*.96);ctx.drawImage(edges,0,0,SIZE,SIZE);ctx.restore();
        frontLight(ctx,t,gain);
      }
      ctx.restore();
    }
    return {draw,duration:DURATION,stages:parts.map(p=>({id:p.id,start:p.start,end:p.start+p.length})),destroy(){pieces.forEach(p=>{[p.canvas,p.rim,p.emission].forEach(c=>{c.width=1;c.height=1;});});[remainder,body,edges,emissionFrame,aura,bloom,specular,cyanSprite,orangeSprite,ribbon].forEach(c=>{c.width=1;c.height=1;});}};
  }
  const api={createRenderer,DURATION};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  else scope.RGMotion=api;
})(typeof window!=='undefined'?window:{});
