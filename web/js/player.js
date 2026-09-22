// ZXTune Web Player — the page side of the real wasm engine.
//
// The engine (player.mjs, zxtune.wasm, the worker and the worklet) is published
// once at the root of the Pages site, and this site sits in a folder next to
// it, so it is loaded from one level up. <html data-engine="..."> overrides that.
// Made absolute against the page: import() would otherwise resolve it against
// this script, while fetch, the worker and the worklet use the page.
const ENGINE_BASE = new URL((document.documentElement.dataset.engine || '..') + '/', document.baseURI).href.replace(/\/$/, '');
const CHANNELS_MASK = 'zxtune.core.channels_mask';
const AYM_LAYOUT = 'zxtune.core.aym.layout';   // 0 ABC … 5 CBA, 6 mono
const AYM_TYPE = 'zxtune.core.aym.type';       // 0 AY-3-8910, 1 YM2149F: volume curve and envelope steps
// AY and SAA only ever drive the output upwards, so it rides on a DC offset. A
// one-pole DC blocker, y[n] = x[n] - x[n-1] + R*y[n-1], cuts below this:
const DC_CUTOFF_HZ = 5;
// One interpolation choice covers every chip that has the setting. Their
// defaults differ, hence the explicit 'default' row (see core_parameters.h).
const INTERPOLATION = {
  default: {aym:2, saa:1, sid:0, dac:0},
  hq:      {aym:2, saa:2, sid:2, dac:1},
  lq:      {aym:1, saa:1, sid:1, dac:1},
  none:    {aym:0, saa:0, sid:0, dac:0},
};
const SETTINGS_KEY = 'zxtune.web.settings';

// The sample set shipped with the engine: one tune per sound chip.
const SAMPLES = [
  {file:'Speccy2.pt3',          chip:'AY-3-8910', icon:'🎹'},
  {file:'TOXIC2.stc',           chip:'AY-3-8910', icon:'🎛️'},
  {file:'Kurztech.ym',          chip:'YM2149',    icon:'🎹'},
  {file:'Love_Is_a_Shield.sid', chip:'MOS6581',   icon:'💾'},
  {file:'knifus.nsf',           chip:'RP2A03',    icon:'👾'},
  {file:'sos.gbs',              chip:'LR35902',   icon:'🕹️'},
  {file:'ala-16.spc',           chip:'SPC700',    icon:'🎮'},
  {file:'carillon.cop',         chip:'SAA1099',   icon:'🎚️'},
  {file:'disco.tfe',            chip:'YM2203',    icon:'🌀'},
];

let tracks=[];            // {title, author, format, chip, icon, ext, durationMs, bytes, subpath, file, local}
let current=null;         // the entry shown in the player
let opened=null;          // the entry the engine has open
let openToken=0;
let player=null, gain=null, analyser=null, dcBlock=null;
let playing=false, posMs=0;
let chanMute=[false,false,false];
let loopMode=0; //0 none,1 one,2 all
let shuffle=false;
let bootError=null;

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

function fmt(ms){
  const s=Math.max(0, Math.floor((ms||0)/1000));
  return Math.floor(s/60)+':'+String(s%60).padStart(2,'0');
}

