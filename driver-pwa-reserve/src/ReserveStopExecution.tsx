import { useEffect, useState } from 'react';
import type { LiveJob, LiveSession, LiveStop } from './liveApi';
import { driverPost, renewSession } from './liveApi';
import {SignaturePad} from './DeliveryHandover';
import {packagingOptions,localMinute,latestRecordedMinute,availableTimes,validActualTime} from './bookingFieldOptions';

type Props={
  job:LiveJob;
  stop:LiveStop;
  session:LiveSession|null;
  localTransition?:(status:LiveStop["status"],handover?:LiveStop["handover"],files?:File[],signature?:File|null)=>Promise<void>;
  onSession:(session:LiveSession)=>void;
  onRefresh:(token:string)=>Promise<void>;
  onBack:()=>void;
  onParentTransition?:()=>void;
  parentBusy?:boolean;
};

type StopDraft = { outcome:string; recipient:string; leftAt:string; items:string; weight:string; packaging:string; deliveredOn:string; notes:string; files:File[]; signature:File|null; signatureImage:string|null };
// In-memory only: preserve unfinished stop forms across Back navigation.
// Never persist POD photos, signatures or recipient names in browser storage.
const stopDrafts = new Map<string,StopDraft>();
export function clearReserveStopDrafts(){stopDrafts.clear();}
function stopDraftKey(jobId:string,stopId:string){return jobId+':'+stopId;}
export function signaturePngFile(image:string):File {
 const match=/^data:image\/png;base64,([a-z0-9+/]+={0,2})$/i.exec(image);
 if(!match)throw new Error('Invalid signature image');
 const decoded=atob(match[1]);
 const bytes=new Uint8Array(decoded.length);
 for(let index=0;index<decoded.length;index++)bytes[index]=decoded.charCodeAt(index);
 if(bytes.length===0||bytes.length>10*1024*1024)throw new Error('Invalid signature size');
 return new File([bytes],'stop-signature.png',{type:'image/png'});
}
const driverApi=import.meta.env.PROD?'/api/driver':'/xdrive-api/driver';
const outcomes=['Completed Delivery','Incorrect Goods','Incorrect Address','Delivery Refused','No Unloading Facilities','Damaged Goods'] as const;
const pad=(n:number)=>String(n).padStart(2,'0');
const localNow=()=>{const d=new Date();return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;};

