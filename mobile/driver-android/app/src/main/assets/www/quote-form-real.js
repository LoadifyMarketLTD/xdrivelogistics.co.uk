(function(){
 'use strict';
 const R=window.XDRIVE_REAL||{},q=new URLSearchParams(location.search),id=q.get('job'),bidId=q.get('bid')||'',edit=q.get('edit')==='1';
 const job=[...(R.jobs||[]),...(R.bookings||[])].find(j=>j.id===id||j.ref===id);
 const quote=(R.quotes||[]).find(x=>String(x.id)===bidId||String(x.jobId)===String(id));
 if(!job){document.getElementById('quoteMessage').textContent='This load is no longer available.';document.querySelector('button.primary').disabled=true;return}
 const tm=v=>v?new Date(v).toLocaleString('en-GB',{timeZone:'Europe/London',day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit',hour12:false}):'Time not supplied';
 const postcode=v=>{const s=String(v||'').trim().toUpperCase().replace(/\s+/g,'');return /^[A-Z]{1,2}\d[A-Z\d]?\d[A-Z]{2}$/.test(s)?s.slice(0,-3)+' '+s.slice(-3):String(v||'').trim()};
 document.getElementById('quoteTitle').textContent=(edit?'Edit Quote · ':'Load ID ')+job.ref;
 document.getElementById('quoteBack').href=edit?'quote.html':'detail.html?job='+encodeURIComponent(job.id)+(q.get('from')==='alerts'?'&from=alerts':'');
 document.getElementById('quotePickup').textContent=postcode(job.pickupPostcode||job.pickupLocation)||'Pickup not supplied';
 document.getElementById('quoteDelivery').textContent=postcode(job.deliveryPostcode||job.deliveryLocation)||'Delivery not supplied';
 document.getElementById('quotePickupTime').textContent=tm(job.collectionStart||job.collectionEnd);
 document.getElementById('quoteDeliveryTime').textContent=tm(job.deliveryStart||job.deliveryEnd);
 document.getElementById('quoteVehicle').textContent=job.vehicle||'Vehicle not supplied';
 document.getElementById('quoteCargo').textContent=(job.pallets?job.pallets+' pallet'+(Number(job.pallets)===1?'':'s'):'Cargo details')+(job.weight?' | '+job.weight+' kg':'');
 document.getElementById('quoteCollectionWindow').textContent='Job collection window: '+tm(job.collectionStart||job.collectionEnd)+(job.collectionEnd&&job.collectionStart?' – '+tm(job.collectionEnd):'');
 const v=R.vehicle;document.getElementById('quoteAssignedVehicle').textContent=v?((v.type||'Vehicle')+(v.registration?' · '+v.registration:'')):'No assigned vehicle';
 const base=document.getElementById('quoteBaseAmount'),extras=document.getElementById('quoteExtras'),total=document.getElementById('quoteTotal'),collect=document.getElementById('quoteCollectWithinMinutes'),notes=document.getElementById('quoteNotes'),submit=document.getElementById('quoteSubmitButton');
 if(edit){
  if(!quote||String(quote.status||'').toLowerCase()!=='submitted'){document.getElementById('quoteMessage').textContent='Only a submitted quote can be edited.';submit.disabled=true}
  else{
   base.value=String(quote.baseAmount==null?Math.max(0,Number(quote.amount||0)-Number(quote.additionalExtrasGbp||0)):quote.baseAmount);
   extras.value=String(Number(quote.additionalExtrasGbp||0));
   collect.value=quote.collectWithinMinutes==null?'':String(quote.collectWithinMinutes);
   notes.value=quote.message||'';
   submit.textContent='Save Quote';
   submit.dataset.editBid=quote.id;
  }
 }
 const update=()=>{const b=Math.max(0,Number(base.value||0)||0),x=Math.max(0,Number(extras.value||0)||0);total.textContent='£'+(b+x).toFixed(2)};
 base.addEventListener('input',update);extras.addEventListener('input',update);update();
 document.body.classList.add('live-ready');
})();