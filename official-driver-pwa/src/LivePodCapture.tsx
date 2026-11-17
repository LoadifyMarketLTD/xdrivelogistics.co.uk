import { useCallback, useRef, useState } from 'react';
import PodDetails, { type PodForm } from './PodDetails';
import { driverPost, renewSession, type LiveSession, type LiveStop } from './liveApi';

type Props = {
  jobId: string;
  reference: string;
  initialItems: number;
  alreadyDelivered?: boolean;
  finalStop?: LiveStop;
  initialRecipient?: string;
  initialSignature?: File | null;
  initialPhotoUris?: string[];
  initialDelivery?: PodForm;
  session: LiveSession;
  onSession: (session: LiveSession) => void;
  onCompleted: (token: string) => Promise<void>;
  onOutcomeRecorded?: (token: string) => Promise<void>;
};
const base = import.meta.env.PROD ? '/api/driver' : '/xdrive-api/driver';

export default function LivePodCapture({
  jobId, reference, initialItems, finalStop, initialRecipient = "", initialSignature = null,
  initialPhotoUris = [], initialDelivery, session, onSession, onCompleted, onOutcomeRecorded,
}: Props) {
  const [recipient, setRecipient] = useState(initialRecipient);
  const [details, setDetails] = useState<PodForm>(initialDelivery ?? {
    leftAt: 'Goods Inwards', condition: 'Completed Delivery', items: initialItems,
    weightKg: null, deliveredOn: '', deliveredTime: '', notes: '',
  });
  const [signature, setSignature] = useState<File | null>(initialSignature);
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [hardCopyAcknowledged, setHardCopyAcknowledged] = useState(false);
  const [cancelScope, setCancelScope] = useState<'stop'|'job'>('job');
  const [cancelledByRole, setCancelledByRole] = useState('customer');
  const [cancelledByName, setCancelledByName] = useState('');
  const [cancellationReason, setCancellationReason] = useState('');
  const [instructionChannel, setInstructionChannel] = useState('phone');
  const [goodsInCustody, setGoodsInCustody] = useState(true);
  const [goodsDisposition, setGoodsDisposition] = useState('return_to_collection');
  const [resolutionAddress, setResolutionAddress] = useState('');
  const uploaded = useRef(new Map<File, string>());
  const addPodInput = useRef<HTMLInputElement>(null);
  const addMoreInput = useRef<HTMLInputElement>(null);
  const onDetailsChange = useCallback((value: PodForm) => setDetails(value), []);
  const onSignatureSaved = useCallback((file: File) => setSignature(file), []);

  const isCompleted = details.condition === 'Completed Delivery';
  const isCancelled = details.condition === 'Job Cancelled';

  const uploadFile = async (
    current: LiveSession,
    file: File,
    scope: 'job'|'stop',
    category: 'photos'|'damage'|'documents',
  ) => {
    if (!['image/jpeg','image/png','application/pdf'].includes(file.type) || file.size > 10 * 1024 * 1024 || file.size === 0) {
      throw new Error('Use JPEG, PNG or PDF up to 10 MB.');
    }
    const existing = uploaded.current.get(file);
    if (existing) return existing;
    const safeName = `${Date.now()}-${crypto.randomUUID().slice(0,8)}-${file.name.replace(/[^A-Za-z0-9._-]/g,'_').slice(-100)}`;
    const headers: Record<string,string> = {
      Authorization: `Bearer ${current.token}`,
      'Content-Type': file.type,
      'x-xdrive-evidence-kind': 'delivery',
      'x-xdrive-evidence-category': category,
      'x-xdrive-evidence-name': safeName,
    };
    if (scope === 'stop') {
      if (!finalStop?.id) throw new Error('Final delivery stop is unavailable. Refresh the booking.');
      headers['x-xdrive-stop-id'] = finalStop.id;
    }
    const response = await fetch(`${base}/mobile/jobs/${encodeURIComponent(jobId)}/evidence`, {
      method:'POST', headers, body:file,
    });
    const result = await response.json().catch(()=>({})) as {storagePath?:string;error?:string};
    if (!response.ok || !result.storagePath) throw new Error(result.error || 'Evidence upload failed.');
    uploaded.current.set(file,result.storagePath);
    return result.storagePath;
  };

  async function submitCompleted(current: LiveSession) {
    if (!recipient.trim() || !signature || (!files.some(f=>f.type==='image/jpeg'||f.type==='image/png') && initialPhotoUris.length===0)) {
      throw new Error('Recipient name, signature and at least one delivery photo are required.');
    }
    const photos=files.filter(f=>f.type==='image/jpeg'||f.type==='image/png');
    const documents=files.filter(f=>f.type==='application/pdf');
    if (photos.length>10||documents.length>10) throw new Error('Maximum 10 delivery photos and 10 documents per POD.');
    if (details.items<1||details.items>100000||!Number.isInteger(details.items)) throw new Error('Enter a valid delivered item count.');
    if (details.weightKg!==null&&(!Number.isFinite(details.weightKg)||details.weightKg<0||details.weightKg>100000)) throw new Error('Enter a valid delivery weight.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(details.deliveredOn)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(details.deliveredTime)) {
      throw new Error('Delivered On date and delivery time are required.');
    }
    const deliveredAt=new Date(`${details.deliveredOn}T${details.deliveredTime}:00`);
    if(!Number.isFinite(deliveredAt.getTime())) throw new Error('Delivered On date/time is invalid.');
    if(deliveredAt.getTime()>Date.now()+5*60_000) throw new Error('Delivered On cannot be in the future.');

    const photoUris=[...initialPhotoUris];
    const documentUris:string[]=[];
    for(const file of files){
      const category=file.type==='application/pdf'?'documents':'photos';
      const path=await uploadFile(current,file,'job',category);
      (category==='photos'?photoUris:documentUris).push(path);
    }
    const signatureData=await new Promise<string>((resolve,reject)=>{
      const reader=new FileReader();
      reader.onload=()=>resolve(String(reader.result));
      reader.onerror=()=>reject(new Error('Could not read signature'));
      reader.readAsDataURL(signature);
    });
    await driverPost(`/mobile/jobs/${encodeURIComponent(jobId)}/pod`,current.token,{
      recipientName:recipient.trim(),leftAt:details.leftAt,itemCount:details.items,weightKg:details.weightKg,
      deliveredOn:details.deliveredOn,deliveredTime:details.deliveredTime,deliveredAt:deliveredAt.toISOString(),
      notes:details.notes.trim()||null,signatureData,photoUris,documentUris,hardCopyAcknowledged,
      deliveryStatus:'Completed Delivery',
    });
    await onCompleted(current.token);
  }

  async function submitException(current: LiveSession) {
    if(!finalStop?.id) throw new Error('Final delivery stop is unavailable. Refresh the booking.');
    const images=files.filter(file=>file.type==='image/jpeg'||file.type==='image/png');
    if(['Damaged Goods','Incorrect Goods'].includes(details.condition)&&images.length<1){
      throw new Error('Photographic evidence is required for damaged or incorrect goods.');
    }
    const photoPaths:string[]=[]; const documentPaths:string[]=[];
    for(const file of files){
      const category=file.type==='application/pdf'?'documents':'damage';
      const path=await uploadFile(current,file,'stop',category);
      (category==='documents'?documentPaths:photoPaths).push(path);
    }
    await driverPost(`/mobile/jobs/${encodeURIComponent(jobId)}/stop-status`,current.token,{
      stop_id:finalStop.id,status:'exception',
      exception:{deliveryStatus:details.condition,notes:details.notes.trim()||null,photoPaths,documentPaths},
    });
    if(onOutcomeRecorded) await onOutcomeRecorded(current.token);
  }

  async function submitCancellation(current: LiveSession) {
    if(!finalStop?.id) throw new Error('Final delivery stop is unavailable. Refresh the booking.');
    if(cancellationReason.trim().length<5) throw new Error('Enter the cancellation reason.');
    await driverPost(`/mobile/jobs/${encodeURIComponent(jobId)}/stop-status`,current.token,{
      stop_id:finalStop.id,status:'cancelled',
      cancellation:{
        scope:cancelScope,cancelledByRole,cancelledByName:cancelledByName.trim()||null,
        reason:cancellationReason.trim(),instructionChannel,goodsInCustody,
        goodsDisposition:goodsInCustody?goodsDisposition:'none',
        resolutionAddress:resolutionAddress.trim()||null,
        notes:details.notes.trim()||null,
      },
    });
    if(onOutcomeRecorded) await onOutcomeRecorded(current.token);
  }

  async function submit(){
    if(busy||done)return;
    setBusy(true);setError('');
    try{
      const current=await renewSession(session);onSession(current);
      if(isCompleted) await submitCompleted(current);
      else if(isCancelled) await submitCancellation(current);
      else await submitException(current);
      setDone(true);
    }catch(reason){
      setError(reason instanceof Error?reason.message:'Could not record the delivery outcome. Retry safely after checking booking status.');
    }finally{setBusy(false);}
  }

  return <section className="settings evidence-panel" aria-label="Live delivery POD">
    <PodDetails jobId={jobId} reference={reference} initialItems={initialItems} initialDelivery={initialDelivery}
      recipient={recipient} onRecipient={setRecipient} onChange={onDetailsChange} onSignature={onSignatureSaved}
      initialSignatureSaved={!!initialSignature}/>

    {isCancelled&&<div className="stop-cancellation">
      <h3>{cancelScope==='job'?'Job Cancelled By':'Stop Cancelled By'}</h3>
      <label>Cancellation scope<select value={cancelScope} onChange={e=>setCancelScope(e.target.value as 'stop'|'job')}>
        <option value="job">Entire job</option><option value="stop">Final stop only</option>
      </select></label>
      <label>Instruction from<select value={cancelledByRole} onChange={e=>setCancelledByRole(e.target.value)}>
        <option value="posting_company">Posting Company</option><option value="customer">Customer</option>
        <option value="broker_dispatcher">Broker / Dispatcher</option><option value="collection_contact">Collection Site Contact</option>
        <option value="delivery_contact">Delivery Site Contact</option><option value="other_authorised_party">Other authorised party</option>
      </select></label>
      <label>Person / Contact Name<input value={cancelledByName} onChange={e=>setCancelledByName(e.target.value)}/></label>
      <label>Cancellation Reason *<textarea rows={3} value={cancellationReason} onChange={e=>setCancellationReason(e.target.value)}/></label>
      <label>Instruction received by<select value={instructionChannel} onChange={e=>setInstructionChannel(e.target.value)}>
        <option value="phone">Phone</option><option value="message">Message</option><option value="email">Email</option>
        <option value="in_person">In person</option><option value="other">Other</option>
      </select></label>
      <label className="stop-cancellation__check"><input type="checkbox" checked={goodsInCustody}
        onChange={e=>{setGoodsInCustody(e.target.checked);if(!e.target.checked)setGoodsDisposition('none')}}/> Goods are already in my custody / vehicle</label>
      {goodsInCustody&&<label>Goods disposition<select value={goodsDisposition} onChange={e=>setGoodsDisposition(e.target.value)}>
        <option value="return_to_collection">Return to collection point</option><option value="return_to_sender_depot">Return to sender / depot</option>
        <option value="await_instructions">Hold goods and await instructions</option><option value="redirect_authorised">Redirect to authorised address</option>
        <option value="replacement_stop">Replacement delivery stop</option>
      </select></label>}
      {goodsInCustody&&['return_to_sender_depot','redirect_authorised','replacement_stop'].includes(goodsDisposition)&&
        <label>Return / replacement address *<input value={resolutionAddress} onChange={e=>setResolutionAddress(e.target.value)}/></label>}
    </div>}

    {!isCancelled&&<div className="stop-execution__attachments">
      <strong>{isCompleted?'Attach files':'Exception evidence'}</strong>
      {files.map((file,index)=><div key={file.name+index}><span>{file.name}</span><button type="button" onClick={()=>setFiles(current=>current.filter((_,i)=>i!==index))}>Remove</button></div>)}
      <input ref={addPodInput} hidden type="file" accept="image/jpeg,image/png,application/pdf"
        onChange={event=>{const next=Array.from(event.currentTarget.files||[]);setFiles(current=>[...current,...next].slice(0,20));event.currentTarget.value=''}}/>
      <input ref={addMoreInput} hidden multiple type="file" accept="image/jpeg,image/png,application/pdf"
        onChange={event=>{const next=Array.from(event.currentTarget.files||[]);setFiles(current=>[...current,...next].slice(0,20));event.currentTarget.value=''}}/>
      <button type="button" className="booking-yellow" onClick={()=>addPodInput.current?.click()}>{isCompleted?'Add POD':'Add Evidence'}</button>
      <button type="button" className="booking-yellow" onClick={()=>addMoreInput.current?.click()}>Add More</button>
      <small>JPG, PNG or PDF. Maximum 10 MB per file.</small>
    </div>}
    {isCompleted&&<label><input type="checkbox" checked={hardCopyAcknowledged} onChange={event=>setHardCopyAcknowledged(event.target.checked)}/> Hard-copy POD requirement acknowledged (if required by the job)</label>}
    <button className="primary" type="button" disabled={busy||done} onClick={()=>void submit()}>
      {busy?'Saving...':done?'Outcome saved':isCompleted?'Send POD':isCancelled?'Record Cancellation':'Report Delivery Exception'}
    </button>
    {error&&<p role="alert">{error}</p>}
  </section>;
}
