// ZXTune Web Player — functional mock with WebAudio + visualization
const DEMO_TRACKS = [
  {title:"Space Debris", artist:"J. Komputerman", format:"PT3 (VortexTracker II)", chip:"AY-3-8910 ×1", dur:222, ext:".pt3", icon:"🎹", color:"#00FFD1"},
  {title:"Aftershock", artist:"MmcM / Soichi", format:"STC (Sound Tracker)", chip:"AY-3-8910", dur:184, ext:".stc", icon:"🎛️", color:"#7C5CFF"},
  {title:"Lyra II", artist:"Shiru", format:"PT3 TurboSound", chip:"2×AY-3-8910 (6ch)", dur:256, ext:".pt3", icon:"🎹", color:"#00E5FF"},
  {title:"Mystic Forest", artist:"n0rd", format:"SPC (SNES)", chip:"SPC700 + DSP", dur:148, ext:".spc", icon:"🎮", color:"#FF3B82"},
  {title:"Journey to Silius — Title", artist:"Sunsoft", format:"NSF (NES)", chip:"2A03 + VRC6", dur:92, ext:".nsf", icon:"👾", color:"#FFD60A"},
  {title:"Green Hill Zone", artist:"Masato Nakamura", format:"VGM (Genesis)", chip:"YM2612 + SN76489", dur:118, ext:".vgm", icon:"🌀", color:"#00FF88"},
  {title:"Cybernoid II", artist:"Jeroen Tel", format:"SID (C64)", chip:"MOS6581", dur:204, ext:".sid", icon:"💾", color:"#FF8A00"},
  {title:"Sundance", artist:"Factor6", format:"TFC (TurboFM)", chip:"YM2203 FM", dur:176, ext:".tfc", icon:"🎚️", color:"#FF3B82"},
];

let idx=0, playing=false, cur=0, raf=null, startAt=0, pausedAt=0;
let audioCtx=null, master=null, analyser=null, oscillators=[];
let chanMute=[false,false,false];
let loopMode=0; //0 none,1 one,2 all
let shuffle=false;

// elements — support both index and player page
const els={
  title: document.getElementById('pTitle')||document.getElementById('pTitle2'),
  artist: document.getElementById('pArtist')||document.getElementById('pArtist2'),
  format: document.getElementById('pFormat')||document.getElementById('pFormat2'),
  chip: document.getElementById('pChip')||document.getElementById('pChip2'),
  art: document.getElementById('pArt')||document.getElementById('pArt2'),
  info: document.getElementById('pInfo')||document.getElementById('pInfo2'),
  cur: document.getElementById('curTime')||document.getElementById('curTime2'),
  tot: document.getElementById('totTime')||document.getElementById('totTime2'),
  remain: document.getElementById('remain')||document.getElementById('remain2'),
  fill: document.getElementById('progressFill')||document.getElementById('progressFill2'),
  handle: document.getElementById('progressHandle')||document.getElementById('progressHandle2'),
  progress: document.getElementById('progress')||document.getElementById('progress2'),
  vis: document.getElementById('visCanvas')||document.getElementById('visCanvas2'),
  visLeft: document.getElementById('visLeft')||document.getElementById('visLeft2'),
  // info panel
  infoTitle: document.getElementById('infoTitle'),
  infoAuthor: document.getElementById('infoAuthor'),
  infoFormat: document.getElementById('infoFormat'),
  infoChip: document.getElementById('infoChip'),
  infoDur: document.getElementById('infoDur'),
};

function fmt(s){
  s=Math.max(0, Math.floor(s));
  const m=Math.floor(s/60), sec=s%60;
  return m+':'+String(sec).padStart(2,'0');
}

function ensureAudio(){
  if(audioCtx) return;
  audioCtx=new (window.AudioContext||window.webkitAudioContext)({sampleRate:48000});
  master=audioCtx.createGain();
  master.gain.value=0.84;
  analyser=audioCtx.createAnalyser();
  analyser.fftSize=1024;
  master.connect(analyser);
  analyser.connect(audioCtx.destination);
}

