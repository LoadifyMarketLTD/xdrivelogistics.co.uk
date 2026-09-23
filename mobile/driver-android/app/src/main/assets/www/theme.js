(function(){
  'use strict';
  const KEY='xdrive-theme-mode';
  const modes=['auto','day','night'];
  const media=window.matchMedia?window.matchMedia('(prefers-color-scheme: dark)'):null;

  function stored(){
    const value=localStorage.getItem(KEY);
    return modes.includes(value)?value:'auto';
  }

  function isNight(mode){
    return mode==='night'||(mode==='auto'&&media&&media.matches);
  }

  function apply(mode){
    const selected=modes.includes(mode)?mode:'auto';
    document.body.classList.toggle('theme-night',Boolean(isNight(selected)));
    document.documentElement.dataset.themeMode=selected;
    ['auto','day','night'].forEach(name=>{
      const button=document.getElementById('theme-'+name);
      if(button){
        button.classList.toggle('active',name===selected);
        button.setAttribute('aria-pressed',name===selected?'true':'false');
      }
    });
  }

  window.setTheme=function(mode){
    const selected=modes.includes(mode)?mode:'auto';
    localStorage.setItem(KEY,selected);
    apply(selected);
  };

  const icons={
    'index.html':'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 11.5 12 4l9 7.5v8a1.5 1.5 0 0 1-1.5 1.5H15v-6H9v6H4.5A1.5 1.5 0 0 1 3 19.5z"/></svg>',
    'alerts.html':'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></svg>',
    'quote.html':'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h14v16H5z"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>',
    'bookings.html':'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 3v4M16 3v4M4 10h16"/></svg>',
    'more.html':'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="19" cy="12" r="1.7"/></svg>'
  };

  function applyNavIcons(){
    document.querySelectorAll('.bottom-nav .nav-item').forEach(link=>{
      const href=(link.getAttribute('href')||'').split('?')[0];
      const span=link.querySelector(':scope > span');
      if(span&&icons[href]) span.innerHTML=icons[href];
      if(link.classList.contains('active')) link.setAttribute('aria-current','page');
    });
  }

  function decoratePage(){
    const page=(location.pathname.split('/').pop()||'index.html').replace('.html','');
    document.body.classList.add('page-'+page.replace(/[^a-z0-9-]/g,'-'));
    applyNavIcons();
  }

  apply(stored());
  decoratePage();
  if(media&&media.addEventListener) media.addEventListener('change',()=>{if(stored()==='auto')apply('auto')});
})();
