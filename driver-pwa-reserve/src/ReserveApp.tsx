import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import './ReserveApp.css';
import { login, loadLiveWithDiagnostics, driverPost, driverGet, bookingOfferRespond, renewSession, revokeLiveSession, type LiveSession, type LiveJob } from './liveApi';
import LiveInvoices from './LiveInvoices';
import RouteMap from './RouteMap';
import LiveInvoiceFlow from './LiveInvoiceFlow';
import { reserveJobs, type QuoteSection } from './reserveLists';
import DriverMenu from './DriverMenu';
import BookingStatusTimeline from './BookingStatusTimeline';
import DeliveryHandover from './DeliveryHandover';
import { routeLabel } from './routeLabel';

type Tab = 'Loads' | 'Quotes' | 'Bookings';
type BookingSection = 'Received' | 'Allocated' | 'Delivered';
type View = 'list' | 'details' | 'quote' | 'quoteDetails' | 'map' | 'incoming' | 'statusHistory' | 'flow' | 'invoiceJob' | 'more' | 'invoices';
type DeliveryDraft = { recipient: string; leftAt: string; items: string; condition: string; notes: string };
const KEY = 'xdrive-driver-reserve-live-session-v1';
const driverApi = import.meta.env.PROD ? '/api/driver' : '/xdrive-api/driver';
function restored(): LiveSession | null { try { const value = JSON.parse(localStorage.getItem(KEY) || 'null'); return value && typeof value.token === 'string' && typeof value.refreshToken === 'string' && typeof value.expiresAt === 'number' ? value : null; } catch { return null; } }
const gbp = (v: number) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(v);
const friendlyService = (value: string | null | undefined) => ({ timed_direct: 'Timed Direct', same_day: 'Same Day', next_day: 'Next Day', on_demand: 'On Demand' } as Record<string,string>)[String(value||'').toLowerCase()] || String(value||'Transport').replaceAll('_',' ').replace(/\b\w/g, c => c.toUpperCase());
const nextStates: Partial<Record<LiveJob['status'], { label: string; backend: string; status: LiveJob['status'] }>> = {
  ALLOCATED: { label: 'On My Way to Collection', backend: 'on_my_way', status: 'ON_WAY_TO_PICKUP' },
  ON_WAY_TO_PICKUP: { label: 'On Site Collection', backend: 'on_site_pickup', status: 'ON_SITE_PICKUP' },
  ON_SITE_PICKUP: { label: 'Complete Collection', backend: 'loaded', status: 'LOADED' },
  LOADED: { label: 'On My Way to Delivery', backend: 'in_transit', status: 'ON_WAY_TO_DELIVERY' },
  ON_WAY_TO_DELIVERY: { label: 'On Site Delivery', backend: 'on_site_delivery', status: 'ON_SITE_DELIVERY' },
  ON_SITE_DELIVERY: { label: 'Complete Delivery', backend: 'delivered', status: 'DELIVERED' },
};
const quarters = Array.from({ length: 96 }, (_, i) => String(Math.floor(i/4)).padStart(2, '0') + ':' + String(i % 4 * 15).padStart(2, '0'));
function Route({ job, full = false }: { job: LiveJob; full?: boolean }) { return <div className="rv-route"><div className="rv-stop"><i/><div><b>{routeLabel(job.from,job.fromOutcode)}</b><span>{full && job.pickupAddress ? job.pickupAddress : 'Collection · ' + job.pickup + (job.pickupDate ? ' · ' + job.pickupDate : '')}</span></div></div><div className="rv-stop"><i/><div><b>{routeLabel(job.to,job.toOutcode)}</b><span>{full && job.deliveryAddress ? job.deliveryAddress : 'Delivery · ' + job.delivery + (job.deliveryDate ? ' · ' + job.deliveryDate : '')}</span></div></div></div>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="rv-field"><span>{label}</span>{children}</label>; }
function Fact({ name, value }: { name: string; value: string | number }) { return <div className="rv-fact"><span>{name}</span><strong>{value || 'Not provided'}</strong></div>; }
export default function ReserveApp() {
  const [session,setSession] = useState<LiveSession|null>(restored);
  const [email,setEmail]=useState('');const [password,setPassword]=useState('');
  const [loading,setLoading]=useState(false);const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');const [warning,setWarning]=useState('');
  const [jobs,setJobs]=useState<LiveJob[]>([]);
  const [tab,setTab]=useState<Tab>('Loads');const [view,setView]=useState<View>('list');
  const [id,setId]=useState<string|null>(null);
  const [quoteSection,setQuoteSection]=useState<QuoteSection>('Submitted');
  const [bookingSection,setBookingSection]=useState<BookingSection>('Received');
  const [withdrawId,setWithdrawId]=useState<string|null>(null);
  const [mapReturnView,setMapReturnView]=useState<View>('list');
  const [quoteAmount,setQuoteAmount]=useState('');const [quoteEta,setQuoteEta]=useState('30');const [quoteNotes,setQuoteNotes]=useState('');
  const [items,setItems]=useState('');const [weight,setWeight]=useState('');const [pickupNotes,setPickupNotes]=useState('');const [eta,setEta]=useState('22:30');
  const [draft,setDraft]=useState<DeliveryDraft>({recipient:'',leftAt:'Goods Inwards',items:'',condition:'Good condition',notes:''});
  const [signature,setSignature]=useState<string|null>(null);const [podFiles,setPodFiles]=useState<File[]>([]);
  const [podDone,setPodDone]=useState(false);
  const [menuOpen,setMenuOpen]=useState(false);const [menuSection,setMenuSection]=useState<string|null>(null);
  const [available,setAvailable]=useState(true);const [role,setRole]=useState<'Owner Driver'|'Company Driver'>('Owner Driver');
  const job=jobs.find(j=>j.id===id);
  const connected=Boolean(session);
  useLayoutEffect(()=>{window.scrollTo(0,0);document.documentElement.scrollTop=0;document.body.scrollTop=0;const frame=requestAnimationFrame(()=>window.scrollTo(0,0));return()=>cancelAnimationFrame(frame);},[view,tab,id]);
  useEffect(()=>{if('scrollRestoration' in history)history.scrollRestoration='manual';},[]);
  const fetchJobs=useCallback(async (token:string) => { const result=await loadLiveWithDiagnostics(token);setJobs(result.jobs);setWarning(result.warnings.join(' | ')); },[]);
  async function retryLive(){if(!session||loading)return;setLoading(true);setError('');setWarning('');try{const s=await renewSession(session);setSession(s);localStorage.setItem(KEY,JSON.stringify(s));await fetchJobs(s.token);}catch(e){setError(e instanceof Error?e.message:'Live service unavailable');}finally{setLoading(false);}}

  useEffect(()=>{if(!session)return;let active=true;setLoading(true);void (async()=>{try{const s=await renewSession(session);if(!active)return;setSession(s);localStorage.setItem(KEY,JSON.stringify(s));await fetchJobs(s.token); const p=await driverGet('/profile',s.token).catch(()=>({}));const driver=(p as Record<string,unknown>).driver as Record<string,unknown>|undefined;if(active&&driver)setRole(String(driver.driver_type||'').toLowerCase().includes('company')?'Company Driver':'Owner Driver');}catch(e){if(active)setError(e instanceof Error?e.message:'Could not restore session');}finally{if(active)setLoading(false);}})();return()=>{active=false};},[]);
  async function run<T>(action:(s:LiveSession)=>Promise<T>,done?:(result:T)=>void){if(!session||busy)return;setBusy(true);setError('');try{const s=await renewSession(session);setSession(s);localStorage.setItem(KEY,JSON.stringify(s));const result=await action(s);done?.(result);await fetchJobs(s.token);}catch(e){setError(e instanceof Error?e.message:'Request failed. Please retry.');}finally{setBusy(false)}}
  async function signIn(e:React.FormEvent){e.preventDefault();setLoading(true);setError('');try{const s=await login(email.trim(),password);setSession(s);localStorage.setItem(KEY,JSON.stringify(s));setPassword('');await fetchJobs(s.token);setTab('Loads');setView('list');}catch(e){setError(e instanceof Error?e.message:'Authentication failed');}finally{setLoading(false)}}
  function open(j:LiveJob,target:View){setId(j.id);setView(target);setWithdrawId(null);setError('');setPodDone(Boolean(j.podRecorded));setItems(String(j.items??''));setWeight(j.weight?String(j.weight):'');setDraft({recipient:'',leftAt:'Goods Inwards',items:String(j.items??''),condition:'Good condition',notes:''});setSignature(null);setPodFiles([]);setQuoteAmount(j.quote!=null&&j.bidStatus!=='withdrawn'?String(j.quote):'');setQuoteNotes(j.bidStatus==='withdrawn'?'':j.quoteNotes||'');setQuoteEta(j.bidStatus==='withdrawn'?'30':j.quoteEtaMinutes!=null?String(j.quoteEtaMinutes):'30');}
  function navigate(t:Tab){setTab(t);setView('list');setId(null);setWithdrawId(null);setError('');if(t==='Bookings')setBookingSection('Received');if(session&&!loading)void retryLive();}
  function openMap(j:LiveJob,back:View='list'){setId(j.id);setMapReturnView(back);setView('map');setError('');}
  function card(j:LiveJob){
    const offered=Boolean(j.acceptanceRequired&&j.offerId);
    const expired=Boolean(j.offerExpired);
    const canWithdraw=tab==='Quotes'&&j.personalBid===true&&j.bidStatus==='submitted'&&Boolean(j.bidId);
    const canEdit=canWithdraw&&j.status==='OPEN';
    const isWithdrawn=j.bidStatus==='withdrawn'||j.quoteOutcome==='CANCELLED';
    const status=offered?(expired?'EXPIRED OFFER':'NEW OFFER'):tab==='Quotes'?(isWithdrawn?'WITHDRAWN':j.quoteOutcome==='UNSUCCESSFUL'?'UNSUCCESSFUL':j.quoteOutcome==='AWARDED'?'AWARDED':'SUBMITTED'):j.status==='OPEN'?(j.quote!=null&&j.quoteOutcome!=='CANCELLED'&&j.bidStatus!=='withdrawn'?'QUOTED':'AVAILABLE'):j.status.replaceAll('_',' ');
    return <article key={j.id} className="rv-card rv-job">
      <div className="rv-jobhead"><div className="rv-job-identity"><strong>{j.company||'Transport buyer'}</strong><div className="rv-job-service"><span>{friendlyService(j.service)}</span><b>{j.vehicle}</b></div>{(j.yourRef||j.customerRef)&&<small>Ref: {j.yourRef||j.customerRef}</small>}</div><span className={'rv-chip '+(offered?'rv-orange':status==='SUBMITTED'?'rv-green':'')}>{status}</span></div>
      <Route job={j}/>
      {j.notes?.trim()&&<p className="rv-job-notes"><strong>Notes:</strong> {j.notes}</p>}
      <div className="rv-chips"><span><strong>{j.weight || '—'}</strong> kg</span>{j.terms&&<span>Payment: {j.terms}</span>}{j.distanceMiles!=null&&<span>{j.distanceMiles} miles</span>}</div>
      {tab==='Quotes'&&j.quote!=null&&<div className="rv-summary"><Fact name="Your submitted quote" value={gbp(j.quote)}/><Fact name="Collection ETA" value={j.quoteEtaMinutes==null?'Not provided':j.quoteEtaMinutes+' minutes'}/></div>}
      {tab!=='Quotes'&&<button className="rv-map-action" onClick={()=>openMap(j,'list')}>⌖ View on Map</button>}
      {tab==='Loads'?<div className="rv-actions"><button className="rv-outline" onClick={()=>open(j,'details')}>Load Details</button>{j.quote!=null&&j.quoteOutcome!=='CANCELLED'&&j.bidStatus!=='withdrawn'?<button className="rv-primary" onClick={()=>{setQuoteSection('Submitted');setTab('Quotes');open(j,'quoteDetails')}}>View Quote</button>:<button className="rv-primary" onClick={()=>open(j,'quote')}>Quote Now</button>}</div>
      :tab==='Quotes'?<>
        {canWithdraw&&<div className="rv-actions rv-primary-quote-actions">
          {canEdit&&<button className="rv-primary" onClick={()=>open(j,'quote')}>Edit Quote</button>}
          <button className="rv-danger" onClick={()=>setWithdrawId(j.id)} disabled={busy}>Withdraw Quote</button>
        </div>}
        {canWithdraw&&!canEdit&&<p className="rv-sub">Editing is unavailable because the job has progressed. Your submitted quote can still be withdrawn.</p>}
        <div className="rv-actions"><button className="rv-outline" onClick={()=>open(j,'quoteDetails')}>View Quote</button><button className="rv-map-action" onClick={()=>openMap(j,'list')}>⌖ View on Map</button></div>
        {withdrawId===j.id&&<section className="rv-withdraw-confirm" role="alertdialog" aria-label="Confirm quote withdrawal"><strong>Withdraw this quotation?</strong><p>The quote will be withdrawn from XDrive. You will no longer be considered for this job unless you submit a new quote while it remains available. Your history is preserved.</p><div className="rv-actions"><button className="rv-outline" onClick={()=>setWithdrawId(null)} disabled={busy}>Keep Quote</button><button className="rv-danger" disabled={busy} onClick={()=>void withdrawQuote(j)}>{busy?'Withdrawing…':'Confirm Withdraw'}</button></div></section>}
      </>:<div className="rv-booking-actions">
        <div className="rv-actions"><button className="rv-outline" onClick={()=>open(j,'details')}>View Booking Details</button><button className="rv-primary" onClick={()=>open(j,offered?'incoming':'statusHistory')}>{offered?(expired?'View Expired Offer':'Review Incoming Job'):j.status==='DELIVERED'||j.status==='POD_SUBMITTED'?'View POD & Status':'Booking Status'}</button></div>
        {!offered&&!['DELIVERED','POD_SUBMITTED'].includes(j.status)&&<button className="rv-outline rv-wide" onClick={()=>open(j,'flow')}>Continue Delivery →</button>}
        {!offered&&j.podRecorded&&<button className="rv-outline rv-wide" onClick={()=>open(j,'flow')}>View Signed POD & Invoice →</button>}
      </div>}
    </article>;
  }
  async function withdrawQuote(j:LiveJob){
    if(!j.bidId||j.bidStatus!=='submitted'||j.personalBid!==true){setError('Only your submitted quotation can be withdrawn.');return;}
    await run(s=>driverPost('/mobile/bids/'+encodeURIComponent(j.bidId!),s.token,{action:'withdraw'}),()=>{
      setWithdrawId(null);setQuoteSection('History');setView('list');
    });
  }
  function list(){
    const shown = reserveJobs(jobs, tab, '', 'All', quoteSection).filter(j=>tab!=='Bookings'||(bookingSection==='Received'?Boolean(j.acceptanceRequired&&!j.offerExpired):bookingSection==='Delivered'?['DELIVERED','POD_SUBMITTED'].includes(j.status):!j.acceptanceRequired&&!['DELIVERED','POD_SUBMITTED'].includes(j.status)));
    return <>
      {tab==='Bookings'&&<div className="rv-quote-tabs rv-booking-tabs" role="group" aria-label="Booking categories">{(['Received','Allocated','Delivered'] as BookingSection[]).map(s=><button key={s} className={bookingSection===s?'rv-selected':''} aria-pressed={bookingSection===s} onClick={()=>setBookingSection(s)}>{s}</button>)}</div>}
      {tab==='Quotes'&&<div className="rv-quote-tabs" role="group" aria-label="Quote sections">{(['Submitted','Awarded','History'] as QuoteSection[]).map(s=><button key={s} className={quoteSection===s?'rv-selected':''} aria-pressed={quoteSection===s} onClick={()=>{setQuoteSection(s);setWithdrawId(null)}}>{s}</button>)}</div>}
      {loading&&shown.length===0&&<p className="rv-loading-inline" role="status">Refreshing live jobs…</p>}
      {shown.length ? shown.map(card) : <div className="rv-empty">
        <b>{loading?'Loading live data…':warning?'Some sources are temporarily unavailable':jobs.length===0?'No jobs returned by the server':tab==='Bookings'&&bookingSection==='Received'?'No current booking offers':tab==='Loads'?'No available marketplace loads':'No matching '+tab.toLowerCase()}</b>
        <p>{loading?'Refreshing XDrive…':warning?'Some live sources failed. Check the notices below or retry. This does not mean that the marketplace is empty.':tab==='Bookings'&&bookingSection==='Received'?'Only pending offers with a future collection time appear here. Expired offers are excluded; their original schedules are not changed.':tab==='Loads'&&jobs.length>0?'No currently OPEN marketplace loads match the selected filters. Your submitted quotes remain under Quotes.':'No matching authenticated records. Nothing fictitious is displayed.'}</p>
        {!loading&&(error||warning||jobs.length===0)&&<button className="rv-outline rv-wide" onClick={()=>void retryLive()}>Retry Live Data →</button>}
        {tab==='Loads'&&jobs.some(j=>j.quote!=null)&&<button className="rv-outline rv-wide" onClick={()=>navigate('Quotes')}>View My Quotes →</button>}
      </div>}
      {warning&&<details className="rv-api-notes"><summary>Live data notices</summary><p>{warning}</p></details>}
    </>;
  }
  function quoteDetails(){if(!job)return null;return <><button className="rv-back" onClick={()=>setView('list')}>← Back to {tab}</button><span className="rv-over">SUBMITTED QUOTATION · XDRIVE</span><h1>My Quote</h1><Route job={job}/><section className="rv-card"><h3>Submitted quote</h3><Fact name="Load reference" value={job.yourRef||job.customerRef||job.id}/><Fact name="Company" value={job.company||'Transport buyer'}/><Fact name="Quote amount" value={job.quote==null?'Unavailable':gbp(job.quote)}/><Fact name="Status" value={job.bidStatus==='withdrawn'?'Withdrawn':job.quoteOutcome==='AWARDED'?'Awarded':job.quoteOutcome==='UNSUCCESSFUL'?'Unsuccessful':job.bidStatus==='submitted'?'Submitted':job.bidStatus||job.status.replaceAll('_',' ')}/><Fact name="Vehicle requested" value={job.vehicle}/><Fact name="Payment terms" value={job.terms||'Not provided'}/><Fact name="Collection ETA" value={job.quoteEtaMinutes==null?'Not provided':job.quoteEtaMinutes+' minutes'}/><Fact name="Quote notes" value={job.quoteNotes||'No notes supplied'}/>{job.quoteOutcome==='AWARDED'&&<p className="rv-warning">This quote has been awarded. Editing or withdrawing it would change an accepted commercial commitment and is blocked by XDrive.</p>}{(job.bidStatus==='withdrawn'||job.quoteOutcome==='CANCELLED')&&<p className="rv-warning">This quotation has already been withdrawn. It remains in History for the commercial audit trail.</p>}</section>{tab==='Quotes'&&job.personalBid===true&&job.bidId&&job.bidStatus==='submitted'&&<><div className="rv-actions">{job.status==='OPEN'&&<button className="rv-primary" onClick={()=>setView('quote')}>Edit Quote</button>}<button className="rv-danger" disabled={busy} onClick={()=>setWithdrawId(job.id)}>Withdraw Quote</button></div>{withdrawId===job.id&&<section className="rv-withdraw-confirm" role="alertdialog" aria-label="Confirm quote withdrawal"><strong>Withdraw this quotation?</strong><p>Your quotation will be withdrawn, not erased from the audit history. It can be quoted again only if the job is still available and you are eligible.</p><div className="rv-actions"><button className="rv-outline" onClick={()=>setWithdrawId(null)} disabled={busy}>Keep Quote</button><button className="rv-danger" disabled={busy} onClick={()=>void withdrawQuote(job)}>{busy?'Withdrawing…':'Confirm Withdraw'}</button></div></section>}</>}<button className="rv-outline rv-wide" onClick={()=>setView('details')}>View Load Details →</button></>}
  function details(){if(!job)return null;return <><button className="rv-back" onClick={()=>setView('list')}>← Back to {tab}</button><span className="rv-over">{job.status==='OPEN'?'LOAD DETAILS':'BOOKING DETAILS'}</span><h1>{job.from} → {job.to}</h1><p className="rv-sub">{job.company||'Transport buyer'} · {job.yourRef||job.id}</p><Route job={job} full={job.status!=='OPEN'}/><button className="rv-map-action rv-wide" onClick={()=>openMap(job,'details')}>⌖ View on Map</button><section className="rv-card"><h3>Transport details</h3><Fact name="Vehicle" value={job.vehicle}/><Fact name="Weight" value={job.weight+' kg'}/><Fact name="Items" value={job.items??'Not stated'}/><Fact name="Collection" value={(job.pickupDate||'')+' '+job.pickup}/><Fact name="Delivery" value={(job.deliveryDate||'')+' '+job.delivery}/><Fact name="Payment Terms" value={job.terms||'Not provided'}/><Fact name="Agreed rate / quote" value={job.quote!=null?gbp(job.quote):'Quote required'}/></section><section className="rv-card"><h3>Instructions & References</h3><p>{job.notes||'No additional handling instructions.'}</p>{job.status!=='OPEN'&&<><Fact name="Customer reference" value={job.customerRef||'Not provided'}/><Fact name="Your reference" value={job.yourRef||job.id}/></>}</section>{job.status === 'OPEN'
  ? job.quote == null || job.quoteOutcome==='CANCELLED'||job.bidStatus==='withdrawn'
    ? <button className="rv-primary rv-wide" onClick={()=>setView('quote')}>Quote Now →</button>
    : <><div className="rv-success">Quotation submitted: {gbp(job.quote)}. A second quote cannot be submitted for the same job.</div><button className="rv-outline rv-wide" onClick={()=>setView('quoteDetails')}>View Submitted Quote →</button></>
  : <button className="rv-primary rv-wide" onClick={()=>setView(job.acceptanceRequired?'incoming':'flow')}>{job.acceptanceRequired?'Review Incoming Booking':'Open Booking'} →</button>}</>}
  function quote(){
    if(!job)return null;
    const editing = tab==='Quotes' && job.personalBid===true && job.quote != null && job.bidStatus==='submitted' && Boolean(job.bidId);
    const minutes = quoteEta===''?null:Number(quoteEta);
    return <>
      <button className="rv-back" onClick={()=>setView(editing?'quoteDetails':'details')}>← {editing?'My Quote':'Load Details'}</button>
      <span className="rv-over">{editing?'EDIT EXISTING QUOTE':'SUBMIT NEW QUOTE'} · XDRIVE</span>
      <h1>{editing?'Edit Quote':'Your Quotation'}</h1>
      <Route job={job}/>
      <section className="rv-card">
        <h3>Quote & Availability</h3>
        {editing&&<div className="rv-warning">You are editing the quote already submitted for this job. No second quote will be created.</div>}
        <Field label="Collection ETA">
          <select value={quoteEta} onChange={e=>setQuoteEta(e.target.value)}>
            {[['5','ASAP · 5 min'],['15','15 min'],['30','30 min'],['45','45 min'],['60','60 min'],['90','90 min'],['120','120 min'],['','On Time']].map(([value,label])=><option key={value} value={value}>{label}</option>)}
          </select>
        </Field>
        <Fact name="Required vehicle" value={job.vehicle}/>
        <p className="rv-sub">The platform validates the vehicle registered to the driver; selecting an unverified vehicle here would not change the submitted quote.</p>
        <Field label="Your total quote (£, VAT included where applicable)"><input type="number" min="1" step=".01" value={quoteAmount} onChange={e=>setQuoteAmount(e.target.value)}/></Field>
        <Field label="Driver notes"><textarea value={quoteNotes} onChange={e=>setQuoteNotes(e.target.value)}/></Field>
        <div className="rv-summary"><Fact name="Total quotation" value={gbp(Number(quoteAmount)||0)}/><Fact name="Payment terms" value={job.terms||'Not stated'}/></div>
      </section>
      <button className="rv-primary rv-wide" disabled={busy||!(Number(quoteAmount)>0)}
       onClick={()=>void run(s=>editing
        ? driverPost('/mobile/bids/'+encodeURIComponent(job.bidId!),s.token,{action:'edit',amount:Number(quoteAmount),baseAmount:Number(quoteAmount),additionalExtrasGbp:0,collectWithinMinutes:minutes,message:quoteNotes.trim()})
        : driverPost('/mobile/bids',s.token,{jobId:job.id,amount:Number(quoteAmount),baseAmount:Number(quoteAmount),additionalExtrasGbp:0,collectWithinMinutes:minutes,message:quoteNotes.trim()}),
        ()=>navigate('Quotes'))}>
       {busy?'Saving…':editing?'Save Updated Quote →':'Submit Quote →'}
      </button>
    </>;
  }
  function incoming(){if(!job)return null;return <><button className="rv-back" onClick={()=>setView('list')}>← Bookings</button><span className="rv-over">BOOKINGS / INCOMING JOB</span><h1>{job.offerExpired?'Expired Booking Offer':'New Job Received'}</h1><div className="rv-attention">{job.offerExpired?'This offer refers to a collection time that has passed. Accept/Decline is disabled until the booking is reconciled.':'Booking awarded. Your response is required.'}</div><section className="rv-card rv-offer"><div className="rv-jobhead"><div><strong>{job.company}</strong><small>{job.yourRef||job.id}</small></div><span className="rv-chip rv-orange">{job.offerExpired?'EXPIRED':'AWARDED'}</span></div><Route job={job} full/><Fact name="Vehicle" value={job.vehicle}/><Fact name="Your agreed rate" value={job.quote!=null?gbp(job.quote):'Not supplied'}/><Fact name="Payment terms" value={job.terms||'Not supplied'}/><Fact name="Collection" value={(job.pickupDate||'')+' '+job.pickup}/><Fact name="Delivery" value={(job.deliveryDate||'')+' '+job.delivery}/><button className="rv-outline rv-wide" onClick={()=>setView('details')}>View Booking Details →</button></section>{job.offerExpired?<div className="rv-warning">Booking is not actionable because its collection time has passed. Open Booking Details for the record; an authorised dispatcher must resolve the offer.</div>:<div className="rv-actions"><button className="rv-danger" disabled={busy} onClick={()=>void run(s=>bookingOfferRespond(s.token,job.offerId!,'decline'),()=>navigate('Bookings'))}>Decline Job</button><button className="rv-primary" disabled={busy} onClick={()=>void run(s=>bookingOfferRespond(s.token,job.offerId!,'accept'),()=>setView('flow'))}>Accept Job</button></div>}</>}
  async function transition(j:LiveJob) {const step=nextStates[j.status];if(!step)return;await run(async s=>{if(j.status==='ALLOCATED'&&['allocated','assigned'].includes(j.backendStatus||'allocated'))await driverPost('/mobile/jobs/'+encodeURIComponent(j.id)+'/status',s.token,{nextStatus:'accepted'});if(j.status==='ON_SITE_PICKUP')await driverPost('/mobile/jobs/'+encodeURIComponent(j.id)+'/handover',s.token,{itemCount:items===''?null:Number(items),weightKg:weight===''?null:Number(weight),notes:pickupNotes});await driverPost('/mobile/jobs/'+encodeURIComponent(j.id)+'/status',s.token,{nextStatus:step.backend});},()=>{setJobs(rows=>rows.map(x=>x.id===j.id?{...x,status:step.status}:x));});}
  async function completeDelivery(j:LiveJob) {if(!draft.recipient.trim()||!signature||!Number.isInteger(Number(draft.items))||Number(draft.items)<=0||!podFiles.some(f=>['image/png','image/jpeg'].includes(f.type))){setError('Recipient name, signature, item count and a delivery photo are required.');return}await run(async s=>{const body={recipientName:draft.recipient,leftAt:draft.leftAt,itemCount:draft.items,deliveryStatus:draft.condition,notes:draft.notes};const res=await fetch(driverApi+'/web/jobs/'+encodeURIComponent(j.id)+'/pod-draft',{method:'PUT',headers:{Authorization:'Bearer '+s.token,'Content-Type':'application/json'},body:JSON.stringify(body)});if(!res.ok){const x=await res.json().catch(()=>({}));throw new Error(x.error||'Delivery details could not be saved ('+res.status+')')}await driverPost('/mobile/jobs/'+encodeURIComponent(j.id)+'/status',s.token,{nextStatus:'delivered'});},()=>{setJobs(rows=>rows.map(x=>x.id===j.id?{...x,status:'DELIVERED'}:x));});}
  async function savePod(j:LiveJob){if(!signature){setError('Recipient signature must be captured under Received By before POD.');return}if(!podFiles.some(f=>['image/png','image/jpeg'].includes(f.type))){setError('At least one delivery photo is required.');return}await run(async s=>{const photos:string[]=[];const documents:string[]=[];for(const file of podFiles){if(!['image/png','image/jpeg','application/pdf'].includes(file.type)||file.size>10*1024*1024||file.size<=0)throw new Error('Only PNG, JPEG or PDF files up to 10 MB.');const category=file.type==='application/pdf'?'documents':'photos';const res=await fetch(driverApi+'/mobile/jobs/'+encodeURIComponent(j.id)+'/evidence',{method:'POST',headers:{Authorization:'Bearer '+s.token,'Content-Type':file.type,'x-xdrive-evidence-kind':'delivery','x-xdrive-evidence-category':category,'x-xdrive-evidence-name':Date.now()+'-'+file.name.replace(/[^A-Za-z0-9._-]/g,'_')},body:file});const out=await res.json().catch(()=>({}));if(!res.ok||typeof out.storagePath!=='string')throw new Error(out.error||'Evidence upload failed');(category==='photos'?photos:documents).push(out.storagePath)}await driverPost('/mobile/jobs/'+encodeURIComponent(j.id)+'/pod',s.token,{recipientName:draft.recipient,leftAt:draft.leftAt,itemCount:Number(draft.items),notes:draft.notes,signatureData:signature,photoUris:photos,documentUris:documents,hardCopyAcknowledged:!j.hardCopyPodRequired,deliveryStatus:draft.condition==='Refused'?'Refused':draft.condition==='Shortage'?'Partial Delivery':'Completed Delivery'});},()=>setPodDone(true));}

  function flow(){
    if(!job)return null;
    if(job.status==='ON_SITE_DELIVERY'){
      return <DeliveryHandover job={job} value={draft} onChange={setDraft} signature={signature} onSignature={setSignature} photos={podFiles} onPhotos={setPodFiles} busy={busy} onBack={()=>setView('list')} onConfirm={()=>void completeDelivery(job)}/>;
    }
    const step=nextStates[job.status];
    const delivered=job.status==='DELIVERED'||job.status==='POD_SUBMITTED';
    return <section className="rv-operation-screen">
      <button className="rv-back" onClick={()=>setView('list')}>← Back to Bookings</button>
      <span className="rv-over">BOOKING OPERATIONS</span>
      <h1>{delivered?'Proof of Delivery':job.status==='ON_SITE_PICKUP'?'Complete Collection':job.status==='ALLOCATED'?'View Booking':step?.label||'Booking'}</h1>
      <span className="rv-chip rv-orange">{job.status.replaceAll('_',' ')}</span>
      <Route job={job} full/>
      {job.status==='ALLOCATED'&&<section className="rv-card"><h3>Assigned job</h3><Fact name="Customer" value={job.company||'Customer'}/><Fact name="Booking reference" value={job.yourRef||job.id}/><Fact name="Vehicle" value={job.vehicle}/><Fact name="Payment terms" value={job.terms||'Not provided'}/><Fact name="Instructions" value={job.notes||'None'}/></section>}
      {job.status==='ON_SITE_PICKUP'&&<section className="rv-card"><h3>Collection handover</h3><div className="rv-two"><Field label="Items collected"><input type="number" min="0" value={items} onChange={e=>setItems(e.target.value)}/></Field><Field label="Weight (kg)"><input type="number" min="0" value={weight} onChange={e=>setWeight(e.target.value)}/></Field></div><Field label="Delivery ETA"><select value={eta} onChange={e=>setEta(e.target.value)}>{quarters.map(v=><option key={v}>{v}</option>)}</select></Field><Field label="Driver notes"><textarea rows={2} value={pickupNotes} onChange={e=>setPickupNotes(e.target.value)}/></Field></section>}
      {delivered&&<section className="rv-card rv-pod-stage">
        <h3>Complete Signed POD</h3>
        <p className="rv-sub">The completed delivery record and recipient signature are carried forward from the handover.</p>
        <Fact name="Received by" value={draft.recipient||'Stored in the official job record'}/>
        <Fact name="Left at" value={draft.leftAt}/>
        {signature&&<><label className="rv-label">Captured recipient signature</label><img className="rv-signpreview" src={signature} alt="Recipient signature captured at delivery"/></>}
        {!podDone&&!job.podRecorded&&<>
          <label className="rv-field"><span>Delivery photos and POD documents</span><input type="file" multiple accept="image/png,image/jpeg,application/pdf" onChange={e=>setPodFiles(prev=>[...prev,...Array.from(e.currentTarget.files||[])])}/></label>
          <p className="rv-sub">{podFiles.length} selected evidence files. At least one delivery photo is required.</p>
          <button className="rv-primary rv-wide" disabled={busy} onClick={()=>void savePod(job)}>{busy?'Saving complete POD…':'Save Signed POD →'}</button>
        </>}
        {(podDone||job.podRecorded)&&<><div className="rv-success">Signed POD is recorded in XDrive. The official invoice generator will use the stored delivery evidence.</div><button className="rv-primary rv-wide" onClick={()=>setView('invoiceJob')}>Create Invoice + Complete POD →</button></>}
      </section>}
      {!delivered&&step&&<button className="rv-primary rv-wide" disabled={busy} onClick={()=>void transition(job)}>{busy?'Saving status…':job.status==='ON_SITE_PICKUP'?'Confirm Loaded →':step.label+' →'}</button>}
    </section>;
  }
  const header=<header className="rv-header"><div className="rv-brand"><div className="rv-mark">X</div><div><strong>XDRIVE LOGISTICS</strong><small>DRIVER RESERVE · NEW WORKFLOW</small></div></div><button aria-label="Driver menu" onClick={()=>setView('more')}>☰</button></header>;
  return <div className="rv-shell">{header}<main key={tab+'-'+view+'-'+(id||'')} className={'rv-main'+(view==='list'&&(tab==='Quotes'||tab==='Bookings')?' rv-card-first-list':'')}>{!connected?<section className="rv-auth"><span className="rv-over">SEPARATE BACKUP PWA · LIVE AUTH</span><h1>Driver Sign In</h1><p>Connect with your real XDrive driver account. No demonstration jobs are injected.</p><form onSubmit={e=>void signIn(e)}><Field label="Email"><input type="email" required autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)}/></Field><Field label="Password"><input type="password" required autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)}/></Field><button className="rv-primary rv-wide" disabled={loading}>{loading?'Connecting…':'Sign In →'}</button></form></section>:<>{error&&<div className="rv-error" role="alert">{error}</div>}{warning&&view!=='list'&&<details className="rv-api-notes"><summary>Some live information is temporarily unavailable</summary><p>{warning}</p></details>}{view==='list'&&list()}{view==='details'&&details()}{view==='map'&&job&&<RouteMap from={job.status==='OPEN'?job.from:(job.pickupAddress||job.from)} to={job.status==='OPEN'?job.to:(job.deliveryAddress||job.to)} distanceMiles={job.distanceMiles} travelMinutes={job.travelMinutes} onBack={()=>setView(mapReturnView)}/>} {view==='quoteDetails'&&quoteDetails()}{view==='quote'&&quote()}{view==='incoming'&&incoming()}{view==='statusHistory'&&job&&<><button className="rv-back" onClick={()=>setView('list')}>← Back to Bookings</button><p className="rv-over">BOOKING STATUS / VERIFIED EVENTS</p><h1>{job.yourRef||job.id}</h1><Route job={job} full/><BookingStatusTimeline job={job}/>{job.podRecorded&&<button className="rv-primary rv-wide" onClick={()=>setView('flow')}>View POD & Invoice →</button>}{!job.podRecorded&&job.status!=='DELIVERED'&&<button className="rv-primary rv-wide" onClick={()=>setView('flow')}>Continue Delivery →</button>}</>}{view==='flow'&&flow()}{view==='invoiceJob'&&session&&job&&<LiveInvoiceFlow key={job.id} job={job} session={session} onSession={setSession} onBack={()=>setView('flow')} onList={()=>setView('invoices')}/>}{view==='invoices'&&session&&<><button className="rv-back" onClick={()=>setView('more')}>← Menu</button><LiveInvoices session={session} onSession={setSession}/></>}{view==='more'&&<><div className="rv-heading"><div><span className="rv-over">DRIVER WORKSPACE</span><h1>More & Settings</h1><p>Your vehicle, documents, profile and finance.</p></div></div>{['My Profile','My Vehicle','Documents','Load Alerts','Availability','Return Journeys','Notifications','Invoices','Settings'].map(name=><button className="rv-menuitem" key={name} onClick={()=>{if(name==='Invoices'){setView('invoices');return}setMenuSection(name);setMenuOpen(true)}}>{name}<span>›</span></button>)}<button className="rv-outline rv-wide" onClick={()=>{if(session)void revokeLiveSession(session).catch(()=>{});localStorage.removeItem(KEY);setSession(null);setJobs([]);setId(null);setView('list');}}>Sign Out</button></>}</>}</main><nav className="rv-nav">{(['Loads','Quotes','Bookings'] as Tab[]).map(t=><button key={t} className={t===tab&&view!=='more'&&view!=='invoices'?'rv-active':''} onClick={()=>navigate(t)}><span>{t==='Loads'?'▣':t==='Quotes'?'▤':'▦'}</span>{t}</button>)}</nav>{menuOpen&&<DriverMenu section={menuSection} setSection={setMenuSection} onClose={()=>setMenuOpen(false)} onNavigate={destination=>{setMenuOpen(false);if(destination==='Invoices')setView('invoices');else if(['Loads','Quotes','Bookings'].includes(destination))navigate(destination as Tab);else{setMenuSection(destination);setMenuOpen(true)}}} role={role} available={available} setAvailable={setAvailable} savedCount={0} liveConnected={connected} token={session?.token??null} onLogout={()=>{localStorage.removeItem(KEY);setSession(null);setJobs([]);setMenuOpen(false);}}/>}</div>;
}
