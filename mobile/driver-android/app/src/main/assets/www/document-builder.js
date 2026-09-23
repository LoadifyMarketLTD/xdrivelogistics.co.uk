(function(){
'use strict';
const Api=window.XDriveApi,Native=window.XDriveNative,R=window.XDRIVE_REAL||{},q=new URLSearchParams(location.search);
const jobId=q.get('job')||'',kind=q.get('kind')==='collection'?'collection':'delivery',stopId=q.get('stop')||'',returnUrl=q.get('return')||(kind==='collection'?'collection-handover.html?job='+encodeURIComponent(jobId)+(stopId?'&stop='+encodeURIComponent(stopId):''):'pod.html?job='+encodeURIComponent(jobId));
const job=[...(R.bookings||[]),...(R.jobs||[])].find(x=>String(x.id)===String(jobId));
const files=document.getElementById('builderFiles'),pages=document.getElementById('builderPages'),upload=document.getElementById('builderUpload'),msg=document.getElementById('builderMessage'),back=document.getElementById('builderBack'),ctx=document.getElementById('builderContext');
if(back)back.href=returnUrl;
if(ctx)ctx.textContent=(job?(job.company||'Assigned job')+' · '+(job.ref||job.id):'Assigned job')+' · '+(kind==='collection'?'Collection':'Delivery')+' documents';
let selected=[];
const key='xdrive-docbundle:'+jobId+':'+kind+':'+(stopId||'root');
const esc=v=>String(v||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fileBase64=f=>new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>{const s=String(r.result||'');resolve(s.includes(',')?s.split(',')[1]:s)};r.onerror=()=>reject(r.error);r.readAsDataURL(f)});
function render(){
 pages.innerHTML=selected.length?selected.map((f,i)=>'<article class="panel document-builder-page"><div><strong>Page '+(i+1)+'</strong><div class="details">'+esc(f.name)+' · '+Math.ceil(f.size/1024)+' KB</div></div><div class="document-builder-actions"><button type="button" class="secondary" data-up="'+i+'" '+(i===0?'disabled':'')+'>Up</button><button type="button" class="secondary" data-down="'+i+'" '+(i===selected.length-1?'disabled':'')+'>Down</button><button type="button" class="danger" data-remove="'+i+'">Remove</button></div></article>').join(''):'<div class="panel"><div class="details">No pages selected yet.</div></div>';
 pages.querySelectorAll('[data-up]').forEach(b=>b.onclick=()=>{const i=Number(b.dataset.up),x=selected[i-1];selected[i-1]=selected[i];selected[i]=x;render()});
 pages.querySelectorAll('[data-down]').forEach(b=>b.onclick=()=>{const i=Number(b.dataset.down),x=selected[i+1];selected[i+1]=selected[i];selected[i]=x;render()});
 pages.querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>{selected.splice(Number(b.dataset.remove),1);render()});
 upload.disabled=!selected.length;
}
files.onchange=()=>{selected=[...selected,...files.files].slice(0,10);files.value='';render()};
upload.onclick=async()=>{
 if(!jobId||!selected.length)return;
 upload.disabled=true;upload.textContent='Uploading pages...';msg.textContent='';
 try{
  const out=[];
  for(let i=0;i<selected.length;i++){
   const f=selected[i];if(f.size>10*1024*1024)throw new Error(f.name+' is larger than 10 MB.');
   const b=await fileBase64(f),mime=f.type||(/\.pdf$/i.test(f.name)?'application/pdf':'image/jpeg'),safe=((i+1)+'-'+f.name).replace(/[^A-Za-z0-9._-]/g,'-');
   const raw=kind==='collection'?Native.uploadJobHandoverEvidence(jobId,stopId,'documents',safe,mime,b):Native.uploadJobEvidence(jobId,'delivery','documents',safe,mime,b);
   const r=JSON.parse(raw||'{}');if(!Api.ok(r))throw new Error(Api.error(r));out.push({path:r.body.storagePath,name:f.name});
  }
  let prior={paths:[],names:[]};try{prior=JSON.parse(localStorage.getItem(key)||'{}')}catch(_e){}
  const paths=[...new Set([...(Array.isArray(prior.paths)?prior.paths:[]),...out.map(x=>x.path)])],names=[...(Array.isArray(prior.names)?prior.names:[]),...out.map(x=>x.name)];
  localStorage.setItem(key,JSON.stringify({paths,names,updatedAt:new Date().toISOString()}));
  msg.textContent=out.length+' page'+(out.length===1?'':'s')+' uploaded.';
  setTimeout(()=>location.replace(returnUrl),350);
 }catch(err){msg.textContent=err&&err.message?err.message:'Document pages could not be uploaded.';upload.disabled=false;upload.textContent='Upload document pages'}
};
render();document.body.classList.add('live-ready');
})();