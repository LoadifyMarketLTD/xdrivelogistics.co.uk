(function(){
 'use strict';
 const path=(location.pathname.split('/').pop()||'').toLowerCase(),R=window.XDRIVE_REAL||{},Api=window.XDriveApi;
 if(!Api)return;
 const qs=new URLSearchParams(location.search);
 const allJobs=()=>[...(R.jobs||[]),...(R.bookings||[])];
 const findJob=()=>{const id=qs.get('job');return allJobs().find(j=>j.id===id||j.ref===id)||null};
 const fail=r=>{alert(Api.error(r));return false};

 if(path==='index.html')setTimeout(()=>{
  const pendingPreferences=new Map();
  const cardStateFromServer=v=>v==='saved'?'saved':v==='deleted'?'dismissed':'available';
  (R.jobs||[]).forEach(j=>{const c=document.querySelector('[data-job-id="'+CSS.escape(j.id)+'"]');if(!c)return;c.dataset.state=cardStateFromServer(j.preferenceState)});
  const requested=new URLSearchParams(location.search).get('tab'),desired=['available','saved','dismissed'].includes(requested)?requested:(activeLoadTab||'available');
  if(typeof showLoadTab==='function')showLoadTab(desired);
  window.addEventListener('message',event=>{
   const d=event.data||{};if(d.type!=='xdrive:api-result'||!pendingPreferences.has(d.requestId))return;
   const p=pendingPreferences.get(d.requestId);pendingPreferences.delete(d.requestId);
   const rr=d.response||{},ok=Number(rr.status)>=200&&Number(rr.status)<300;
   if(ok)return;
   p.job.preferenceState=p.previous;p.card.dataset.state=cardStateFromServer(p.previous);
   if(typeof showLoadTab==='function')showLoadTab(activeLoadTab||'available');
   fail(rr);
  });
  window.persistLoadState=function(card,state){
   const j=(R.jobs||[]).find(x=>x.id===card.dataset.jobId||x.ref===card.dataset.jobRef);if(!j)return false;
   const server=state==='saved'?'saved':state==='dismissed'?'deleted':null,previous=j.preferenceState==null?null:j.preferenceState;
   if(window.XDriveNative&&typeof XDriveNative.apiPostAsync==='function'){
    const requestId='jobpref:'+j.id+':'+Date.now()+':'+Math.random().toString(36).slice(2,7);
    pendingPreferences.set(requestId,{job:j,card,previous});j.preferenceState=server;
    XDriveNative.apiPostAsync(requestId,'/api/driver/mobile/resources',JSON.stringify({action:'set_job_preference',jobId:j.id,state:server}));
    return true;
   }
   const rr=Api.post('/api/driver/mobile/resources',{action:'set_job_preference',jobId:j.id,state:server});if(!Api.ok(rr)){fail(rr);return false}j.preferenceState=server;return true;
  };
 },0);

 if(path==='quote-form.html')window.submitQuote=function(){
  const j=findJob(),base=Number((document.getElementById('quoteBaseAmount')||{}).value||0),extras=Number((document.getElementById('quoteExtras')||{}).value||0),collectRaw=String((document.getElementById('quoteCollectWithinMinutes')||{}).value||''),msg=document.getElementById('quoteMessage'),submit=document.getElementById('quoteSubmitButton');
  if(!j){if(msg)msg.textContent='This load is no longer available.';return}
  if(!(base>0)){if(msg)msg.textContent='Enter a base transport price greater than £0.00.';return}
  if(!Number.isFinite(extras)||extras<0){if(msg)msg.textContent='Additional extras cannot be negative.';return}
  const collectWithinMinutes=collectRaw===''?null:Number(collectRaw);
  if(collectWithinMinutes!==null&&(!Number.isFinite(collectWithinMinutes)||collectWithinMinutes<5||collectWithinMinutes>240)){if(msg)msg.textContent='Collection time must be between 5 and 240 minutes.';return}
  const amount=Math.round((base+extras)*100)/100;
  const noteEl=document.getElementById('quoteNotes'),notes=String((noteEl&&('value' in noteEl)?noteEl.value:noteEl&&noteEl.textContent)||'').trim();
  if(extras>0&&!notes){if(msg)msg.textContent='Explain the additional extras in Notes.';return}
  const editBid=(submit&&submit.dataset.editBid)||qs.get('bid')||'',body={jobId:j.id,amount,baseAmount:base,additionalExtrasGbp:extras,collectWithinMinutes,message:notes};
  if(submit){submit.disabled=true;submit.textContent=editBid?'Saving...':'Submitting...'}
  const endpoint=editBid?'/api/driver/mobile/bids/'+encodeURIComponent(editBid):'/api/driver/mobile/bids';
  const payload=editBid?{action:'edit',amount,baseAmount:base,additionalExtrasGbp:extras,collectWithinMinutes,message:notes}:body;
  const key=editBid?('quote:'+editBid+':edit:'+amount+':'+base+':'+extras+':'+String(collectWithinMinutes)):('quote:'+j.id+':submit:'+amount+':'+base+':'+extras+':'+String(collectWithinMinutes));
  const r=Api.postReliable(endpoint,payload,key);
  if(!Api.ok(r)){if(msg)msg.textContent=Api.error(r);if(submit){submit.disabled=false;submit.textContent=editBid?'Save Quote':'Submit Quote'}return}
  if(r.body&&r.body.queued){
   const record={id:editBid||'',jobId:j.id,jobRef:j.ref,company:j.company,companyXdId:j.companyXdId,vehicle:j.vehicle,pickupPostcode:j.pickupPostcode,deliveryPostcode:j.deliveryPostcode,paymentTerms:j.paymentTerms,amount,baseAmount:base,additionalExtrasGbp:extras,collectWithinMinutes,message:notes,createdAt:new Date().toISOString()};
   localStorage.setItem(editBid?'xdrive-pending-edit-'+editBid:'xdrive-pending-quote-'+j.id,JSON.stringify(record));
   if(msg)msg.textContent='Saved offline. Quote will sync automatically when the connection returns.';
   setTimeout(()=>location.replace('quote.html'),350);return;
  }
  if(editBid)localStorage.removeItem('xdrive-pending-edit-'+editBid);else localStorage.removeItem('xdrive-pending-quote-'+j.id);
  location.replace('quote.html');
 };
 if(path==='quote.html')setTimeout(()=>{
  document.querySelectorAll('[data-cancel-job]').forEach(btn=>{
   const jobId=btn.dataset.cancelJob,q=(R.quotes||[]).find(x=>x.jobId===jobId);
   if(!q)return;
   btn.onclick=e=>{e.preventDefault();e.stopPropagation();if(!confirm('Cancel this quote?'))return;btn.disabled=true;btn.textContent='Cancelling...';const endpoint='/api/driver/mobile/bids/'+encodeURIComponent(q.id),r=Api.postReliable(endpoint,{action:'withdraw'},'quote:'+q.id+':withdraw');if(!Api.ok(r)){btn.disabled=false;btn.textContent='Cancel Bid';fail(r);return}if(r.body&&r.body.queued){localStorage.setItem('xdrive-pending-withdraw-'+q.id,JSON.stringify({bidId:q.id,jobId:q.jobId,createdAt:new Date().toISOString()}));btn.textContent='Pending sync';setTimeout(()=>location.reload(),250);return}localStorage.removeItem('xdrive-pending-withdraw-'+q.id);location.reload()};
  });
 },60);


 const executionSteps=[
  {key:'assigned',label:'Assigned'},
  {key:'accepted',label:'Driver Accepted'},
  {key:'on_my_way',label:'To Collection'},
  {key:'on_site_pickup',label:'At Collection'},
  {key:'loaded',label:'Loaded'},
  {key:'in_transit',label:'To Delivery'},
  {key:'on_site_delivery',label:'At Delivery'},
  {key:'delivered',label:'POD / Delivered'}
 ];
 function canonicalLifecycle(status){
  const s=String(status||'').toLowerCase();
  if(['awarded','allocated','assigned'].includes(s))return'assigned';
  if(s==='accepted')return'accepted';
  if(['on_my_way','on_my_way_pickup'].includes(s))return'on_my_way';
  if(['on_site_pickup','arrived_pickup'].includes(s))return'on_site_pickup';
  if(['loaded','collected'].includes(s))return'loaded';
  if(['in_transit','on_my_way_delivery','on_my_way_to_delivery'].includes(s))return'in_transit';
  if(['on_site_delivery','arrived_delivery'].includes(s))return'on_site_delivery';
  if(['delivered','completed'].includes(s))return'delivered';
  return s;
 }
 function lifecycleMeta(status,podCompleted){
  const s=canonicalLifecycle(status);
  if(s==='assigned')return{title:'Job Assigned',badge:'ASSIGNED',help:'Accept the assigned job before starting the journey to collection.',next:{label:'Accept Job',action:'accept'}};
  if(s==='accepted')return{title:'Job Accepted',badge:'ACCEPTED',help:'Start the job when you leave for the collection point.',next:{label:'Start Job - On My Way to Collection',action:'on-my-way-pickup'}};
  if(s==='on_my_way')return{title:'On My Way to Collection',badge:'IN PROGRESS',help:'Use navigation below. When you arrive at collection, update your status.',next:{label:'On Site (Collection)',action:'arrived-pickup'}};
  if(s==='on_site_pickup')return{title:'On Site at Collection',badge:'COLLECTION',help:'Complete the collection handover and evidence before confirming the load is on board.',next:{label:'Collection Handover & Confirm Loaded',collectionProof:true}};
  if(s==='loaded')return{title:'Loaded',badge:'LOADED',help:'Cargo is confirmed on board. Start the delivery leg when you leave collection.',next:{label:'On My Way to Delivery',action:'on-my-way-delivery'}};
  if(s==='in_transit')return{title:'On My Way to Delivery',badge:'IN TRANSIT',help:'Use navigation below. When you reach the delivery point, update your status.',next:{label:'On Site (Delivery)',action:'arrived-delivery'}};
  if(s==='on_site_delivery')return{title:'On Site at Delivery',badge:'DELIVERY',help:'Capture the recipient name, signature and delivery photo to complete POD.',next:{label:'Complete POD',pod:true}};
  if(s==='delivered')return{title:podCompleted?'Delivered · POD Complete':'Delivered',badge:'COMPLETED',help:podCompleted?'This job is complete. POD is available for review.':'Complete the POD evidence for this delivery.',next:{label:podCompleted?'View POD':'Complete POD',pod:true,view:podCompleted}};
  return{title:'Job Status',badge:String(status||'UNKNOWN').replace(/_/g,' ').toUpperCase(),help:'This job status needs review before the next driver action can be shown.',next:null};
 }

 function showOfflinePending(message){let box=document.getElementById('offline-action-pending');if(!box){box=document.createElement('div');box.id='offline-action-pending';box.className='panel';box.style.border='1px solid #F5A300';box.style.marginBottom='12px';const cta=document.getElementById('job-execution-primary')||document.querySelector('.detail-screen>a.primary');if(cta)cta.insertAdjacentElement('beforebegin',box);else document.querySelector('.detail-screen')?.prepend(box)}box.innerHTML='<div class="panel-title">Pending sync</div><div class="details">'+String(message||'Saved offline. XDrive will sync this action when the connection returns.')+'</div>'}
 const nativePending=new Map();
 let nativeSeq=0;
 window.__XDriveNativeResult=function(d){
  d=d||{};if(d.type!=='xdrive:api-result'||!nativePending.has(d.requestId))return false;
  const p=nativePending.get(d.requestId);nativePending.delete(d.requestId);clearTimeout(p.timer);p.resolve(d.response||{status:500,body:{error:'No response returned.'}});return true;
 };
 window.addEventListener('message',event=>window.__XDriveNativeResult(event.data));
 function nativeHost(){
  try{if(parent&&parent!==window&&parent.XDriveTabs&&typeof parent.XDriveTabs.nativePostAsync==='function')return parent.XDriveTabs}catch(_e){}
  return window.XDriveNative||null;
 }
 function nativePostAsync(path,body,label){
  const nativeBridge=window.XDriveNative||(window.parent&&window.parent.XDriveNative)||(window.top&&window.top.XDriveNative);
  if(nativeBridge&&typeof nativeBridge.apiPostAsync==='function')return new Promise(resolve=>{
   const requestId='lifecycle:'+String(label||'post')+':'+Date.now()+':'+(++nativeSeq),timer=setTimeout(()=>{if(!nativePending.has(requestId))return;nativePending.delete(requestId);resolve({status:504,body:{error:'The server response timed out. Please retry.'}})},20000);
   nativePending.set(requestId,{resolve,timer});nativeBridge.apiPostAsync(requestId,path,JSON.stringify(body||{}));
  });
  return Promise.resolve().then(()=>Api.post(path,body||{}));
 }
 function nativeGetAsync(path,label){
  const nativeBridge=window.XDriveNative||(window.parent&&window.parent.XDriveNative)||(window.top&&window.top.XDriveNative);
  if(nativeBridge&&typeof nativeBridge.apiGetAsync==='function')return new Promise(resolve=>{
   const requestId='lifecycle:'+String(label||'get')+':'+Date.now()+':'+(++nativeSeq),timer=setTimeout(()=>{if(!nativePending.has(requestId))return;nativePending.delete(requestId);resolve({status:504,body:{error:'The server response timed out.'}})},12000);
   nativePending.set(requestId,{resolve,timer});nativeBridge.apiGetAsync(requestId,path);
  });
  return Promise.resolve().then(()=>Api.get(path));
 }
 const optimisticNext={accept:'accepted','on-my-way-pickup':'on_my_way','arrived-pickup':'on_site_pickup',loaded:'loaded','on-my-way-delivery':'in_transit','arrived-delivery':'on_site_delivery',delivered:'delivered'};
 const optimisticPrevious={accepted:'allocated',on_my_way:'accepted',on_site_pickup:'on_my_way',loaded:'on_site_pickup',in_transit:'loaded',on_site_delivery:'in_transit'};
 function refreshBookingUi(job){
  try{if(typeof window.XDriveRefreshBookingPresentation==='function')window.XDriveRefreshBookingPresentation()}catch(_e){}
  applyBookingLifecycle(0);
 }
 function applyServerJob(job,raw){
  if(!raw)return job;
  let mapped=null;try{mapped=typeof window.XDriveMapBooking==='function'?window.XDriveMapBooking(raw):null}catch(_e){}
  if(mapped)Object.assign(job,mapped);else{job.currentStatus=String(raw.currentStatus||raw.current_status||raw.status||job.currentStatus||'');job.lifecycleStatus=String(raw.lifecycleStatus||raw.lifecycle_status||job.currentStatus||'');job.status=String(raw.status||job.status||'')}
  job._syncing=false;refreshBookingUi(job);return job;
 }
 function setOptimisticStatus(job,status){job._syncing=true;job.currentStatus=status;job.lifecycleStatus=status;job.status=status;refreshBookingUi(job)}
 async function postLifecycle(job,action,button){
  if(job._syncing)return false;
  const previous={status:job.status,currentStatus:job.currentStatus,lifecycleStatus:job.lifecycleStatus},next=optimisticNext[action];
  if(next)setOptimisticStatus(job,next);else if(button){button.disabled=true;button.textContent='Syncing...'}
  const endpoint='/api/driver/mobile/jobs/'+encodeURIComponent(job.id)+'/'+action,r=await nativePostAsync(endpoint,{},action);
  if(!Api.ok(r)){Object.assign(job,previous,{_syncing:false});refreshBookingUi(job);fail(r);return false}
  applyServerJob(job,r.body&&r.body.job);try{if(window.XDriveNative&&typeof XDriveNative.ensureLocationFeatures==='function')XDriveNative.ensureLocationFeatures()}catch(_e){}
  return true;
 }
 const reversibleLifecycle=new Set(['accepted','on_my_way','on_site_pickup','loaded','in_transit','on_site_delivery']);
 async function undoLifecycle(job,status,button){
  const current=canonicalLifecycle(status);if(!reversibleLifecycle.has(current)||job._syncing)return false;
  if(!confirm('Undo the latest job status? This will move the job back one operational step.'))return false;
  const previousSnapshot={status:job.status,currentStatus:job.currentStatus,lifecycleStatus:job.lifecycleStatus},previous=optimisticPrevious[current];
  if(previous)setOptimisticStatus(job,previous);else if(button){button.disabled=true;button.textContent='Undoing...'}
  const endpoint='/api/driver/mobile/jobs/'+encodeURIComponent(job.id)+'/undo-status',r=await nativePostAsync(endpoint,{expectedCurrentStatus:status},'undo-'+current);
  if(!Api.ok(r)){Object.assign(job,previousSnapshot,{_syncing:false});refreshBookingUi(job);fail(r);return false}
  applyServerJob(job,r.body&&r.body.job);return true;
 }
 function renderUndoAction(job,status){
  const panel=document.getElementById('job-execution-panel');if(!panel)return;
  let btn=document.getElementById('job-execution-undo');
  const current=canonicalLifecycle(status),show=reversibleLifecycle.has(current);
  if(!show){if(btn)btn.remove();return}
  if(!btn){btn=document.createElement('button');btn.id='job-execution-undo';btn.className='secondary job-execution-undo';btn.type='button';const primary=document.getElementById('job-execution-primary');if(primary)primary.insertAdjacentElement('afterend',btn);else panel.appendChild(btn)}
  btn.textContent=job._syncing?'Syncing...':'Undo last status';btn.disabled=job._syncing===true;btn.onclick=()=>undoLifecycle(job,status,btn);
 }
 window.XDriveUndoCurrentStatus=function(){const j=findJob();if(!j)return false;return undoLifecycle(j,j.currentStatus||j.lifecycleStatus||j.status,document.getElementById('job-execution-undo'))};
 function navTarget(job,kind){return kind==='delivery'?(job.deliveryPostcode||job.deliveryLocation||''):(job.pickupPostcode||job.pickupLocation||'')}
 function navUrl(provider,target){const q=encodeURIComponent(target);return provider==='waze'?'https://www.waze.com/ul?q='+q+'&navigate=yes':'https://www.google.com/maps/dir/?api=1&destination='+q}
 function renderExecutionNavigation(job,status){
  const host=document.getElementById('job-execution-navigation');if(!host)return;host.innerHTML='';
  const s=canonicalLifecycle(status),kind=s==='on_my_way'?'collection':s==='in_transit'?'delivery':null;if(!kind)return;
  const target=navTarget(job,kind);if(!target)return;
  host.innerHTML='<div class="stage-navigation-actions"><div class="stage-navigation-title">'+(kind==='collection'?'Navigate to collection':'Navigate to delivery')+'</div><div class="stage-navigation-buttons"><a class="secondary" href="'+navUrl('google',target)+'">Google Maps</a><a class="secondary" href="'+navUrl('waze',target)+'">Waze</a></div></div>';
 }
 let trackingRenderToken=0;
 function renderTrackingState(job){
  const panel=document.getElementById('job-execution-panel');if(!panel)return;
  let box=document.getElementById('job-tracking-state');if(!box){box=document.createElement('div');box.id='job-tracking-state';box.className='job-tracking-state';const nav=document.getElementById('job-execution-navigation');if(nav)nav.insertAdjacentElement('afterend',box);else panel.appendChild(box)}
  const token=++trackingRenderToken;
  let diag=null;try{diag=window.XDriveNative&&typeof XDriveNative.appDiagnostics==='function'?JSON.parse(XDriveNative.appDiagnostics()||'{}'):null}catch(_e){}
  const pending=diag&&diag.body?Number(diag.body.pendingLocations||0):0;
  if(!box.dataset.ready)box.innerHTML='<div class="job-tracking-row"><span class="tracking-dot off"></span><div><strong>Tracking status</strong><small>Checking live tracking...'+(pending>0?' '+pending+' location point'+(pending===1?'':'s')+' pending sync.':'')+'</small></div><button id="job-tracking-refresh" class="secondary" type="button">Refresh</button></div>';
  const refresh=box.querySelector('#job-tracking-refresh');if(refresh)refresh.onclick=()=>{try{if(window.XDriveNative&&typeof XDriveNative.ensureLocationFeatures==='function')XDriveNative.ensureLocationFeatures()}catch(_e){};box.dataset.ready='';renderTrackingState(job)};
  nativeGetAsync('/api/driver/tracking-state','tracking').then(r=>{
   if(token!==trackingRenderToken||!box.isConnected)return;
   const ok=r&&Api.ok(r),body=ok?(r.body||{}):{},forThis=body.should_track===true&&String(body.job_id||'')===String(job.id);
   box.dataset.ready='1';
   box.innerHTML='<div class="job-tracking-row"><span class="tracking-dot '+(forThis?'on':'off')+'"></span><div><strong>'+(forThis?'Mobile Tracking On':'Mobile Tracking Off')+'</strong><small>'+(forThis?'Live job tracking is enabled for this booking.':body.reason==='multiple_active_jobs'?'Tracking is paused because more than one active job was found.':'Tracking starts automatically when this booking is the active assigned job.')+(pending>0?' '+pending+' location point'+(pending===1?'':'s')+' pending sync.':'')+'</small></div><button id="job-tracking-refresh" class="secondary" type="button">Refresh</button></div>';
   const b=box.querySelector('#job-tracking-refresh');if(b)b.onclick=()=>{try{if(window.XDriveNative&&typeof XDriveNative.ensureLocationFeatures==='function')XDriveNative.ensureLocationFeatures()}catch(_e){};box.dataset.ready='';renderTrackingState(job)};
  });
 }
 function renderCollectionPassAction(job,status){
  const panel=document.getElementById('job-execution-panel');if(!panel)return;
  let link=document.getElementById('job-collection-pass');
  const current=canonicalLifecycle(status),show=['assigned','accepted','on_my_way','on_site_pickup'].includes(current);
  if(!show){if(link)link.remove();return}
  if(!link){link=document.createElement('a');link.id='job-collection-pass';link.className='secondary job-collection-pass';link.textContent='Collection Pass';const nav=document.getElementById('job-execution-navigation');if(nav)nav.insertAdjacentElement('afterend',link);else panel.appendChild(link)}
  link.href='collection-pass.html?job='+encodeURIComponent(job.id);
  link.textContent=job.collectionPassRequired===true?'Collection Pass · REQUIRED':'Collection Pass';
 }
 function renderExecutionProgress(status){
  const host=document.getElementById('job-execution-progress');if(!host)return;
  const current=canonicalLifecycle(status),idx=Math.max(0,executionSteps.findIndex(x=>x.key===current)),complete=current==='delivered';
  host.innerHTML=executionSteps.map((step,i)=>{const done=i<idx||(complete&&i===idx),cls=done?'done':i===idx?'current':'';return'<div class="job-execution-step '+cls+'"><span>'+(done?'✓':i+1)+'</span><small>'+step.label+'</small></div>'}).join('');
 }
 function applyBookingLifecycle(attempt){
  const j=findJob(),panel=document.getElementById('job-execution-panel'),button=document.getElementById('job-execution-primary'),oldCta=document.querySelector('.detail-screen>a.primary');
  if(!j||!panel||!button){if((attempt||0)<30)setTimeout(()=>applyBookingLifecycle((attempt||0)+1),150);return}
  if(oldCta)oldCta.style.display='none';
  const status=j.currentStatus||j.lifecycleStatus||j.status,meta=lifecycleMeta(status,j.podCompleted===true);
  panel.style.display='block';
  document.getElementById('job-execution-status').textContent=meta.title;
  const badge=document.getElementById('job-execution-badge');badge.textContent=meta.badge;badge.className='badge '+(canonicalLifecycle(status)==='delivered'?'green':'orange');
  const formatPostcode=v=>{const s=String(v||'').trim().toUpperCase().replace(/\s+/g,'');return /^[A-Z]{1,2}\d[A-Z\d]?\d[A-Z]{2}$/.test(s)?s.slice(0,-3)+' '+s.slice(-3):String(v||'').trim()};const route=document.getElementById('job-execution-route');route.textContent=formatPostcode(j.pickupPostcode||j.pickupLocation||'Collection')+' → '+formatPostcode(j.deliveryPostcode||j.deliveryLocation||'Delivery');
  document.getElementById('job-execution-help').textContent=meta.help;
  renderExecutionProgress(status);renderExecutionNavigation(j,status);renderTrackingState(j);renderCollectionPassAction(j,status);renderUndoAction(j,status);
  const next=meta.next;
  if(!next){button.style.display='none';return}
  button.style.display='flex';button.disabled=j._syncing===true;button.textContent=j._syncing?'Syncing...':next.label;button.dataset.label=next.label;
  button.onclick=()=>{
   if(next.pod){location.href='pod.html?job='+encodeURIComponent(j.id);return}
   if(next.collectionProof){location.href='collection-handover.html?job='+encodeURIComponent(j.id);return}
   postLifecycle(j,next.action,button);
  };
 }
 if(path==='booking-detail.html'){setTimeout(()=>applyBookingLifecycle(0),120);window.addEventListener('xdrive:booking-refreshed',()=>applyBookingLifecycle(0));}
 if(path==='booking-detail.html')setTimeout(()=>{
  const j=findJob();if(!j)return;
  document.querySelectorAll('[data-stop-action]').forEach(btn=>{
   btn.onclick=async e=>{e.preventDefault();e.stopPropagation();const stopId=btn.dataset.stopId,next=btn.dataset.stopNext;if(!stopId||!['arrived','completed'].includes(next))return;const stop=(j.stops||[]).find(x=>String(x.id)===String(stopId));if(next==='completed'&&stop&&String(stop.type).toLowerCase()==='collection'){location.href='collection-handover.html?job='+encodeURIComponent(j.id)+'&stop='+encodeURIComponent(stopId);return}btn.disabled=true;const oldText=btn.textContent,previous=stop?{status:stop.status,arrivedAt:stop.arrivedAt,completedAt:stop.completedAt}:null;btn.textContent=next==='arrived'?'Updating...':'Completing...';if(stop){stop.status=next;if(next==='arrived')stop.arrivedAt=new Date().toISOString();if(next==='completed')stop.completedAt=new Date().toISOString();try{if(typeof window.XDriveRefreshBookingPresentation==='function')window.XDriveRefreshBookingPresentation()}catch(_e){}}const r=await nativePostAsync('/api/driver/mobile/jobs/'+encodeURIComponent(j.id)+'/stop-status',{stop_id:stopId,status:next},'stop-'+stopId+'-'+next);if(!Api.ok(r)){if(stop&&previous)Object.assign(stop,previous);try{if(typeof window.XDriveRefreshBookingPresentation==='function')window.XDriveRefreshBookingPresentation()}catch(_e){}btn.disabled=false;btn.textContent=oldText;fail(r);return}if(stop&&r.body&&r.body.stop)Object.assign(stop,r.body.stop);try{if(typeof window.XDriveRefreshBookingPresentation==='function')window.XDriveRefreshBookingPresentation()}catch(_e){};try{if(window.XDriveNative&&typeof XDriveNative.ensureLocationFeatures==='function')XDriveNative.ensureLocationFeatures()}catch(_e){}};
  });
 },180);
 const fileBase64=f=>new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>{const s=String(r.result||'');resolve(s.includes(',')?s.split(',')[1]:s)};r.onerror=()=>reject(r.error);r.readAsDataURL(f)});

 if(path==='pod.html')setTimeout(()=>{
  const j=findJob(),btn=document.getElementById('pod-final-save');if(!j||!btn||j.podCompleted===true)return;
  const uploadFiles=async(files,category)=>{
   const paths=[];
   for(const f of files){
    if(f.size>10*1024*1024)throw new Error(f.name+' is larger than 10 MB.');
    const b=await fileBase64(f),mime=f.type||(/\.pdf$/i.test(f.name)?'application/pdf':'image/jpeg');
    const rr=JSON.parse(XDriveNative.uploadJobEvidence(j.id,'delivery',category,f.name,mime,b)||'{}');
    if(!Api.ok(rr))throw new Error(Api.error(rr));paths.push(rr.body.storagePath);
   }
   return paths;
  };
  btn.onclick=async()=>{
   const recipient=document.getElementById('pod-final-recipient').value.trim(),notes=document.getElementById('pod-final-notes').value.trim();
   const signaturePad=document.getElementById('pod-signature-pad'),signature=signaturePad&&typeof signaturePad.getSignatureData==='function'?signaturePad.getSignatureData():'';
   const files=[...document.getElementById('pod-final-files').files],damage=[...document.getElementById('pod-damage-files').files],documents=[...document.getElementById('pod-document-files').files];
   const deliveryStatus=String((document.getElementById('pod-delivery-status')||{}).value||'Completed Delivery'),leftAt=String((document.getElementById('pod-left-at')||{}).value||'').trim(),deliveredOn=String((document.getElementById('pod-delivered-on')||{}).value||'').trim(),itemRaw=String((document.getElementById('pod-item-count')||{}).value||'').trim(),itemCount=itemRaw===''?null:Number(itemRaw),hardCopyBox=document.getElementById('pod-hard-copy-ack'),hardCopyAcknowledged=!hardCopyBox||hardCopyBox.checked;
   if(!recipient){alert('Received By (Full Name) is required.');return}
   if(!signature){alert('Recipient signature is required. Ask the recipient to sign in the signature box.');return}
   if(!files.length){alert('At least one delivery photo is required.');return}
   if(!hardCopyAcknowledged){alert('Confirm the hard-copy POD requirement before completing delivery.');return}
   if(itemCount!==null&&(!Number.isFinite(itemCount)||itemCount<0)){alert('Enter a valid delivered item count.');return}
   if(files.length+damage.length>10){alert('A maximum of 10 delivery and damage photos can be submitted.');return}
   const bundleKey='xdrive-docbundle:'+j.id+':delivery:root';let built=[];try{const b=JSON.parse(localStorage.getItem(bundleKey)||'{}');if(Array.isArray(b.paths))built=b.paths.filter(Boolean)}catch(_e){}
   if(documents.length+built.length>10){alert('A maximum of 10 POD documents can be submitted.');return}
   btn.disabled=true;btn.textContent='Uploading POD...';
   try{
    const paths=await uploadFiles(files,'photos'),damagePaths=await uploadFiles(damage,'damage'),newDocumentPaths=await uploadFiles(documents,'documents'),documentPaths=[...new Set([...built,...newDocumentPaths])];
    let r=Api.post('/api/driver/mobile/jobs/'+encodeURIComponent(j.id)+'/pod',{recipientName:recipient,signatureData:signature,photoUris:paths,damagePhotoUris:damagePaths,documentUris:documentPaths,notes,deliveryStatus,leftAt,deliveredOn,itemCount,hardCopyAcknowledged});
    if(!Api.ok(r))throw new Error(Api.error(r));
    localStorage.removeItem(bundleKey);
    r=Api.postReliable('/api/driver/mobile/jobs/'+encodeURIComponent(j.id)+'/delivered',{},'job:'+j.id+':delivered');
    if(!Api.ok(r))throw new Error(Api.error(r));
    if(r.body&&r.body.queued){showOfflinePending(r.body.message);btn.textContent='POD saved - delivery pending sync';awaitOfflineSync();return}
    if(confirm('POD complete. Would you like to update your availability status now?'))location.replace('availability.html');else location.replace('booking-detail.html?job='+encodeURIComponent(j.id));
   }catch(err){alert(err.message||'POD could not be completed.');btn.disabled=false;btn.textContent='Complete POD'}
  };
 },180);
 if(path==='return-journey.html')setTimeout(()=>{
  const j=R.returnJourney||{};
  if(j.from_postcode||j.from_location)from.value=j.from_postcode||j.from_location;
  if(j.to_postcode||j.to_location)to.value=j.to_postcode||j.to_location;
  if(j.available_from||j.available_date)date.value=String(j.available_from||j.available_date).slice(0,10);
  window.saveJourney=function(){const miles=parseInt(String(radius.value||'50'),10)||50;const r=Api.post('/api/driver/mobile/resources',{action:'save_return_journey',fromLocation:from.value,toLocation:to.value,availableDate:date.value?new Date(date.value+'T00:00:00').toISOString():null,vehicleType:(R.vehicle&&R.vehicle.rawType)||null,notes:'Search radius '+miles+' miles'});journeySaved.textContent=Api.ok(r)?'Return Journey saved. Matching loads refreshed.':Api.error(r);if(Api.ok(r)&&typeof renderMatches==='function')renderMatches()};
 },0);
})();
