(function(){
'use strict';
const Api=window.XDriveApi,R=window.XDRIVE_REAL||{},q=new URLSearchParams(location.search),jobId=q.get('job')||'';
const job=[...(R.bookings||[]),...(R.jobs||[])].find(x=>String(x.id)===String(jobId)||String(x.ref)===String(jobId));
const back=document.getElementById('passBack'),jobEl=document.getElementById('passJob'),badge=document.getElementById('passBadge'),required=document.getElementById('passRequired'),codeWrap=document.getElementById('passCodeWrap'),codeEl=document.getElementById('passCode'),meta=document.getElementById('passMeta'),activate=document.getElementById('passActivate'),rotate=document.getElementById('passRotate'),revoke=document.getElementById('passRevoke'),msg=document.getElementById('passMessage');
if(back&&job)back.href='booking-detail.html?job='+encodeURIComponent(job.id);
if(jobEl){
 const company=job?String(job.company||'').trim():'',cleanCompany=/not supplied/i.test(company)?'':company;
 const route=job?[job.pickupPostcode,job.deliveryPostcode].filter(Boolean).join(' → '):'';
 jobEl.textContent=job?[cleanCompany,(job.ref||job.id),route,(job.vehicle||'Assigned vehicle')].filter(Boolean).join(' · '):'Assigned job';
}
const key='xdrive-collection-pass-code:'+jobId;
const fmt=v=>v?new Date(v).toLocaleString('en-GB',{timeZone:'Europe/London',day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:false}):'Not recorded';
function localCode(){try{const v=JSON.parse(localStorage.getItem(key)||'{}');return v&&v.code?String(v.code):''}catch(_e){return''}}
function setLocal(code,expiresAt){if(code)localStorage.setItem(key,JSON.stringify({code,expiresAt,updatedAt:new Date().toISOString()}));else localStorage.removeItem(key)}
function render(state){
 const status=String(state.status||'not_activated').toLowerCase(),stored=localCode(),last4=String(state.codeLast4||'');
 badge.textContent=status.replace(/_/g,' ').toUpperCase();badge.className='badge '+(status==='verified'?'green':status==='active'?'orange':'');
 required.textContent=state.required===true?'Required for this job':'Optional unless requested by the posting company';
 let code=stored;if(code&&last4&&!code.endsWith(last4))code='';
 codeWrap.style.display=(status==='active'&&code)?'block':'none';if(codeEl)codeEl.textContent=code||'------';
 const bits=[];if(state.expiresAt)bits.push('Expires '+fmt(state.expiresAt));if(state.verifiedAt)bits.push('Verified '+fmt(state.verifiedAt));if(state.vehicleId)bits.push('Vehicle bound');if(status==='active'&&!code)bits.push('Code hidden after activation. Generate a new code if you need to display it again.');
 meta.textContent=bits.join(' · ');
 activate.style.display=['not_activated','revoked','expired'].includes(status)?'block':'none';rotate.style.display=status==='active'?'block':'none';revoke.style.display=status==='active'?'block':'none';
 if(status==='verified'){setLocal('',null);codeWrap.style.display='none';msg.textContent='Collection Pass verified. Secure collection check is complete.'}
}
function load(){
 msg.textContent='';const r=Api.get('/api/driver/mobile/jobs/'+encodeURIComponent(jobId)+'/collection-pass');if(!Api.ok(r)){msg.textContent=Api.error(r);return}render(r.body||{});
}
function mutate(action){
 const r=Api.post('/api/driver/mobile/jobs/'+encodeURIComponent(jobId)+'/collection-pass',{action});if(!Api.ok(r)){msg.textContent=Api.error(r);return}
 if((r.body||{}).code)setLocal(String(r.body.code),r.body.expiresAt||null);if(action==='revoke')setLocal('',null);render(r.body||{});msg.textContent=action==='revoke'?'Collection Pass revoked.':action==='rotate'?'New Collection Pass generated.':'Collection Pass activated.';
}
activate.onclick=()=>mutate('activate');rotate.onclick=()=>{if(confirm('Generate a new Collection Pass code? The previous code will stop working.'))mutate('rotate')};revoke.onclick=()=>{if(confirm('Revoke this Collection Pass?'))mutate('revoke')};
if(!jobId){msg.textContent='No assigned job was supplied.';activate.disabled=true}else load();
document.body.classList.add('live-ready');
})();