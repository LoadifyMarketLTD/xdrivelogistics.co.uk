import { useEffect, useRef, useState } from 'react';
import type { LiveJob } from './liveApi';

export type DeliveryHandoverDraft = {
  recipient:string;
  leftAt:string;
  items:string;
  condition:string;
  notes:string;
  deliveredOn:string;
  deliveredTime:string;
};

const deliveryOutcomes=[
  'Completed Delivery',
  'Incorrect Goods',
  'Incorrect Address',
  'Job Cancelled',
  'Delivery Refused',
  'No Unloading Facilities',
  'Damaged Goods',
] as const;

const readableAddress=(value:string)=>{
 const seen=new Set<string>();
 return String(value||'').split(',').map(part=>part.trim()).filter(part=>{
   if(!part||part.toUpperCase()==='GB')return false;
   const key=part.toUpperCase().replace(/\s+/g,' ');
   if(seen.has(key))return false;
   seen.add(key);return true;
 }).join(', ');
};
type Props = {
 mode?: 'delivery' | 'pod' | 'arrival';
 job:LiveJob;
 value:DeliveryHandoverDraft;
 onChange:(value:DeliveryHandoverDraft)=>void;
 signature:string|null;
 onSignature:(image:string|null)=>void;
 onSaveSignature:()=>Promise<void>;
 signatureVerified:boolean;
 photos:File[];
 onPhotos:(files:File[])=>void;
 onConfirm:()=>void;
 onBack:()=>void;
 onUndo?:()=>void;
 busy:boolean;
 hardCopyRequired?:boolean;
 hardCopyAcknowledged?:boolean;
 onHardCopyAcknowledged?:(value:boolean)=>void;
};

function SignaturePad({value,onChange}:{value:string|null;onChange:(image:string|null)=>void}){
 const canvas=useRef<HTMLCanvasElement>(null);
 const active=useRef<number|null>(null);
 const painted=useRef(false);
 const [hasInk,setHasInk]=useState(Boolean(value));
 useEffect(()=>{const el=canvas.current;if(!el)return;const ctx=el.getContext('2d');if(!ctx)return;ctx.clearRect(0,0,el.width,el.height);if(!value){setHasInk(false);return;}const img=new Image();img.onload=()=>{ctx.clearRect(0,0,el.width,el.height);ctx.drawImage(img,0,0,el.width,el.height);};img.src=value;setHasInk(true);},[value]);
 const point=(e:React.PointerEvent<HTMLCanvasElement>)=>{const bounds=e.currentTarget.getBoundingClientRect();return{x:(e.clientX-bounds.left)*e.currentTarget.width/bounds.width,y:(e.clientY-bounds.top)*e.currentTarget.height/bounds.height};};
 const up=(e:React.PointerEvent<HTMLCanvasElement>)=>{if(active.current!==e.pointerId)return;active.current=null;if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);if(painted.current){setHasInk(true);onChange(e.currentTarget.toDataURL('image/png'));}};
 return <div className="rv-delivery-signature">
  <canvas ref={canvas} width={900} height={260} aria-label="Recipient signature pad. Draw with your finger or stylus."
    onPointerDown={e=>{if(active.current!==null)return;active.current=e.pointerId;painted.current=false;e.currentTarget.setPointerCapture(e.pointerId);const ctx=e.currentTarget.getContext('2d');if(!ctx)return;const p=point(e);ctx.strokeStyle='#1c3952';ctx.lineWidth=3.3;ctx.lineJoin='round';ctx.lineCap='round';ctx.beginPath();ctx.moveTo(p.x,p.y);}}
    onPointerMove={e=>{if(active.current!==e.pointerId)return;const ctx=e.currentTarget.getContext('2d');if(!ctx)return;const p=point(e);ctx.lineTo(p.x,p.y);ctx.stroke();painted.current=true;}}
    onPointerUp={up} onPointerCancel={up}/>
  <div className="rv-delivery-signature-foot"><span>{hasInk?'Signature captured':'Sign inside the box'}</span><button type="button" onClick={()=>{const el=canvas.current;el?.getContext('2d')?.clearRect(0,0,el.width,el.height);painted.current=false;setHasInk(false);onChange(null);}}>Clear</button></div>
 </div>;
}

