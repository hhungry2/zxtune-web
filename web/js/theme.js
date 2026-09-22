// Light / dark theme. Loaded first in <head> so the page is painted in the
// right colors from the start. Light is the default; a choice is remembered.
(function(){
  const KEY='zxtune.web.theme';
  const BAR={light:'#F5F7FB', dark:'#070A12'};
  const root=document.documentElement;

  function stored(){
    try{ const v=localStorage.getItem(KEY); return v==='dark' || v==='light' ? v : null; }catch{ return null; }
  }
  function apply(theme){
    root.dataset.theme=theme;
    document.querySelectorAll('meta[name="theme-color"]').forEach(m=>m.content=BAR[theme]);
    document.querySelectorAll('.theme-toggle').forEach(label);
    window.dispatchEvent(new CustomEvent('zxtheme', {detail:theme}));
  }
  function label(b){
    const dark=root.dataset.theme==='dark';
    b.textContent= dark ? '☀' : '🌙';
    b.title= dark ? 'ライトモードにする' : 'ダークモードにする';
    b.setAttribute('aria-label', b.title);
  }

  // Colors for canvases, which cannot use CSS variables: the value of --name,
  // or rgba() of an "r,g,b" token such as --ink.
  window.zxTheme={
    get current(){ return root.dataset.theme; },
    set(theme){ try{ localStorage.setItem(KEY, theme); }catch{} apply(theme); },
    toggle(){ this.set(root.dataset.theme==='dark' ? 'light' : 'dark'); },
    color(name){ return getComputedStyle(root).getPropertyValue(`--${name}`).trim(); },
    rgba(name, alpha){ return `rgba(${this.color(name)},${alpha})`; },
  };

  apply(stored() || 'light');

  document.addEventListener('DOMContentLoaded', ()=>{
    document.querySelectorAll('meta[name="theme-color"]').forEach(m=>m.content=BAR[root.dataset.theme]);
    const slot=document.querySelector('.header-actions');
    if(!slot) return;
    const b=document.createElement('button');
    b.type='button';
    b.className='icon-btn small theme-toggle';
    b.addEventListener('click', ()=>window.zxTheme.toggle());
    label(b);
    slot.prepend(b);
  });
})();
