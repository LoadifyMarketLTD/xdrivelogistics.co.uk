import { useRef, useState } from 'react';
import type { LiveJob, LiveSession, LiveStop } from './liveApi';
import { driverPost, renewSession } from './liveApi';

type Props={
  job:LiveJob;
  stop:LiveStop;
  session:LiveSession|null;
  localTransition?:(status:LiveStop["status"],handover?:LiveStop["handover"],files?:File[],signature?:File|null)=>Promise<void>;
  onSession:(session:LiveSession)=>void;
  onRefresh:(token:string)=>Promise<void>;
  onBack:()=>void;
  onCancel:()=>void;
};

const driverApi=import.meta.env.PROD?'/api/driver':'/xdrive-api/driver';
const outcomes=['Completed Delivery','Incorrect Goods','Incorrect Address','Job Cancelled','Delivery Refused','No Unloading Facilities','Damaged Goods'] as const;
const pad=(n:number)=>String(n).padStart(2,'0');
const localNow=()=>{const d=new Date();return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;};

function StopSignature({onSave}:{onSave:(file:File|null)=>void}){
  const canvas=useRef<HTMLCanvasElement>(null);
  const active=useRef<number|null>(null);
  const drawn=useRef(false);
  const [saved,setSaved]=useState(false);
  const point=(e:React.PointerEvent<HTMLCanvasElement>)=>{const r=e.currentTarget.getBoundingClientRect();return{x:(e.clientX-r.left)*e.currentTarget.width/r.width,y:(e.clientY-r.top)*e.currentTarget.height/r.height};};
  const end=(e:React.PointerEvent<HTMLCanvasElement>)=>{if(active.current!==e.pointerId)return;active.current=null;if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);};
  const save=()=>{if(!drawn.current||!canvas.current)return;canvas.current.toBlob(blob=>{if(!blob)return;onSave(new File([blob],'stop-signature.png',{type:'image/png'}));setSaved(true);},'image/png');};
  return <div className="rv-delivery-signature">
    <canvas ref={canvas} width={900} height={240} aria-label="Stop recipient signature"
      onPointerDown={e=>{active.current=e.pointerId;e.currentTarget.setPointerCapture(e.pointerId);const c=e.currentTarget.getContext('2d');if(!c)return;const p=point(e);c.strokeStyle='#1c3952';c.lineWidth=3;c.lineCap='round';c.lineJoin='round';c.beginPath();c.moveTo(p.x,p.y);}}
      onPointerMove={e=>{if(active.current!==e.pointerId)return;const c=e.currentTarget.getContext('2d');if(!c)return;const p=point(e);c.lineTo(p.x,p.y);c.stroke();drawn.current=true;setSaved(false);onSave(null);}}
      onPointerUp={end} onPointerCancel={end}/>
    <div className="rv-delivery-signature-foot"><span>{saved?'Signature saved':'Draw recipient signature'}</span><button type="button" onClick={save}>Save Signature</button><button type="button" onClick={()=>{canvas.current?.getContext('2d')?.clearRect(0,0,900,240);drawn.current=false;setSaved(false);onSave(null);}}>Clear</button></div>
  </div>;
}

