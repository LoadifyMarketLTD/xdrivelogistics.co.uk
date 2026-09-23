(function(){
'use strict';
const Api=window.XDriveApi,Native=window.XDriveNative,R=window.XDRIVE_REAL||{};
const $=id=>document.getElementById(id),qs=new URLSearchParams(location.search);
const jobId=qs.get('job')||'',stopId=qs.get('stop')||'';
const job=(R.bookings||[]).find(x=>String(x.id)===jobId);
const stop=job&&stopId?(job.stops||[]).find(x=>String(x.id)===stopId):null;
const title=$('handoverTitle'),context=$('handoverContext'),route=$('handoverRoute'),save=$('handoverSave'),msg=$('handoverMessage'),vehicleEl=$('handoverVehicle'),equipmentEl=$('handoverEquipment');
const items=$('handoverItems'),packaging=$('handoverPackaging'),weight=$('handoverWeight'),eta=$('handoverEta'),notes=$('handoverNotes');
const photos=$('handoverPhotos'),documents=$('handoverDocuments'),photoInfo=$('handoverPhotoInfo'),documentInfo=$('handoverDocumentInfo');
const previous=(stop&&stop.handover)||(job&&job.collectionHandover)||{};
const parseNative=raw=>{try{return JSON.parse(raw||'{}')}catch{return{status:500,body:{error:'Invalid native response.'}}}};
const fileBase64=file=>new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>{const s=String(r.result||'');resolve(s.includes(',')?s.split(',')[1]:s)};r.onerror=()=>reject(r.error);r.readAsDataURL(file)});
function numeric(value){if(value===''||value==null)return null;const n=Number(value);return Number.isFinite(n)?n:null}
function fail(text){msg.textContent=String(text||'Handover could not be saved.');save.disabled=false;save.textContent=stop?'Save Handover & Complete Stop':'Save Handover & Mark Loaded'}
if(!Api||!Native||!job){context.textContent='Handover unavailable';route.textContent='Return to Bookings and reopen the assigned job.';save.disabled=true;document.body.classList.add('live-ready');return}
if(stop){const idx=Math.max(1,(job.stops||[]).findIndex(x=>String(x.id)===String(stop.id))+1),kind=/delivery/i.test(String(stop.type||''))?'Delivery':'Collection';title.textContent=kind+' Handover';context.textContent=stop.company||(kind+' '+idx);route.textContent=stop.address||'';save.textContent='Save Handover & Complete Stop'}
else{context.textContent=(job.company||'Assigned job')+' · '+(job.ref||'');route.textContent=(job.pickupPostcode||job.pickupLocation||'Pickup')+' → '+(job.deliveryPostcode||job.deliveryLocation||'Delivery')}
items.value=previous.itemCount??job.itemCount??job.pallets??'';
packaging.value=previous.packaging??job.packaging??'';
weight.value=previous.weightKg??job.weightKg??job.weight??'';
eta.value=previous.etaMinutes??'';
notes.value=previous.notes??job.collectionNotes??'';
vehicleEl.textContent=String(job.vehicle||job.requestedVehicleLabel||job.vehicleRequirement||job.vehicleType||'Not supplied');
const equipmentBits=[];
if(job.tailLift===true)equipmentBits.push('Tail Lift');
if(job.forkliftAvailable===true)equipmentBits.push('Forklift');
if(job.handballRequired===true)equipmentBits.push('Handball');
if(job.adr===true)equipmentBits.push('ADR');
if(job.temperatureControlled===true)equipmentBits.push('Temperature controlled');
if(job.bodyType)equipmentBits.push(String(job.bodyType));
if(Array.isArray(job.requirementFlags))job.requirementFlags.map(String).filter(Boolean).forEach(v=>{if(!equipmentBits.includes(v))equipmentBits.push(v)});
equipmentEl.textContent=equipmentBits.length?equipmentBits.join(' | '):'Not supplied';
const existingPhotos=Array.isArray(previous.photoPaths)?previous.photoPaths.slice():[];
const existingDocuments=Array.isArray(previous.documentPaths)?previous.documentPaths.slice():[];
const builderKey='xdrive-docbundle:'+jobId+':collection:'+(stopId||'root');
let builtDocuments=[];try{const b=JSON.parse(localStorage.getItem(builderKey)||'{}');if(Array.isArray(b.paths))builtDocuments=b.paths.filter(Boolean)}catch(_e){}
const builder=$('handoverDocumentBuilder'),builtInfo=$('handoverBuiltDocuments');
if(builder)builder.href='document-builder.html?job='+encodeURIComponent(jobId)+'&kind=collection'+(stopId?'&stop='+encodeURIComponent(stopId):'')+'&return='+encodeURIComponent('collection-handover.html?job='+jobId+(stopId?'&stop='+stopId:''));
if(builtInfo)builtInfo.textContent=builtDocuments.length?(builtDocuments.length+' builder page'+(builtDocuments.length===1?'':'s')+' ready.'):'No builder document pages added.';
photoInfo.textContent=existingPhotos.length?existingPhotos.length+' existing photo(s). Add more or keep these.':'At least one photo is required.';
documentInfo.textContent=existingDocuments.length?existingDocuments.length+' existing document(s).':'PDF, JPEG or PNG.';
photos.onchange=()=>{photoInfo.textContent=(photos.files&&photos.files.length?photos.files.length:0)+' new photo(s) selected.'};
documents.onchange=()=>{documentInfo.textContent=(documents.files&&documents.files.length?documents.files.length:0)+' new document(s) selected.'};
const photoButton=document.querySelector('label[for="handoverPhotos"]');
const documentButton=document.querySelector('label[for="handoverDocuments"]');
if(photoButton)photoButton.addEventListener('click',e=>{e.preventDefault();photos.click()});
if(documentButton)documentButton.addEventListener('click',e=>{e.preventDefault();documents.click()});
if(builder)builder.addEventListener('click',e=>{e.preventDefault();if(builder.href)location.href=builder.href});
const terminal=['delivered','completed','cancelled','void'].includes(String(job.status||job.currentStatus||job.lifecycleStatus||'').toLowerCase());
if(terminal){[items,packaging,weight,eta,notes,photos,documents].forEach(el=>{if(el)el.disabled=true});save.disabled=true;save.textContent='Completed';msg.textContent='This job is complete. Handover is read-only.'}
document.body.classList.add('live-ready');
async function uploadSelected(fileList,category){
 const out=[];
 for(const file of [...fileList]){
  const base64=await fileBase64(file);
  const raw=Native.uploadJobHandoverEvidence(jobId,stopId,category,file.name,file.type||'application/octet-stream',base64);
  const result=parseNative(raw);
  if(!Api.ok(result))throw new Error(Api.error(result)||'Evidence upload failed.');
  if(result.body&&result.body.storagePath)out.push(result.body.storagePath);
 }
 return out;
}