function esc(s){
  return String(s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function setText(el, text){ if(el) el.textContent=text; }

function setPlayButton(){
  for(const id of ['btnPlay','btnPlay2']){
    const b=document.getElementById(id); if(b) b.textContent= playing ? '⏸' : '▶';
  }
}

function loopLabel(){ return loopMode===1?'1曲':loopMode===2?'全曲':'なし'; }

function entryFrom(meta, extra){
  const name=extra.file;
  const ext='.'+name.split('.').pop().toLowerCase();
  return {
    title: meta.title || name.replace(/\.[^.]+$/,''),
    author: meta.author || '',
    format: meta.program || meta.type || ext.slice(1).toUpperCase(),
    type: meta.type || '',
    durationMs: meta.durationMs || 0,
    subpath: meta.subpath || '',
    ext,
    ...extra,
  };
}

function renderPlaylist(){
  const q=(document.getElementById('search')?.value||'').trim().toLowerCase();
  const html=tracks.map((t,i)=>{
    if(q && !`${t.title} ${t.author} ${t.format} ${t.chip} ${t.file}`.toLowerCase().includes(q)) return '';
    return `
      <div class="track ${t===current?'active':''}" data-i="${i}" onclick="selectTrack(${i}, true)">
        <span class="track-index mono">${String(i+1).padStart(2,'0')}</span>
        <span style="font-size:18px">${t.icon}</span>
        <div class="track-main"><div class="track-title">${esc(t.title)}</div><div class="track-sub">${esc([t.author, t.format].filter(Boolean).join(' • '))}</div></div>
        <span class="track-chip">${esc(t.chip)}</span>
        <span class="track-time mono">${fmt(t.durationMs)}</span>
      </div>`;
  }).join('');
  for(const id of ['playlist','playlist2']){ const pl=document.getElementById(id); if(pl) pl.innerHTML=html; }
  for(const id of ['plCount','plCount2']){ const c=document.getElementById(id); if(c) c.textContent=tracks.length+' tracks'; }
}

function showTrack(t){
  setText(els.title, t.title);
  setText(els.artist, [t.author || 'Unknown', t.format].join(' • '));
  setText(els.format, t.format);
  setText(els.chip, t.chip);
  setText(els.art, t.icon);
  setText(els.info, `${t.ext} • ${fmt(t.durationMs)} • ${t.chip}`);
  setText(els.visLeft, `${t.chip} • ${t.type || t.format}`);
  setText(els.infoTitle, t.title);
  setText(els.infoAuthor, t.author || '—');
  setText(els.infoFormat, `${t.format} (${t.ext})`);
  setText(els.infoChip, t.chip);
  setText(els.infoDur, `${fmt(t.durationMs)} • ループ: ${loopLabel()}`);
}

function syncDocumentTitle(){
  if(!current) return;
  document.title = playing ? `▶ ${current.title} — ZXTune` : `${current.title} — ZXTune Web Player`;
}

function updateProgress(){
  const dur=current?.durationMs||0;
  const pct=dur ? Math.min(1, Math.max(0, posMs/dur)) : 0;
  if(els.fill) els.fill.style.width=(pct*100)+'%';
  if(els.handle) els.handle.style.left=(pct*100)+'%';
  setText(els.cur, fmt(posMs));
  setText(els.remain, '-'+fmt(Math.max(0, dur-posMs)));
  setText(els.tot, fmt(dur));
}

// Opens the entry in the engine unless it already is. Resolves false when a later
// selection overtook this one or the engine refused the file.
async function openInEngine(t){
  if(opened===t) return true;
  const token=++openToken;
  try{
    const meta=await player.open(t.bytes, t.subpath);
    if(token!==openToken) return false;
    if(meta.durationMs) t.durationMs=meta.durationMs;
    opened=t;
    posMs=0;
    return true;
  }catch(e){
    if(token===openToken){ opened=null; toast(`${t.file}: ${e.message}`, '⚠️'); }
    return false;
  }
}

async function startPlayback(){
  if(!player || !current) return;
  if(!await openInEngine(current)) { playing=false; setPlayButton(); return; }
  await player.play();
  playing=true;
  setPlayButton(); syncDocumentTitle(); updateProgress();
}

window.selectTrack=async (i, autoplay=false)=>{
  if(!tracks.length) return;
  const t=tracks[(i+tracks.length)%tracks.length];
  const wasPlaying=playing;
  current=t;
  posMs=0;
  showTrack(t);
  renderPlaylist();
  updateProgress();
  if(autoplay || wasPlaying) await startPlayback();
  if(current!==t) return;     // another selection came in while this one was opening
  showTrack(t); renderPlaylist(); updateProgress();
  syncDocumentTitle();
};

async function togglePlay(){
  if(!player){ toast(bootError ? `このブラウザでは再生できません: ${bootError}` : 'エンジンを読み込み中…', '⚠️'); return; }
  if(!current) return;
  if(playing){
    await player.pause();
    playing=false;
    setPlayButton(); syncDocumentTitle();
  } else {
    await startPlayback();
  }
}

function onEnded(){
  if(loopMode===1){
    player.seek(0); posMs=0; updateProgress();
  } else if(loopMode===2 || shuffle){
    nextTrack();
  } else {
    playing=false;
    player.pause();
    opened=null;               // the engine ran off the end; reopen on the next Play
    posMs=current?.durationMs||0;
    setPlayButton(); syncDocumentTitle(); updateProgress();
  }
}

function seekTo(ms){
  if(!current) return;
  posMs=Math.max(0, Math.min(current.durationMs||0, ms));
  if(player && opened===current) player.seek(posMs);
  updateProgress();
}

function indexOfCurrent(){ return Math.max(0, tracks.indexOf(current)); }
function prevTrack(){ selectTrack(indexOfCurrent()-1, true); }
function nextTrack(){
  if(shuffle && tracks.length>1){
    let n;
    do { n=Math.floor(Math.random()*tracks.length); } while(tracks[n]===current);
    selectTrack(n, true);
  } else selectTrack(indexOfCurrent()+1, true);
}

// Bit n of the core's channel mask silences channel n.
window.toggleChan=(ch)=>{
  chanMute[ch]=!chanMute[ch];
  const el=document.getElementById(['chA','chB','chC'][ch]);
  if(el){
    el.style.opacity=chanMute[ch]?0.45:1;
    el.style.textDecoration=chanMute[ch]?'line-through':'none';
  }
  const mask=chanMute.reduce((m, muted, i)=> muted ? m|(1<<i) : m, 0);
  player?.setIntProperty(CHANNELS_MASK, mask);
  toast(chanMute[ch]? `CH ${['A','B','C'][ch]} ミュート` : `CH ${['A','B','C'][ch]} オン`, chanMute[ch]?'🔇':'🔊');
};

// bind controls
function bindControls(){
  for(const id of ['btnPlay','btnPlay2']){ const b=document.getElementById(id); if(b) b.onclick=togglePlay; }
  for(const id of ['btnPrev','btnPrev2']){ const b=document.getElementById(id); if(b) b.onclick=prevTrack; }
  for(const id of ['btnNext','btnNext2']){ const b=document.getElementById(id); if(b) b.onclick=nextTrack; }
  const bLoop=document.getElementById('btnLoop'); const bLoop2=document.getElementById('btnLoop2');
  function toggleLoop(){
    loopMode=(loopMode+1)%3;
    const label=['↻','↻•1','↻•∞'][loopMode];
    for(const b of [bLoop,bLoop2]) if(b){ b.textContent=label; b.classList.toggle('active', loopMode!==0); }
    toast(loopMode===0?'ループ: なし': loopMode===1?'ループ: 1曲リピート':'ループ: 全曲', '↻');
    if(current) setText(els.infoDur, `${fmt(current.durationMs)} • ループ: ${loopLabel()}`);
  }
  if(bLoop) bLoop.onclick=toggleLoop;
  if(bLoop2) bLoop2.onclick=toggleLoop;
  const bSh=document.getElementById('btnShuffle'); const bSh2=document.getElementById('btnShuffle2');
  function toggleShuffle(){
    shuffle=!shuffle;
    for(const b of [bSh,bSh2]) if(b) b.classList.toggle('active', shuffle);
    toast(shuffle?'シャッフル: ON':'シャッフル: OFF', '⇄');
  }
  if(bSh) bSh.onclick=toggleShuffle;
  if(bSh2) bSh2.onclick=toggleShuffle;

  const vol=document.getElementById('vol'); const vol2=document.getElementById('vol2');
  let lastVol=84;
  function applyVol(v){
    if(gain) gain.gain.value=v/100;
    if(vol) vol.value=v;
    if(vol2) vol2.value=v;
    const m=document.getElementById('btnMute2'); if(m) m.textContent= Number(v)===0 ? '🔇' : '🔊';
  }
  if(vol) vol.oninput=e=>applyVol(e.target.value);
  if(vol2) vol2.oninput=e=>applyVol(e.target.value);
  const bMute=document.getElementById('btnMute2');
  if(bMute) bMute.onclick=()=>{
    const v=Number((vol2||vol)?.value ?? 84);
    if(v>0){ lastVol=v; applyVol(0); } else applyVol(lastVol||84);
  };
  bindControls.applyVol=()=>applyVol((vol||vol2)?.value ?? 84);

  const search=document.getElementById('search');
  if(search) search.oninput=renderPlaylist;

  // progress seek
  [document.getElementById('progress'), document.getElementById('progress2')].forEach(p=>{
    if(!p) return;
    let dragging=false;
    function ratio(e){
      const r=p.getBoundingClientRect();
      const x=(e.touches?e.touches[0].clientX:e.clientX)-r.left;
      return Math.min(1, Math.max(0, x/r.width));
    }
    // the engine restarts rendering on every seek, so only the release is sent to it
    p.addEventListener('pointerdown', e=>{ dragging=true; p.setPointerCapture(e.pointerId); posMs=ratio(e)*(current?.durationMs||0); updateProgress(); });
    p.addEventListener('pointermove', e=>{ if(dragging){ posMs=ratio(e)*(current?.durationMs||0); updateProgress(); } });
    p.addEventListener('pointerup', e=>{ if(dragging){ dragging=false; seekTo(ratio(e)*(current?.durationMs||0)); } });
  });

  // keyboard
  window.addEventListener('keydown', e=>{
    if(e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
    if(e.code==='Space'){ e.preventDefault(); togglePlay(); }
    if(e.code==='ArrowRight'){ seekTo(posMs+5000); }
    if(e.code==='ArrowLeft'){ seekTo(posMs-5000); }
    if(e.key==='m' || e.key==='M'){ toggleChan(0); }
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
      const files=[...e.dataTransfer.files];
      if(files.length) handleFiles(files);
    });
  });
  ['fileInput','fileInput2'].forEach(id=>{
    const inp=document.getElementById(id);
    // copied first: clearing the input (so the same file can be picked again) empties its live FileList
    if(inp) inp.addEventListener('change', e=>{ handleFiles([...e.target.files]); e.target.value=''; });
  });
}

// Audio settings: kept in the browser. The engine ones are pushed to the worker,
// which applies them to the playing track right away and to every track opened
// later; the DC filter lives in the page's own audio graph.
let settings={interp:'default', layout:0, aymType:0, dc:true};

function loadSettings(){
  try{
    const saved=JSON.parse(localStorage.getItem(SETTINGS_KEY)||'{}');
    if(saved.interp in INTERPOLATION) settings.interp=saved.interp;
    if(Number.isInteger(saved.layout) && saved.layout>=0 && saved.layout<=6) settings.layout=saved.layout;
    if(saved.aymType===0 || saved.aymType===1) settings.aymType=saved.aymType;
    if(typeof saved.dc==='boolean') settings.dc=saved.dc;
  }catch{}
}

function saveSettings(){
  try{ localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); }catch{}
}