function stopOsc(){
  oscillators.forEach(o=>{try{o.stop()}catch{}});
  oscillators=[];
}

function playOsc(){
  ensureAudio();
  if(audioCtx.state==='suspended') audioCtx.resume();
  stopOsc();
  // create 3 detuned square-ish voices + bass
  const baseFreq=[110, 138.59, 164.81]; // A2, C#3, E3
  const detune=[-4,0,5];
  for(let ch=0; ch<3; ch++){
    if(chanMute[ch]) continue;
    const osc=audioCtx.createOscillator();
    const g=audioCtx.createGain();
    const f=audioCtx.createBiquadFilter();
    f.type='lowpass'; f.frequency.value=2800;
    osc.type= ch===1 ? 'square' : 'triangle';
    osc.frequency.value=baseFreq[ch] * (1 + Math.sin(Date.now()*0.001+ch)*0.002);
    osc.detune.value=detune[ch];
    g.gain.value= ch===1 ? 0.11 : 0.065;
    // simple envelope wobble
    const lfo=audioCtx.createOscillator();
    const lfoGain=audioCtx.createGain();
    lfo.frequency.value= 4.2 + ch*0.7;
    lfoGain.gain.value= 6;
    lfo.connect(lfoGain); lfoGain.connect(osc.detune);
    lfo.start();
    oscillators.push(lfo);
    osc.connect(f); f.connect(g); g.connect(master);
    osc.start();
    oscillators.push(osc);
  }
  // bass
  if(!chanMute[0]){
    const osc=audioCtx.createOscillator();
    const g=audioCtx.createGain();
    osc.type='sawtooth'; osc.frequency.value=55;
    g.gain.value=0.055;
    osc.connect(g); g.connect(master);
    osc.start(); oscillators.push(osc);
  }
}

function renderPlaylist(){
  const pl=document.getElementById('playlist');
  const pl2=document.getElementById('playlist2');
  function html(){
    return DEMO_TRACKS.map((t,i)=>`
      <div class="track ${i===idx?'active':''}" data-i="${i}" onclick="selectTrack(${i}, true)">
        <span class="track-index mono">${String(i+1).padStart(2,'0')}</span>
        <span style="font-size:18px">${t.icon}</span>
        <div class="track-main"><div class="track-title">${t.title}</div><div class="track-sub">${t.artist} • ${t.format}</div></div>
        <span class="track-chip">${t.chip.split(' ')[0]}</span>
        <span class="track-time mono">${fmt(t.dur)}</span>
      </div>
    `).join('');
  }
  if(pl) pl.innerHTML=html();
  if(pl2) pl2.innerHTML=html();
  const c=document.getElementById('plCount'); if(c) c.textContent=DEMO_TRACKS.length+' tracks';
  const c2=document.getElementById('plCount2'); if(c2) c2.textContent=DEMO_TRACKS.length+' tracks';
}

window.selectTrack=(i, autoplay=false)=>{
  idx=(i+DEMO_TRACKS.length)%DEMO_TRACKS.length;
  cur=0; pausedAt=0;
  const t=DEMO_TRACKS[idx];
  if(els.title) els.title.textContent=t.title;
  if(els.artist) els.artist.textContent=t.artist+' • '+t.format;
  if(els.format) els.format.textContent=t.format;
  if(els.chip) els.chip.textContent=t.chip;
  if(els.art) els.art.textContent=t.icon;
  if(els.info) els.info.textContent=`${t.ext} • ${fmt(t.dur)} • ${t.chip}`;
  if(els.tot) els.tot.textContent=fmt(t.dur);
  if(els.visLeft) els.visLeft.textContent=`${t.chip} • ${t.format} • CH A/B/C`;
  if(els.infoTitle) els.infoTitle.textContent=t.title;
  if(els.infoAuthor) els.infoAuthor.textContent=t.artist;
  if(els.infoFormat) els.infoFormat.textContent=t.format+` (${t.ext})`;
  if(els.infoChip) els.infoChip.textContent=t.chip;
  if(els.infoDur) els.infoDur.textContent=`${fmt(t.dur)} • ループ: ${loopMode===1?'1曲':loopMode===2?'全曲':'なし'}`;
  renderPlaylist();
  updateProgress();
  if(autoplay){
    if(!playing) togglePlay();
    else { // restart
      startAt=audioCtx ? audioCtx.currentTime : 0;
      playOsc();
    }
  } else if(playing){
    startAt=audioCtx ? audioCtx.currentTime : 0;
    playOsc();
  }
  // highlight speed
  syncDocumentTitle();
};

