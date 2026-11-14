import { useEffect, useRef, useState } from 'react';
import type { LiveJob } from './liveApi';
import { SignaturePad, type DeliveryHandoverDraft } from './DeliveryHandover';
import EvidenceImageEditor from './EvidenceImageEditor';

type Props = {
 mode?: 'delivery' | 'pod';
 job: LiveJob; value: DeliveryHandoverDraft;
 onChange: (next:DeliveryHandoverDraft) => void;
 signature: string|null; onSignature: (next:string|null) => void;
 onSaveSignature: () => Promise<void>; signatureVerified: boolean;
 photos: File[]; onPhotos: (files:File[]) => void;
 hardCopyAcknowledged:boolean; onHardCopyAcknowledged:(value:boolean)=>void;
 onConfirm: () => void; onBack: () => void; busy:boolean;
};
export default function BookingDeliveryForm({
 mode='delivery',job,value,onChange,signature,onSignature,onSaveSignature,signatureVerified,
 photos,onPhotos,hardCopyAcknowledged,onHardCopyAcknowledged,onConfirm,onBack,busy,
}:Props){
 const [picker,setPicker]=useState(false);
 const [fileError,setFileError]=useState('');
 const [editingPhoto,setEditingPhoto]=useState<File|null>(null);
 const [savingSignature,setSavingSignature]=useState(false);
 const [signatureError,setSignatureError]=useState('');
 const [cameraOpen,setCameraOpen]=useState(false);
 const [cameraBusy,setCameraBusy]=useState(false);
 const videoRef=useRef<HTMLVideoElement>(null);
 const streamRef=useRef<MediaStream|null>(null);
 const fileCamera=useRef<HTMLInputElement>(null);
 const fileImage=useRef<HTMLInputElement>(null);
 const fileDocument=useRef<HTMLInputElement>(null);
 const set=(key:keyof DeliveryHandoverDraft,text:string)=>onChange({...value,[key]:text});
 const requiredItems=value.items!==''&&Number.isInteger(Number(value.items))&&Number(value.items)>0;
 const ready=value.recipient.trim().length>=2&&Boolean(signature)&&signatureVerified&&requiredItems&&(!job.hardCopyPodRequired||hardCopyAcknowledged);
 const photosCount=photos.filter(f=>f.type==='image/png'||f.type==='image/jpeg').length+(mode==='pod'&&photos.length===0?(job.deliveryPhotos?.length||0):0);
 const documentsCount=photos.filter(f=>f.type==='application/pdf').length;
 const stopCamera=()=>{streamRef.current?.getTracks().forEach(track=>track.stop());streamRef.current=null;setCameraOpen(false);};
 useEffect(()=>()=>{streamRef.current?.getTracks().forEach(track=>track.stop());},[]);
 useEffect(()=>{if(cameraOpen&&videoRef.current&&streamRef.current){videoRef.current.srcObject=streamRef.current;void videoRef.current.play().catch(()=>setFileError('Camera preview could not start. Check camera permission.'));}},[cameraOpen]);
 const append=(incoming:File[]|FileList|null)=>{
  const selected=Array.from(incoming||[]);
  const invalid=selected.find(f=>!['image/jpeg','image/png','application/pdf'].includes(f.type)||f.size<=0||f.size>10*1024*1024);
  if(invalid){setFileError('Files must be JPEG, PNG or PDF, max 10 MB: '+invalid.name);return;}
  const all=[...photos,...selected];
  const unique=all.filter((file,index)=>all.findIndex(other=>file.name===other.name&&file.size===other.size&&file.lastModified===other.lastModified)===index);
  onPhotos(unique);
  setFileError('');setPicker(false);
 };
 const openCamera=async()=>{
  setCameraBusy(true);setFileError('');
  try{
   if(!navigator.mediaDevices?.getUserMedia){fileCamera.current?.click();return;}
   streamRef.current=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false});
   setCameraOpen(true);
  }catch(err){
   setFileError(err instanceof Error?err.message:'Camera unavailable; try the phone camera picker.');
   fileCamera.current?.click();
   stopCamera();
  }finally{setCameraBusy(false);}
 };
 const capturePhoto=async()=>{
  const video=videoRef.current;
  if(!video?.videoWidth){setFileError('Camera is starting. Please try again.');return;}
  const canvas=document.createElement('canvas');
  canvas.width=video.videoWidth;canvas.height=video.videoHeight;
  const ctx=canvas.getContext('2d');
  if(!ctx){setFileError('Camera capture unavailable.');return;}
  ctx.drawImage(video,0,0);
  const blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,'image/jpeg',0.88));
  if(!blob){setFileError('Could not capture photo.');return;}
  const stamp=Date.now();
  setEditingPhoto(new File([blob],'delivery-photo-'+stamp+'.jpg',{type:'image/jpeg',lastModified:stamp}));
  stopCamera();
 };
 const save=async()=>{
  if(!signature||signatureVerified||savingSignature||busy)return;
  setSavingSignature(true);setSignatureError('');
  try{await onSaveSignature();}
  catch(error){setSignatureError(error instanceof Error?error.message:'Could not save signature.');}
  finally{setSavingSignature(false);}
 };
