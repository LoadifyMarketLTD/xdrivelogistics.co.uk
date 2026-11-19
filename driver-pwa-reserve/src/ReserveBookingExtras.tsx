import {useEffect,useRef,useState} from 'react';
import {driverGet,driverPost,renewSession,type LiveJob,type LiveSession} from './liveApi';
export const extraTypes=[['waiting_time','Waiting time'],['handball','Handball'],['parking','Parking'],['toll','Toll'],['other','Other']] as const;
type Extra={id:string;extra_type:string;description?:string;amount_gbp:number|string;minutes?:number;status:string;review_note?:string;contractual_amendment_id?:string};
type Props={job:LiveJob;session:LiveSession;onSession:(session:LiveSession)=>void;onBack:()=>void};
export function parseExtraInput(type:string,amount:string,minutes:string,description:string){
 const n=Number(amount),m=Number(minutes);
 if(!extraTypes.some(x=>x[0]===type)||!/^\d{1,5}(\.\d{1,2})?$/.test(amount.trim())||!Number.isFinite(n)||n<=0||n>10000)throw new Error('Enter an amount between £0.01 and £10,000.00.');
 if(type==='waiting_time'&&(!/^\d+$/.test(minutes)||!Number.isInteger(m)||m<1||m>1440))throw new Error('Waiting time must be 1–1440 whole minutes.');
 if(!description.trim()||description.trim().length>500)throw new Error('Explain the charge in 1–500 characters.');
 return {extraType:type,amountGbp:n,minutes:type==='waiting_time'?m:null,description:description.trim()};
}
export function mayRequestExtra(job:LiveJob){
 return job.isTest===true&&['accepted','on_my_way','on_site_pickup','loaded','in_transit','on_site_delivery'].includes((job.backendStatus||'').toLowerCase())&&!job.podRecorded;
}
export default function ReserveBookingExtras({job,session,onSession,onBack}:Props){
 type Pending = ReturnType<typeof parseExtraInput>&{requestId:string};
 const key='xd-reserve-extra-pending:'+job.id;
 const [pending,setPending]=useState<Pending|null>(()=>{try{const raw=sessionStorage.getItem(key);return raw?JSON.parse(raw) as Pending:null}catch{return null}});
 const [items,setItems]=useState<Extra[]>([]),[loading,setLoading]=useState(true),[verified,setVerified]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState(''),[type,setType]=useState('waiting_time'),[amount,setAmount]=useState(''),[minutes,setMinutes]=useState(''),[description,setDescription]=useState('');
 const lock=useRef(false),path='/mobile/jobs/'+encodeURIComponent(job.id)+'/extras';
 const allowed=mayRequestExtra(job);
 function clearPending(){
  sessionStorage.removeItem(key);setPending(null);
 }
 async function refresh(current:LiveSession){
  const r=await driverGet(path,current.token,25000);
  if(r.ok!==true||!Array.isArray(r.extras))throw new Error('Official charges could not be read.');
  const rows=r.extras as Extra[];
  setItems(rows);setVerified(true);
  if(pending&&rows.some(row=>row.id===pending.requestId&&row.extra_type===pending.extraType&&Number(row.amount_gbp)===pending.amountGbp&&(row.minutes==null?null:Number(row.minutes))===pending.minutes&&row.description===pending.description)){
   clearPending();setMessage('Previous charge request confirmed from the official ledger.');
  }
 }
 useEffect(()=>{let active=true;setLoading(true);setVerified(false);setError('');void refresh(session).catch(e=>{if(active)setError(String(e.message||e));}).finally(()=>{if(active)setLoading(false);});return()=>{active=false};},[job.id,session.token]);
 async function reload(){
  if(lock.current)return;lock.current=true;setBusy(true);setError('');
  try{const current=await renewSession(session);onSession(current);await refresh(current);}
  catch(e){setVerified(false);setError(e instanceof Error?e.message:'Could not refresh charges.');}finally{lock.current=false;setBusy(false);}
 }
 async function submit(retry=false){
  if(lock.current||loading||!allowed||!verified||(!retry&&pending))return;
  let body:Pending;
  try{
   body=retry&&pending?pending:{...parseExtraInput(type,amount,minutes,description),requestId:crypto.randomUUID()};
   sessionStorage.setItem(key,JSON.stringify(body));setPending(body);
  }catch(e){setError(e instanceof Error?e.message:'Could not safely retain request identity. No charge sent.');return}
  lock.current=true;setBusy(true);setError('');setMessage('');
  try{
   const current=await renewSession(session);onSession(current);
   const r=await driverPost(path,current.token,body);
   if(r.ok!==true||!r.extra||typeof r.extra!=='object'||(r.extra as Record<string,unknown>).id!==body.requestId)throw new Error('Server did not confirm the request identity.');
   const saved=r.extra as Extra;
   setItems(rows=>[saved,...rows.filter(x=>x.id!==saved.id)]);clearPending();setAmount('');setMinutes('');setDescription('');
   setMessage(saved.status==='submitted'?'Charge submitted for buyer approval. The agreed invoice amount has not changed.':'Existing charge confirmed: '+saved.status+'.');
  }catch(e){setError((e instanceof Error?e.message:'Request not confirmed.')+' Retry the same request ID or refresh the official list.');}
  finally{lock.current=false;setBusy(false);}
 }
 return <section className="rv-operation-screen rv-request-screen"><button className="rv-back" onClick={onBack}>Back to Booking Status</button><span className="rv-over">XDRIVE FINANCE</span><h1>Additional Charges</h1><p className="rv-sub">Only buyer-approved contractual amendments can change the invoice value.</p>
 <section className="rv-card"><div className="rv-row"><h3>Charge requests</h3><button className="rv-outline" disabled={busy||loading} onClick={()=>void reload()}>Refresh</button></div>
 {loading?<p>Checking official charges…</p>:items.length?items.map(x=><div key={x.id} className="rv-card"><strong>{extraTypes.find(t=>t[0]===x.extra_type)?.[1]||x.extra_type} · £{Number(x.amount_gbp).toFixed(2)}</strong><p>{x.status} {x.status==='approved'&&!x.contractual_amendment_id?' — amendment not verified':''}</p>{x.minutes!=null&&<p>{x.minutes} minutes</p>}{x.description&&<p>{x.description}</p>}{x.review_note&&<p>Review: {x.review_note}</p>}</div>):<p>{verified?'No charge requests recorded.':'Charge list not verified.'}</p>}
 </section>
 {allowed?<section className="rv-card"><h3>Add item — request approval</h3><label className="rv-field">Item type<select value={type} onChange={e=>setType(e.target.value)}>{extraTypes.map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>{type==='waiting_time'&&<label className="rv-field">Waiting minutes<input type="number" min="1" max="1440" step="1" value={minutes} onChange={e=>setMinutes(e.target.value)}/></label>}<label className="rv-field">Amount (GBP)<input inputMode="decimal" value={amount} onChange={e=>setAmount(e.target.value)}/></label><label className="rv-field">Reason<textarea maxLength={500} rows={3} value={description} onChange={e=>setDescription(e.target.value)}/></label><button className="rv-primary rv-wide" disabled={busy||loading||!verified||Boolean(pending)} onClick={()=>void submit()}>{busy?'Submitting…':'Submit for Approval'}</button>{pending&&<section className="rv-card"><p className="rv-warning">Unconfirmed request: {pending.extraType.replaceAll("_"," ")} — £{pending.amountGbp.toFixed(2)}. Retry uses the same ID and cannot create a second charge.</p><button className="rv-outline rv-wide" disabled={busy||loading||!verified} onClick={()=>void submit(true)}>Retry Same Request</button></section>}</section>:<p className="rv-sub">New charges are available during active designated test bookings only. Closed bookings cannot be adjusted here.</p>}
 {error&&<p className="rv-error" role="alert">{error}</p>}{message&&<p role="status">{message}</p>}</section>;
}