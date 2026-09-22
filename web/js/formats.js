// formats.html — the curated cards, and the engine's full plugin list
const esc=s=>String(s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const catLabel=id=>window.FORMAT_CATS.find(c=>c.id===id)?.label ?? id;

// --- curated formats ---------------------------------------------------------------
const grid=document.getElementById('grid');
const q=document.getElementById('q');
const countEl=document.getElementById('count');
const chips=[...document.querySelectorAll('.filter-bar .chip')];
let activeCat='all';
let query='';

function matches(f){
  if(activeCat!=='all' && f.cat!==activeCat) return false;
  if(!query) return true;
  const s=query.toLowerCase();
  return [f.ext, f.name, f.aka, f.desc, f.chip, f.platform, ...(f.exts||[]), ...(f.plugins||[]), ...(f.features||[])].join(' ').toLowerCase().includes(s);
}

function render(){
  const list=window.ZXTUNE_FORMATS.filter(matches);
  countEl.textContent=`${list.length} / ${window.ZXTUNE_FORMATS.length} 形式`;
  grid.innerHTML=list.map(f=>`
    <div class="format-card">
      <div class="format-top"><div class="format-ext">${esc(f.ext==='—' ? f.aka : f.ext)}</div><span class="format-cat">${esc(catLabel(f.cat))}</span></div>
      <div class="format-name">${esc(f.name)} <span class="format-aka">· ${esc(f.aka)}</span></div>
      <div class="format-desc">${esc(f.desc)}</div>
      <div class="format-meta"><span>${esc(f.platform)}</span>${f.chip!=='—' ? `<span>${esc(f.chip)}</span>` : ''}${f.exts?.length ? `<span>${esc(f.exts.join(' '))}</span>` : ''}</div>
      <div class="feature-tags">${(f.features||[]).map(x=>`<span>${esc(x)}</span>`).join('')}</div>
      <a class="link" href="formats/${f.id}.html">詳細ページ →</a>
    </div>
  `).join('') || `<div class="empty-note">該当する形式がありません。<br>検索ワードを変えてみてください。</div>`;
}

chips.forEach(c=> c.addEventListener('click', ()=>{
  chips.forEach(x=>x.classList.remove('active'));
  c.classList.add('active');
  activeCat=c.dataset.cat;
  history.replaceState(null,'', activeCat==='all' ? 'formats.html' : 'formats.html#'+activeCat);
  render();
}));
if(q) q.addEventListener('input', e=>{ query=e.target.value; render(); });

if(location.hash){
  const h=location.hash.slice(1);
  const found=chips.find(c=>c.dataset.cat===h);
  if(found){ chips.forEach(x=>x.classList.remove('active')); found.classList.add('active'); activeCat=h; }
}
const params=new URLSearchParams(location.search);
if(params.get('q') && q){ query=params.get('q'); q.value=query; }
render();

// --- every plugin the engine reports ---------------------------------------------------
(function(){
  const table=document.getElementById('pluginRows');
  const stats=window.ZXTUNE_ENGINE_STATS, plugins=window.ZXTUNE_PLUGINS;
  if(!table || !plugins) return;
  const TYPES={archive:'書庫', compressor:'圧縮', snapshot:'スナップショット', diskimage:'ディスクイメージ', decompiler:'コンパイル済み曲の展開', multitrack:'複数曲の展開', scaner:'走査'};
  const kindOf=p=> p.kind==='container' ? TYPES[p.type]||p.type : `曲 • ${p.devices.join(' + ')||'—'}`;
  for(const el of document.querySelectorAll('[data-stat]')) el.textContent=stats[el.dataset.stat];
  const pq=document.getElementById('pluginQuery');
  const pkind=document.getElementById('pluginKind');
  const pcount=document.getElementById('pluginCount');
  function renderPlugins(){
    const s=(pq?.value||'').trim().toLowerCase();
    const k=pkind?.value||'all';
    const list=plugins.filter(p=>(k==='all' || p.kind===k) && (!s || `${p.id} ${p.description} ${kindOf(p)}`.toLowerCase().includes(s)));
    pcount.textContent=`${list.length} / ${plugins.length}`;
    table.innerHTML=list.map(p=>`<tr><td><code>${esc(p.id)}</code></td><td>${esc(p.description)}</td><td>${esc(kindOf(p))}</td></tr>`).join('')
      || '<tr><td colspan="3" class="empty-note">該当するプラグインがありません。</td></tr>';
  }
  pq?.addEventListener('input', renderPlugins);
  pkind?.addEventListener('change', renderPlugins);
  renderPlugins();
})();