function syncDocumentTitle(){
  const t=DEMO_TRACKS[idx];
  document.title = playing ? `▶ ${t.title} — ZXTune` : `${t.title} — ZXTune Web Player`;
}

function togglePlay(){
  ensureAudio();
  if(audioCtx.state==='suspended') audioCtx.resume();
  playing=!playing;
  const btn=document.getElementById('btnPlay')||document.getElementById('btnPlay2');
  if(btn) btn.textContent= playing ? '⏸' : '▶';
  if(playing){
    startAt=audioCtx.currentTime - pausedAt;
    playOsc();
    tick();
  } else {
    pausedAt= cur;
    stopOsc();
    cancelAnimationFrame(raf);
  }
  syncDocumentTitle();
}

function tick(){
  if(!playing) return;
  const t=DEMO_TRACKS[idx];
  if(audioCtx) cur= audioCtx.currentTime - startAt;
  else cur+=0.016;
  if(cur>= t.dur){
    if(loopMode===1){
      cur=0; startAt=audioCtx.currentTime;
      playOsc();
    } else if(loopMode===2 || shuffle){
      nextTrack();
      return;
    } else {
      cur=t.dur;
      playing=false;
      const btn=document.getElementById('btnPlay')||document.getElementById('btnPlay2');
      if(btn) btn.textContent='▶';
      stopOsc();
      syncDocumentTitle();
      updateProgress();
      return;
    }
  }
  updateProgress();
  raf=requestAnimationFrame(tick);
}

function updateProgress(){
  const t=DEMO_TRACKS[idx];
  const pct=Math.min(1, Math.max(0, cur / t.dur));
  if(els.fill) els.fill.style.width=(pct*100)+'%';
  if(els.handle) els.handle.style.left=(pct*100)+'%';
  if(els.cur) els.cur.textContent=fmt(cur);
  if(els.remain) els.remain.textContent='-'+fmt(Math.max(0, t.dur - cur));
  if(els.tot) els.tot.textContent=fmt(t.dur);
}

function prevTrack(){ selectTrack(idx-1, true); }
function nextTrack(){
  if(shuffle){
    let n;
    do { n=Math.floor(Math.random()*DEMO_TRACKS.length); } while(DEMO_TRACKS.length>1 && n===idx);
    selectTrack(n, true);
  } else selectTrack(idx+1, true);
}

window.toggleChan=(ch)=>{
  chanMute[ch]=!chanMute[ch];
  const el=document.getElementById(['chA','chB','chC'][ch]);
  if(el){
    el.style.opacity=chanMute[ch]?0.45:1;
    el.style.textDecoration=chanMute[ch]?'line-through':'none';
  }
  if(playing) playOsc();
  toast(chanMute[ch]? `CH ${['A','B','C'][ch]} ミュート` : `CH ${['A','B','C'][ch]} オン`, chanMute[ch]?'🔇':'🔊');
};

