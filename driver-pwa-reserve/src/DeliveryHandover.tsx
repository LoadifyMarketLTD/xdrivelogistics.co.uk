import { useEffect, useRef, useState } from 'react';
import type { LiveJob } from './liveApi';

export type DeliveryHandoverDraft = {recipient:string;leftAt:string;items:string;condition:string;notes:string};

type Props = {
 mode?: 'delivery' | 'pod';
 job:LiveJob;
 value:DeliveryHandoverDraft;
 onChange:(value:DeliveryHandoverDraft)=>void;
 signature:string|null;
 onSignature:(image:string|null)=>void;
 onSaveSignature:()=>Promise<void>;
 photos:File[];
 onPhotos:(files:File[])=>void;
 onConfirm:()=>void;
 onBack:()=>void;
 busy:boolean;
};

function SignaturePad({value,onChange}:{value:string|null;onChange:(image:string|null)=>void}){
 const canvas=useRef<HTMLCanvasElement>(null);
 const active=useRef<number|null>(null);
 const painted=useRef(false);
 const [hasInk,setHasInk]=useState(Boolean(value));
 useEffect(()=>{const el=canvas.current; if(!el)return;const ctx=el.getContext('2d');if(!ctx)return;ctx.clearRect(0,0,el.width,el.height); if(!value){setHasInk(false);return;}const img=new Image();img.onload=()=>{ctx.clearRect(0,0,el.width,el.height);ctx.drawImage(img,0,0,el.width,el.height);};img.src=value;setHasInk(true);},[value]);
 const point=(e:React.PointerEvent<HTMLCanvasElement>)=>{const bounds=e.currentTarget.getBoundingClientRect();return {x:(e.clientX-bounds.left)*e.currentTarget.width/bounds.width,y:(e.clientY-bounds.top)*e.currentTarget.height/bounds.height};};
 const up=(e:React.PointerEvent<HTMLCanvasElement>)=>{
   if(active.current!==e.pointerId)return;
   active.current=null;
   if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);
   if(painted.current) {setHasInk(true);onChange(e.currentTarget.toDataURL('image/png'));}
 };
 return <div className="rv-delivery-signature">
  <canvas ref={canvas} width={900} height={260} aria-label="Recipient signature pad. Draw with your finger or stylus."
    onPointerDown={e=>{
      if(active.current!==null)return;
      active.current=e.pointerId;painted.current=false;
      e.currentTarget.setPointerCapture(e.pointerId);
      const ctx=e.currentTarget.getContext('2d');if(!ctx)return;
      const p=point(e);ctx.strokeStyle='#1c3952';ctx.lineWidth=3.3;ctx.lineJoin='round';ctx.lineCap='round';ctx.beginPath();ctx.moveTo(p.x,p.y);
    }}
    onPointerMove={e=>{
      if(active.current!==e.pointerId)return;
      const ctx=e.currentTarget.getContext('2d');if(!ctx)return;
      const p=point(e);ctx.lineTo(p.x,p.y);ctx.stroke();painted.current=true;
    }}
    onPointerUp={up} onPointerCancel={up}/>
  <div className="rv-delivery-signature-foot"><span>{hasInk?'Signature captured':'Sign inside the box'}</span><button type="button" onClick={()=>{const el=canvas.current;el?.getContext('2d')?.clearRect(0,0,el.width,el.height);painted.current=false;setHasInk(false);onChange(null);}}>Clear</button></div>
 </div>;
}