export default function ReserveStopExecution({job,stop,session,onSession,onRefresh,onBack,onCancel,localTransition}:Props){
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [outcome,setOutcome]=useState('Completed Delivery');
  const [recipient,setRecipient]=useState(stop.handover?.recipientName||'');
  const [leftAt,setLeftAt]=useState(stop.handover?.leftAt||'Goods Inwards');
  const [items,setItems]=useState(String(stop.handover?.itemCount??(job.routeStops&&job.routeStops.length>2?undefined:job.items)??''));
  const [weight,setWeight]=useState(String(stop.handover?.weightKg??(job.routeStops&&job.routeStops.length>2?undefined:job.weight)??''));
  const [deliveredOn,setDeliveredOn]=useState(localNow());
  const [notes,setNotes]=useState(stop.handover?.notes||'');
  const [files,setFiles]=useState<File[]>([]);
  const [signature,setSignature]=useState<File|null>(null);
  const returnStop=stop.handover?.stopKind==='return';
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
    await driverPost('/mobile/jobs/'+encodeURIComponent(job.id)+'/reserve-stop-status',current.token,{stop_id:stop.id,status});
  });

  const completeWork=async(current:LiveSession|null)=>{
    const itemCount=Number(items);const weightKg=weight.trim()===''?null:Number(weight);
    if(!Number.isInteger(itemCount)||itemCount<(stop.type==='delivery'?1:0))throw new Error('Enter a valid item count.');
    if(weightKg!==null&&(!Number.isFinite(weightKg)||weightKg<0))throw new Error('Enter a valid weight.');
    const imageFiles=files.filter(file=>file.type==='image/jpeg'||file.type==='image/png');
    if(imageFiles.length<1)throw new Error(returnStop?'Add at least one return evidence photo.':'Add at least one stop photo.');
    if(stop.type==='delivery'&&(!recipient.trim()||!leftAt.trim()||!signature))throw new Error('Received By, Left At and recipient signature are required.');
    if(localTransition){if(files.some(f=>!['image/jpeg','image/png','application/pdf'].includes(f.type)||f.size<=0||f.size>10*1024*1024))throw new Error('Invalid evidence file.');await localTransition('completed',{itemCount,weightKg,notes,recipientName:recipient,leftAt,deliveredOn:new Date(deliveredOn).toISOString(),deliveryStatus:stop.type==='delivery'?'Completed Delivery':null},files,signature);return;}
    if(!current)throw new Error('Live session required.');
    const photoPaths:string[]=[];const documentPaths:string[]=[];
    for(const file of files){const category=file.type==='application/pdf'?'documents':'photos';const path=await upload(current,file,category);(category==='documents'?documentPaths:photoPaths).push(path);}
    const signaturePath=stop.type==='delivery'&&signature?await upload(current,signature,'signature'):null;
    await driverPost('/mobile/jobs/'+encodeURIComponent(job.id)+'/reserve-stop-status',current.token,{
      stop_id:stop.id,status:'completed',
      handover:{
        customerReference:job.customerRef||null,itemCount,weightKg,packaging:null,notes:notes.trim()||null,
        photoPaths,documentPaths,
        recipientName:stop.type==='delivery'?recipient.trim():null,
        leftAt:stop.type==='delivery'?leftAt.trim():null,
        deliveredOn:stop.type==='delivery'?new Date(deliveredOn).toISOString():null,
        deliveryStatus:stop.type==='delivery'?'Completed Delivery':null,
        signaturePath,
      },
    });
    onBack();
  };
  const complete=()=>localTransition?void localRun(()=>completeWork(null)):void run(completeWork);

  const reportException=()=>void run(async current=>{
    if(stop.type!=='delivery')throw new Error('Delivery exceptions apply only to delivery stops.');
    if(outcome==='Job Cancelled'){onCancel();return;}
    if(outcome==='Completed Delivery')throw new Error('Use Complete Stop for a successful delivery.');
    if(notes.trim().length<3)throw new Error('Describe the exception in Driver Notes.');
    const imageFiles=files.filter(file=>file.type==='image/jpeg'||file.type==='image/png');
    if(['Damaged Goods','Incorrect Goods'].includes(outcome)&&imageFiles.length<1)throw new Error('Add photographic evidence for this exception.');
    const photoPaths:string[]=[];const documentPaths:string[]=[];
    for(const file of files){const category=file.type==='application/pdf'?'documents':'damage';const path=await upload(current,file,category);(category==='documents'?documentPaths:photoPaths).push(path);}
    await driverPost('/mobile/jobs/'+encodeURIComponent(job.id)+'/reserve-stop-status',current.token,{
      stop_id:stop.id,status:'exception',exception:{deliveryStatus:outcome,notes:notes.trim(),photoPaths,documentPaths},
    });
  });

  return <section className="rv-operation-screen rv-stop-workspace">
    <button type="button" className="rv-back" onClick={onBack}>← Booking status</button>
    <span className="rv-over">MULTI-STOP EXECUTION</span>
    <h1>{title}</h1>
    <section className="rv-card rv-stop-destination"><span className="rv-over">DESTINATION</span><strong>{stop.address}</strong><div className="rv-stop-progress" aria-label="Stop progress">{["pending","en_route","arrived","completed"].map((stage,index)=><span key={stage} className={stop.status===stage?"active":""}>{["Pending","En route","On site","Complete"][index]}</span>)}</div>{stop.timeWindowFrom&&<p>{/^\d{2}:\d{2}$/.test(stop.timeWindowFrom)?stop.timeWindowFrom:new Date(stop.timeWindowFrom).toLocaleString('en-GB')}</p>}{stop.notes&&<p>{stop.notes}</p>}</section>
    {error&&<div className="rv-error" role="alert">{error}</div>}

    {stop.status==='pending'&&<><button className="rv-primary rv-wide" disabled={busy} onClick={()=>transition('en_route')}>{busy?'Saving…':returnStop?'On My Way to Return':'On My Way to Stop'}</button><button className="rv-outline rv-wide" disabled={busy} onClick={onCancel}>Record Stop / Job Cancellation</button></>}
    {stop.status==='en_route'&&<><button className="rv-primary rv-wide" disabled={busy} onClick={()=>transition('arrived')}>{busy?'Saving…':returnStop?'On Site - Return':'On Site - Stop'}</button><button className="rv-outline rv-wide" disabled={busy} onClick={onCancel}>Record Stop / Job Cancellation</button></>}

    {stop.status==='arrived'&&<section className="rv-card">
      {stop.type==='delivery'&&<label className="rv-field"><span>Delivery Status</span><select value={outcome} onChange={e=>setOutcome(e.target.value)}>{outcomes.map(value=><option key={value}>{value}</option>)}</select></label>}
      {outcome==='Job Cancelled'?<button className="rv-primary rv-wide" type="button" onClick={onCancel}>Open Cancellation Record</button>:<>
        {stop.type==='delivery'&&outcome==='Completed Delivery'&&<>
          <label className="rv-field"><span>Received By *</span><input value={recipient} onChange={e=>setRecipient(e.target.value)} maxLength={160}/></label>
          <StopSignature onSave={setSignature}/>
          <label className="rv-field"><span>Left At *</span><select value={leftAt} onChange={e=>setLeftAt(e.target.value)}>{['Goods Inwards','Reception','Warehouse','Loading Bay','Delivery Office','Handed to recipient','Other'].map(value=><option key={value}>{value}</option>)}</select></label>
          <label className="rv-field"><span>{returnStop?'Returned On':'Delivered On'} *</span><input type="datetime-local" value={deliveredOn} onChange={e=>setDeliveredOn(e.target.value)}/></label>
        </>}
        {(stop.type==='collection'||outcome==='Completed Delivery')&&<div className="rv-two"><label className="rv-field"><span>Items *</span><input type="number" min={stop.type==='delivery'?1:0} value={items} onChange={e=>setItems(e.target.value)}/></label><label className="rv-field"><span>Weight (kg)</span><input type="number" min="0" step="0.01" value={weight} onChange={e=>setWeight(e.target.value)}/></label></div>}
        <label className="rv-field"><span>Evidence</span><input type="file" accept="image/jpeg,image/png,application/pdf" multiple onChange={e=>{setFiles(Array.from(e.currentTarget.files||[]).slice(0,20));e.currentTarget.value='';}}/></label>
        {files.length>0&&<ul className="rv-delivery-files">{files.map((file,index)=><li key={file.name+'-'+index}><span>{file.name}</span><button type="button" disabled={busy} onClick={()=>setFiles(previous=>previous.filter((_,i)=>i!==index))}>Remove</button></li>)}</ul>}
        <label className="rv-field"><span>Driver Notes {stop.type==='delivery'&&outcome!=='Completed Delivery'?'*':''}</span><textarea rows={3} value={notes} onChange={e=>setNotes(e.target.value)} maxLength={2000}/></label>
        {stop.type==='delivery'&&outcome!=='Completed Delivery'
          ?<button className="rv-primary rv-wide" disabled={busy} onClick={()=>reportException()}>{busy?'Saving…':'Report Delivery Exception'}</button>
          :<button className="rv-primary rv-wide" disabled={busy} onClick={()=>complete()}>{busy?'Saving…':returnStop?'Complete Return / Proof of Return':'Complete Stop'}</button>}
      </>}
      <button className="rv-outline rv-wide" disabled={busy} onClick={onCancel}>Record Stop / Job Cancellation</button>
    </section>}

    {stop.status==='cancelled'&&<section className="rv-card"><h2>Cancelled on Instruction</h2><p>This stop is preserved in the booking audit history.</p></section>}
    {stop.status==='skipped'&&<section className="rv-card rv-warning"><h2>Legacy skipped stop — review required</h2><p>XDrive will not treat this stop as completed or cancelled until it has an auditable resolution.</p></section>}
  </section>;
}