function applySettings(){
  if(!player) return;
  for(const [chip, value] of Object.entries(INTERPOLATION[settings.interp])){
    player.setIntProperty(`zxtune.core.${chip}.interpolation`, value);
  }
  player.setIntProperty(AYM_LAYOUT, settings.layout);
  player.setIntProperty(AYM_TYPE, settings.aymType);
  routeOutput();
}

// worklet → [DC blocker] → analyser → volume → speakers
function routeOutput(){
  if(!player) return;
  const ctx=player.context;
  if(!dcBlock){
    const r=1 - 2*Math.PI*DC_CUTOFF_HZ/ctx.sampleRate;
    dcBlock=ctx.createIIRFilter([1, -1], [1, -r]);
    dcBlock.connect(analyser);
  }
  player.node.disconnect();
  player.node.connect(settings.dc ? dcBlock : analyser);
}

function bindSettings(){
  loadSettings();
  const bind=(id, key, parse, label)=>{
    const el=document.getElementById(id);
    if(!el) return;
    const checkbox=el.type==='checkbox';
    if(checkbox) el.checked=settings[key]; else el.value=String(settings[key]);
    el.onchange=()=>{
      settings[key]= checkbox ? el.checked : parse(el.value);
      saveSettings(); applySettings();
      toast(`${label}: ${checkbox ? (el.checked?'ON':'OFF') : el.selectedOptions[0].textContent}`, '🎚️');
    };
  };
  bind('interp', 'interp', String, '補間');
  bind('aymLayout', 'layout', Number, 'AYM レイアウト');
  bind('aymType', 'aymType', Number, 'AY/YM チップ');
  bind('dcFilter', 'dc', null, 'DC除去フィルタ');
}

