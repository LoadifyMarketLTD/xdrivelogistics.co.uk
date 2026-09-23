(function(){
 'use strict';
 const CITY={BB:'BLACKBURN',LS:'LEEDS',NG:'NOTTINGHAM',DA:'ERITH'},list=document.getElementById('load-list');
 if(!list||!Array.isArray(window.XDRIVE_REAL_JOBS))return;
 const safe=v=>String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
 function compact(v){const p=String(v||'').toUpperCase().replace(/\s+/g,'');return /^[A-Z]{1,2}\d[A-Z\d]?\d[A-Z]{2}$/.test(p)?p.slice(0,-3)+' '+p.slice(-3):p}
 function outward(v){const p=compact(v).replace(/\s+/g,'');return /^[A-Z]{1,2}\d[A-Z\d]?\d[A-Z]{2}$/.test(p)?p.slice(0,-3):p}
 function place(v){const out=outward(v),m=out.match(/^[A-Z]+/),city=CITY[m?m[0]:''];return city?(city+', '+out):out}
 const clock=v=>v?new Date(v).toLocaleTimeString('en-GB',{timeZone:'Europe/London',hour:'2-digit',minute:'2-digit',hour12:false}):'Time not supplied';
 const shortDate=v=>v?new Date(v).toLocaleDateString('en-GB',{timeZone:'Europe/London',day:'2-digit',month:'short'}):'';
 const posted=v=>v?'Posted '+clock(v)+' · '+shortDate(v):'';
 function when(v,label){return v?(label+' '+clock(v)+' · '+shortDate(v)):(label+' time not supplied')}
 function cargo(job){const p=[];if(job.freightType)p.push(job.freightType);if(job.pallets!==null&&job.pallets!==undefined&&job.pallets!=='')p.push(job.pallets+' pallet'+(Number(job.pallets)===1?'':'s'));if(job.weight!==null&&job.weight!==undefined&&job.weight!=='')p.push(job.weight+' kg');return p.length?p.join(' | '):'Cargo details not supplied'}
 function dimensions(job){const d=job.dimensions;return d&&Number(d.length)>0&&Number(d.width)>0&&Number(d.height)>0?(Number(d.length)+' × '+Number(d.width)+' × '+Number(d.height)+' cm'):''}
 function serviceLabel(v){const s=String(v||'').toLowerCase();if(s==='timed_direct')return'TIMED DIRECT';if(s==='asap_direct')return'ASAP DIRECT';if(s==='coload_permitted')return'CO-LOAD';return s?s.replace(/_/g,' ').toUpperCase():''}
 function badgeHtml(job){const out=['<span class="badge green">NEW</span>'],service=serviceLabel(job.serviceMode);if(service)out.push('<span class="badge orange">'+safe(service)+'</span>');if(job.directDeliveryRequired&&service.indexOf('DIRECT')<0)out.push('<span class="badge">'+safe('DIRECT')+'</span>');(job.requirementFlags||[]).slice(0,3).forEach(v=>out.push('<span class="badge">'+safe(v)+'</span>'));if(job.hasProposedPrice&&Number.isFinite(Number(job.proposedPriceGbp)))out.push('<span class="badge payment">PROPOSED £'+safe(Number(job.proposedPriceGbp).toFixed(0))+'</span>');return out.join('')}
 function render(job){
  const state=job.preferenceState==='saved'?'saved':job.preferenceState==='deleted'?'dismissed':'available';
  const dims=dimensions(job);
  const sub=[cargo(job),dims].filter(Boolean).join(' · ');
  const toCollection=job.distanceMiles!==null&&job.distanceMiles!==undefined&&job.distanceMiles!==''&&Number.isFinite(Number(job.distanceMiles))&&Number(job.distanceMiles)>=0
   ?Number(job.distanceMiles).toFixed(1)+' mi'+(Number.isFinite(Number(job.pickupEtaMinutes))&&Number(job.pickupEtaMinutes)>0?' · '+Math.round(Number(job.pickupEtaMinutes))+' min':''):'Not available';
  const jobDistance=job.journeyDistanceMiles!==null&&job.journeyDistanceMiles!==undefined&&job.journeyDistanceMiles!==''&&Number.isFinite(Number(job.journeyDistanceMiles))&&Number(job.journeyDistanceMiles)>0
   ?Number(job.journeyDistanceMiles).toFixed(1)+' mi'+(Number.isFinite(Number(job.estimatedJourneyMinutes))&&Number(job.estimatedJourneyMinutes)>0?' · '+Math.round(Number(job.estimatedJourneyMinutes))+' min':''):'Not available';
  return '<article class="load-card booking-card job-card clickable-card" data-state="'+state+'" data-distance="'+safe(job.distanceMiles??9999)+'" data-posted="'+new Date(job.postedAt||0).getTime()+'" data-job-id="'+safe(job.id)+'" data-job-ref="'+safe(job.ref)+'" data-href="detail.html?job='+encodeURIComponent(job.id)+'&from=loads"><div class="company">'+safe(job.company)+(job.companyXdId?'<span class="company-xd-id">('+safe(job.companyXdId)+')</span>':'')+'</div><div class="meta">Load ID '+safe(job.ref)+' | '+safe(job.vehicle||'Vehicle not supplied')+'</div><div class="badges">'+badgeHtml(job)+'</div><div class="route"><div class="stop"><div class="pin">1</div><div><div class="place">'+safe(place(job.pickupPostcode))+'</div><div class="time">'+safe(when(job.collectionEnd||job.collectionStart,'Collect'))+'</div></div></div><div class="stop"><div class="pin">2</div><div><div class="place">'+safe(place(job.deliveryPostcode))+'</div><div class="time">'+safe(when(job.deliveryStart||job.deliveryEnd,'Deliver'))+'</div></div></div></div><div class="job-card-context"><span>To Collection</span><strong>'+safe(toCollection)+'</strong></div><div class="job-card-context"><span>Job Distance</span><strong>'+safe(jobDistance)+'</strong></div><div class="details">'+safe(sub)+'</div>'+(posted(job.postedAt)?'<div class="booking-note">'+safe(posted(job.postedAt))+'</div>':'')+'<a class="primary" href="quote-form.html?job='+encodeURIComponent(job.id)+'" onclick="event.stopPropagation()">Quote</a></article>';
 }
 const jobs=window.XDRIVE_REAL_JOBS.filter(j=>j.isTest!==true);list.innerHTML=jobs.map(render).join('');
 list.querySelectorAll('.load-card').forEach(card=>{card.onclick=()=>location.href=card.dataset.href||('detail.html?job='+encodeURIComponent(card.dataset.jobId)+'&from=loads');prepareSwipe(card)});
 sortAvailable();const desired=new URLSearchParams(location.search).get('tab'),initial=['available','saved','dismissed'].includes(desired)?desired:'available';showLoadTab(initial);setTimeout(()=>{if(['available','saved','dismissed'].includes(desired))showLoadTab(desired)},250);
})();

if(document.body)document.body.classList.add('live-ready');
