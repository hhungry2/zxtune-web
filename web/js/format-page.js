// formats/<id>.html — one page per format or category, filled from
// formats-data.js and the engine's plugin list (plugins-data.js).
(function(){
const id=location.pathname.split('/').pop().replace('.html','');
const FORMATS=window.ZXTUNE_FORMATS, CATS=window.FORMAT_CATS, PLUGINS=window.ZXTUNE_PLUGINS||[];
const esc=s=>String(s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const SITE='ZXTune / Chiptune Web Player';
const CONTAINER_TYPES={archive:'書庫', compressor:'圧縮', snapshot:'スナップショット', diskimage:'ディスクイメージ', decompiler:'コンパイル済み曲の展開', multitrack:'複数曲の展開', scaner:'走査'};

// "ID" or "ID|text": among plugins sharing an id, the ones whose description has the text
function pluginsOf(f){
  return (f.plugins||[]).flatMap(spec=>{
    const [pid, text]=spec.split('|');
    return PLUGINS.filter(p=>p.id===pid && (!text || p.description.includes(text)));
  });
}
function pluginKind(p){
  return p.kind==='container' ? CONTAINER_TYPES[p.type]||p.type : `曲 (${p.devices.join(' + ')||'—'})`;
}
function extsOf(f){
  return f.exts && f.exts.length ? f.exts.join(' / ') : '決まった拡張子なし';
}
const isContainerCat=cat=>cat==='packed' || cat==='archived';
// formats without a fixed extension show their id instead
const tag=f=>f.ext==='—' ? f.aka : f.ext;

const root=document.getElementById('detailRoot');
const related=document.getElementById('related');
const cat=CATS.find(c=>c.id===id);

if(cat){
  const list=FORMATS.filter(f=>f.cat===id);
  const plugins=[...new Set(list.flatMap(pluginsOf))];
  document.title=`${cat.label} — ${SITE}`;
  document.querySelector('meta[name="description"]').content=cat.desc;
  root.innerHTML=`
    <div class="detail-hero">
      <div class="detail-head">
        <div class="detail-icon">${cat.icon}</div>
        <div class="detail-title"><h1>${esc(cat.label)}</h1><p>${list.length} 形式 • ${esc(cat.desc)}</p></div>
        <div class="detail-stats"><span><b>${list.length}</b>掲載形式</span><span><b>${plugins.length}</b>プラグイン</span></div>
      </div>
      <div class="detail-body">
        <div>
          <div class="tile-grid">
            ${list.map(f=>`
              <a class="tile" href="${f.id}.html">
                <span class="tile-ext">${esc(tag(f))}</span>
                <span class="tile-main"><b>${esc(f.name)}</b><span>${esc(f.platform)}</span></span>
                <span class="tile-go">→</span>
              </a>`).join('')}
          </div>
          <div class="note-box">
            <h3>このカテゴリについて</h3>
            <p>${esc(cat.desc)} ここには代表的な形式を載せています。エンジンが対応する形式の全体は、<a href="../formats.html#plugins">フォーマット図鑑の全プラグイン一覧</a>にあります。</p>
            <div class="note-actions">
              <a class="btn btn-primary" href="../player.html">▶ Webプレイヤーで試す</a>
              <a class="btn btn-ghost" href="../formats.html">他のカテゴリを見る</a>
            </div>
          </div>
        </div>
        <div class="detail-side">
          <div class="info-box"><h4>カテゴリ情報</h4><dl><dt>掲載形式</dt><dd>${list.length}</dd><dt>関係するプラグイン</dt><dd>${plugins.length}</dd><dt>主なチップ</dt><dd>${esc([...new Set(list.map(f=>f.chip))].filter(c=>c!=='—').slice(0,3).join(', ')||'—')}</dd></dl></div>
          <div class="try-box"><h4>💡 すぐ試す</h4><p>このカテゴリのファイルを Webプレイヤーにドロップすると再生できます。書庫やディスクイメージの中の曲も探します。</p><a class="btn btn-primary" href="../player.html" style="width:100%;justify-content:center">Webプレイヤーを開く</a></div>
        </div>
      </div>
    </div>`;
  related.innerHTML=`
    <h3 class="related-head">他のカテゴリ</h3>
    <div class="formats-cats">${CATS.filter(c=>c.id!==id).map(c=>`
      <a class="cat-card" href="${c.id}.html" style="--cat:${c.color}"><div class="cat-head"><div class="cat-icon">${c.icon}</div><div><h3>${esc(c.label)}</h3><span>${FORMATS.filter(f=>f.cat===c.id).length} 形式</span></div></div><p>${esc(c.desc)}</p></a>`).join('')}</div>`;
} else {
  const f=FORMATS.find(x=>x.id===id);
  if(!f){
    root.innerHTML=`<div class="not-found"><h2>フォーマットが見つかりません</h2><p>${esc(id)} に対応するページがありません。</p><a class="btn btn-ghost" href="../formats.html">一覧へ戻る</a></div>`;
  } else {
    const fcat=CATS.find(c=>c.id===f.cat);
    const plugins=pluginsOf(f);
    const container=isContainerCat(f.cat);
    document.title=`${f.name} — ${SITE}`;
    document.querySelector('meta[name="description"]').content=`${f.desc} ${f.long}`;
    root.innerHTML=`
      <div class="detail-hero">
        <div class="detail-head">
          <div class="detail-icon">${fcat.icon}</div>
          <div class="detail-title">
            <h1>${esc(f.name)} <span class="detail-ext">${esc(tag(f))}</span></h1>
            <p>${esc(f.aka)} • ${esc(f.platform)}${f.chip!=='—' ? ` • ${esc(f.chip)}` : ''} • <a href="${fcat.id}.html">${esc(fcat.label)}</a></p>
          </div>
          <div class="detail-stats">
            ${f.ext!=='—' ? `<span><b>${esc(f.ext)}</b>拡張子</span>` : ''}
            <span><b>${plugins.length}</b>プラグイン</span>
            ${f.chip!=='—' ? `<span><b>${esc(f.chip)}</b>チップ</span>` : ''}
          </div>
        </div>
        <div class="detail-body">
          <div class="detail-prose">
            <p class="lead"><b>${esc(f.desc)}</b></p>
            <p>${esc(f.long)}</p>
            <h3>基本情報</h3>
            <ul class="spec-list">
              <li>拡張子: <code>${esc(extsOf(f))}</code></li>
              <li>プラットフォーム: <code>${esc(f.platform)}</code></li>
              ${f.chip!=='—' ? `<li>サウンドチップ: <code>${esc(f.chip)}</code></li>` : ''}
              <li>カテゴリ: <code>${esc(fcat.label)}</code></li>
            </ul>
            <h3>${container ? '展開と再生' : '再生と互換性'}</h3>
            <p>${container
              ? 'ZXTune はこの形式を開いて中身を調べ、見つかった曲を再生します。形式はファイル名ではなく中身で判定します。'
              : 'ZXTune はファイル名ではなく中身で形式を判定して再生します。ZIP や TRD などの書庫・ディスクイメージに入ったままでも見つけます。Web プレイヤーは同じ C++ コアを WebAssembly にしたものです。'}</p>
            <h3>ヒント</h3>
            <p>${f.cat==='aym' ? 'Webプレイヤーの A / B / C ボタン (キーボードでは M が A チャンネル) でチャンネルをミュートすると、各パートを聴き分けられます。補間や AY/YM の切り替えは設定パネルから。'
              : f.cat==='console' ? '1つのファイルに複数の曲が入っている形式は、1曲ずつプレイリストに展開されます。'
              : container ? '決まった拡張子がなくても、ドロップすれば ZXTune が中身から判定します。'
              : 'Webプレイヤーにドラッグ＆ドロップするだけで再生できます。'}</p>
            <div class="engine-box">
              <h4>エンジンのプラグイン</h4>
              ${plugins.length ? `<ul>${plugins.map(p=>`<li><code>${esc(p.id)}</code> ${esc(p.description)} <span>${esc(pluginKind(p))}</span></li>`).join('')}</ul>`
                : '<p>対応するプラグインがありません。</p>'}
              <p class="engine-note">このサイトの wasm エンジンが報告するプラグインです。</p>
            </div>
          </div>
          <div class="detail-side">
            <div class="info-box">
              <h4>ファイル情報</h4>
              <dl>
                <dt>名前</dt><dd>${esc(f.name)}</dd>
                <dt>別名 / ID</dt><dd>${esc(f.aka)}</dd>
                <dt>拡張子</dt><dd>${esc(extsOf(f))}</dd>
                <dt>プラットフォーム</dt><dd>${esc(f.platform)}</dd>
                ${f.chip!=='—' ? `<dt>チップ</dt><dd>${esc(f.chip)}</dd>` : ''}
                <dt>カテゴリ</dt><dd><a href="${fcat.id}.html">${esc(fcat.label)}</a></dd>
              </dl>
            </div>
            <div class="info-box">
              <h4>特徴</h4>
              <div class="feature-tags">${(f.features||[]).map(x=>`<span>${esc(x)}</span>`).join('')}</div>
            </div>
            <div class="try-box">
              <h4>▶ この形式を試す</h4>
              <p>${container || f.ext==='—' ? 'このファイルを' : `<code>${esc(f.ext)}</code> などのファイルを`} Webプレイヤーにドロップしてください。</p>
              <a class="btn btn-primary" href="../player.html" style="width:100%;justify-content:center">Webプレイヤーで再生</a>
              <a class="btn btn-ghost" href="../formats.html" style="width:100%;justify-content:center;margin-top:8px">一覧に戻る</a>
            </div>
          </div>
        </div>
      </div>`;
    const rel=FORMATS.filter(x=>x.cat===f.cat && x.id!==f.id).slice(0,6);
    related.innerHTML=`
      <div class="related-bar">
        <h3 class="related-head">同じカテゴリの形式</h3>
        <a href="${fcat.id}.html">すべて見る →</a>
      </div>
      <div class="formats-grid">
        ${rel.map(r=>`
          <a class="format-card" href="${r.id}.html">
            <div class="format-top"><div class="format-ext">${esc(tag(r))}</div><span class="format-cat">${esc(fcat.label)}</span></div>
            <div class="format-name">${esc(r.name)}</div>
            <div class="format-desc">${esc(r.desc)}</div>
            <div class="format-meta"><span>${esc(r.platform)}</span></div>
          </a>`).join('')}
      </div>`;
  }
}
})();