function engineUnavailable(){
  if(player) return false;
  toast(bootError ? `このブラウザでは再生できません: ${bootError}` : 'エンジンを読み込み中…', '⚠️');
  return true;
}

// Content may be an archive or a multi-song rip: every module found in it is
// listed. Returns the index of the first new entry, or -1.
async function addContent(name, bytes, extra){
  let found;
  try{ found=await player.detect(bytes); }
  catch(e){ toast(`${name}: ${e.message}`, '⚠️'); return -1; }
  if(!found.length){ toast(`${name}: 再生できる曲が見つかりません`, '⚠️'); return -1; }
  const first=tracks.length;
  for(const meta of found){
    tracks.push(entryFrom(meta, {file:name, bytes, chip:'Local', icon:'📄', local:true, ...extra}));
  }
  toast(`${name}: ${found.length}曲を追加`, '📁');
  return first;
}

async function handleFiles(files){
  await booting;
  if(engineUnavailable()) return;
  let first=-1;
  for(const f of files){
    const at=await addContent(f.name, new Uint8Array(await f.arrayBuffer()), {source:'file'});
    if(first<0) first=at;
  }
  renderPlaylist();
  if(first>=0) selectTrack(first, true);
}

// --- loading from a URL -------------------------------------------------------
// The browser only hands over another site's bytes when that site allows it
// (CORS). raw.githubusercontent.com and api.modarchive.org do; pages that merely
// link to a tune usually do not. Nothing is proxied: the request goes from the
// visitor's browser straight to the URL they gave.
const MAX_DOWNLOAD = 64 << 20;