return <div className="xb-delivery" aria-label="Proof of Delivery form">
  <section className="xb-collection-panel xb-delivery-header">
   <h3>Proof of Delivery (POD)</h3>
   <p className="xb-muted">Complete the signed proof of delivery. Confirmation finalises the booking only after the server verifies the POD.</p>
   <div className="xb-address"><strong>Delivery address</strong><p>{job.deliveryAddress||[job.to,job.toOutcode].filter(Boolean).join(', ')}</p></div>
  </section>
  <section className="xb-collection-panel">
   <h3>Proof of delivery</h3>
    <p className="xb-muted">Enter the recipient name, capture the signature, and attach any supporting delivery evidence before confirming the POD.</p>
   <label className="xb-form-field"><span>Received By (Full Name) *</span>
    <input autoComplete="name" value={value.recipient} placeholder="Full name of recipient" onChange={e=>set('recipient',e.target.value)}/></label>
   <div className="xb-signature-inline" aria-label="Recipient signature in POD">
    <h3>Recipient signature *</h3>
    <p className="xb-muted">Ask the recipient to sign directly below.</p>
    <SignaturePad value={signature} onChange={next=>{setSignatureError('');onSignature(next);}}/>
    <button type="button" className={'xb-signature-page-save'+(signatureVerified?' xb-saved':'')} disabled={!signature||savingSignature||busy||signatureVerified||value.recipient.trim().length<2} onClick={()=>void save()}>
      {savingSignature?'Saving signature...':signatureVerified?'Signature saved & verified':'Save Signature'}
    </button>
    {signatureVerified&&<div className="xb-signature-page-success" role="status">Signature saved and verified on XDrive.</div>}
    {signatureError&&<p role="alert" className="xb-error">{signatureError}</p>}
   </div>
<div className="xb-form-grid">
    <label className="xb-form-field"><span>Left At</span>
      <select value={value.leftAt} onChange={e=>set('leftAt',e.target.value)}>
       {['Goods Inwards','Receiving Department','Reception','Warehouse','Loading Bay','Handed to recipient','Other'].map(x=><option key={x}>{x}</option>)}
      </select></label>
    <label className="xb-form-field"><span>Number of items *</span>
      <input type="number" min="1" step="1" inputMode="numeric" value={value.items} onChange={e=>set('items',e.target.value)}/></label>
   </div>
   <label className="xb-form-field"><span>Delivery condition</span>
    <select value={value.condition} onChange={e=>set('condition',e.target.value)}>
     {['Good condition','Damaged','Shortage','Refused'].map(x=><option key={x}>{x}</option>)}
    </select></label>
   <label className="xb-form-field"><span>Driver notes (optional)</span>
    <textarea rows={3} value={value.notes} maxLength={2000} onChange={e=>set('notes',e.target.value)}/></label>
  </section>
  <section className="xb-collection-panel">
   <div className="xb-evidence-header">
    <div><h3>Delivery documents</h3><p>Photos and documents are optional unless requested by the customer.</p></div>
    <span>{photosCount} photos · {documentsCount} PDFs</span>
   </div>
   <button type="button" className="xb-add-document" aria-expanded={picker} onClick={()=>setPicker(v=>!v)}>＋ Add Document</button>
   {picker&&<div className="xb-evidence-choices">
    <button type="button" disabled={cameraBusy} onClick={()=>void openCamera()}>{cameraBusy?'Opening…':'Camera'}</button>
    <button type="button" onClick={()=>fileImage.current?.click()}>Image</button>
    <button type="button" onClick={()=>fileDocument.current?.click()}>Document</button>
   </div>}
   <input ref={fileCamera} type="file" accept="image/jpeg,image/png" capture="environment" style={{display:'none'}} tabIndex={-1}
     aria-label="Use phone camera" onChange={e=>{append(e.target.files);e.target.value='';}}/>
   <input ref={fileImage} type="file" accept="image/jpeg,image/png" multiple style={{display:'none'}} tabIndex={-1}
     aria-label="Add delivery images" onChange={e=>{append(e.target.files);e.target.value='';}}/>
   <input ref={fileDocument} type="file" accept="application/pdf,image/jpeg,image/png" multiple style={{display:'none'}} tabIndex={-1}
     aria-label="Add delivery documents" onChange={e=>{append(e.target.files);e.target.value='';}}/>
   {cameraOpen&&<div className="xb-camera"><video ref={videoRef} autoPlay playsInline muted aria-label="Live delivery camera preview"/>
    <div><button type="button" onClick={()=>void capturePhoto()}>Capture photo</button><button type="button" onClick={stopCamera}>Cancel</button></div>
   </div>}
   {fileError&&<p role="alert" className="xb-error">{fileError}</p>}
   {editingPhoto&&<EvidenceImageEditor file={editingPhoto} onCancel={()=>setEditingPhoto(null)}
     onSave={edited=>{onPhotos([...photos.filter(file=>file!==editingPhoto),edited]);setFileError('');setPicker(false);setEditingPhoto(null);}}/>}
   {photos.length>0&&<ul className="xb-file-list">{photos.map((file,i)=><li key={file.name+'-'+i}>
    <span>{file.name} <small>{Math.ceil(file.size/1024)} KB</small></span>
    {file.type.startsWith('image/')&&<button type="button" onClick={()=>setEditingPhoto(file)}>Rotate / Crop</button>}
    <button type="button" aria-label={'Remove '+file.name} onClick={()=>onPhotos(photos.filter((_,index)=>index!==i))}>Remove</button>
   </li>)}</ul>}
  </section>
  {job.hardCopyPodRequired&&<label className="xb-hard-copy-ack"><input type="checkbox" checked={hardCopyAcknowledged} onChange={event=>onHardCopyAcknowledged(event.target.checked)}/> I acknowledge the customer's hard-copy POD requirement.</label>}
  <div className="xb-form-actions">
   <button type="button" className="xb-secondary" onClick={onBack} disabled={busy}>Booking status</button>
   <button type="button" className="xb-primary" disabled={busy||!ready} onClick={onConfirm}>
    {busy?'Confirming POD...':'Confirm POD & Complete Delivery'}
   </button>
  </div>
  {!ready&&<p className="xb-evidence-note">Required before confirmation: recipient name, item count, a saved verified signature, and hard-copy acknowledgement if required.</p>}
 </div>;
}
