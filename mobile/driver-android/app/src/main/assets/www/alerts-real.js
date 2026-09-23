(function(){
 'use strict';
 const R=window.XDRIVE_REAL||{},Api=window.XDriveApi;
 const screen=document.querySelector('.screen'),tabs=[...document.querySelectorAll('.alert-status-tabs .tab')];
 if(!screen||!Api)return;
 const esc=v=>String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const money=v=>'\u00A3'+Number(v||0).toFixed(2);
 const CITY={BB:'BLACKBURN',LS:'LEEDS',DA:'ERITH',NG:'NOTTINGHAM',PR:'PRESTON',M:'MANCHESTER',CH:'CHESTER',CV:'COVENTRY',WN:'WIGAN',SK:'STOCKPORT'};
 const compact=v=>String(v||'').toUpperCase().replace(/\s+/g,'');
 const outward=v=>{const p=compact(v);return /^[A-Z]{1,2}\d[A-Z\d]?\d[A-Z]{2}$/.test(p)?p.slice(0,-3):p};
 const place=v=>{const o=outward(v),m=o.match(/^[A-Z]+/),city=CITY[m?m[0]:''];return city?city+', '+o:o};
 const stamp=v=>v?new Date(v).toLocaleString('en-GB',{timeZone:'Europe/London',day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit',hour12:false}):'';
 const when=(a,b)=>{
  if(!a&&!b)return'Time not supplied';
  const s=new Date(a||b),e=new Date(b||a),opt={timeZone:'Europe/London',hour:'2-digit',minute:'2-digit',hour12:false};
  const date=s.toLocaleDateString('en-GB',{timeZone:'Europe/London',day:'2-digit',month:'short'});
  const t1=s.toLocaleTimeString('en-GB',opt),t2=e.toLocaleTimeString('en-GB',opt);
  return (t1===t2?t1:t1+' - '+t2)+' | '+date;
 };
 const matchLabel=reasons=>{
  const r=Array.isArray(reasons)?reasons.map(String):[];
  if(r.includes('current_location'))return'Driver current location';
  if(r.includes('home_outcode'))return'Home location';
  if(r.includes('future_position'))return'Future position';
  return'Load alert';
 };
 const sourceAlerts=(()=>{
  const byKey=new Map();
  (R.alerts||[]).forEach(a=>{
   if(!a||!a.id)return;
   const key=String(a.id)+'|'+String(a.event_type||'');
   const prev=byKey.get(key);
   if(!prev){byKey.set(key,a);return}
   const prevPayload=prev&&typeof prev.payload==='object'&&prev.payload?prev.payload:{};
   const nextPayload=a&&typeof a.payload==='object'&&a.payload?a.payload:{};
   const prevRich=['job','bid'].includes(String(prev.entity_type||''));
   const nextRich=['job','bid'].includes(String(a.entity_type||''));
   const primary=nextRich&&!prevRich?a:prev;
   const secondary=primary===a?prev:a;
   byKey.set(key,{...secondary,...primary,payload:{...prevPayload,...nextPayload}});
  });
  return [...byKey.values()];
 })();
 const rawAlerts=sourceAlerts.map(a=>{
  const p=a&&typeof a.payload==='object'&&a.payload?a.payload:{};
  const eventType=String(a.event_type||'');
  const jobId=String(p.job_id||((a.entity_type==='job'&&a.entity_id)||''));
  return{
   raw:a,id:String(a.id||''),eventType,jobId,payload:p,
   read:Boolean(p.read_at),saved:Boolean(p.saved_at),deleted:Boolean(p.deleted_at),actionable:p.source==='driver_inbox',
   createdAt:a.created_at||null
  };
 });
 const LOAD_ALERT_TYPES=new Set(['load_alert','marketplace_load_alert','nearby_load_alert']);
 const INVOICE_EVENTS=new Set(['invoice_created','invoice_dispute','invoice_disputed','invoice_paid','invoice_overdue','invoice_payment_received']);
 const all=rawAlerts.filter(a=>!INVOICE_EVENTS.has(a.eventType));
 const knownJobIds=new Set((R.jobs||[]).map(j=>String(j.id||'')));
 [...new Set(all.map(a=>a.jobId).filter(Boolean))].filter(id=>!knownJobIds.has(id)).slice(0,20).forEach(id=>{
  const response=Api.get('/api/driver/mobile/jobs/'+encodeURIComponent(id));
  if(!Api.ok(response)||!response.body||!response.body.job)return;
  const j=response.body.job,status=String(j.status||j.currentStatus||j.lifecycleStatus||'').toLowerCase();
  const vehicle=String(j.requestedVehicleLabel||j.vehicleRequirement||j.vehicleType||'Vehicle not supplied').replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
  (R.jobs||(R.jobs=[])).push({
   id:String(j.id||id),ref:String(j.reference||j.publicReference||j.jobReference||j.id||id),
   company:String(j.companyName||j.clientName||j.posterCompanyName||'Company not supplied'),companyXdId:String(j.companyXdId||''),vehicle,
   pickupPostcode:String(j.pickupPostcode||''),pickupLocation:String(j.pickupLocation||''),deliveryPostcode:String(j.deliveryPostcode||''),deliveryLocation:String(j.deliveryLocation||''),
   collectionStart:j.pickupTime||j.collectionStart||null,collectionEnd:j.pickupEndTime||j.collectionEnd||j.pickupTime||j.collectionStart||null,
   deliveryStart:j.deliveryTime||j.deliveryStart||null,deliveryEnd:j.deliveryEndTime||j.deliveryEnd||j.deliveryTime||j.deliveryStart||null,
   paymentTerms:String(j.paymentTerms||''),freightType:String(j.cargoType||j.freightType||''),pallets:j.palletCount??j.pallets??null,weight:j.weightKg??j.weight??null,
   notes:String(j.notesSummary||j.notes||''),serviceMode:String(j.serviceMode||''),status,canQuote:['posted','quoted','open'].includes(status)
  });
  knownJobIds.add(String(j.id||id));
 });
 const jobs=new Map([...(R.jobs||[]),...(R.bookings||[])].map(j=>[String(j.id),j]));
 let mode='inbox';

 function rows(){
  if(mode==='saved')return all.filter(a=>!a.deleted&&a.saved);
  if(mode==='deleted')return all.filter(a=>a.deleted);
  return all.filter(a=>!a.deleted);
 }
 function mutate(item,action){
  const r=Api.post('/api/driver/mobile/resources',{action,notificationId:item.id});
  if(!Api.ok(r)){alert(Api.error(r));return false}
  const n=r.body&&r.body.notification||{};
  item.read=Boolean(n.read_at);item.saved=Boolean(n.saved_at);item.deleted=Boolean(n.deleted_at);
  return true;
 }
 function markRead(item){if(item.read||!item.actionable)return true;return mutate(item,'mark_notification_read')}
 function toggleSaved(item){if(item.deleted||!item.actionable)return false;return mutate(item,item.saved?'unsave_notification':'save_notification')}
 function remove(item){if(item.deleted||!item.actionable)return false;return mutate(item,'delete_notification')}
 function restore(item){if(!item.deleted||!item.actionable)return false;return mutate(item,'restore_notification')}
 function jobFor(item){return item.jobId?jobs.get(item.jobId)||null:null}
 function fallbackRoute(item){
  const p=item.payload||{};
  return{pickupPostcode:String(p.pickup_outcode||''),deliveryPostcode:String(p.delivery_outcode||''),vehicle:String(p.vehicle_type||'Vehicle not supplied')};
 }
 const eventLabel=type=>({
  job_assigned:'Job assigned to you',job_awarded:'Job awarded',job_allocated:'Job allocated',
  bid_accepted:'Your quote was accepted',quote_accepted:'Your quote was accepted',
  bid_rejected:'Quote not accepted',quote_rejected:'Quote not accepted',
  driver_instruction_added:'New driver instruction',message_received:'New message',message:'New message',
  pod_uploaded:'POD completed',job_delivered:'Delivery completed',job_completed:'Job completed',
  booking_status_changed:'Booking status updated',job_status_changed:'Job status updated',
  compliance_alert:'Compliance update',document_rejected:'Document requires attention',
  document_expiring:'Document expiring soon',document_expired:'Document expired'
 }[String(type||'')]||String(type||'Notification').replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase()));
 function genericCard(item){
  const j=jobFor(item),p=item.payload||{},title=String(p.title||eventLabel(item.eventType));
  const message=String(p.message||p.body||p.summary||p.notes||'').trim();
  const ref=j?.ref||p.job_reference||p.load_reference||p.job_ref||'';
  const badges=!item.read&&!item.deleted?'<div class="badges"><span class="badge green">NEW</span></div>':'';
  const save=item.actionable?'<button class="alert-swipe-action alert-save-action" type="button" aria-label="'+(item.saved?'Unsave alert':'Save alert')+'">'+(item.saved?'&#9733;':'&#9734;')+'</button>':'<span class="alert-swipe-action" aria-hidden="true"></span>';
  const del=item.actionable?'<button class="alert-swipe-action alert-delete-action" type="button" aria-label="'+(item.deleted?'Restore alert':'Delete alert')+'">'+(item.deleted?'&#8634;':'&#128465;')+'</button>':'<span class="alert-swipe-action" aria-hidden="true"></span>';
  return '<div class="alert-swipe-shell" data-alert-shell="'+esc(item.id)+'">'+save+
   '<article class="load-card job-card booking-card clickable-card alert-load-card" data-alert-id="'+esc(item.id)+'">'+
    '<div class="company">'+esc(title)+'</div>'+
    (ref?'<div class="meta">Load ID '+esc(String(ref))+'</div>':'')+badges+
    (message?'<div class="details alert-cargo">'+esc(message)+'</div>':'')+
    '<div class="alert-reason"><strong>'+esc(eventLabel(item.eventType))+'</strong><span class="alert-reason-time">'+esc(stamp(item.createdAt))+'</span></div>'+
    (j?'<div class="details">Tap to view job details.</div>':'')+
   '</article>'+del+'</div>';
 }
 function card(item){
  if(!LOAD_ALERT_TYPES.has(item.eventType))return genericCard(item);
  const j=jobFor(item),p=item.payload||{},fallback=fallbackRoute(item);
  const pickup=j?.pickupPostcode||fallback.pickupPostcode,delivery=j?.deliveryPostcode||fallback.deliveryPostcode;
  const vehicle=j?.vehicle||fallback.vehicle;
  const company=j?.company||'Matching load',companyId=j?.companyXdId||'';
  const available=Boolean(j&&j.canQuote!==false&&!item.deleted);
  const meta='Load ID '+String(j?.ref||item.jobId||'Not supplied')+' | '+vehicle;
  const context=[stamp(item.createdAt),matchLabel(p.match_reasons)].filter(Boolean).join(' \u00B7 ');
  const badges=[];
  if(!item.read&&!item.deleted)badges.push('<span class="badge green">NEW</span>');
  if(j?.serviceMode)badges.push('<span class="badge orange">'+esc(String(j.serviceMode).replace(/_/g,' ').toUpperCase())+'</span>');
  if(j?.paymentTerms)badges.push('<span class="badge payment">'+esc(j.paymentTerms)+'</span>');
  const cargo=[];
  if(j?.freightType)cargo.push(j.freightType);
  if(j?.pallets!==null&&j?.pallets!==undefined&&j?.pallets!=='')cargo.push(j.pallets+' pallet'+(Number(j.pallets)===1?'':'s'));
  if(j?.weight!==null&&j?.weight!==undefined&&j?.weight!=='')cargo.push(j.weight+' kg');
  if(j?.notes)cargo.push(j.notes);
  const budget=p.budget_amount!==null&&p.budget_amount!==undefined&&p.budget_amount!==''?money(p.budget_amount):'';
  const saveAction=item.actionable?'<button class="alert-swipe-action alert-save-action" type="button" aria-label="'+(item.saved?'Unsave load alert':'Save load alert')+'">'+(item.saved?'&#9733;':'&#9734;')+'</button>':'<span class="alert-swipe-action" aria-hidden="true"></span>';
  const deleteAction=item.actionable?'<button class="alert-swipe-action alert-delete-action" type="button" aria-label="'+(item.deleted?'Restore load alert':'Delete load alert')+'">'+(item.deleted?'&#8634;':'&#128465;')+'</button>':'<span class="alert-swipe-action" aria-hidden="true"></span>';
  return '<div class="alert-swipe-shell" data-alert-shell="'+esc(item.id)+'">'+saveAction+
   '<article class="load-card job-card booking-card clickable-card alert-load-card" data-alert-id="'+esc(item.id)+'">'+
    '<div class="company">'+esc(company)+(companyId?'<span class="company-xd-id">('+esc(companyId)+')</span>':'')+'</div>'+
    '<div class="meta">'+esc(meta)+'</div>'+
    (badges.length?'<div class="badges">'+badges.join('')+'</div>':'')+
    '<div class="route"><div class="stop"><div class="pin">1</div><div><div class="place">'+esc(place(pickup))+'</div><div class="time">'+esc(j?when(j.collectionStart,j.collectionEnd):'Collection time unavailable')+'</div></div></div>'+
    '<div class="stop"><div class="pin">2</div><div><div class="place">'+esc(place(delivery))+'</div><div class="time">'+esc(j?when(j.deliveryStart,j.deliveryEnd):'Delivery time unavailable')+'</div></div></div></div>'+
    (cargo.length?'<div class="details alert-cargo">'+esc(cargo.join(' \u00B7 '))+'</div>':'')+
    (budget?'<div class="details">Budget '+esc(budget)+'</div>':'')+
    (available?'<a class="primary alert-quote" href="quote-form.html?job='+encodeURIComponent(j.id)+'&from=alerts">Quote</a>':'<div class="alert-unavailable">'+(item.deleted?'Deleted alert':'Load no longer available')+'</div>')+
    '<div class="alert-reason"><strong>Notification Reason:</strong> '+esc(matchLabel(p.match_reasons))+(context?'<span class="alert-reason-time">'+esc(stamp(item.createdAt))+'</span>':'')+'</div>'+
   '</article>'+deleteAction+'</div>';
 }
 function render(){
  const list=rows();
  screen.innerHTML=list.length?list.map(card).join(''):'<div class="panel"><div class="panel-title">'+(mode==='saved'?'No saved alerts':mode==='deleted'?'No deleted alerts':'No alerts')+'</div><div class="details">'+(mode==='inbox'?'Load matches, job updates, messages and driver instructions will appear here.':'')+'</div></div>';
  list.forEach(item=>{
   const shell=screen.querySelector('[data-alert-shell="'+CSS.escape(item.id)+'"]'),cardEl=shell?.querySelector('.alert-load-card');
   if(!shell||!cardEl)return;
   const j=jobFor(item);
   const quote=shell.querySelector('.alert-quote');
   if(quote)quote.addEventListener('click',e=>{e.stopPropagation();markRead(item)});
   cardEl.addEventListener('click',e=>{
    if(e.target.closest('a,button'))return;
    if(!j||item.deleted)return;
    markRead(item);
    location.href='detail.html?job='+encodeURIComponent(j.id)+'&from=alerts';
   });
   shell.querySelector('.alert-save-action')?.addEventListener('click',e=>{e.stopPropagation();if(toggleSaved(item))render()});
   shell.querySelector('.alert-delete-action')?.addEventListener('click',e=>{e.stopPropagation();const ok=item.deleted?restore(item):remove(item);if(ok)render()});
   if(item.actionable)prepareSwipe(shell,cardEl,item);
  });
 }
 function prepareSwipe(shell,cardEl,item){
  const MAX=92,THRESHOLD=62;let startX=0,startY=0,delta=0,drag=false,horizontal=false,pid=null,moved=false;
  const reset=()=>{cardEl.style.transform='translateX(0)';shell.classList.remove('drag-save','drag-delete','is-dragging')};
  cardEl.addEventListener('pointerdown',e=>{if(e.target.closest('a,button'))return;startX=e.clientX;startY=e.clientY;delta=0;drag=true;horizontal=false;moved=false;pid=e.pointerId;cardEl.setPointerCapture(e.pointerId)});
  cardEl.addEventListener('pointermove',e=>{if(!drag||e.pointerId!==pid)return;const dx=e.clientX-startX,dy=e.clientY-startY;if(!horizontal){if(Math.abs(dy)>8&&Math.abs(dy)>=Math.abs(dx)*.85){drag=false;reset();return}if(Math.abs(dx)<8)return;horizontal=true;shell.classList.add('is-dragging')}delta=Math.max(-MAX,Math.min(MAX,dx));moved=true;cardEl.style.transform='translateX('+delta+'px)';shell.classList.toggle('drag-save',delta>0);shell.classList.toggle('drag-delete',delta<0)});
  const finish=()=>{if(!drag)return;drag=false;shell.classList.remove('is-dragging');if(horizontal&&delta>=THRESHOLD){if(toggleSaved(item))render();return}if(horizontal&&delta<=-THRESHOLD){const ok=item.deleted?restore(item):remove(item);if(ok)render();return}reset();setTimeout(()=>moved=false,100)};
  cardEl.addEventListener('pointerup',finish);cardEl.addEventListener('pointercancel',()=>{drag=false;reset()});
  cardEl.addEventListener('click',e=>{if(moved){e.preventDefault();e.stopPropagation()}},true);
 }
 const modes=['inbox','saved','deleted'];
 tabs.forEach((b,i)=>b.onclick=()=>{mode=modes[i]||'inbox';tabs.forEach((x,n)=>x.classList.toggle('active',n===i));render()});
 render();document.body.classList.add('live-ready');
})();