// bind controls
function bindControls(){
  const bPlay=document.getElementById('btnPlay'); if(bPlay) bPlay.onclick=togglePlay;
  const bPlay2=document.getElementById('btnPlay2'); if(bPlay2) bPlay2.onclick=togglePlay;
  const bPrev=document.getElementById('btnPrev'); if(bPrev) bPrev.onclick=prevTrack;
  const bPrev2=document.getElementById('btnPrev2'); if(bPrev2) bPrev2.onclick=prevTrack;
  const bNext=document.getElementById('btnNext'); if(bNext) bNext.onclick=nextTrack;
  const bNext2=document.getElementById('btnNext2'); if(bNext2) bNext2.onclick=nextTrack;
  const bLoop=document.getElementById('btnLoop'); const bLoop2=document.getElementById('btnLoop2');
  function toggleLoop(){
    loopMode=(loopMode+1)%3;
    const label=['↻','↻•1','↻•∞'][loopMode];
    if(bLoop) bLoop.textContent=label;
    if(bLoop2) bLoop2.textContent=label;
    if(bLoop) bLoop.classList.toggle('active', loopMode!==0);
    if(bLoop2) bLoop2.classList.toggle('active', loopMode!==0);
    toast(loopMode===0?'ループ: なし': loopMode===1?'ループ: 1曲リピート':'ループ: 全曲', '↻');
    if(els.infoDur) els.infoDur.textContent=`${fmt(DEMO_TRACKS[idx].dur)} • ループ: ${loopMode===1?'1曲':loopMode===2?'全曲':'なし'}`;
  }
  if(bLoop) bLoop.onclick=toggleLoop;
  if(bLoop2) bLoop2.onclick=toggleLoop;
  const bSh=document.getElementById('btnShuffle'); const bSh2=document.getElementById('btnShuffle2');
  function toggleShuffle(){
    shuffle=!shuffle;
    if(bSh) bSh.classList.toggle('active', shuffle);
    if(bSh2) bSh2.classList.toggle('active', shuffle);
    toast(shuffle?'シャッフル: ON':'シャッフル: OFF', '⇄');
  }
  if(bSh) bSh.onclick=toggleShuffle;
  if(bSh2) bSh2.onclick=toggleShuffle;

  const vol=document.getElementById('vol'); const vol2=document.getElementById('vol2');
  function onVol(e){
    const v=e.target.value/100;
    if(master) master.gain.value=v*0.9;
    if(vol) vol.value=e.target.value;
    if(vol2) vol2.value=e.target.value;
  }
  if(vol) vol.oninput=onVol;
  if(vol2) vol2.oninput=onVol;

  const speed=document.getElementById('speed');
  if(speed) speed.oninput=e=>{
    document.getElementById('speedVal').textContent=e.target.value+'%';
    if(audioCtx) audioCtx.dispatchEvent?.(new Event('speed'));
  };

  // progress seek
  [document.getElementById('progress'), document.getElementById('progress2')].forEach(p=>{
    if(!p) return;
    let dragging=false;
    function seek(e){
      const r=p.getBoundingClientRect();
      const x=(e.touches?e.touches[0].clientX:e.clientX)-r.left;
      const pct=Math.min(1, Math.max(0, x/r.width));
      const t=DEMO_TRACKS[idx];
      cur=pct*t.dur;
      pausedAt=cur;
      if(playing && audioCtx) startAt=audioCtx.currentTime - cur;
      updateProgress();
    }
    p.addEventListener('pointerdown', e=>{ dragging=true; p.setPointerCapture(e.pointerId); seek(e); });
    p.addEventListener('pointermove', e=>{ if(dragging) seek(e); });
    p.addEventListener('pointerup', ()=> dragging=false);
    p.addEventListener('click', seek);
  });

  // keyboard
  window.addEventListener('keydown', e=>{
    if(e.code==='Space'){ e.preventDefault(); togglePlay(); }
    if(e.code==='ArrowRight'){ cur=Math.min(DEMO_TRACKS[idx].dur, cur+5); pausedAt=cur; if(playing&&audioCtx) startAt=audioCtx.currentTime - cur; updateProgress(); }
    if(e.code==='ArrowLeft'){ cur=Math.max(0, cur-5); pausedAt=cur; if(playing&&audioCtx) startAt=audioCtx.currentTime - cur; updateProgress(); }
    if(e.key==='m' || e.key==='M'){ chanMute[0]=!chanMute[0]; toggleChan(0); }
    if(e.key==='l' || e.key==='L'){ if(bLoop) bLoop.click(); else if(bLoop2) bLoop2.click(); }
    if(e.key==='n' || e.key==='N'){ nextTrack(); }
    if(e.key==='p' || e.key==='P'){ prevTrack(); }
  });

  // drop
  ['dropZone','dropZone2'].forEach(id=>{
    const z=document.getElementById(id);
    if(!z) return;
    z.addEventListener('click', ()=> (document.getElementById('fileInput')||document.getElementById('fileInput2'))?.click());
    z.addEventListener('dragover', e=>{ e.preventDefault(); z.classList.add('drag'); });
    z.addEventListener('dragleave', ()=> z.classList.remove('drag'));
    z.addEventListener('drop', e=>{
      e.preventDefault(); z.classList.remove('drag');
      const files=e.dataTransfer.files;
      if(files.length) handleFiles(files);
    });
  });
  ['fileInput','fileInput2'].forEach(id=>{
    const inp=document.getElementById(id);
    if(inp) inp.addEventListener('change', e=> handleFiles(e.target.files));
  });
}

