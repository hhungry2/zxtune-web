// Shared helpers — toast, hero canvas, catsPreview, etc.
function toast(msg, icon='✨'){
  const t=document.getElementById('toast');
  if(!t) return;
  document.getElementById('toastMsg').textContent=msg;
  document.getElementById('toastIcon').textContent=icon;
  t.classList.add('show');
  clearTimeout(t._tm);
  t._tm=setTimeout(()=>t.classList.remove('show'), 2200);
}

// Hero canvas — animated spectrum + grid
(function(){
  const c=document.getElementById('heroCanvas');
  if(!c) return;
  const ctx=c.getContext('2d');
  let w=c.width, h=c.height;
  const DPR=Math.min(2, window.devicePixelRatio||1);
  function resize(){
    const rect=c.getBoundingClientRect();
    w=rect.width*DPR; h=rect.height*DPR;
    c.width=w; c.height=h;
  }
  window.addEventListener('resize', resize);
  resize();
  const bars=48;
  const data=new Array(bars).fill(0);
  let t=0;
  let mouseX=0.5, mouseY=0.35;
  c.addEventListener('pointermove', e=>{
    const r=c.getBoundingClientRect();
    mouseX=(e.clientX-r.left)/r.width;
    mouseY=(e.clientY-r.top)/r.height;
  });
  function frame(){
    t+=0.016;
    ctx.clearRect(0,0,w,h);
    // bg gradient
    const g=ctx.createLinearGradient(0,0,0,h);
    g.addColorStop(0,'rgba(18,24,46,0.0)');
    g.addColorStop(1,'rgba(7,10,18,0.9)');
    ctx.fillStyle=g;
    ctx.fillRect(0,0,w,h);
    // subtle grid
    ctx.strokeStyle='rgba(255,255,255,0.035)';
    ctx.lineWidth=1*DPR;
    const step=28*DPR;
    for(let x=0;x<w;x+=step){ ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,h); ctx.stroke(); }
    for(let y=0;y<h;y+=step){ ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(w,y); ctx.stroke(); }

    // glow orb follows mouse
    const orbX=mouseX*w, orbY=mouseY*h;
    const rad=160*DPR;
    const rg=ctx.createRadialGradient(orbX,orbY,0,orbX,orbY,rad);
    rg.addColorStop(0,'rgba(0,255,209,0.14)');
    rg.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=rg;
    ctx.beginPath(); ctx.arc(orbX,orbY,rad,0,Math.PI*2); ctx.fill();
    const rg2=ctx.createRadialGradient(w*0.75,h*0.2,0,w*0.75,h*0.2,200*DPR);
    rg2.addColorStop(0,'rgba(124,92,255,0.10)');
    rg2.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=rg2;
    ctx.beginPath(); ctx.arc(w*0.75,h*0.2,200*DPR,0,Math.PI*2); ctx.fill();

    // bars
    const barW=(w*0.92)/bars;
    const gap=3*DPR;
    const baseY=h*0.72;
    for(let i=0;i<bars;i++){
      const phase=i/bars;
      const k=Math.sin(t*1.2 + phase*9 + Math.sin(t*0.5+phase*3)*0.6);
      const env=Math.sin(phase*Math.PI); // envelope
      const target=(0.18 + 0.72*env*(0.5+0.5*k) + Math.random()*0.06);
      data[i]+= (target - data[i])*0.18;
      const bh=data[i]* (h*0.42);
      const x=w*0.04 + i*(barW);
      const y=baseY - bh;
      // bar gradient
      const bg=ctx.createLinearGradient(x,y,x,y+bh);
      bg.addColorStop(0,'#00FFD1');
      bg.addColorStop(0.55,'#7C5CFF');
      bg.addColorStop(1,'rgba(255,59,130,0.9)');
      ctx.fillStyle=bg;
      // rounded top
      const r=4*DPR;
      ctx.beginPath();
      ctx.roundRect(x, y, barW-gap, bh, [r,r,2,2]);
      ctx.fill();
      // glow
      ctx.shadowColor='rgba(0,255,209,0.35)';
      ctx.shadowBlur=8*DPR;
      ctx.fill();
      ctx.shadowBlur=0;
    }
    // baseline
    ctx.strokeStyle='rgba(255,255,255,0.08)';
    ctx.lineWidth=1*DPR;
    ctx.beginPath(); ctx.moveTo(w*0.04, baseY+0.5); ctx.lineTo(w*0.96, baseY+0.5); ctx.stroke();
    // floating chips labels
    ctx.fillStyle='rgba(255,255,255,0.55)';
    ctx.font=`${9*DPR}px JetBrains Mono, monospace`;
    ctx.fillText('AY-3-8910  •  YM2149  •  SID  •  SPC700  •  2A03  •  YM2612', w*0.04, h*0.92);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();

// Cats preview + formats preview on index
(function(){
  const catsEl=document.getElementById('catsPreview');
  const prevEl=document.getElementById('formatsPreview');
  if(!catsEl || !window.ZXTUNE_FORMATS) return;
  const cats=window.FORMAT_CATS;
  catsEl.innerHTML=cats.map(c=>`
    <a class="cat-card" href="formats.html#${c.id}" style="--cat:${c.color}">
      <div class="cat-head"><div class="cat-icon">${c.icon}</div><div><h3>${c.label}</h3><span>${window.ZXTUNE_FORMATS.filter(f=>f.cat===c.id).length} formats</span></div></div>
      <p>${c.desc}</p>
      <div class="cat-tags">${window.ZXTUNE_FORMATS.filter(f=>f.cat===c.id).slice(0,3).map(f=>`<i>${f.ext}</i>`).join('')}</div>
    </a>
  `).join('');
  // preview 6 formats
  const picks=["pt3","spc","nsf","sid","vgm","zip","ym","tfc"];
  const chosen=window.ZXTUNE_FORMATS.filter(f=>picks.includes(f.id)).slice(0,6);
  if(prevEl){
    prevEl.innerHTML=chosen.map(f=>`
      <div class="format-card">
        <div class="format-top"><div class="format-ext">${f.ext}</div><span class="format-cat">${f.cat}</span></div>
        <div class="format-name">${f.name} <span style="color:var(--muted);font-weight:400">· ${f.aka}</span></div>
        <div class="format-desc">${f.desc}</div>
        <div class="format-meta"><span>${f.platform}</span><span>${f.chip}</span><span>${f.year}</span></div>
        <a class="link" href="formats/${f.id}.html">詳しく見る →</a>
      </div>
    `).join('');
  }
})();

// Generic formats-page cats
(function(){
  const el=document.getElementById('cats');
  if(!el || !window.FORMAT_CATS) return;
  el.innerHTML=window.FORMAT_CATS.map(c=>`
    <a class="cat-card" href="formats/${c.id}.html" style="--cat:${c.color}">
      <div class="cat-head"><div class="cat-icon">${c.icon}</div><div><h3>${c.label}</h3><span>${window.ZXTUNE_FORMATS.filter(f=>f.cat===c.id).length} formats</span></div></div>
      <p>${c.desc}</p>
    </a>
  `).join('');
})();