// Page links on hosts that also serve the raw file are rewritten to the latter.
function directUrl(input){
  const url=new URL(String(input).trim());
  if(url.protocol!=='https:' && url.protocol!=='http:') throw new Error('http(s) の URL を入力してください');
  const gh=url.hostname==='github.com' && url.pathname.match(/^\/([^/]+)\/([^/]+)\/(?:blob|raw)\/(.+)$/);
  if(gh) return new URL(`https://raw.githubusercontent.com/${gh[1]}/${gh[2]}/${gh[3]}`);
  if(/(^|\.)modarchive\.org$/.test(url.hostname) && url.hostname!=='api.modarchive.org'){
    const id=url.searchParams.get('moduleid') || url.searchParams.get('query') || url.search.match(/^\?(\d+)$/)?.[1];
    if(id && /^\d+$/.test(id)) return new URL(`https://api.modarchive.org/downloads.php?moduleid=${id}`);
  }
  return url;
}

function nameFromUrl(url){
  const id=url.hostname==='api.modarchive.org' && url.searchParams.get('moduleid');
  if(id) return `modarchive-${id}`;
  const last=url.pathname.split('/').filter(Boolean).pop();
  try{ return last ? decodeURIComponent(last) : url.hostname; }catch{ return last; }
}

async function fetchBytes(url){
  let res;
  try{ res=await fetch(url, {mode:'cors', credentials:'omit'}); }
  catch{
    throw new Error('読み込めませんでした。このサーバーがブラウザからの直接読み込みを許可していない (CORS) か、接続できません');
  }
  if(!res.ok) throw new Error(`HTTP ${res.status}`);
  const size=Number(res.headers.get('Content-Length')||0);
  if(size>MAX_DOWNLOAD) throw new Error(`${(size/1048576).toFixed(0)}MB は大きすぎます (上限 ${MAX_DOWNLOAD>>20}MB)`);
  const bytes=new Uint8Array(await res.arrayBuffer());
  if(bytes.length>MAX_DOWNLOAD) throw new Error(`上限 ${MAX_DOWNLOAD>>20}MB を超えています`);
  return bytes;
}

// Fetches, detects and lists. Resolves the index of the first new entry, or -1.
async function addFromUrl(input){
  let url;
  try{ url=directUrl(input); }
  catch(e){ toast(e instanceof TypeError ? 'URL の形式が正しくありません' : e.message, '⚠️'); return -1; }
  toast(`読み込み中: ${url.href}`, '🌐');
  let bytes;
  try{ bytes=await fetchBytes(url.href); }
  catch(e){ toast(`${nameFromUrl(url)}: ${e.message}`, '⚠️'); return -1; }
  return addContent(nameFromUrl(url), bytes, {source:'url', url:url.href, icon:'🌐', chip:'URL'});
}

async function loadFromUrl(input){
  await booting;
  if(engineUnavailable()) return;
  const first=await addFromUrl(input);
  renderPlaylist();
  if(first>=0) selectTrack(first, true);
}

