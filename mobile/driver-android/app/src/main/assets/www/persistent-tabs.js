(function(){
'use strict';

const SPECS={loads:'index.html',alerts:'alerts.html',quotes:'quote.html',bookings:'bookings.html',more:'more.html'};
const ROOT_TO_TAB=Object.fromEntries(Object.entries(SPECS).map(([k,v])=>[v,k]));
const DETAIL_FILES=new Set(['detail.html','quote-form.html','member-profile.html','booking-detail.html','pod.html','evidence-viewer.html','attachment-viewer.html']);
const stack=document.getElementById('tab-stack');
const buttons=[...document.querySelectorAll('[data-shell-tab]')];
const frames={};
const loaded={};
let current='loads';
const tabHistory=['loads'];
let overlay=null;
let overlayVisible=false;
let overlayStartHref='';
let detailSnapshot=null;

function fileName(href){
  try{return new URL(href,location.href).pathname.split('/').pop()||''}
  catch(_e){return String(href||'').split('?')[0].split('/').pop()}
}
function localHref(raw){
  try{return new URL(raw,location.href).href}catch(_e){return String(raw||'')}
}
function extractNavigationTarget(ev){
  const target=ev.target&&ev.target.closest?ev.target:null;
  if(!target)return'';
  const a=target.closest('a[href]');
  if(a)return a.getAttribute('href')||'';
  const clickable=target.closest('[data-href],.real-quote,.booking-card,.clickable-card');
  if(!clickable)return'';
  if(clickable.dataset&&clickable.dataset.href)return clickable.dataset.href;
  const inline=clickable.getAttribute('onclick')||'';
  const match=inline.match(/location(?:\.href)?\s*=\s*['"]([^'"]+)['"]/i);
  return match?match[1]:'';
}
function ensure(tab){
  if(frames[tab])return frames[tab];
  const frame=document.createElement('iframe');
  frame.className='tab-frame';
  frame.dataset.tab=tab;
  frame.setAttribute('title',tab);
  frame.setAttribute('allow','geolocation; camera; microphone');
  frame.addEventListener('load',()=>wireFrame(frame,tab));
  frames[tab]=frame;
  stack.appendChild(frame);
  if(!loaded[tab]){
    loaded[tab]=true;
    frame.src=SPECS[tab];
  }
  return frame;
}
function embeddedStyle(doc){
  let style=doc.getElementById('xdrive-persistent-shell-style');
  if(style)return;
  style=doc.createElement('style');
  style.id='xdrive-persistent-shell-style';
  style.textContent='.bottom-nav{display:none!important}.screen{padding-bottom:24px!important}.more-screen{padding-bottom:24px!important}';
  doc.head.appendChild(style);
}
function wireFrame(frame,tab){
  try{
    const name=frame.contentWindow.location.pathname.split('/').pop()||'';
    if(name==='login.html'){
      location.replace('login.html');
      return;
    }
    const doc=frame.contentDocument;
    if(!doc)return;
    doc.documentElement.classList.add('xdrive-embedded');
    embeddedStyle(doc);
    if(doc.documentElement.dataset.shellWired==='1')return;
    doc.documentElement.dataset.shellWired='1';

    doc.addEventListener('click',ev=>{
      const raw=extractNavigationTarget(ev);
      if(!raw)return;
      const destination=fileName(raw);
      const targetTab=ROOT_TO_TAB[destination];

      if(DETAIL_FILES.has(destination)){
        ev.preventDefault();
        ev.stopImmediatePropagation();
        openOverlay(raw,tab);
        return;
      }

      const a=ev.target.closest&&ev.target.closest('a[href]');
      if(targetTab&&(a?.classList.contains('nav-item')||targetTab!==tab)){
        ev.preventDefault();
        ev.stopImmediatePropagation();
        show(targetTab,true);
      }
    },true);
  }catch(_e){}
}
function normalizeSearchJob(j){
  if(!j||typeof j!=='object')return null;
  return {
    id:String(j.id||''),ref:'XDL-'+String(j.id||'').slice(0,8).toUpperCase(),isTest:false,
    company:String(j.posterName||'Marketplace member'),companyXdId:String(j.posterMemberCode||''),companyId:j.company_id||j.posterCompanyId||null,
    vehicle:String(j.requested_vehicle_label||j.requested_vehicle_type||j.vehicle_type||'Vehicle not supplied'),bodyType:String(j.bodyType||j.body_type||''),
    requirementFlags:String(j.special_requirements||'').split(',').map(v=>v.trim()).filter(Boolean),
    pallets:j.pallets??null,weight:j.weight_kg??null,freightType:String(j.requested_cargo_label||j.cargo_type||''),
    pickupLocation:String(j.pickup_location||j.pickup_postcode||''),pickupPostcode:String(j.pickup_postcode||''),
    deliveryLocation:String(j.delivery_location||j.delivery_postcode||''),deliveryPostcode:String(j.delivery_postcode||''),
    collectionStart:j.pickup_datetime||j.pickup_time_slot||null,collectionEnd:j.pickup_datetime||j.pickup_time_slot||null,
    deliveryStart:j.delivery_datetime||j.delivery_time_slot||null,deliveryEnd:j.delivery_datetime||j.delivery_time_slot||null,
    paymentTerms:String(j.payment_terms||''),status:String(j.status||'posted'),
    journeyDistanceMiles:j.journeyDistanceMiles??j.job_distance_miles??j.distance_miles??null,
    estimatedJourneyMinutes:j.estimatedJourneyMinutes??null,notes:String(j.load_details||''),
    serviceMode:String(j.service_mode||''),directDeliveryRequired:j.direct_delivery_required===true,
    hasProposedPrice:j.budget_amount!=null&&Number(j.budget_amount)>0,proposedPriceGbp:j.budget_amount==null?null:Number(j.budget_amount),
    canQuote:true
  };
}
function captureDetailSnapshot(raw,sourceTab){
  const destination=fileName(raw);
  if(!['detail.html','quote-form.html','booking-detail.html'].includes(destination)){detailSnapshot=null;return}
  let id='';
  try{id=new URL(raw,location.href).searchParams.get('job')||''}catch(_e){}
  if(!id)return;
  const frame=frames[sourceTab];
  if(!frame)return;
  try{
    const w=frame.contentWindow,R=w.XDRIVE_REAL||{},all=[...(R.jobs||[]),...(R.bookings||[])];
    let job=all.find(j=>String(j.id||j.ref||'')===String(id)||String(j.ref||'')===String(id))||null;
    if(!job&&Array.isArray(w.XDRIVE_SEARCH_ROWS)){
      const row=w.XDRIVE_SEARCH_ROWS.find(j=>String(j.id||'')===String(id));
      job=normalizeSearchJob(row);
    }
    if(!job)return;
    const quote=(R.quotes||[]).find(q=>String(q.jobId||q.jobRef||'')===String(id)||String(q.jobRef||'')===String(job.ref||''))||null;
    detailSnapshot={jobId:String(id),from:String(sourceTab||''),at:Date.now(),job,quote};
    try{localStorage.setItem('xdrive-detail-snapshot-v1',JSON.stringify(detailSnapshot))}catch(_e){}
  }catch(_e){}
}
function getDetailSnapshot(id){
  if(detailSnapshot&&String(detailSnapshot.jobId)===String(id)&&Date.now()-Number(detailSnapshot.at||0)<120000)return detailSnapshot;
  try{
    const raw=JSON.parse(localStorage.getItem('xdrive-detail-snapshot-v1')||'null');
    if(raw&&String(raw.jobId||'')===String(id)&&Date.now()-Number(raw.at||0)<120000)return raw;
  }catch(_e){}
  return null;
}
function ensureOverlay(){
  if(overlay)return overlay;
  overlay=document.createElement('iframe');
  overlay.id='detail-overlay';
  overlay.setAttribute('title','Job details');
  overlay.setAttribute('allow','geolocation; camera; microphone');
  overlay.style.cssText='position:absolute;inset:0;width:100%;height:100%;border:0;background:#F1F3F6;z-index:5000;display:none';
  overlay.addEventListener('load',wireOverlay);
  stack.appendChild(overlay);
  return overlay;
}
function wireOverlay(){
  if(!overlay)return;
  try{
    const name=overlay.contentWindow.location.pathname.split('/').pop()||'';
    if(name==='login.html'){
      location.replace('login.html');
      return;
    }
    const rootTab=ROOT_TO_TAB[name];
    if(rootTab&&overlayVisible){
      closeOverlay(false);
      show(rootTab,true);
      return;
    }
    const doc=overlay.contentDocument;
    if(!doc)return;
    embeddedStyle(doc);
    if(doc.documentElement.dataset.overlayWired==='1')return;
    doc.documentElement.dataset.overlayWired='1';
    doc.addEventListener('click',ev=>{
      const a=ev.target&&ev.target.closest?ev.target.closest('a[href]'):null;
      if(!a)return;
      const destination=fileName(a.getAttribute('href'));
      const targetTab=ROOT_TO_TAB[destination];
      if(a.classList.contains('back')){
        ev.preventDefault();
        ev.stopImmediatePropagation();
        overlayBack();
        return;
      }
      if(targetTab){
        ev.preventDefault();
        ev.stopImmediatePropagation();
        closeOverlay(true);
        show(targetTab,false);
      }
    },true);
  }catch(_e){}
}
function openOverlay(raw,sourceTab){
  if(sourceTab&&SPECS[sourceTab])current=sourceTab;
  captureDetailSnapshot(raw,sourceTab);
  const f=ensureOverlay();
  overlayStartHref=localHref(raw);
  overlayVisible=true;
  f.style.display='block';
  if(f.src!==overlayStartHref)f.src=overlayStartHref;
}
function dirty(tab){
  const frame=frames[tab];
  if(!frame)return false;
  try{return frame.contentWindow.sessionStorage.getItem('xdrive.shellDirty')==='1'}catch(_e){return false}
}
function clearDirty(tab){
  const frame=frames[tab];
  if(!frame)return;
  try{frame.contentWindow.sessionStorage.removeItem('xdrive.shellDirty')}catch(_e){}
}
function refreshDirtyTab(tab){
  const frame=frames[tab];
  if(!frame||!dirty(tab))return;
  clearDirty(tab);
  frame.src=SPECS[tab];
}
function closeOverlay(refresh){
  if(!overlay)return;
  overlayVisible=false;
  overlay.style.display='none';
  if(refresh!==false)refreshDirtyTab(current);
}
function overlayBack(){
  if(!overlayVisible||!overlay)return false;
  try{
    const href=overlay.contentWindow.location.href;
    if(href&&overlayStartHref&&href!==overlayStartHref){
      overlay.contentWindow.history.back();
      return true;
    }
  }catch(_e){
    if(overlayStartHref){
      overlayVisible=true;
      overlay.style.display='block';
      overlay.src=overlayStartHref;
      return true;
    }
  }
  closeOverlay(true);
  return true;
}
function show(tab,push){
  if(!SPECS[tab])tab='loads';
  if(overlayVisible)closeOverlay(true);
  const prev=current;
  const frame=ensure(tab);
  refreshDirtyTab(tab);
  Object.entries(frames).forEach(([name,f])=>f.classList.toggle('active',name===tab));
  buttons.forEach(b=>b.classList.toggle('active',b.dataset.shellTab===tab));
  current=tab;
  sessionStorage.setItem('xdrive.activeTab',tab);
  if(push!==false&&prev!==tab&&tabHistory[tabHistory.length-1]!==tab)tabHistory.push(tab);
  try{frame.contentWindow.postMessage({type:'xdrive:tab-visible',tab},'*')}catch(_e){}
  try{if(window.XDriveNative&&typeof XDriveNative.prewarmCoreData==='function')XDriveNative.prewarmCoreData()}catch(_e){}
}
function handleBack(){
  if(overlayVisible)return overlayBack();
  const frame=frames[current];
  if(frame){
    try{
      const name=frame.contentWindow.location.pathname.split('/').pop()||'';
      if(name&&name!==SPECS[current]){
        frame.contentWindow.history.back();
        return true;
      }
    }catch(_e){}
  }
  if(tabHistory.length>1){
    tabHistory.pop();
    show(tabHistory[tabHistory.length-1]||'loads',false);
    return true;
  }
  if(current!=='loads'){
    show('loads',false);
    return true;
  }
  return false;
}
function markDirty(tabs){
  const list=Array.isArray(tabs)?tabs:Object.keys(SPECS);
  list.forEach(tab=>{
    const frame=frames[tab];
    if(!frame)return;
    try{frame.contentWindow.sessionStorage.setItem('xdrive.shellDirty','1')}catch(_e){}
  });
}

window.addEventListener('message',ev=>{
  const d=ev.data||{};
  if(d.type==='xdrive:data-dirty')markDirty(d.tabs);
});
function nativePostAsync(requestId,path,body){
  if(!window.XDriveNative||typeof XDriveNative.apiPostAsync!=='function')return false;
  XDriveNative.apiPostAsync(String(requestId||''),String(path||''),String(body||'{}'));return true;
}
function nativeGetAsync(requestId,path){
  if(!window.XDriveNative||typeof XDriveNative.apiGetAsync!=='function')return false;
  XDriveNative.apiGetAsync(String(requestId||''),String(path||''));return true;
}
window.XDriveTabs={
  show,handleBack,current:()=>current,frames,markDirty,
  openOverlay,closeOverlay,getDetailSnapshot,
  nativePostAsync,nativeGetAsync,
  overlay:()=>overlay,
  overlayVisible:()=>overlayVisible
};

[...stack.querySelectorAll('.tab-frame[data-tab]')].forEach(frame=>{
  const tab=frame.dataset.tab;
  if(!SPECS[tab])return;
  frames[tab]=frame;
  loaded[tab]=!!frame.getAttribute('src');
  frame.addEventListener('load',()=>wireFrame(frame,tab));
  try{wireFrame(frame,tab)}catch(_e){}
});

buttons.forEach(b=>b.addEventListener('click',()=>show(b.dataset.shellTab,true)));

const remembered=sessionStorage.getItem('xdrive.activeTab');
current=SPECS[remembered]?remembered:'loads';
show(current,false);

const preloadOrder=['alerts','quotes','bookings','more'].filter(t=>t!==current);
preloadOrder.forEach((tab,i)=>setTimeout(()=>ensure(tab),2200+(i*650)));
})();