function StopSignature({recipient,onSave,initialImage,onImageChange,initialSaved}:{recipient:string;onSave:(file:File|null)=>void;initialImage:string|null;onImageChange:(image:string|null)=>void;initialSaved:boolean}){
 const [open,setOpen]=useState(false),[image,setImage]=useState<string|null>(initialImage),[saved,setSaved]=useState(initialSaved);
 const [error,setError]=useState('');
 const change=(next:string|null)=>{setImage(next);onImageChange(next);setSaved(false);setError('');onSave(null);};
 const save=async()=>{if(!image)return;try{onSave(signaturePngFile(image));setSaved(true);setError('');}catch{setError('Signature could not be prepared. Try again.');onSave(null);}};
 return <div className="rv-delivery-field"><span>Recipient signature *</span><button type="button" className="rv-primary rv-wide" onClick={()=>setOpen(true)}>{image?'Edit Signature':'Add Signature'}</button>{open&&<div className="rv-signature-modal" role="dialog" aria-modal="true" aria-label="Recipient signature"><h2>Recipient signature</h2><p>{recipient}</p><SignaturePad value={image} onChange={change}/><button type="button" className="rv-primary rv-wide" disabled={!image} onClick={()=>setOpen(false)}>Done</button><button type="button" className="rv-outline rv-wide" onClick={()=>setOpen(false)}>Close</button></div>}<button type="button" className={'rv-signature-save'+(saved?' rv-signature-saved':'')} disabled={!image||saved} onClick={()=>void save()}>{saved?'Signature Saved':'Save Signature'}</button>{saved&&<p role="status" className="rv-signature-confirm">Signature prepared. It will be uploaded with stop evidence when you complete the stop.</p>}{error&&<p role="alert">{error}</p>}</div>;
}
export default function ReserveStopExecution({job,stop,session,onSession,onRefresh,onBack,localTransition,onParentTransition,parentBusy=false}:Props){
  const draftKey=stopDraftKey(job.id,stop.id);
  const restored=stopDrafts.get(draftKey);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [outcome,setOutcome]=useState(restored?.outcome==='Job Cancelled'?'Completed Delivery':(restored?.outcome??'Completed Delivery'));
  const [recipient,setRecipient]=useState(restored?.recipient??stop.handover?.recipientName??'');
  const [leftAt,setLeftAt]=useState(restored?.leftAt??stop.handover?.leftAt??'Goods Inwards');
  const [items,setItems]=useState(restored?.items??String(stop.handover?.itemCount??(job.routeStops&&job.routeStops.length>2?undefined:job.items)??''));
  const [weight,setWeight]=useState(restored?.weight??String(stop.handover?.weightKg??(job.routeStops&&job.routeStops.length>2?undefined:job.weight)??''));
  const [packaging,setPackaging]=useState(restored?.packaging??stop.handover?.packaging??'');
  const [deliveredOn,setDeliveredOn]=useState(restored?.deliveredOn??localNow());
  const earliestDelivery=latestRecordedMinute([stop.arrivedAt,...(job.routeStops||[]).filter(s=>s.sequence<stop.sequence).map(s=>s.completedAt)]);
  const [notes,setNotes]=useState(restored?.notes??stop.handover?.notes??'');
  const [files,setFiles]=useState<File[]>(restored?.files??[]);
  const [signature,setSignature]=useState<File|null>(restored?.signature??null);
  const [signatureImage,setSignatureImage]=useState<string|null>(restored?.signatureImage??null);
  useEffect(()=>{stopDrafts.set(draftKey,{outcome,recipient,leftAt,items,weight,packaging,deliveredOn,notes,files,signature,signatureImage});},[draftKey,outcome,recipient,leftAt,items,weight,packaging,deliveredOn,notes,files,signature,signatureImage]);
  const returnStop=stop.handover?.stopKind==='return';
  const isFinalTestDelivery=job.isTest===true&&stop.type==='delivery'&&job.routeStops?.at(-1)?.id===stop.id;
  const parentStatus=String(job.backendStatus||'').toLowerCase();
  const parentRequired=isFinalTestDelivery&&parentStatus!=='on_site_delivery';
  const parentLabel=parentStatus==='loaded'?'On My Way to Final Delivery':parentStatus==='in_transit'?'On Site (Final Delivery)':null;
  const title=returnStop?'Return Stop':`${stop.type==='collection'?'Collection':'Delivery'} Stop ${stop.sequence}`;

  const upload=async(current:LiveSession,file:File,category:'photos'|'damage'|'documents'|'signature')=>{
    if(!['image/jpeg','image/png','application/pdf'].includes(file.type)||file.size<=0||file.size>10*1024*1024)throw new Error('Use JPG, PNG or PDF files up to 10 MB.');
    if((category==='photos'||category==='damage'||category==='signature')&&file.type==='application/pdf')throw new Error('Photo/signature evidence must be an image.');
    const extension=file.type==='application/pdf'?'pdf':file.type==='image/png'?'png':'jpg';
    const res=await fetch(driverApi+'/mobile/jobs/'+encodeURIComponent(job.id)+'/evidence',{
      method:'POST',
      headers:{
        Authorization:'Bearer '+current.token,
        'Content-Type':file.type,
        'x-xdrive-evidence-kind':stop.type,
        'x-xdrive-evidence-category':category,
        'x-xdrive-stop-id':stop.id,
        'x-xdrive-evidence-name':`stop-${stop.id}-${crypto.randomUUID()}.${extension}`,
      },
      body:file,
    });
    const body=await res.json().catch(()=>({})) as {storagePath?:string;error?:string};
    if(!res.ok||!body.storagePath)throw new Error(body.error||'Stop evidence upload failed.');
    return body.storagePath;
  };

  const run=async(work:(current:LiveSession)=>Promise<void>)=>{
    if(busy)return;setBusy(true);setError('');
    try{if(!session)throw new Error("Live session required.");const current=await renewSession(session);onSession(current);await work(current);await onRefresh(current.token);}
    catch(reason){setError(reason instanceof Error?reason.message:'Stop action failed. Refresh before retrying.');}
    finally{setBusy(false);}
  };

  const localRun=async(work:()=>Promise<void>)=>{if(busy)return;setBusy(true);setError('');try{await work();}catch(e){setError(e instanceof Error?e.message:'Stop action failed.');}finally{setBusy(false);}};
  const transition=(status:'en_route'|'arrived')=>localTransition?void localRun(()=>localTransition(status)):void run(async current=>{
    await driverPost('/mobile/jobs/'+encodeURIComponent(job.id)+(job.isTest===true?'/reserve-stop-status':'/stop-status'),current.token,{stop_id:stop.id,status});
  });

  const completeWork=async(current:LiveSession|null)=>{
    if(parentRequired)throw new Error('Confirm the parent booking journey stage before final POD.');
    const itemCount=Number(items);const weightKg=weight.trim()===''?null:Number(weight);
    if(!Number.isInteger(itemCount)||itemCount<(stop.type==='delivery'?1:0))throw new Error('Enter a valid item count.');
    if(weightKg!==null&&(!Number.isFinite(weightKg)||weightKg<0))throw new Error('Enter a valid weight.');
    const imageFiles=files.filter(file=>file.type==='image/jpeg'||file.type==='image/png');
    if(imageFiles.length<1)throw new Error(returnStop?'Add at least one return evidence photo.':'Add at least one stop photo.');
    if(stop.type==='delivery'&&!validActualTime(deliveredOn.slice(0,10),deliveredOn.slice(11,16),earliestDelivery))throw new Error('Delivery time must be at or after recorded arrival and not in the future.');
    if(stop.type==='delivery'&&(!recipient.trim()||!leftAt.trim()||!signature))throw new Error('Received By, Left At and recipient signature are required.');
    if(localTransition){if(files.some(f=>!['image/jpeg','image/png','application/pdf'].includes(f.type)||f.size<=0||f.size>10*1024*1024))throw new Error('Invalid evidence file.');await localTransition('completed',{itemCount,weightKg,packaging:packaging||null,notes,recipientName:recipient,leftAt,deliveredOn:new Date(deliveredOn).toISOString(),deliveryStatus:stop.type==='delivery'?'Completed Delivery':null},files,signature);return;}
    if(!current)throw new Error('Live session required.');
    const photoPaths:string[]=[];const documentPaths:string[]=[];
    for(const file of files){const category=file.type==='application/pdf'?'documents':'photos';const path=await upload(current,file,category);(category==='documents'?documentPaths:photoPaths).push(path);}
    const signaturePath=stop.type==='delivery'&&signature?await upload(current,signature,'signature'):null;
    await driverPost('/mobile/jobs/'+encodeURIComponent(job.id)+(job.isTest===true?'/reserve-stop-status':'/stop-status'),current.token,{
      stop_id:stop.id,status:'completed',
      handover:{
        customerReference:job.customerRef||null,itemCount,weightKg,packaging:packaging||null,notes:notes.trim()||null,
        photoPaths,documentPaths,
        recipientName:stop.type==='delivery'?recipient.trim():null,
        leftAt:stop.type==='delivery'?leftAt.trim():null,
        deliveredOn:stop.type==='delivery'?new Date(deliveredOn).toISOString():null,
        deliveryStatus:stop.type==='delivery'?'Completed Delivery':null,
        signaturePath,
      },
    });
    stopDrafts.delete(draftKey);
    onBack();
  };
  const complete=()=>localTransition?void localRun(()=>completeWork(null)):void run(completeWork);

  const reportException=()=>void run(async current=>{
    if(stop.type!=='delivery')throw new Error('Delivery exceptions apply only to delivery stops.');
    if(outcome==='Job Cancelled'){setError('Contact the company that allocated this booking by phone.');return;}
    if(outcome==='Completed Delivery')throw new Error('Use Complete Stop for a successful delivery.');
    if(notes.trim().length<3)throw new Error('Describe the exception in Driver Notes.');
    const imageFiles=files.filter(file=>file.type==='image/jpeg'||file.type==='image/png');
    if(['Damaged Goods','Incorrect Goods'].includes(outcome)&&imageFiles.length<1)throw new Error('Add photographic evidence for this exception.');
    const photoPaths:string[]=[];const documentPaths:string[]=[];
    for(const file of files){const category=file.type==='application/pdf'?'documents':'damage';const path=await upload(current,file,category);(category==='documents'?documentPaths:photoPaths).push(path);}
    await driverPost('/mobile/jobs/'+encodeURIComponent(job.id)+(job.isTest===true?'/reserve-stop-status':'/stop-status'),current.token,{
      stop_id:stop.id,status:'exception',exception:{deliveryStatus:outcome,notes:notes.trim(),photoPaths,documentPaths},
    });
  });

  return <section className="rv-operation-screen rv-stop-workspace">
    <button type="button" className="rv-back" onClick={onBack}>← Booking status</button>
    <span className="rv-over">MULTI-STOP EXECUTION</span>
    <h1>{title}</h1>
    <section className="rv-card rv-stop-destination"><span className="rv-over">DESTINATION</span><strong>{stop.address}</strong><div className="rv-stop-progress" aria-label="Stop progress">{["pending","en_route","arrived","completed"].map((stage,index)=><span key={stage} className={stop.status===stage?"active":""}>{["Pending","En route","On site","Complete"][index]}</span>)}</div>{stop.timeWindowFrom&&<p>{/^\d{2}:\d{2}$/.test(stop.timeWindowFrom)?stop.timeWindowFrom:new Date(stop.timeWindowFrom).toLocaleString('en-GB')}</p>}{stop.notes&&<p>{stop.notes}</p>}</section>
    {error&&<div className="rv-error" role="alert">{error}</div>}

    {stop.status==='pending'&&<><button className="rv-primary rv-wide" disabled={busy} onClick={()=>transition('en_route')}>{busy?'Saving…':returnStop?'On My Way to Return':'On My Way to Stop'}</button></>}
    {stop.status==='en_route'&&<><button className="rv-primary rv-wide" disabled={busy} onClick={()=>transition('arrived')}>{busy?'Saving…':returnStop?'On Site - Return':'On Site - Stop'}</button></>}

    {stop.status==='arrived'&&<section className="rv-card">
      {stop.type==='delivery'&&<label className="rv-field"><span>Delivery Status</span><select value={outcome} onChange={e=>setOutcome(e.target.value)}>{outcomes.map(value=><option key={value}>{value}</option>)}</select></label>}
      {<>
        {stop.type==='delivery'&&outcome==='Completed Delivery'&&<>
          <label className="rv-field"><span>Received By *</span><input value={recipient} onChange={e=>setRecipient(e.target.value)} maxLength={160}/></label>
          <StopSignature recipient={recipient} onSave={setSignature} initialImage={signatureImage} onImageChange={setSignatureImage} initialSaved={Boolean(signature)}/>
          <label className="rv-field"><span>Left At *</span><select value={leftAt} onChange={e=>setLeftAt(e.target.value)}>{['Goods Inwards','Reception','Warehouse','Loading Bay','Delivery Office','Handed to recipient','Other'].map(value=><option key={value}>{value}</option>)}</select></label>
          <div className="rv-two"><label className="rv-field"><span>{returnStop?'Returned On':'Delivered On'} *</span><input type="date" min={earliestDelivery.slice(0,10)||undefined} max={localMinute().slice(0,10)} value={deliveredOn.slice(0,10)} onChange={e=>setDeliveredOn(e.target.value+"T")}/></label><label className="rv-field"><span>Delivery Time *</span><select value={deliveredOn.slice(11,16)} onChange={e=>setDeliveredOn(deliveredOn.slice(0,10)+"T"+e.target.value)}><option value="">Select time</option>{availableTimes(deliveredOn.slice(0,10),earliestDelivery,localMinute(),1).map(t=><option key={t}>{t}</option>)}</select></label></div>
        </>}
        {(stop.type==='collection'||outcome==='Completed Delivery')&&<div className="rv-two"><label className="rv-field"><span>Items *</span><input type="number" min={stop.type==='delivery'?1:0} value={items} onChange={e=>setItems(e.target.value)}/></label><label className="rv-field"><span>Weight (kg)</span><input type="number" min="0" step="0.01" value={weight} onChange={e=>setWeight(e.target.value)}/></label></div>}
        {(stop.type==="collection"||outcome==="Completed Delivery")&&<><label className="rv-field"><span>Packaging</span><select value={packaging} onChange={e=>setPackaging(e.target.value)}><option value="">Select packaging</option>{packagingOptions(packaging).map(v=><option key={v} value={v}>{v}</option>)}</select></label><p className="rv-sub">Booked packaging: {job.packaging||"Not specified"}</p></>}
        <label className="rv-field"><span>Evidence</span><input type="file" accept="image/jpeg,image/png,application/pdf" multiple onChange={e=>{setFiles(Array.from(e.currentTarget.files||[]).slice(0,20));e.currentTarget.value='';}}/></label>
        {files.length>0&&<ul className="rv-delivery-files">{files.map((file,index)=><li key={file.name+'-'+index}><span>{file.name}</span><button type="button" disabled={busy} onClick={()=>setFiles(previous=>previous.filter((_,i)=>i!==index))}>Remove</button></li>)}</ul>}
        <label className="rv-field"><span>Driver Notes {stop.type==='delivery'&&outcome!=='Completed Delivery'?'*':''}</span><textarea rows={3} value={notes} onChange={e=>setNotes(e.target.value)} maxLength={2000}/></label>
        {parentRequired&&<section className="rv-card" role="status"><p>Confirm the final booking journey stage before completing this stop.</p>{parentLabel&&onParentTransition?<button type="button" className="rv-primary rv-wide" disabled={busy||parentBusy} onClick={onParentTransition}>{parentBusy?'Saving status...':parentLabel}</button>:<p className="rv-warning">Refresh booking status before final delivery.</p>}</section>}
        {stop.type==='delivery'&&outcome!=='Completed Delivery'
          ?<button className="rv-primary rv-wide" disabled={busy} onClick={()=>reportException()}>{busy?'Saving…':'Report Delivery Exception'}</button>
          :<button className="rv-primary rv-wide" disabled={busy||parentBusy||parentRequired} onClick={()=>complete()}>{busy?'Saving…':returnStop?'Complete Return / Proof of Return':'Complete Stop'}</button>}
      </>}

    </section>}

    {stop.status==='cancelled'&&<section className="rv-card"><h2>Cancelled on Instruction</h2><p>This stop is preserved in the booking audit history.</p></section>}
    {stop.status==='skipped'&&<section className="rv-card rv-warning"><h2>Legacy skipped stop — review required</h2><p>XDrive will not treat this stop as completed or cancelled until it has an auditable resolution.</p></section>}
  </section>;
}