let urlDialog=null;
window.openUrlDialog=()=>{
  if(!urlDialog){
    urlDialog=document.createElement('dialog');
    urlDialog.className='url-dialog';
    urlDialog.innerHTML=`
      <form method="dialog">
        <h3>URLから読み込み</h3>
        <input name="url" type="url" required placeholder="https://raw.githubusercontent.com/…/tune.pt3" autocomplete="url" spellcheck="false">
        <p>GitHub のファイル URL と ModArchive のモジュールページは、そのまま貼り付けられます。
        ほかのサイトは、ブラウザからの直接読み込み (CORS) を許可している場合だけ読めます。</p>
        <div class="url-dialog-actions">
          <button class="btn btn-ghost" type="button" data-cancel>キャンセル</button>
          <button class="btn btn-primary" value="load">読み込む</button>
        </div>
      </form>`;
    document.body.append(urlDialog);
    // Escape and Enter are handled here rather than left to the browser, whose
    // close request and implicit submission both depend on how the key arrived.
    // Cancel is a plain button, so nothing but "load" can submit.
    urlDialog.addEventListener('keydown', e=>{
      if(e.key==='Escape'){ e.preventDefault(); urlDialog.close('cancel'); }
      if(e.key==='Enter' && e.target.matches('input')){ e.preventDefault(); urlDialog.querySelector('form').requestSubmit(urlDialog.querySelector('[value=load]')); }
    });
    urlDialog.addEventListener('click', e=>{ if(e.target===urlDialog || e.target.closest('[data-cancel]')) urlDialog.close('cancel'); });
    urlDialog.addEventListener('close', ()=>{
      const input=urlDialog.querySelector('input');
      if(urlDialog.returnValue==='load' && input.value) loadFromUrl(input.value);
    });
  }
  urlDialog.returnValue='';
  urlDialog.showModal();
  urlDialog.querySelector('input').select();
};

// --- XSPF export --------------------------------------------------------------
// Written the way zxtune-qt writes it (playlist version 1: text fields
// percent-encoded, "location?subpath"), so the desktop and Android players can
// read it back. Local files can only be named, not located.
function xmlText(s){
  return String(s).replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
}
const pct=s=>encodeURIComponent(s);

function trackLocation(t){
  const base= t.source==='url' ? t.url
    : t.source==='sample' ? new URL(`${ENGINE_BASE}/tunes/${t.file}`).href
    : encodeURI(t.file);
  return t.subpath ? `${base}?${t.subpath}` : base;
}

function xspfExtension(props, indent){
  const lines=props.filter(([, v])=>v!=='' && v!=null)
    .map(([k, v])=>`${indent}  <property name="${xmlText(k)}">${xmlText(v)}</property>`);
  return `${indent}<extension application="http://zxtune.googlecode.com">\n${lines.join('\n')}\n${indent}</extension>`;
}

function buildXspf(list){
  const items=list.map(t=>{
    const fields=[`      <location>${xmlText(trackLocation(t))}</location>`];
    if(t.author) fields.push(`      <creator>${xmlText(pct(t.author))}</creator>`);
    fields.push(`      <title>${xmlText(pct(t.title))}</title>`);
    if(t.durationMs) fields.push(`      <duration>${t.durationMs}</duration>`);
    fields.push(xspfExtension([['Type', t.type && pct(t.type)], ['Program', t.format && t.format!==t.type ? pct(t.format) : '']], '      '));
    return `    <track>\n${fields.join('\n')}\n    </track>`;
  });
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<playlist version="1" xmlns="http://xspf.org/ns/0/">',
    xspfExtension([
      ['zxtune.app.playlist.creator', pct('zxtune-web')],
      ['zxtune.app.playlist.name', pct('ZXTune Web')],
      ['zxtune.app.playlist.version', 1],
      ['zxtune.app.playlist.items', list.length],
    ], '  '),
    '  <trackList>',
    ...items,
    '  </trackList>',
    '</playlist>',
    '',
  ].join('\n');
}

window.exportXspf=()=>{
  if(!tracks.length){ toast('プレイリストが空です', '⚠️'); return; }
  const blob=new Blob([buildXspf(tracks)], {type:'application/xspf+xml'});
  const a=document.createElement('a');
  const d=new Date();
  a.download=`zxtune-playlist-${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}.xspf`;
  a.href=URL.createObjectURL(blob);
  document.body.append(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(a.href), 1000);
  const locals=tracks.filter(t=>t.source==='file').length;
  toast(locals ? `${tracks.length}曲を保存 (ローカルファイル${locals}曲はファイル名のみ)` : `${tracks.length}曲を保存`, '💾');
};

