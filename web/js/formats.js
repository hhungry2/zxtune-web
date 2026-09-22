// formats.html — filtering + rendering
const grid=document.getElementById('grid');
const q=document.getElementById('q');
const countEl=document.getElementById('count');
const chips=[...document.querySelectorAll('.chip')];
let activeCat='all';
let query='';

function matches(f){
  if(activeCat!=='all' && f.cat!==activeCat) return false;
  if(!query) return true;
  const s=query.toLowerCase();
  return [f.ext,f.name,f.aka,f.desc,f.chip,f.platform,f.year, f.features?.join(' ')].join(' ').toLowerCase().includes(s);
}

function render(){
  const list=window.ZXTUNE_FORMATS.filter(matches);
  countEl.textContent=list.length+' / '+window.ZXTUNE_FORMATS.length+' formats';
  grid.innerHTML=list.map(f=>`
    <div class="format-card">
      <div class="format-top"><div class="format-ext">${f.ext}</div><span class="format-cat">${f.cat}</span></div>
      <div class="format-name">${f.name} <span style="color:var(--muted);font-weight:400">· ${f.aka}</span></div>
      <div class="format-desc">${f.desc}</div>
      <div class="format-meta"><span>${f.platform}</span><span>${f.chip}</span><span>${f.year}</span><span>${(f.exts||[f.ext]).join(' ')}</span></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:4px">${(f.features||[]).map(x=>`<span style="font-size:11px;padding:3px 7px;border-radius:999px;background:rgba(0,255,209,.08);border:1px solid rgba(0,255,209,.15);color:var(--cyan);font-family:'JetBrains Mono',monospace">${x}</span>`).join('')}</div>
      <a class="link" href="formats/${f.id}.html">詳細ページ →</a>
    </div>
  `).join('') || `<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--muted)">該当するフォーマットがありません。<br>検索ワードを変えてみてください。</div>`;
}

chips.forEach(c=> c.addEventListener('click', ()=>{
  chips.forEach(x=>x.classList.remove('active'));
  c.classList.add('active');
  activeCat=c.dataset.cat;
  // hash
  history.replaceState(null,'', activeCat==='all' ? 'formats.html' : 'formats.html#'+activeCat);
  render();
}));
if(q) q.addEventListener('input', e=>{ query=e.target.value; render(); });

// hash init
if(location.hash){
  const h=location.hash.slice(1);
  const found=chips.find(c=>c.dataset.cat===h);
  if(found){ chips.forEach(x=>x.classList.remove('active')); found.classList.add('active'); activeCat=h; }
}
render();

// allow ?q= param
const params=new URLSearchParams(location.search);
if(params.get('q')){ query=params.get('q'); q.value=query; render(); }