export default function DeliveryHandover({job,value,onChange,signature,onSignature,onSaveSignature,signatureVerified,photos,onPhotos,onConfirm,onBack,onUndo,busy,mode='delivery',hardCopyRequired=false,hardCopyAcknowledged=false,onHardCopyAcknowledged}:Props){
 const [signatureOpen,setSignatureOpen]=useState(false);
 const [savingSignature,setSavingSignature]=useState(false);
 const [signatureError,setSignatureError]=useState('');
 const set=(key:keyof DeliveryHandoverDraft,text:string)=>onChange({...value,[key]:text});
 const requiredItems=Number.isInteger(Number(value.items))&&value.items!==''&&Number(value.items)>0;
 const hasDeliveryPhoto=photos.some(file=>file.type==='image/jpeg'||file.type==='image/png')||Boolean(job.deliveryPhotos?.length);
 const docsCount=photos.filter(f=>f.type==='application/pdf').length;
 const photosCount=(job.deliveryPhotos?.length||0)+photos.filter(f=>f.type==='image/jpeg'||f.type==='image/png').length;
 const successful=value.condition==='Completed Delivery';
 const cancelled=value.condition==='Job Cancelled';
 const photoRequiredForException=['Damaged Goods','Incorrect Goods'].includes(value.condition);
 const exceptionReady=!successful&&!cancelled&&value.notes.trim().length>=3&&(!photoRequiredForException||hasDeliveryPhoto);
 const successfulReady=value.recipient.trim().length>=2&&Boolean(signature)&&signatureVerified&&requiredItems&&Boolean(value.leftAt.trim())&&/^\d{4}-\d{2}-\d{2}$/.test(value.deliveredOn)&&/^([01]\d|2[0-3]):[0-5]\d$/.test(value.deliveredTime)&&hasDeliveryPhoto&&photosCount<=10&&(!hardCopyRequired||hardCopyAcknowledged);
 const ready=cancelled||exceptionReady||successfulReady;
 const [fileError,setFileError]=useState('');
 const [cameraOpen,setCameraOpen]=useState(false);
 const [cameraBusy,setCameraBusy]=useState(false);
 const videoRef=useRef<HTMLVideoElement>(null);
 const streamRef=useRef<MediaStream|null>(null);

 const saveSignature=async()=>{if(!signature||savingSignature||busy||signatureVerified)return;setSavingSignature(true);setSignatureError('');try{await onSaveSignature();}catch(error){setSignatureError(error instanceof Error?error.message:'Signature could not be saved.');}finally{setSavingSignature(false);}};
 const changeSignature=(next:string|null)=>{setSignatureError('');onSignature(next);};
 const stopCamera=()=>{streamRef.current?.getTracks().forEach(track=>track.stop());streamRef.current=null;setCameraOpen(false);};
 useEffect(()=>()=>{streamRef.current?.getTracks().forEach(track=>track.stop());},[]);
 useEffect(()=>{if(cameraOpen&&videoRef.current&&streamRef.current){videoRef.current.srcObject=streamRef.current;void videoRef.current.play().catch(()=>setFileError('Camera preview could not start. Check camera permissions.'));}},[cameraOpen]);
 const openCamera=async()=>{setCameraBusy(true);setFileError('');try{if(!navigator.mediaDevices?.getUserMedia)throw new Error('Live camera unavailable. Open the PWA on localhost or HTTPS and permit camera access.');streamRef.current=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false});setCameraOpen(true);}catch(error){setFileError(error instanceof Error?error.message:'Camera could not be opened. Check permissions.');stopCamera();}finally{setCameraBusy(false);}};
 const capturePhoto=async()=>{const video=videoRef.current;if(!video?.videoWidth){setFileError('Camera is starting. Try again when the preview appears.');return;}const canvas=document.createElement('canvas');canvas.width=video.videoWidth;canvas.height=video.videoHeight;const ctx=canvas.getContext('2d');if(!ctx){setFileError('Camera capture is unavailable.');return;}ctx.drawImage(video,0,0);const blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,'image/jpeg',0.9));if(!blob){setFileError('Photo could not be captured.');return;}const timestamp=Date.now();addFiles([new File([blob],'delivery-camera-'+timestamp+'.jpg',{type:'image/jpeg',lastModified:timestamp})]);stopCamera();};
 const addFiles=(incoming:FileList|File[]|null)=>{
   const candidates=Array.from(incoming||[]);
   const bad=candidates.find(file=>!['image/png','image/jpeg','application/pdf'].includes(file.type)||file.size<=0||file.size>10*1024*1024);
   if(bad){setFileError('Only PNG, JPEG or PDF up to 10 MB per file. Check: '+bad.name);return;}
   setFileError('');
   const all=[...photos,...candidates];
   const unique=all.filter((file,index)=>all.findIndex(other=>other.name===file.name&&other.size===file.size&&other.lastModified===file.lastModified)===index);
   const imageCount=unique.filter(file=>file.type==='image/jpeg'||file.type==='image/png').length;
   const documentCount=unique.filter(file=>file.type==='application/pdf').length;
   if(imageCount+(job.deliveryPhotos?.length||0)>10||documentCount>10){setFileError('Maximum 10 delivery images (including saved job photos) and 10 documents per POD.');return;}
   onPhotos(unique);
 };

 if(mode==='arrival') return <section className="rv-delivery-page">
  <div className="rv-delivery-bar"><button type="button" className="rv-back" onClick={onBack}>Back to Bookings</button><span>DELIVERY ARRIVAL</span>{onUndo&&<button type="button" className="rv-undo-action" disabled={busy} onClick={onUndo}>Undo Last Status</button>}</div>
  <div className="rv-delivery-title"><div><span className="rv-delivery-eyebrow">ON SITE DELIVERY</span><h1>Confirm Arrival</h1></div><span className="rv-delivery-state">On site</span></div>
  <div className="rv-delivery-route"><div><strong>{readableAddress(job.from)}</strong></div><div><strong>{readableAddress(job.to)}</strong></div></div>
  <div className="rv-delivery-form"><h2>Arrival confirmation</h2><p>Confirm you have arrived. XDrive saves the time automatically. POD, exceptions or cancellation are recorded only after arrival is confirmed.</p></div>
  <div className="rv-delivery-footer"><button type="button" className="rv-primary" disabled={busy} onClick={onConfirm}>{busy?'Confirming arrival...':'Confirm On Site Delivery'}</button></div>
 </section>;

 return <section className="rv-delivery-page">
  <div className="rv-delivery-bar"><button type="button" className="rv-back" onClick={onBack}>Back to Bookings</button><span>{mode==='pod'?'POD RECOVERY':'FINAL DELIVERY'}</span>{onUndo&&<button type="button" className="rv-undo-action" disabled={busy} onClick={onUndo}>Undo Last Status</button>}</div>
  <div className="rv-delivery-title"><div><span className="rv-delivery-eyebrow">{mode==='pod'?'DELIVERY EVIDENCE':'ON SITE DELIVERY'}</span><h1>{mode==='pod'?'Complete Signed POD':'Delivered / POD'}</h1></div><span className="rv-delivery-state">{successful?'POD':cancelled?'Cancelled':'Exception'}</span></div>
  <div className="rv-delivery-route" aria-label="Collection and delivery">
    <div><span className="rv-collection-dot"/> <strong>{readableAddress(job.from)}</strong><small>Collection: {job.pickup} {job.pickupDate}</small></div>
    <span className="rv-delivery-arrow" aria-hidden="true">to</span>
    <div><span className="rv-drop-dot"/> <strong>{readableAddress(job.to)}</strong><small>Delivery: {job.delivery} {job.deliveryDate}</small></div>
  </div>
  <div className="rv-delivery-form">
    <div className="rv-delivery-section-head"><h2>Delivery outcome</h2><span>* Required</span></div>
    <label className="rv-delivery-field"><span>Delivery Status <em>*</em></span><select value={value.condition} onChange={e=>set('condition',e.target.value)}>{deliveryOutcomes.map(v=><option key={v}>{v}</option>)}</select></label>

    {successful&&<>
      <label className="rv-delivery-field rv-delivery-name"><span>Received By (Full Name) <em>*</em></span><input autoComplete="name" placeholder="Full name of recipient" value={value.recipient} onChange={e=>set('recipient',e.target.value)}/></label>
      <div className="rv-delivery-field"><span>Recipient signature <em>*</em></span><button type="button" className="rv-primary rv-wide" onClick={()=>setSignatureOpen(true)}>{signature?"Edit Signature":"Add Signature"}</button>{signatureOpen&&<div className="rv-signature-modal" role="dialog" aria-modal="true" aria-label="Recipient signature"><h2>Recipient signature</h2><p>{value.recipient}</p><SignaturePad value={signature} onChange={changeSignature}/><button type="button" className="rv-primary rv-wide" disabled={!signature} onClick={()=>setSignatureOpen(false)}>Done</button><button type="button" className="rv-outline rv-wide" onClick={()=>setSignatureOpen(false)}>Close</button></div>}<button type="button" className={'rv-signature-save'+(signatureVerified?' rv-signature-saved':'')} disabled={!signature||savingSignature||busy||signatureVerified} onClick={()=>void saveSignature()}>{savingSignature?'Saving signature...':signatureVerified?'Signature Saved':'Save Signature'}</button>{signatureVerified&&<p role="status" className="rv-signature-confirm">Signature saved securely in the XDrive POD draft.</p>}{signatureError&&<p role="alert" className="rv-delivery-file-error">{signatureError}</p>}</div>
      <div className="rv-delivery-split"><label className="rv-delivery-field"><span>Delivered On <em>*</em></span><input required type="date" value={value.deliveredOn} max={new Date().toISOString().slice(0,10)} onChange={e=>set('deliveredOn',e.target.value)}/></label><label className="rv-delivery-field"><span>Delivery Time <em>*</em></span><input required type="time" value={value.deliveredTime} onChange={e=>set('deliveredTime',e.target.value)}/></label></div>
      <div className="rv-delivery-split">
        <label className="rv-delivery-field"><span>Left At <em>*</em></span><select required value={value.leftAt} onChange={e=>set('leftAt',e.target.value)}>{['Receiving Department','Goods Inwards','Reception','Warehouse','Loading Bay','Delivery Office','Handed to recipient','Other'].map(v=><option key={v}>{v}</option>)}</select></label>
        <label className="rv-delivery-field"><span>Number of Items <em>*</em></span><input inputMode="numeric" type="number" min="1" step="1" placeholder="Qty" value={value.items} onChange={e=>set('items',e.target.value)}/></label>
      </div>
    </>}

    {!cancelled&&<div className="rv-delivery-upload"><div className="rv-delivery-upload-title"><strong>{successful?'Delivery evidence':'Exception evidence'}</strong><span>{photosCount} photos / {docsCount} documents</span></div>
      <div className="rv-delivery-attach-actions"><button type="button" className="rv-delivery-add" disabled={cameraBusy} onClick={()=>void openCamera()}>{cameraBusy?'Opening camera...':'Add POD / Take photo'}</button><label className="rv-delivery-add">Add More<input type="file" accept="image/png,image/jpeg,application/pdf" multiple onChange={e=>{addFiles(e.currentTarget.files);e.currentTarget.value='';}}/></label></div>
      {cameraOpen&&<section className="rv-camera-card" aria-label="Delivery camera"><div className="rv-camera-head"><strong>{successful?'Delivery photo':'Exception photo'}</strong></div><div className="rv-camera-preview-shell"><video ref={videoRef} autoPlay playsInline muted aria-label="Live delivery camera preview" className="rv-camera-preview"/></div><div className="rv-camera-actions"><button type="button" className="rv-primary rv-camera-action" onClick={()=>void capturePhoto()}>Capture Photo</button><button type="button" className="rv-outline rv-camera-action" onClick={stopCamera}>Cancel</button></div></section>}
      <p>{successful?'At least one delivery photo is required before Delivered.':photoRequiredForException?'Photographic evidence is required for this exception.':'Attach evidence when available.'}</p>{fileError&&<p className="rv-delivery-file-error" role="alert">{fileError}</p>}
      {photos.length>0&&<ul className="rv-delivery-files">{photos.map((file,i)=><li key={file.name+'-'+i}><span>{file.type==='application/pdf'?'PDF':'PHOTO'}: {file.name}</span><button type="button" aria-label={'Remove '+file.name} onClick={()=>onPhotos(photos.filter((_,index)=>index!==i))}>Remove</button></li>)}</ul>}
    </div>}

    {!cancelled&&<label className="rv-delivery-field"><span>Driver notes <small>{successful?'Optional':'Required for exception'}</small></span><textarea rows={2} placeholder="Access, shortages, cancellation or delivery instructions" value={value.notes} onChange={e=>set('notes',e.target.value)}/></label>}
  </div>
  {successful&&hardCopyRequired&&<label className="rv-hard-copy-ack"><input type="checkbox" checked={hardCopyAcknowledged} onChange={e=>onHardCopyAcknowledged?.(e.target.checked)}/> I acknowledge that the required paper POD must be retained and handed over as instructed.</label>}
  <div className="rv-delivery-footer"><button type="button" className="rv-primary" disabled={busy||!ready} onClick={onConfirm}>{busy?'Saving...':successful?'Send POD':cancelled?'Record Job / Stop Cancellation':'Report Delivery Exception'}</button><p>{successful&&!ready?'Recipient, signature, date/time, Left At, item count and at least one delivery photo are required.':!successful&&!cancelled&&!ready?'Add a short explanation and required evidence for this exception.':cancelled?'The cancellation form records who instructed it and what happens to any goods in custody.':'Outcome ready to record.'}</p></div>
 </section>;
}