window.shufflePlaylist=()=>{
  for(let i=tracks.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [tracks[i],tracks[j]]=[tracks[j],tracks[i]]; }
  renderPlaylist(); toast('シャッフルしました','⇄');
};
window.clearPlaylist=()=>{
  const wasLocal=current?.local;
  tracks=tracks.filter(t=>!t.local);
  tracks.sort((a,b)=>SAMPLES.findIndex(s=>s.file===a.file)-SAMPLES.findIndex(s=>s.file===b.file));
  if(wasLocal){
    if(playing){ player.pause(); playing=false; setPlayButton(); }
    opened=null;
    selectTrack(0,false);
  } else renderPlaylist();
  toast('プレイリストをリセット','🗑️');
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
  window.addEventListener('keydown', e=>{
    if(e.target instanceof HTMLInputElement) return;
    if(e.key==='s' || e.key==='S'){ mode^=1; toast(mode?'波形表示':'スペクトラム表示', mode?'〰️':'▮▮'); }
  });

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
        ctx.fillStyle='rgba(255,255,255,0.10)';
        ctx.beginPath(); ctx.roundRect(x,y,barW-3*DPR,bh,[3,3,1,1]); ctx.fill();
      }
      ctx.fillStyle='rgba(255,255,255,0.28)';
      ctx.font=`${11*DPR}px JetBrains Mono, monospace`;
      ctx.textAlign='center';
      ctx.fillText(bootError ? 'このブラウザでは再生できません' : !player ? 'エンジンを読み込み中…' : '▶ を押して再生 — クリックで波形切替', w/2, h/2);
      ctx.textAlign='left';
    }
    // bottom line
    ctx.strokeStyle='rgba(255,255,255,0.06)';
    ctx.lineWidth=1*DPR;
    ctx.beginPath(); ctx.moveTo(0,h-0.5*DPR); ctx.lineTo(w,h-0.5*DPR); ctx.stroke();
  }
  requestAnimationFrame(draw);
})();

async function fetchSample(file){
  const res=await fetch(`${ENGINE_BASE}/tunes/${file}`);
  if(!res.ok) throw new Error(`${res.status} ${file}`);
  return new Uint8Array(await res.arrayBuffer());
}

async function boot(){
  bindControls();
  bindSettings();
  setText(els.title, 'エンジンを読み込み中…');
  try{
    const { ZXTunePlayer } = await import(`${ENGINE_BASE}/player.mjs`);
    player=await ZXTunePlayer.create({ base: ENGINE_BASE });
  }catch(e){
    bootError=e?.message ?? String(e);
    setText(els.title, 'このブラウザでは再生できません');
    setText(els.artist, bootError);
    return;
  }
  // volume sits after the analyser so the visualizer does not shrink with it
  const ctx=player.context;
  analyser=player.analyser;
  analyser.fftSize=1024;
  analyser.disconnect();
  gain=ctx.createGain();
  analyser.connect(gain);
  gain.connect(ctx.destination);
  bindControls.applyVol();
  applySettings();
  player.onposition=ms=>{ if(opened===current){ posMs=ms; updateProgress(); } };
  player.onended=onEnded;

  // fetches overlap; detection is one at a time, since the worker's replies carry no id
  const fetched=SAMPLES.map(s=>fetchSample(s.file).catch(e=>e));
  const loaded=[];
  for(const [i, s] of SAMPLES.entries()){
    try{
      const bytes=await fetched[i];
      if(bytes instanceof Error) throw bytes;
      const [meta]=await player.detect(bytes);
      if(meta) loaded.push(entryFrom(meta, {...s, bytes, source:'sample'}));
    }catch(e){
      console.warn(s.file, e);
    }
  }
  tracks=[...loaded, ...tracks];
  // a shared link, player.html?url=…, lists that tune too. Playback waits for a
  // click, as browsers only start audio on one.
  const shared=new URLSearchParams(location.search).get('url');
  const at= shared ? await addFromUrl(shared) : -1;
  renderPlaylist();
  if(!tracks.length){ setText(els.title, 'サンプル曲を読み込めませんでした'); return; }
  selectTrack(Math.max(0, at), false);
}

const booting=boot();

// expose for console
window.ZXTUNE_PLAYER={nextTrack, prevTrack, togglePlay, selectTrack, get player(){ return player; }};
