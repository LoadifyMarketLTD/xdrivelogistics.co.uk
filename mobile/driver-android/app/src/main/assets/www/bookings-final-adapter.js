(function(){
 'use strict';
 const R=window.XDRIVE_REAL||{},path=(location.pathname.split('/').pop()||'').toLowerCase();
 if(!['booking-detail.html','pod.html'].includes(path))return;
 const qs=new URLSearchParams(location.search),job=(R.bookings||[]).find(j=>j.id===qs.get('job')||j.ref===qs.get('job'));if(!job)return;
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const fmt=v=>v?new Date(v).toLocaleString('en-GB',{timeZone:'Europe/London',day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:false}):'Not recorded';
 const invoice=(R.invoices||[]).find(i=>i.jobId===job.id)||null,podComplete=job.podCompleted===true;
 function normaliseBooking(){
  const screen=document.querySelector('.detail-screen');if(!screen)return;
  const back=document.querySelector('.topbar .back'),source=qs.get('from');if(back)back.href=source==='quotes'?'quote.html':source==='alerts'?'alerts.html':'bookings.html';
  const first=screen.querySelector(':scope > .panel');if(first){
   const company=first.querySelector('.company');if(company)company.innerHTML=esc(job.company)+(job.companyXdId?'<span class="company-xd-id">('+esc(job.companyXdId)+')</span>':'');
   const meta=first.querySelector(':scope > .meta');if(meta)meta.textContent='Load ID '+(job.ref||'Not supplied')+(job.customerRef?' | Customer Ref: '+job.customerRef:'');
   const actions=first.querySelectorAll('.booking-actions button');if(actions[0]){const phone=job.collectionContactPhone||job.deliveryContactPhone||job.clientPhone||'';actions[0].onclick=()=>phone?location.href='tel:'+phone:alert('Contact phone not supplied for this job.')}if(actions[1])actions[1].onclick=()=>location.href='messenger.html?job='+encodeURIComponent(job.id)+'&company='+encodeURIComponent(job.company||'')+'&companyId='+encodeURIComponent(job.companyXdId||'');
  }
  const cta=screen.querySelector(':scope > a.primary');if(!cta)return;
  if(String(job.status||job.currentStatus||'').toLowerCase()==='delivered'&&podComplete){cta.textContent='View POD';cta.href='pod.html?job='+encodeURIComponent(job.id);cta.onclick=null}
 }
 function renderPod(){
  const screen=document.querySelector('.detail-screen');if(!screen)return;
  const back=document.querySelector('.topbar .back');if(back)back.href='booking-detail.html?job='+encodeURIComponent(job.id);
  const head='<div class="panel"><div class="company">'+esc(job.company)+(job.companyXdId?'<span class="company-xd-id">('+esc(job.companyXdId)+')</span>':'')+'</div><div class="meta">Load ID '+esc(job.ref||'Not supplied')+(job.customerRef?' | Customer Ref: '+esc(job.customerRef):'')+'</div><div class="badges"><span class="badge green">'+(podComplete?'POD COMPLETE':'POD REQUIRED')+'</span>'+(job.paymentTerms?'<span class="badge payment">'+esc(job.paymentTerms)+'</span>':'')+'</div></div>';
  if(!podComplete){
   screen.innerHTML=head+'<div class="panel"><div class="panel-title">Complete POD</div>'+
    '<label class="field-label">Received By (Full Name)</label><input id="pod-final-recipient" class="form-input" maxlength="200" placeholder="Full name of recipient">'+
    '<label class="field-label">Recipient signature</label><div class="pod-signature-capture"><canvas id="pod-signature-pad" aria-label="Recipient signature pad"></canvas><div class="pod-signature-actions"><button id="pod-signature-clear" class="secondary" type="button">Clear signature</button><span id="pod-signature-state">Sign in the box above</span></div></div>'+
    '<label class="field-label">Delivery photos <span class="required-mark">Required</span></label><div class="pod-upload"><label class="pod-upload-btn" for="pod-final-files">Add delivery photos</label><span id="pod-final-file-name">No photos selected</span><input id="pod-final-files" class="pod-file-input" type="file" accept="image/jpeg,image/png" capture="environment" multiple></div>'+
    '<label class="field-label">Damage photos <span class="optional-mark">Optional</span></label><div class="pod-upload"><label class="pod-upload-btn" for="pod-damage-files">Add damage photos</label><span id="pod-damage-file-name">No damage photos selected</span><input id="pod-damage-files" class="pod-file-input" type="file" accept="image/jpeg,image/png" capture="environment" multiple></div>'+
    '<label class="field-label">Delivery Status</label><select id="pod-delivery-status" class="form-input"><option>Completed Delivery</option><option>Partial Delivery</option><option>Failed Delivery</option><option>Refused</option><option>Left Safe</option></select>'+
    '<label class="field-label">Left At <span class="optional-mark">Optional</span></label><input id="pod-left-at" class="form-input" maxlength="500" placeholder="Reception, loading bay, safe place...">'+
    '<label class="field-label">Delivered On</label><input id="pod-delivered-on" class="form-input" type="date">'+
    '<label class="field-label">Delivered item count <span class="optional-mark">Optional</span></label><input id="pod-item-count" class="form-input" type="number" min="0" step="1" inputmode="numeric" placeholder="Items delivered">'+
    '<label class="field-label">POD / documents <span class="optional-mark">Optional</span></label><div class="pod-upload"><label class="pod-upload-btn" for="pod-document-files">Add documents</label><span id="pod-document-file-name">No documents selected</span><input id="pod-document-files" class="pod-file-input" type="file" accept="application/pdf,image/jpeg,image/png" multiple></div>'+
    '<a id="pod-document-builder" class="secondary document-builder-link" href="document-builder.html?job='+encodeURIComponent(job.id)+'&kind=delivery&return='+encodeURIComponent('pod.html?job='+job.id)+'">Build multi-page document</a><div id="pod-built-docs" class="details"></div>'+
    (job.hardCopyPod?'<div class="hard-copy-pod-panel"><div class="panel-title">Hard-copy POD required</div><div class="details">'+esc(job.hardCopyPod)+'</div><label class="check-row"><input id="pod-hard-copy-ack" type="checkbox"> <span>I have retained / followed the required hard-copy POD instruction.</span></label></div>':'')+
    '<label class="field-label">Driver notes</label><textarea id="pod-final-notes" class="form-input" maxlength="5000" placeholder="Delivery notes"></textarea>'+
    '<button id="pod-final-save" class="primary">Complete POD</button></div>';
   const bindCount=(id,label,singular,plural)=>{const input=document.getElementById(id),out=document.getElementById(label);if(input)input.onchange=()=>{const files=[...input.files];if(out)out.textContent=files.length?(files.length===1?singular(files[0]):plural(files.length)):(id==='pod-final-files'?'No photos selected':id==='pod-damage-files'?'No damage photos selected':'No documents selected')}};
   bindCount('pod-final-files','pod-final-file-name',f=>f.name,n=>n+' delivery photos selected');
   bindCount('pod-damage-files','pod-damage-file-name',f=>f.name,n=>n+' damage photos selected');
   bindCount('pod-document-files','pod-document-file-name',f=>f.name,n=>n+' documents selected');
   const deliveredOn=document.getElementById('pod-delivered-on');if(deliveredOn&&!deliveredOn.value)deliveredOn.value=new Date().toISOString().slice(0,10);
   const itemCount=document.getElementById('pod-item-count');if(itemCount&&job.itemCount!=null)itemCount.value=String(job.itemCount);
   const bundleKey='xdrive-docbundle:'+job.id+':delivery:root',builtInfo=document.getElementById('pod-built-docs');try{const bundle=JSON.parse(localStorage.getItem(bundleKey)||'{}'),count=Array.isArray(bundle.paths)?bundle.paths.length:0;if(builtInfo)builtInfo.textContent=count?(count+' document page'+(count===1?'':'s')+' ready from Document Builder.'):'No builder documents added.'}catch(_e){if(builtInfo)builtInfo.textContent='No builder documents added.'}
   const canvas=document.getElementById('pod-signature-pad'),clear=document.getElementById('pod-signature-clear'),state=document.getElementById('pod-signature-state');
   if(canvas){
    const ctx=canvas.getContext('2d');let drawing=false,signed=false,last=null;
    const resize=()=>{const rect=canvas.getBoundingClientRect(),ratio=Math.max(1,window.devicePixelRatio||1),copy=signed?canvas.toDataURL('image/png'):null;canvas.width=Math.max(1,Math.round(rect.width*ratio));canvas.height=Math.max(1,Math.round(rect.height*ratio));ctx.setTransform(ratio,0,0,ratio,0,0);ctx.lineWidth=2.2;ctx.lineCap='round';ctx.lineJoin='round';ctx.strokeStyle='#0B2F6B';if(copy){const img=new Image();img.onload=()=>ctx.drawImage(img,0,0,rect.width,rect.height);img.src=copy}};
    requestAnimationFrame(resize);window.addEventListener('resize',resize,{passive:true});
    const pos=e=>{const r=canvas.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top}};
    canvas.addEventListener('pointerdown',e=>{drawing=true;last=pos(e);canvas.setPointerCapture(e.pointerId);e.preventDefault()});
    canvas.addEventListener('pointermove',e=>{if(!drawing)return;const p=pos(e);ctx.beginPath();ctx.moveTo(last.x,last.y);ctx.lineTo(p.x,p.y);ctx.stroke();last=p;signed=true;if(state)state.textContent='Signature captured';e.preventDefault()});
    const stop=e=>{drawing=false;last=null;if(e&&canvas.hasPointerCapture&&canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId)};
    canvas.addEventListener('pointerup',stop);canvas.addEventListener('pointercancel',stop);
    canvas.getSignatureData=()=>signed?canvas.toDataURL('image/png'):'';
    canvas.clearSignature=()=>{ctx.clearRect(0,0,canvas.width,canvas.height);signed=false;if(state)state.textContent='Sign in the box above'};
    if(clear)clear.onclick=()=>canvas.clearSignature();
   }
   return;
  }
  const serverPod=job.pod||{},audit=Array.isArray(serverPod.auditHistory)?serverPod.auditHistory:[],podEvent=audit.find(h=>String(h.status||'').toLowerCase()==='pod_completed');
  const completedAt=podEvent?.timestamp||job.updatedAt||job.podGeneratedAt||job.pod_generated_at||null,recipient=serverPod.receiverName||job.clientSignatureName||'Recorded';
  const photos=Array.isArray(serverPod.deliveryPhotoUris)&&serverPod.deliveryPhotoUris.length?serverPod.deliveryPhotoUris:(Array.isArray(job.deliveryPhotos)?job.deliveryPhotos:[]),note=serverPod.comments||serverPod.deliveryNotes||job.notes||'';
  const deliveredOn=serverPod.deliveredOn||job.podDeliveredOn||'',deliveryStatus=serverPod.deliveryStatus||job.podDeliveryStatus||'Completed Delivery',leftAt=serverPod.leftAt||job.podLeftAt||'',noOfItems=serverPod.noOfItems??job.podNoOfItems;
  const bookingReturn='booking-detail.html?job='+encodeURIComponent(job.id)+'&from=bookings';
  const photoLinks=photos.map((src,i)=>'<a class="secondary evidence-link" href="evidence-viewer.html?src='+encodeURIComponent(src)+'&return='+encodeURIComponent(bookingReturn)+'&title='+encodeURIComponent('Delivery Evidence '+(i+1))+'">View delivery photo '+(i+1)+'</a>').join('');
  screen.innerHTML=head+'<div class="panel"><div class="panel-title">Delivery confirmation</div><div class="info-row"><span>Completed</span><strong>'+esc(fmt(completedAt))+'</strong></div><div class="info-row"><span>Delivery Status</span><strong>'+esc(deliveryStatus)+'</strong></div>'+(deliveredOn?'<div class="info-row"><span>Delivered On</span><strong>'+esc(deliveredOn)+'</strong></div>':'')+'<div class="info-row"><span>Recipient</span><strong>'+esc(recipient)+'</strong></div>'+(leftAt?'<div class="info-row"><span>Left At</span><strong>'+esc(leftAt)+'</strong></div>':'')+(noOfItems!=null?'<div class="info-row"><span>Items</span><strong>'+esc(noOfItems)+'</strong></div>':'')+'<div class="info-row"><span>Photos</span><strong>'+photos.length+'</strong></div></div><div class="panel"><div class="panel-title">Recipient signature</div><div class="pod-signature">'+esc(job.clientSignatureName||recipient)+'</div>'+photoLinks+'</div>'+(note?'<div class="panel"><div class="panel-title">Driver notes</div><div class="details">'+esc(note)+'</div></div>':'')+(invoice?'<a class="primary" href="invoice-detail.html?id='+encodeURIComponent(invoice.number||invoice.id)+'">View Invoice</a>':'<div class="panel"><div class="details">Invoice generation is pending.</div></div>');
 }
 const apply=()=>{path==='booking-detail.html'?normaliseBooking():renderPod();if(document.body)document.body.classList.add('live-ready')};setTimeout(apply,40);addEventListener('pageshow',()=>setTimeout(apply,40));
})();
