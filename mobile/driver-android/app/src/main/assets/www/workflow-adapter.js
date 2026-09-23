(function(){
 'use strict';
 const R=window.XDRIVE_REAL||{},path=(location.pathname.split('/').pop()||'').toLowerCase(),qs=new URLSearchParams(location.search);
 const esc=v=>String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const fmt=v=>v?new Date(v).toLocaleString('en-GB',{timeZone:'Europe/London',day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:false}):'Not recorded';
 const prettyStatus=v=>{
  const s=String(v||'status').toLowerCase();
  const m={
   awarded:'Awarded',allocated:'Allocated',accepted:'Driver Accepted',
   on_my_way:'On My Way to Collection',on_my_way_pickup:'On My Way to Collection',
   on_site_pickup:'On Site Collection',arrived_pickup:'On Site Collection',
   loaded:'Loaded',collected:'Loaded',
   in_transit:'On My Way to Delivery',on_my_way_delivery:'On My Way to Delivery',on_my_way_to_delivery:'On My Way to Delivery',
   on_site_delivery:'On Site Delivery',arrived_delivery:'On Site Delivery',
   pod_completed:'POD Completed',delivered:'Delivered (POD)',completed:'Completed',
   invoice:'Invoice'
  };
  return m[s]||s.replace(/_/g,' ').replace(/w/g,c=>c.toUpperCase());
 };
 const booking=id=>(R.bookings||[]).find(j=>j.id===id||j.ref===id);
 const invoiceFor=id=>(R.invoices||[]).find(i=>i.jobId===id)||null;

 function stopRowsFor(j){
  const rows=(j.stops&&j.stops.length)?j.stops:[
   {sequence:1,type:'collection',address:j.pickupLocation||j.pickupPostcode,timeWindowFrom:j.collectionStart,status:'pending',company:j.company||''},
   {sequence:2,type:'delivery',address:j.deliveryLocation||j.deliveryPostcode,timeWindowFrom:j.deliveryStart,status:'pending',company:j.company||''}
  ];
  const jobStatus=String(j.currentStatus||j.lifecycleStatus||j.status||'').toLowerCase();
  const done=['delivered','completed'].includes(jobStatus),locked=done||['cancelled','void'].includes(jobStatus);
  return rows.map(s=>done?{...s,status:'completed',_locked:true}:locked?{...s,_locked:true}:s);
 }

 function stopCard(s,i){
  const st=String(s.status||'pending').toLowerCase();
  const from=s.timeWindowFrom||s.windowStart||s.window_start,to=s.timeWindowTo||s.windowEnd||s.window_end;
  const label=String(s.type||s.stopType||'stop').replace(/^./,x=>x.toUpperCase());
  const time=from?fmt(from)+(to?' - '+fmt(to):''):'Time not supplied';
  const action=!s._locked&&s.id&&st==='pending'
   ?'<button class="secondary stop-action" type="button" data-stop-action data-stop-id="'+esc(s.id)+'" data-stop-next="arrived">On Site</button>'
   :!s._locked&&s.id&&st==='arrived'
    ?'<button class="primary stop-action" type="button" data-stop-action data-stop-id="'+esc(s.id)+'" data-stop-next="completed">Complete Stop</button>'
    :'';
  return '<article class="stop-execution-card" data-stop-index="'+i+'" data-stop-id="'+esc(s.id||'')+'">'+
   '<button class="stop-detail-open" type="button" data-stop-detail="'+i+'" aria-label="Open '+esc(label)+' details">'+
    '<span class="stop-detail-pin">'+(i+1)+'</span>'+
    '<span class="stop-detail-main"><strong>'+esc(label)+' Details</strong><small>'+esc(time)+'</small>'+(s.company?'<small>'+esc(s.company)+'</small>':'')+'<small>'+esc(s.address||s.postcode||'Location not supplied')+'</small></span>'+
    '<span class="stop-detail-chevron">&#8250;</span>'+
   '</button>'+action+
  '</article>';
 }

 function ensureStopModal(){
  let modal=document.getElementById('booking-stop-modal');
  if(modal)return modal;
  modal=document.createElement('div');modal.id='booking-stop-modal';modal.className='booking-stop-modal';modal.style.display='none';
  modal.innerHTML='<div class="booking-stop-sheet"><div class="booking-stop-sheet-head"><div id="booking-stop-sheet-title"></div><button id="booking-stop-close" type="button" aria-label="Close stop details">&#10005;</button></div><div id="booking-stop-sheet-body"></div><button id="booking-stop-close-bottom" class="primary" type="button">Close</button></div>';
  document.querySelector('.phone')?.appendChild(modal);
  const close=()=>modal.style.display='none';
  modal.querySelector('#booking-stop-close')?.addEventListener('click',close);
  modal.querySelector('#booking-stop-close-bottom')?.addEventListener('click',close);
  modal.addEventListener('click',e=>{if(e.target===modal)close()});
  return modal;
 }

 function openStopDetail(s,i){
  const modal=ensureStopModal(),title=modal.querySelector('#booking-stop-sheet-title'),body=modal.querySelector('#booking-stop-sheet-body');
  const type=String(s.type||s.stopType||'Stop').toLowerCase(),from=s.timeWindowFrom||s.windowStart||s.window_start,to=s.timeWindowTo||s.windowEnd||s.window_end;
  const pin=type.includes('delivery')?'&#128205;':'&#9632;';
  title.innerHTML='<span class="stop-sheet-pin">'+pin+'</span><strong>'+(i+1)+' · '+esc((type||'stop').replace(/^./,x=>x.toUpperCase()))+'</strong>';
  const rows=[
   ['Time',from?fmt(from)+(to?' - '+fmt(to):''):'Not supplied'],
   ['Company',s.company||'Not supplied'],
   ['Address',s.address||s.postcode||'Not supplied'],
   ['Contact',s.contactPerson||s.contact_name||'Not supplied'],
   ['Phone',s.telephone||s.contact_phone||'Not supplied']
  ];
  body.innerHTML=rows.map(([k,v])=>'<div class="stop-sheet-row"><span>'+esc(k)+'</span><strong>'+esc(v)+'</strong></div>').join('')+
   ((s.notes||s.instructions)?'<div class="stop-sheet-notes"><span>Instructions</span><div>'+esc(s.notes||s.instructions)+'</div></div>':'');
  const phone=String(s.telephone||s.contact_phone||'').trim();
  if(phone)body.insertAdjacentHTML('beforeend','<a class="secondary stop-sheet-call" href="tel:'+esc(phone.replace(/[^+0-9]/g,''))+'">Call contact</a>');
  modal.style.display='grid';
 }

 function buildStatusRows(j){
  const hist=[...(j.statusHistory||[])].map(h=>({
   label:prettyStatus(h.label||h.status||'Status'),
   key:String(h.label||h.status||'').toLowerCase(),
   timestamp:h.timestamp||h.createdAt||h.created_at||null,
   source:String(h.source||''),
   actorUserId:String(h.actor_user_id||h.actorUserId||''),
   undoneFrom:String(h.undone_from||h.undoneFrom||''),
   note:String(h.note||h.message||'')
  }));
  if(j.podCompleted===true&&!hist.some(h=>/pod/.test(h.key))){
   hist.push({label:'POD Completed',key:'pod_completed',timestamp:j.updatedAt||null,source:'pod',actorUserId:'',undoneFrom:'',note:''});
  }
  const inv=invoiceFor(j.id);
  if(inv&&!hist.some(h=>/invoice/.test(h.key))){
   hist.push({label:'Invoice',key:'invoice',timestamp:inv.date||inv.createdAt||inv.created_at||null,source:'invoice',actorUserId:'',undoneFrom:'',note:''});
  }
  return hist.sort((a,b)=>{
   const ta=a.timestamp?Date.parse(a.timestamp):0,tb=b.timestamp?Date.parse(b.timestamp):0;
   return tb-ta;
  });
 }

 const reversibleStatusKeys=new Set(['accepted','on_my_way','on_my_way_pickup','on_site_pickup','arrived_pickup','loaded','collected','in_transit','on_my_way_delivery','on_my_way_to_delivery','on_site_delivery','arrived_delivery']);
 function ensureStatusModal(){
  let modal=document.getElementById('booking-status-modal');if(modal)return modal;
  modal=document.createElement('div');modal.id='booking-status-modal';modal.className='booking-stop-modal';modal.style.display='none';
  modal.innerHTML='<div class="booking-stop-sheet status-detail-sheet"><div class="booking-stop-sheet-head"><div id="booking-status-sheet-title"></div><button id="booking-status-close" type="button" aria-label="Close status details">&#10005;</button></div><div id="booking-status-sheet-body"></div><div class="status-detail-actions"><button id="booking-status-undo" class="danger" type="button" style="display:none">Undo latest status</button><button id="booking-status-close-bottom" class="primary" type="button">Close</button></div></div>';
  document.querySelector('.phone')?.appendChild(modal);
  const close=()=>modal.style.display='none';
  modal.querySelector('#booking-status-close')?.addEventListener('click',close);modal.querySelector('#booking-status-close-bottom')?.addEventListener('click',close);modal.addEventListener('click',e=>{if(e.target===modal)close()});
  return modal;
 }
 function openStatusDetail(row,index,total){
  const modal=ensureStatusModal(),title=modal.querySelector('#booking-status-sheet-title'),body=modal.querySelector('#booking-status-sheet-body'),undo=modal.querySelector('#booking-status-undo');
  title.innerHTML='<strong>'+esc(row.label)+'</strong>';
  const source=row.source?row.source.replace(/_/g,' '):'Not recorded';
  body.innerHTML='<div class="stop-sheet-row"><span>Recorded</span><strong>'+esc(fmt(row.timestamp))+'</strong></div><div class="stop-sheet-row"><span>Source</span><strong>'+esc(source)+'</strong></div>'+(row.undoneFrom?'<div class="stop-sheet-row"><span>Undid</span><strong>'+esc(prettyStatus(row.undoneFrom))+'</strong></div>':'')+(row.note?'<div class="stop-sheet-notes"><span>Details</span><div>'+esc(row.note)+'</div></div>':'');
  const canUndo=index===0&&reversibleStatusKeys.has(row.key)&&!row.source.includes('undo');
  undo.style.display=canUndo?'block':'none';undo.onclick=()=>{if(typeof window.XDriveUndoCurrentStatus==='function'){modal.style.display='none';window.XDriveUndoCurrentStatus()}};
  modal.style.display='grid';
 }

 function bookingTabs(j){
  const screen=document.querySelector('.detail-screen');
  if(!screen||!j||document.getElementById('booking-detail-tabs'))return;
  const summary=document.getElementById('booking-summary-panel'),execution=document.getElementById('job-execution-panel'),detailsBody=document.getElementById('booking-details-body'),detailsToggle=document.getElementById('bookingDetailsToggle');
  const tabs=document.createElement('div');tabs.id='booking-detail-tabs';tabs.className='booking-tabs booking-detail-tabs';
  tabs.innerHTML='<button class="active">Job</button><button>Stops</button><button>Status</button>';
  screen.prepend(tabs);

  const stops=document.createElement('div');stops.className='panel workflow-panel booking-workflow-panel';stops.id='workflow-stops-panel';stops.style.display='none';
  const stopRows=stopRowsFor(j);
  stops.innerHTML='<div class="workflow-screen-title">Stops</div>'+stopRows.map(stopCard).join('');

  const status=document.createElement('div');status.className='panel workflow-panel booking-workflow-panel';status.id='workflow-status-panel';status.style.display='none';
  const hist=buildStatusRows(j),currentKey=String(j.currentStatus||j.lifecycleStatus||j.status||'').toLowerCase();
  if(currentKey&&!hist.some(h=>h.key===currentKey))hist.unshift({label:prettyStatus(currentKey),key:currentKey,timestamp:j.updatedAt||null,source:'current',actorUserId:'',undoneFrom:'',note:''});
  status.innerHTML='<div class="workflow-screen-title">Booking Status</div>'+(hist.length
   ?'<div class="booking-status-timeline">'+hist.map((h,i)=>'<button class="booking-status-item booking-status-detail-open '+(i===0?'current':'')+'" type="button" data-status-detail="'+i+'"><span class="booking-status-check">'+(i===0?'':'&#10003;')+'</span><div><strong>'+esc(h.label)+'</strong><small>'+esc(fmt(h.timestamp))+'</small></div><span class="status-detail-chevron">'+(i===0&&reversibleStatusKeys.has(h.key)?'Undo':'&#8250;')+'</span></button>').join('')+'</div>'
   :'<div class="details">No status history available.</div>');

  const cta=screen.querySelector(':scope > a.primary');
  if(cta){screen.insertBefore(stops,cta);screen.insertBefore(status,cta)}else{screen.append(stops,status)}

  if(detailsToggle&&detailsBody){
   detailsToggle.onclick=()=>{const opening=detailsBody.hidden;detailsBody.hidden=!opening;detailsToggle.textContent=opening?'Hide Booking Details':'View Booking Details';if(opening)setTimeout(()=>detailsBody.scrollIntoView({behavior:'smooth',block:'start'}),30)};
  }

  stops.querySelectorAll('[data-stop-detail]').forEach(btn=>btn.addEventListener('click',e=>{
   if(e.target.closest('[data-stop-action]'))return;
   const idx=Number(btn.getAttribute('data-stop-detail'));if(Number.isInteger(idx)&&stopRows[idx])openStopDetail(stopRows[idx],idx);
  }));
  status.querySelectorAll('[data-status-detail]').forEach(btn=>btn.addEventListener('click',()=>{
   const idx=Number(btn.getAttribute('data-status-detail'));if(Number.isInteger(idx)&&hist[idx]){
    if(idx===0&&reversibleStatusKeys.has(hist[idx].key)&&typeof window.XDriveUndoCurrentStatus==='function'){window.XDriveUndoCurrentStatus();return}
    openStatusDetail(hist[idx],idx,hist.length);
   }
  }));

  function show(n){
   tabs.querySelectorAll('button').forEach((b,i)=>b.classList.toggle('active',i===n));
   if(summary)summary.style.display=n===0?'block':'none';
   if(execution)execution.style.display=n===0?'block':'none';
   if(detailsBody){if(n!==0)detailsBody.hidden=true;else if(detailsToggle&&detailsToggle.textContent==='Hide Booking Details')detailsBody.hidden=false}
   if(detailsToggle)detailsToggle.style.display=n===0?'flex':'none';
   stops.style.display=n===1?'block':'none';status.style.display=n===2?'block':'none';
   if(cta)cta.style.display=n===0?cta.style.display:'none';
  }
  tabs.querySelectorAll('button').forEach((b,i)=>b.onclick=()=>show(i));show(0);
 }
 if(path==='booking-detail.html'){
  bookingTabs(booking(qs.get('job')));
  window.addEventListener('xdrive:booking-refreshed',()=>{
   document.getElementById('booking-detail-tabs')?.remove();document.getElementById('workflow-stops-panel')?.remove();document.getElementById('workflow-status-panel')?.remove();
   bookingTabs(booking(qs.get('job')));
  });
 }

 const navKey='xdrive-nav-state-v1',saveNav=()=>{try{const sc=document.querySelector('.screen')||document.scrollingElement;sessionStorage.setItem(navKey,JSON.stringify({path,scroll:sc.scrollTop||0,tab:[...document.querySelectorAll('.tab,.booking-tabs button')].findIndex(x=>x.classList.contains('active'))}))}catch{}};
 addEventListener('pagehide',saveNav);document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')saveNav()});
 addEventListener('pageshow',()=>{try{const s=JSON.parse(sessionStorage.getItem(navKey)||'{}');if(s.path!==path)return;const tabs=[...document.querySelectorAll('.tab,.booking-tabs button')];if(s.tab>=0&&tabs[s.tab])tabs[s.tab].click();setTimeout(()=>{const sc=document.querySelector('.screen')||document.scrollingElement;sc.scrollTop=Number(s.scroll||0)},0)}catch{}});

 const all=[...(R.jobs||[]),...(R.bookings||[])],job=all.find(x=>x.id===qs.get('job')||x.ref===qs.get('job'));
 if(job&&(path==='detail.html'||path==='booking-detail.html'))document.querySelectorAll('button.secondary').forEach(b=>{if(/map/i.test(b.textContent)){b.onclick=()=>window.open('https://www.google.com/maps/dir/?api=1&origin='+encodeURIComponent(job.pickupPostcode||job.pickupLocation||'')+'&destination='+encodeURIComponent(job.deliveryPostcode||job.deliveryLocation||''),'_blank','noopener')}});

 const toast=document.createElement('div');toast.id='connection-state';toast.style.cssText='display:none;position:absolute;left:12px;right:12px;bottom:84px;z-index:20;padding:10px 12px;border-radius:12px;background:#1A1F2B;color:#fff;font:700 12px Inter,Segoe UI,Arial,sans-serif;text-align:center';document.querySelector('.phone')?.appendChild(toast);
 const sync=()=>{if(!toast)return;if(navigator.onLine)toast.style.display='none';else{toast.textContent='Offline — operational actions may remain pending until connection returns.';toast.style.display='block'}};
 addEventListener('online',sync);addEventListener('offline',sync);sync();
})();