save.onclick=async()=>{
 msg.textContent='';save.disabled=true;save.textContent='Saving handover...';
 try{
  const newPhotos=await uploadSelected(photos.files||[],'photos');
  const newDocuments=await uploadSelected(documents.files||[],'documents');
  const photoPaths=[...new Set([...existingPhotos,...newPhotos])];
  const documentPaths=[...new Set([...existingDocuments,...builtDocuments,...newDocuments])];
  if(!photoPaths.length)throw new Error('At least one collection photo is required.');
  const handover={itemCount:numeric(items.value),packaging:packaging.value.trim(),weightKg:numeric(weight.value),etaMinutes:numeric(eta.value),notes:notes.value.trim(),photoPaths,documentPaths};
  if(stop){
   const r=Api.post('/api/driver/mobile/jobs/'+encodeURIComponent(jobId)+'/stop-status',{stop_id:stopId,status:'completed',handover});
   if(!Api.ok(r))throw new Error(Api.error(r));
  }else{
   const h=Api.post('/api/driver/mobile/jobs/'+encodeURIComponent(jobId)+'/handover',handover);
   if(!Api.ok(h))throw new Error(Api.error(h));
   const loaded=Api.post('/api/driver/mobile/jobs/'+encodeURIComponent(jobId)+'/loaded',{});
   if(!Api.ok(loaded))throw new Error(Api.error(loaded));
  }
  localStorage.removeItem(builderKey);builtDocuments=[];
  msg.textContent='Handover saved.';
  location.href='booking-detail.html?job='+encodeURIComponent(jobId);
 }catch(error){fail(error&&error.message?error.message:error)}
};
})();