export default function DeliveryHandover({job,value,onChange,signature,onSignature,onSaveSignature,photos,onPhotos,onConfirm,onBack,busy,mode='delivery'}:Props){
 const [savingSignature,setSavingSignature]=useState(false);
 const [signatureSaved,setSignatureSaved]=useState(false);
 const [signatureError,setSignatureError]=useState('');
 const saveSignature=async()=>{if(!signature||savingSignature||busy)return;setSavingSignature(true);setSignatureError('');try{await onSaveSignature();setSignatureSaved(true);}catch(error){setSignatureSaved(false);setSignatureError(error instanceof Error?error.message:'Signature could not be saved.');}finally{setSavingSignature(false);}};
 const changeSignature=(next:string|null)=>{setSignatureSaved(false);setSignatureError('');onSignature(next);};
 const set=(key:keyof DeliveryHandoverDraft,text:string)=>onChange({...value,[key]:text});
 const requiredItems=Number.isInteger(Number(value.items))&&value.items!==''&&Number(value.items)>0;
 const ready=value.recipient.trim().length>=2&&Boolean(signature)&&requiredItems&&(photos.some(f=>f.type==='image/jpeg'||f.type==='image/png')||(mode==='pod'&&Boolean(job.deliveryPhotos?.length)));
 const photosCount=mode==='pod'?Math.max(photos.filter(f=>f.type==='image/jpeg'||f.type==='image/png').length,job.deliveryPhotos?.length||0):photos.filter(f=>f.type==='image/jpeg'||f.type==='image/png').length;
 const [fileError,setFileError]=useState('');
 const [cameraOpen,setCameraOpen]=useState(false);
 const [cameraBusy,setCameraBusy]=useState(false);
 const videoRef=useRef<HTMLVideoElement>(null);
 const streamRef=useRef<MediaStream|null>(null);
 const stopCamera=()=>{streamRef.current?.getTracks().forEach(track=>track.stop());streamRef.current=null;setCameraOpen(false);};
 useEffect(()=>()=>{streamRef.current?.getTracks().forEach(track=>track.stop());},[]);
 useEffect(()=>{if(cameraOpen&&videoRef.current&&streamRef.current){videoRef.current.srcObject=streamRef.current;void videoRef.current.play().catch(()=>setFileError('Camera preview could not start. Check camera permissions.'));}},[cameraOpen]);
 const openCamera=async()=>{
  setCameraBusy(true);setFileError('');
  try{
   if(!navigator.mediaDevices?.getUserMedia)throw new Error('Live camera unavailable. Open the PWA on localhost or HTTPS and permit camera access.');
   streamRef.current=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false});
   setCameraOpen(true);
  }catch(error){setFileError(error instanceof Error?error.message:'Camera could not be opened. Check permissions.');stopCamera();}
  finally{setCameraBusy(false);}
 };
 const capturePhoto=async()=>{
  const video=videoRef.current;
  if(!video?.videoWidth){setFileError('Camera is starting. Try again when the preview appears.');return;}
  const canvas=document.createElement('canvas');canvas.width=video.videoWidth;canvas.height=video.videoHeight;
  const ctx=canvas.getContext('2d');if(!ctx){setFileError('Camera capture is unavailable.');return;}
  ctx.drawImage(video,0,0);
  const blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,'image/jpeg',0.9));
  if(!blob){setFileError('Photo could not be captured.');return;}
  const timestamp=new Date().getTime();
  const file=new File([blob],'delivery-camera-'+timestamp+'.jpg',{type:'image/jpeg',lastModified:timestamp});
  addFiles([file]);stopCamera();
 };
 const docsCount=photos.filter(f=>f.type==='application/pdf').length;
 const addFiles=(incoming:FileList|File[]|null)=>{
   const candidates=Array.from(incoming||[]);
   const bad=candidates.find(file=>!['image/png','image/jpeg','application/pdf'].includes(file.type)||file.size<=0||file.size>10*1024*1024);
   if(bad){setFileError('Only PNG, JPEG or PDF up to 10 MB per file. Check: '+bad.name);return;}
   setFileError('');
   const all=[...photos,...candidates];
   const unique=all.filter((file,index)=>all.findIndex(other=>other.name===file.name&&other.size===file.size&&other.lastModified===file.lastModified)===index);
   onPhotos(unique);
 };
 return <section className="rv-delivery-page">
  <div className="rv-delivery-bar"><button type="button" className="rv-back" onClick={onBack}>← Bookings</button><span>{mode==='pod'?'08 / 11 · POD':'07 / 11 · DELIVERY'}</span></div>
  <div className="rv-delivery-title"><div><span className="rv-delivery-eyebrow">{mode === 'pod' ? 'DELIVERY EVIDENCE' : 'ON SITE DELIVERY'}</span><h1>{mode === 'pod' ? 'Complete Signed POD' : 'Complete Delivery'}</h1></div><span className="rv-delivery-state">{mode==='pod'?'Delivered':'On site'}</span></div>
  <div className="rv-delivery-route" aria-label="Collection and delivery">
    <div><span className="rv-collection-dot"/> <strong>{job.from}</strong><small>Collection · {job.pickup} {job.pickupDate}</small></div>
    <span className="rv-delivery-arrow" aria-hidden="true">→</span>
    <div><span className="rv-drop-dot"/> <strong>{job.to}</strong><small>Delivery · {job.delivery} {job.deliveryDate}</small></div>
  </div>
  <div className="rv-delivery-form">
    <div className="rv-delivery-section-head"><h2>Recipient handover</h2><span>* Required</span></div>
    <label className="rv-delivery-field rv-delivery-name"><span>Received By <em>*</em></span><input autoComplete="name" placeholder="Full name of recipient" value={value.recipient} onChange={e=>set('recipient',e.target.value)}/></label>
    <div className="rv-delivery-field"><span>Recipient signature <em>*</em></span><SignaturePad value={signature} onChange={changeSignature}/><button type="button" className={'rv-signature-save'+(signatureSaved?' rv-signature-saved':'')} disabled={!signature||savingSignature||busy||signatureSaved} onClick={()=>void saveSignature()}><span aria-hidden="true">✓</span> {savingSignature?'Saving signature…':signatureSaved?'Signature Saved ✓':'Save Signature'}</button>{signatureSaved&&<p role="status" className="rv-signature-confirm">Signature saved securely in the XDrive POD draft. Complete the remaining delivery details to finalise POD.</p>}{signatureError&&<p role="alert" className="rv-delivery-file-error">{signatureError}</p>}</div>
    <div className="rv-delivery-split">
      <label className="rv-delivery-field"><span>Left At</span><select value={value.leftAt} onChange={e=>set('leftAt',e.target.value)}>{['Goods Inwards','Reception','Warehouse','Loading Bay','Handed to recipient','Other'].map(v=><option key={v}>{v}</option>)}</select></label>
      <label className="rv-delivery-field"><span>Items <em>*</em></span><input inputMode="numeric" type="number" min="1" step="1" placeholder="Qty" value={value.items} onChange={e=>set('items',e.target.value)}/></label>
    </div>
    <label className="rv-delivery-field"><span>Delivery condition</span><select value={value.condition} onChange={e=>set('condition',e.target.value)}>{['Good condition','Damaged','Shortage','Refused'].map(v=><option key={v}>{v}</option>)}</select></label>
    <div className="rv-delivery-upload"><div className="rv-delivery-upload-title"><strong>Delivery evidence</strong><span>{photosCount} photos · {docsCount} documents</span></div>
      <div className="rv-delivery-attach-actions"><button type="button" className="rv-delivery-add" disabled={cameraBusy} onClick={()=>void openCamera()}><span aria-hidden="true">◉</span> {cameraBusy?'Opening camera...':'Take photo'}</button><label className="rv-delivery-add"><span aria-hidden="true">＋</span> Add files<input type="file" accept="image/png,image/jpeg,application/pdf" multiple onChange={e=>{addFiles(e.currentTarget.files);e.currentTarget.value='';}}/></label></div>
      {cameraOpen&&<section className="rv-camera-card" aria-label="Delivery camera"><div className="rv-camera-head"><strong>Delivery photo</strong><span>Capture a clear photograph as proof of delivery.</span></div><div className="rv-camera-preview-shell"><video ref={videoRef} autoPlay playsInline muted aria-label="Live delivery camera preview" className="rv-camera-preview"/></div><div className="rv-camera-actions"><button type="button" className="rv-primary rv-camera-action" onClick={()=>void capturePhoto()}><span aria-hidden="true">◉</span> Capture photo</button><button type="button" className="rv-outline rv-camera-action" onClick={stopCamera}>Cancel</button></div></section>}
      <p>{photosCount>0?`${photosCount} delivery photo${photosCount===1?' is':'s are'} recorded. Complete the recipient signature to save the official POD.`:'At least one delivery photo is required. Photos and documents will be retained with the signed POD.'}</p>{fileError&&<p className="rv-delivery-file-error" role="alert">{fileError}</p>}
      {photos.length>0&&<ul className="rv-delivery-files">{photos.map((file,i)=><li key={file.name+'-'+i}><span>{file.type==='application/pdf'?'PDF':'PHOTO'} · {file.name}</span><button type="button" aria-label={'Remove '+file.name} onClick={()=>onPhotos(photos.filter((_,index)=>index!==i))}>×</button></li>)}</ul>}
    </div>
    <label className="rv-delivery-field"><span>Driver notes <small>Optional</small></span><textarea rows={2} placeholder="Access, shortages or delivery instructions…" value={value.notes} onChange={e=>set('notes',e.target.value)}/></label>
  </div>
  <div className="rv-delivery-footer"><button type="button" className="rv-primary" disabled={busy||!ready} onClick={onConfirm}>{busy ? 'Saving...' : mode === 'pod' ? 'Save Signed POD' : 'Confirm Delivery'}</button><p>{ready?'Handover is ready. Your evidence will be verified by XDrive.':`Required: ${[!value.recipient.trim()&&'recipient name',!signature&&'recipient signature',!requiredItems&&'item count',photosCount===0&&'delivery photo'].filter(Boolean).join(', ')}.`}</p></div>
 </section>;
}