function handleFiles(files){
  const names=[...files].map(f=>f.name).join(', ');
  toast(`読み込み: ${names} — デモではプレイリストに追加`, '📁');
  // add to demo playlist as fake entries
  for(const f of files){
    const ext='.'+f.name.split('.').pop().toLowerCase();
    DEMO_TRACKS.push({title:f.name.replace(/\.[^.]+$/,''), artist:'Local file', format:ext.toUpperCase()+' file', chip:'Auto detect', dur: 120+Math.floor(Math.random()*120), ext, icon:"📄", color:"#B8A6FF"});
  }
  renderPlaylist();
  selectTrack(DEMO_TRACKS.length - files.length, true);
}

window.shufflePlaylist=()=>{
  for(let i=DEMO_TRACKS.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [DEMO_TRACKS[i],DEMO_TRACKS[j]]=[DEMO_TRACKS[j],DEMO_TRACKS[i]]; }
  renderPlaylist(); toast('シャッフルしました','⇄');
};
window.clearPlaylist=()=>{
  DEMO_TRACKS.splice(8);
  idx=0; renderPlaylist(); selectTrack(0,false); toast('プレイリストをリセット','🗑️');
};

// visualization — spectrum + waveform switch
(function visLoop(){
  const canvas=els.vis;
  if(!canvas) return;
  const ctx=canvas.getContext('2d');
  const DPR=Math.min(2, window.devicePixelRatio||1);
  function resize(){
    const r=canvas.getBoundingClientRect();
    canvas.width=r.width*DPR; canvas.height=r.height*DPR;
  }
  window.addEventListener('resize', resize);
  resize();
  const dataArray = new Uint8Array(256);
  let mode=0; //0 spectrum,1 waveform
  canvas.addEventListener('click', ()=>{ mode^=1; toast(mode?'波形表示':'スペクトラム表示', mode?'〰️':'▮▮'); });

  function draw(){
    requestAnimationFrame(draw);
    const w=canvas.width, h=canvas.height;
    ctx.clearRect(0,0,w,h);
    // bg
    const g=ctx.createLinearGradient(0,0,0,h);
    g.addColorStop(0,'rgba(18,24,46,0.0)');
    g.addColorStop(1,'rgba(7,10,18,0.55)');
    ctx.fillStyle=g; ctx.fillRect(0,0,w,h);
    // grid
    ctx.strokeStyle='rgba(255,255,255,0.04)';
    ctx.lineWidth=1*DPR;
    for(let x=0;x<w;x+=32*DPR){ ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,h); ctx.stroke(); }
    for(let y=0;y<h;y+=32*DPR){ ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(w,y); ctx.stroke(); }

    if(analyser && playing){
      if(mode===0){
        analyser.getByteFrequencyData(dataArray);
        const bars=56;
        const step=Math.floor(dataArray.length/bars);
        const barW=(w*0.94)/bars;
        for(let i=0;i<bars;i++){
          const v=dataArray[i*step]/255;
          const eased=Math.pow(v,0.9);
          const bh=eased * (h*0.72) + 2*DPR;
          const x=w*0.03 + i*barW;
          const y=h - bh - 12*DPR;
          const grad=ctx.createLinearGradient(x,y,x,y+bh);
          grad.addColorStop(0,'#00FFD1');
          grad.addColorStop(0.5,'#7C5CFF');
          grad.addColorStop(1,'rgba(255,59,130,0.8)');
          ctx.fillStyle=grad;
          ctx.shadowColor='rgba(0,255,209,0.25)'; ctx.shadowBlur=6*DPR;
          ctx.beginPath(); ctx.roundRect(x, y, barW-3*DPR, bh, [4*DPR,4*DPR,2,2]); ctx.fill();
          ctx.shadowBlur=0;
        }
      } else {
        analyser.getByteTimeDomainData(dataArray);
        ctx.strokeStyle='#00FFD1'; ctx.lineWidth=2*DPR; ctx.shadowColor='rgba(0,255,209,0.4)'; ctx.shadowBlur=8*DPR;
        ctx.beginPath();
        for(let i=0;i<dataArray.length;i++){
          const x=(i/dataArray.length)*w;
          const y=(dataArray[i]/255)*h*0.7 + h*0.15;
          if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
        }
        ctx.stroke(); ctx.shadowBlur=0;
        // fill under
        const grad=ctx.createLinearGradient(0,0,0,h);
        grad.addColorStop(0,'rgba(0,255,209,0.18)');
        grad.addColorStop(1,'rgba(0,0,0,0)');
        ctx.fillStyle=grad;
        ctx.lineTo(w,h); ctx.lineTo(0,h); ctx.closePath(); ctx.fill();
      }
    } else {
      // idle — faux bars
      const t=Date.now()*0.001;
      const bars=56;
      const barW=(w*0.94)/bars;
      for(let i=0;i<bars;i++){
        const ph=i/bars;
        const v=0.08 + 0.28*Math.pow(Math.sin(t*1.4 + ph*10),2) * Math.sin(ph*Math.PI);
        const bh=v*h;
        const x=w*0.03 + i*barW;
        const y=h - bh - 12*DPR;
        ctx.fillStyle= playing ? 'rgba(0,255,209,0.9)' : 'rgba(255,255,255,0.10)';
        ctx.beginPath(); ctx.roundRect(x,y,barW-3*DPR,bh,[3,3,1,1]); ctx.fill();
      }
      if(!playing){
        ctx.fillStyle='rgba(255,255,255,0.28)';
        ctx.font=`${11*DPR}px JetBrains Mono, monospace`;
        ctx.textAlign='center';
        ctx.fillText('▶ を押して再生 — クリックで波形切替', w/2, h/2);
        ctx.textAlign='left';
      }
    }
    // bottom line
    ctx.strokeStyle='rgba(255,255,255,0.06)';
    ctx.lineWidth=1*DPR;
    ctx.beginPath(); ctx.moveTo(0,h-0.5*DPR); ctx.lineTo(w,h-0.5*DPR); ctx.stroke();
  }
  requestAnimationFrame(draw);
})();

// init
renderPlaylist();
selectTrack(0,false);
bindControls();

// expose for console
window.ZXTUNE_PLAYER={nextTrack, prevTrack, togglePlay, selectTrack};
