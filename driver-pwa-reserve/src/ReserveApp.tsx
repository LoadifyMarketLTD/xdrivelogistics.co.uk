import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import './ReserveApp.css';
import { login, loadLiveWithDiagnostics, driverPost, driverGet, bookingOffersGet, applyBookingOffers, applyPersonalBids, bookingOfferRespond, renewSession, revokeLiveSession, type LiveSession, type LiveJob } from './liveApi';
import LiveInvoices from './LiveInvoices';
import RouteMap from './RouteMap';
import LiveInvoiceFlow from './LiveInvoiceFlow';
import OfficialPodDownload from './OfficialPodDownload';
import { reserveJobs, type QuoteSection } from './reserveLists';
import DriverMenu from './DriverMenu';
import GpsTracking from './GpsTracking';
import type { DriverRecord } from './driverMenuView';
import BookingStatusTimeline from './BookingStatusTimeline';
import DeliveryHandover from './DeliveryHandover';
import { routeLabel } from './routeLabel';

type Tab = 'Loads' | 'Quotes' | 'Bookings';
type BookingSection = 'Received' | 'Allocated' | 'Delivered';
type View = 'list' | 'details' | 'quote' | 'quoteDetails' | 'map' | 'incoming' | 'statusHistory' | 'flow' | 'invoiceJob' | 'more' | 'invoices' | 'gps';
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
function Route({ job, full = false, onOpen }: { job: LiveJob; full?: boolean; onOpen?: () => void }) { return <div className={"rv-route"+(onOpen?" rv-route-clickable":"")} role={onOpen?"button":undefined} tabIndex={onOpen?0:undefined} aria-label={onOpen?"Open load details":undefined} onClick={onOpen} onKeyDown={onOpen?(e)=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();onOpen();}}:undefined}><div className="rv-stop"><i/><div><b>{routeLabel(job.from,job.fromOutcode)}</b>{full && job.pickupAddress ? <span>{job.pickupAddress}</span> : <span className="rv-stop-schedule"><span>Collection · </span><strong className="rv-stop-time">{job.pickup}</strong>{job.pickupDate && <span className="rv-stop-date"> · {job.pickupDate}</span>}</span>}</div></div><div className="rv-stop"><i/><div><b>{routeLabel(job.to,job.toOutcode)}</b>{full && job.deliveryAddress ? <span>{job.deliveryAddress}</span> : <span className="rv-stop-schedule"><span>Delivery · </span><strong className="rv-stop-time">{job.delivery}</strong>{job.deliveryDate && <span className="rv-stop-date"> · {job.deliveryDate}</span>}</span>}</div></div></div>; }
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
  const [bookingSearch,setBookingSearch]=useState('');
  const [bookingPeriod,setBookingPeriod]=useState('all');
  const [withdrawId,setWithdrawId]=useState<string|null>(null);
  const [mapReturnView,setMapReturnView]=useState<View>('list');
  const [quoteAmount,setQuoteAmount]=useState('');const [quoteEta,setQuoteEta]=useState('30');const [quoteNotes,setQuoteNotes]=useState('');
  const [items,setItems]=useState('');const [weight,setWeight]=useState('');const [pickupNotes,setPickupNotes]=useState('');const [eta,setEta]=useState('22:30');
  const [draft,setDraft]=useState<DeliveryDraft>({recipient:'',leftAt:'Goods Inwards',items:'',condition:'Good condition',notes:''});
  const [signature,setSignature]=useState<string|null>(null);const [verifiedSignature,setVerifiedSignature]=useState<string|null>(null);const [podFiles,setPodFiles]=useState<File[]>([]);
  const uploadedEvidence=useRef(new Map<File,string>());
  const [podDone,setPodDone]=useState(false);
  const menuCache=useRef<{token:string;entries:Record<string,DriverRecord>}>({token:'',entries:{}});
  const [menuOpen,setMenuOpen]=useState(false);const [menuSection,setMenuSection]=useState<string|null>(null);
  const [available,setAvailable]=useState(true);const [role,setRole]=useState<'Owner Driver'|'Company Driver'>('Owner Driver');
  const job=jobs.find(j=>j.id===id);
  const connected=Boolean(session);
  // Read receipts are per authenticated driver and per awarded offer, not per tab visit.
  const receiptKey=(()=>{try{const payload=JSON.parse(atob((session?.token||'').split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));return 'xdrive-reserve-booking-seen-v1:'+String(payload.sub||'unknown');}catch{return 'xdrive-reserve-booking-seen-v1:unknown';}})();
  const [seenOffers,setSeenOffers]=useState<string[]>([]);
  useEffect(()=>{try{const value=JSON.parse(localStorage.getItem(receiptKey)||'[]');setSeenOffers(Array.isArray(value)?value.filter((v:unknown)=>typeof v==='string'):[]);}catch{setSeenOffers([]);}},[receiptKey]);
  const markOfferSeen=(j:LiveJob)=>{if(!j.offerId||!j.acceptanceRequired)return;setSeenOffers(previous=>{if(previous.includes(j.offerId!))return previous;const next=[...previous,j.offerId!];try{localStorage.setItem(receiptKey,JSON.stringify(next));}catch{}return next;});};
  const unreadBookingOffers=jobs.filter(j=>j.acceptanceRequired&&j.offerId&&!seenOffers.includes(j.offerId)).length;
  const isAuthFailure=(e:unknown)=>/invalid session|unauthorized|session expired|invalid.grant|refresh.token|already.used|jwt expired|401/i.test(e instanceof Error?e.message:String(e));
  const clearInvalidSession=()=>{localStorage.removeItem(KEY);setSession(null);setJobs([]);setId(null);setError('Session expired. Please sign in again.');};
  useLayoutEffect(()=>{window.scrollTo(0,0);document.documentElement.scrollTop=0;document.body.scrollTop=0;const frame=requestAnimationFrame(()=>window.scrollTo(0,0));return()=>cancelAnimationFrame(frame);},[view,tab,id]);
  useEffect(()=>{if('scrollRestoration' in history)history.scrollRestoration='manual';},[]);
  const browserBackRef=useRef(false);
  useEffect(()=>{const pop=(event:PopStateEvent)=>{const st=event.state as {rvView?:View;rvTab?:Tab;rvId?:string|null}|null;browserBackRef.current=true;setView(st?.rvView??'list');setTab(st?.rvTab??'Loads');setId(st?.rvId??null);};window.addEventListener('popstate',pop);return()=>window.removeEventListener('popstate',pop);},[]);
  const historyInitialized=useRef(false);
  useEffect(()=>{const st={rvView:view,rvTab:tab,rvId:id};if(!historyInitialized.current){historyInitialized.current=true;window.history.replaceState({...window.history.state,...st},'');return;}if(browserBackRef.current){browserBackRef.current=false;return;}window.history.pushState(st,'');},[view,tab,id]);
  const offersFetchRef=useRef(0);
  const offersPendingRef=useRef(false);
  const [offersLoading,setOffersLoading]=useState(false);
  const bidsFetchRef=useRef(0);
  const bidsPendingRef=useRef(false);
  const [bidsLoading,setBidsLoading]=useState(false);
  const fetchJobs=useCallback(async (token:string) => { let result=await loadLiveWithDiagnostics(token, undefined, false, (_feed, freshJobs)=>{setJobs(previous=>{const merged=new Map(previous.map(job=>[job.id,job]));for(const fresh of freshJobs){const prior=merged.get(fresh.id);merged.set(fresh.id,prior&&prior.status!=='OPEN'&&fresh.status==='OPEN'?{...fresh,status:prior.status,backendStatus:prior.backendStatus,podRecorded:prior.podRecorded||fresh.podRecorded}:fresh);}return [...merged.values()];});});setJobs(previous=>{const previousById=new Map(previous.map(job=>[job.id,job]));const missingExecutionFeed=result.warnings.some(message=>/Active bookings|Completed bookings/.test(message));const merged=result.jobs.map(fresh=>{const prior=previousById.get(fresh.id);if(!prior||!missingExecutionFeed||prior.status==='OPEN'||fresh.status!=='OPEN')return fresh;return {...prior,...fresh,status:prior.status,backendStatus:prior.backendStatus,podRecorded:prior.podRecorded||fresh.podRecorded,deliveryPhotos:prior.deliveryPhotos?.length?prior.deliveryPhotos:fresh.deliveryPhotos};});if(missingExecutionFeed){const returnedIds=new Set(merged.map(j=>j.id));for(const prior of previous){if(prior.status!=='OPEN'&&!returnedIds.has(prior.id))merged.push(prior);}}return merged;});setWarning(result.warnings.join(' | '));const now=Date.now();if(!offersPendingRef.current&&now-offersFetchRef.current>=15000){offersPendingRef.current=true;offersFetchRef.current=now;setOffersLoading(true);void bookingOffersGet(token).then(offers=>{setJobs(previous=>applyBookingOffers(previous,offers));setOffersLoading(false);setWarning(previous=>previous.split(' | ').filter(message=>message&&!message.startsWith('Booking offers:')).join(' | '));}).catch(reason=>{offersFetchRef.current=0;setOffersLoading(false);setWarning(previous=>[...previous.split(' | ').filter(message=>message&&!message.startsWith('Booking offers:')),'Booking offers: '+(reason instanceof Error?reason.message:'Service unavailable')].filter(Boolean).join(' | '));}).finally(()=>{offersPendingRef.current=false;});}
    const bidNow=Date.now();
    if(!bidsPendingRef.current && bidNow-bidsFetchRef.current>=15000){
      bidsPendingRef.current=true;bidsFetchRef.current=bidNow;setBidsLoading(true);
      void driverGet('/mobile/bids', token, 30000).then(bidData=>{
        setJobs(previous=>applyPersonalBids(previous,bidData));
        setWarning(previous=>previous.split(' | ').filter(message=>message&&!message.startsWith('Quote history:')).join(' | '));
      }).catch(reason=>{
        bidsFetchRef.current=0;
        setWarning(previous=>[...previous.split(' | ').filter(message=>message&&!message.startsWith('Quote history:')),'Quote history: '+(reason instanceof Error?reason.message:'Service unavailable')].filter(Boolean).join(' | '));
      }).finally(()=>{bidsPendingRef.current=false;setBidsLoading(false);});
    }
  },[]);
  async function retryLive(){if(!session||loading)return;setLoading(true);setError('');setWarning('');try{const s=await renewSession(session);setSession(s);localStorage.setItem(KEY,JSON.stringify(s));await fetchJobs(s.token);}catch(e){if(isAuthFailure(e))clearInvalidSession();else setError(e instanceof Error?e.message:'Live service unavailable');}finally{setLoading(false);}}

  useEffect(()=>{if(!session)return;let active=true;setLoading(true);void (async()=>{try{const s=await renewSession(session);if(!active)return;setSession(s);localStorage.setItem(KEY,JSON.stringify(s));void driverGet('/profile',s.token,7000).then(p=>{const driver=(p as Record<string,unknown>).driver as Record<string,unknown>|undefined;if(active&&driver)setRole(String(driver.driver_type||'').toLowerCase().includes('company')?'Company Driver':'Owner Driver');}).catch(()=>{});await fetchJobs(s.token);}catch(e){if(active){if(isAuthFailure(e))clearInvalidSession();else setError(e instanceof Error?e.message:'Could not restore session');}}finally{if(active)setLoading(false);}})();return()=>{active=false};},[]);
  async function run<T>(action:(s:LiveSession)=>Promise<T>,done?:(result:T)=>void){if(!session||busy)return;setBusy(true);setError('');try{const s=await renewSession(session);setSession(s);localStorage.setItem(KEY,JSON.stringify(s));const result=await action(s);done?.(result);void fetchJobs(s.token).catch(refreshError=>{setWarning('Job action saved, but live lists could not refresh: '+(refreshError instanceof Error?refreshError.message:'Unknown refresh failure'));});}catch(e){if(isAuthFailure(e))clearInvalidSession();else setError(e instanceof Error?e.message:'Request failed. Please retry.');}finally{setBusy(false)}}
  async function signIn(e:React.FormEvent){e.preventDefault();setLoading(true);setError('');try{const s=await login(email.trim(),password);setSession(s);localStorage.setItem(KEY,JSON.stringify(s));setPassword('');await fetchJobs(s.token);setTab('Loads');setView('list');}catch(e){setError(e instanceof Error?e.message:'Authentication failed');}finally{setLoading(false)}}
  function open(j:LiveJob,target:View){if(tab==='Bookings'&&['incoming','details'].includes(target))markOfferSeen(j);setId(j.id);setView(target);setWithdrawId(null);setError('');setPodDone(Boolean(j.podRecorded));setItems(String(j.items??''));setWeight(j.weight?String(j.weight):'');setDraft({recipient:'',leftAt:'Goods Inwards',items:String(j.items??''),condition:'Good condition',notes:''});setSignature(null);setVerifiedSignature(null);setPodFiles([]);uploadedEvidence.current.clear();setQuoteAmount(j.quote!=null&&j.bidStatus!=='withdrawn'?String(j.quote):'');setQuoteNotes(j.bidStatus==='withdrawn'?'':j.quoteNotes||'');setQuoteEta(j.bidStatus==='withdrawn'?'30':j.quoteEtaMinutes!=null?String(j.quoteEtaMinutes):'30');}
  useEffect(()=>{
    if(!session||!job||view!=='flow'||!['DELIVERED','POD_SUBMITTED'].includes(job.status)||job.podRecorded||podDone)return;
    let active=true;
    void (async()=>{
      try{
        const res=await fetch(driverApi+'/web/jobs/'+encodeURIComponent(job.id)+'/pod-draft',{headers:{Authorization:'Bearer '+session.token},cache:'no-store'});
        if(!res.ok||!active)return;
        const data=await res.json();
        if(data?.completed===true){setPodDone(true);setJobs(rows=>rows.map(row=>row.id===job.id?{...row,podRecorded:true,status:'DELIVERED'}:row));return;}
        const saved=data?.draft;
        if(!saved||typeof saved!=='object'||!active)return;
        setDraft(previous=>({
          ...previous,
          recipient:previous.recipient||String(saved.recipientName||''),
          leftAt:previous.leftAt==='Goods Inwards'?String(saved.leftAt||previous.leftAt):previous.leftAt,
          items:previous.items||String(saved.itemCount||''),
          condition:previous.condition==='Good condition'?String(saved.deliveryStatus||previous.condition):previous.condition,
          notes:previous.notes||String(saved.notes||'')
        }));
        if(typeof saved.signatureData==='string'&&/^data:image\/(png|jpeg);base64,/i.test(saved.signatureData)){setSignature(previous=>previous||saved.signatureData);setVerifiedSignature(saved.signatureData);}
      }catch{/* Existing POD draft may be unavailable; request a new signature. */}
    })();
    return ()=>{active=false};
  },[id,view,job?.status,job?.podRecorded,session?.token]);
  function navigate(t:Tab){setTab(t);setView('list');setId(null);setWithdrawId(null);setError('');if(t==='Bookings')setBookingSection('Received');}
  function openMap(j:LiveJob,back:View='list'){setId(j.id);setMapReturnView(back);setView('map');setError('');}
  function card(j:LiveJob, mode:'list'|'details'='list'){
    const offered=Boolean(j.acceptanceRequired&&j.offerId);
    const expired=Boolean(j.offerExpired);
    const canWithdraw=tab==='Quotes'&&j.personalBid===true&&j.bidStatus==='submitted'&&Boolean(j.bidId);
    const canEdit=canWithdraw&&j.status==='OPEN';
    const isWithdrawn=j.bidStatus==='withdrawn'||j.quoteOutcome==='CANCELLED';
    const status=offered?(expired?'EXPIRED OFFER':'NEW OFFER'):tab==='Quotes'?(isWithdrawn?'WITHDRAWN':j.quoteOutcome==='UNSUCCESSFUL'?'UNSUCCESSFUL':j.quoteOutcome==='AWARDED'?'AWARDED':'SUBMITTED'):j.status==='OPEN'?(j.quote!=null&&j.quoteOutcome!=='CANCELLED'&&j.bidStatus!=='withdrawn'?'QUOTED':'AVAILABLE'):j.status.replaceAll('_',' ');
    return <article key={j.id} className="rv-card rv-job">
      <div className="rv-jobhead"><div className="rv-job-identity"><strong>{j.company||'Transport buyer'}</strong><div className="rv-job-service"><span>{friendlyService(j.service)}</span><b>{j.vehicle}</b></div>{(j.yourRef||j.customerRef)&&<small>Ref: {j.yourRef||j.customerRef}</small>}</div><div className="rv-card-head-actions"><span className={'rv-chip '+(offered?'rv-orange':status==='SUBMITTED'?'rv-green':'')}>{status}</span>{mode==='details'&&<button className="rv-card-back" aria-label="Back" onClick={()=>setView('list')}>← Back</button>}</div></div>
      <Route job={j} onOpen={()=>open(j,'details')}/>
      {j.notes?.trim()&&<p className="rv-job-notes"><strong>Notes:</strong> {j.notes}</p>}
      {j.postedAt&&!Number.isNaN(Date.parse(j.postedAt))&&<div className="rv-posted-at">Posted: {new Date(j.postedAt).toLocaleString('en-GB',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:false})}</div>}
      <div className="rv-chips"><span><strong>{j.weight || '—'}</strong> kg</span>{j.terms&&<span>Payment: {j.terms}</span>}{j.distanceMiles!=null&&<span>{j.distanceMiles} miles</span>}</div>
      {tab==='Quotes'&&j.quote!=null&&<div className="rv-quote-inline"><span><strong>Quote:</strong> {gbp(j.quote)}</span><span><strong>ETA:</strong> {j.quoteEtaMinutes==null?'Not provided':j.quoteEtaMinutes+' min'}</span></div>}

      {mode==='details'?null:tab==='Loads'?<div className="rv-actions"><button className="rv-outline rv-load-details-action" onClick={()=>open(j,'details')}>Load Details</button>{j.quote!=null&&j.quoteOutcome!=='CANCELLED'&&j.bidStatus!=='withdrawn'?<button className="rv-primary" onClick={()=>{setQuoteSection('Submitted');setTab('Quotes');open(j,'quoteDetails')}}>View Quote</button>:<button className="rv-primary rv-quote-now-action" onClick={()=>open(j,'quote')}>Quote Now</button>}</div>
      :tab==='Quotes'?<>
        {canWithdraw&&<div className="rv-actions rv-primary-quote-actions">
          {canEdit&&<button className="rv-primary" onClick={()=>open(j,'quote')}>Edit Quote</button>}
          <button className="rv-danger" onClick={()=>setWithdrawId(j.id)} disabled={busy}>Withdraw Quote</button>
        </div>}
        {canWithdraw&&!canEdit&&<p className="rv-sub">Editing is unavailable because the job has progressed. Your submitted quote can still be withdrawn.</p>}
        <div className="rv-actions"><button className="rv-outline" onClick={()=>open(j,'quoteDetails')}>View Quote</button></div>
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
    const waitingOffers=tab==='Bookings'&&bookingSection==='Received'&&offersLoading;
    const waitingQuotes=tab==='Quotes'&&bidsLoading;
    const shown = reserveJobs(jobs, tab, '', 'All', quoteSection).filter(j=>tab!=='Bookings'||(bookingSection==='Received'?Boolean(j.acceptanceRequired):bookingSection==='Delivered'?['DELIVERED','POD_SUBMITTED'].includes(j.status)||Boolean(j.podRecorded):!j.acceptanceRequired&&!['DELIVERED','POD_SUBMITTED'].includes(j.status)&&!j.podRecorded)).filter(j=>tab!=='Bookings'||bookingSection!=='Delivered'||((!bookingSearch.trim()||[j.id,j.yourRef,j.customerRef,j.from,j.to,j.company,j.pickupAddress,j.deliveryAddress].some(v=>String(v||'').toLowerCase().includes(bookingSearch.trim().toLowerCase())))&&(bookingPeriod==='all'||(Boolean(j.postedAt)&&Date.parse(j.postedAt||'')>=Date.now()-Number(bookingPeriod)*86400000)))).sort((a,b)=>tab==='Bookings'&&bookingSection==='Delivered'?(Date.parse(b.postedAt||'')||0)-(Date.parse(a.postedAt||'')||0):0);
    return <>
      {tab==='Bookings'&&<div className="rv-quote-tabs rv-booking-tabs" role="group" aria-label="Booking categories">{(['Received','Allocated','Delivered'] as BookingSection[]).map(s=><button key={s} className={bookingSection===s?'rv-selected':''} aria-pressed={bookingSection===s} onClick={()=>setBookingSection(s)}>{s==='Received'?'Pending':s==='Allocated'?'Active':'History'}</button>)}</div>}
      {tab==='Bookings'&&bookingSection==='Delivered'&&<div className="rv-booking-history-tools" style={{display:'flex',gap:8,flexWrap:'wrap',margin:'10px 0 14px'}}><input aria-label="Search booking history" placeholder="Search reference, town, postcode, customer" value={bookingSearch} onChange={e=>setBookingSearch(e.target.value)} style={{flex:'1 1 200px',minWidth:0,padding:11,borderRadius:9,border:'1px solid #cbd5e1'}}/><select aria-label="Booking history period" value={bookingPeriod} onChange={e=>setBookingPeriod(e.target.value)} style={{padding:10,borderRadius:9,border:'1px solid #cbd5e1'}}><option value="all">All time</option><option value="7">7 days</option><option value="30">30 days</option><option value="90">90 days</option></select></div>}
      {tab==='Quotes'&&<div className="rv-quote-tabs" role="group" aria-label="Quote sections">{(['Submitted','Awarded','History'] as QuoteSection[]).map(s=><button key={s} className={quoteSection===s?'rv-selected':''} aria-pressed={quoteSection===s} onClick={()=>{setQuoteSection(s);setWithdrawId(null)}}>{s}</button>)}</div>}
      {loading&&shown.length===0&&<p className="rv-loading-inline" role="status">Refreshing live jobs…</p>}
      {shown.length ? shown.map(j=>card(j)) : <div className="rv-empty">
        <b>{waitingOffers?'Checking incoming booking offers…':waitingQuotes?'Loading your quote history':loading?'Loading live data…':warning?'Some sources are temporarily unavailable':jobs.length===0?'No jobs returned by the server':tab==='Bookings'&&bookingSection==='Received'?'No current booking offers':tab==='Loads'?'No available marketplace loads':'No matching '+tab.toLowerCase()}</b>
        <p>{waitingOffers?'Bookings and quotes remain accessible while incoming offers are checked.':waitingQuotes?'Your personal bids are being checked separately so Loads and Bookings stay responsive.':loading?'Refreshing XDrive…':warning?'Some live sources failed. Check the notices below or retry. This does not mean that the marketplace is empty.':tab==='Bookings'&&bookingSection==='Received'?'Pending awarded jobs appear here, including overdue collections. You can review and respond to an offer even after the scheduled collection time.':tab==='Loads'&&jobs.length>0?'No currently OPEN marketplace loads match the selected filters. Your submitted quotes remain under Quotes.':'No matching authenticated records. Nothing fictitious is displayed.'}</p>
        {!loading&&(error||warning||jobs.length===0)&&<button className="rv-outline rv-wide" onClick={()=>void retryLive()}>Retry Live Data →</button>}
        {tab==='Loads'&&jobs.some(j=>j.quote!=null)&&<button className="rv-outline rv-wide" onClick={()=>navigate('Quotes')}>View My Quotes →</button>}
      </div>}
      {warning&&<details className="rv-api-notes"><summary>Live data notices</summary><p>{warning}</p></details>}
    </>;
  }
  function detailHeader(j:LiveJob) { return card(j,'details'); }
  function quoteDetails(){if(!job)return null;return <>{detailHeader(job)}<section className="rv-card"><h3>Submitted quote</h3><Fact name="Load reference" value={job.yourRef||job.customerRef||job.id}/><Fact name="Company" value={job.company||'Transport buyer'}/><Fact name="Quote amount" value={job.quote==null?'Unavailable':gbp(job.quote)}/><Fact name="Status" value={job.bidStatus==='withdrawn'?'Withdrawn':job.quoteOutcome==='AWARDED'?'Awarded':job.quoteOutcome==='UNSUCCESSFUL'?'Unsuccessful':job.bidStatus==='submitted'?'Submitted':job.bidStatus||job.status.replaceAll('_',' ')}/><Fact name="Vehicle requested" value={job.vehicle}/><Fact name="Payment terms" value={job.terms||'Not provided'}/><Fact name="Collection ETA" value={job.quoteEtaMinutes==null?'Not provided':job.quoteEtaMinutes+' minutes'}/><Fact name="Quote notes" value={job.quoteNotes||'No notes supplied'}/>{job.quoteOutcome==='AWARDED'&&<p className="rv-warning">This quote has been awarded. Editing or withdrawing it would change an accepted commercial commitment and is blocked by XDrive.</p>}{(job.bidStatus==='withdrawn'||job.quoteOutcome==='CANCELLED')&&<p className="rv-warning">This quotation has already been withdrawn. It remains in History for the commercial audit trail.</p>}</section>{tab==='Quotes'&&job.personalBid===true&&job.bidId&&job.bidStatus==='submitted'&&<><div className="rv-actions">{job.status==='OPEN'&&<button className="rv-primary" onClick={()=>setView('quote')}>Edit Quote</button>}<button className="rv-danger" disabled={busy} onClick={()=>setWithdrawId(job.id)}>Withdraw Quote</button></div>{withdrawId===job.id&&<section className="rv-withdraw-confirm" role="alertdialog" aria-label="Confirm quote withdrawal"><strong>Withdraw this quotation?</strong><p>Your quotation will be withdrawn, not erased from the audit history. It can be quoted again only if the job is still available and you are eligible.</p><div className="rv-actions"><button className="rv-outline" onClick={()=>setWithdrawId(null)} disabled={busy}>Keep Quote</button><button className="rv-danger" disabled={busy} onClick={()=>void withdrawQuote(job)}>{busy?'Withdrawing…':'Confirm Withdraw'}</button></div></section>}</>}<button className="rv-outline rv-wide" onClick={()=>setView('details')}>View Load Details →</button></>}
  function details(){if(!job)return null;return <>{detailHeader(job)}<button className="rv-map-action rv-wide" onClick={()=>openMap(job,'details')}>View on Map</button><section className="rv-card"><h3>Transport details</h3><Fact name="Vehicle" value={job.vehicle}/><Fact name="Weight" value={job.weight+' kg'}/><Fact name="Items" value={job.items??'Not stated'}/><Fact name="Payment Terms" value={job.terms||'Not provided'}/><Fact name="Agreed rate / quote" value={job.quote!=null?gbp(job.quote):'Quote required'}/></section><section className="rv-card"><h3>Instructions & References</h3><p>{job.notes||'No additional handling instructions.'}</p>{job.status!=='OPEN'&&<><Fact name="Customer reference" value={job.customerRef||'Not provided'}/><Fact name="Your reference" value={job.yourRef||job.id}/></>}</section>{job.status === 'OPEN'
  ? job.quote == null || job.quoteOutcome==='CANCELLED'||job.bidStatus==='withdrawn'
    ? <button className="rv-primary rv-wide" onClick={()=>setView('quote')}>Quote Now →</button>
    : <><div className="rv-success">Quotation submitted: {gbp(job.quote)}. A second quote cannot be submitted for the same job.</div><button className="rv-outline rv-wide" onClick={()=>setView('quoteDetails')}>View Submitted Quote →</button></>
  : <button className="rv-primary rv-wide" onClick={()=>setView(job.acceptanceRequired?'incoming':'flow')}>{job.acceptanceRequired?'Review Incoming Booking':'Open Booking'} →</button>}</>}
  function quote(){
    if(!job)return null;
    const editing = tab==='Quotes' && job.personalBid===true && job.quote != null && job.bidStatus==='submitted' && Boolean(job.bidId);
    const minutes = quoteEta===''?null:Number(quoteEta);
    return <>
      <button className="rv-details-back-icon" type="button" aria-label="Back to load details" onClick={()=>setView(editing?'quoteDetails':'details')}>←</button>
      
      
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
  function incoming(){if(!job)return null;return <><button className="rv-back" onClick={()=>setView('list')}>← Bookings</button><span className="rv-over">BOOKINGS / INCOMING JOB</span><h1>{'New Job Received'}</h1><div className="rv-attention">{'Booking awarded. Your response is required.'}</div><section className="rv-card rv-offer"><div className="rv-jobhead"><div><strong>{job.company}</strong><small>{job.yourRef||job.id}</small></div><span className="rv-chip rv-orange">{'AWARDED'}</span></div><Route job={job} full/><Fact name="Vehicle" value={job.vehicle}/><Fact name="Your agreed rate" value={job.quote!=null?gbp(job.quote):'Not supplied'}/><Fact name="Payment terms" value={job.terms||'Not supplied'}/><Fact name="Collection" value={(job.pickupDate||'')+' '+job.pickup}/><Fact name="Delivery" value={(job.deliveryDate||'')+' '+job.delivery}/><button className="rv-outline rv-wide" onClick={()=>setView('details')}>View Booking Details →</button></section><div className="rv-actions"><button className="rv-danger" disabled={busy} onClick={()=>void run(s=>bookingOfferRespond(s.token,job.offerId!,'decline'),()=>navigate('Bookings'))}>Decline Job</button><button className="rv-primary" disabled={busy} onClick={()=>void run(s=>bookingOfferRespond(s.token,job.offerId!,'accept'),()=>setView('flow'))}>Accept Job</button></div></>}
  async function transition(j:LiveJob) {const step=nextStates[j.status];if(!step)return;await run(async s=>{if(j.status==='ALLOCATED'&&['allocated','assigned'].includes(j.backendStatus||'allocated'))await driverPost('/mobile/jobs/'+encodeURIComponent(j.id)+'/status',s.token,{nextStatus:'accepted'});if(j.status==='ON_SITE_PICKUP')await driverPost('/mobile/jobs/'+encodeURIComponent(j.id)+'/handover',s.token,{itemCount:items===''?null:Number(items),weightKg:weight===''?null:Number(weight),notes:pickupNotes});await driverPost('/mobile/jobs/'+encodeURIComponent(j.id)+'/status',s.token,{nextStatus:step.backend});},()=>{setJobs(rows=>rows.map(x=>x.id===j.id?{...x,status:step.status}:x));});}
  async function prepareDeliveryUpload(file:File):Promise<File> {
    if(file.type==='application/pdf')return file;
    if(!['image/jpeg','image/png'].includes(file.type))throw new Error('Unsupported photo format: '+file.name);
    // Mobile camera originals can exceed the hosting provider's request-body limit.
    // Keep the original on the device and upload a readable, bounded JPEG copy.
    if(file.size<=2*1024*1024)return file;
    const image=await createImageBitmap(file).catch(()=>null);
    if(!image)throw new Error('Photo cannot be decoded: '+file.name+'. Select a JPEG or PNG.');
    try {
      const scale=Math.min(1,1800/Math.max(image.width,image.height));
      const canvas=document.createElement('canvas');
      canvas.width=Math.max(1,Math.round(image.width*scale));
      canvas.height=Math.max(1,Math.round(image.height*scale));
      const ctx=canvas.getContext('2d');
      if(!ctx)throw new Error('Photo processing is unavailable.');
      ctx.drawImage(image,0,0,canvas.width,canvas.height);
      let blob:Blob|null=null;
      for(const quality of [0.82,0.68,0.5]) {
        blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,'image/jpeg',quality));
        if(blob&&blob.size<=2*1024*1024)break;
      }
      if(!blob||blob.size>2*1024*1024)throw new Error('Photo is too large to upload after optimisation: '+file.name);
      return new File([blob],file.name.replace(/\.[^.]+$/, '')+'-upload.jpg',{type:'image/jpeg',lastModified:file.lastModified});
    } finally { image.close(); }
  }
  async function uploadDeliveryEvidence(j:LiveJob, token:string) {
    const photos:string[]=[];
    const documents:string[]=[];
    for(const file of podFiles){
      if(!['image/png','image/jpeg','application/pdf'].includes(file.type)||file.size>10*1024*1024||file.size<=0) throw new Error('Only PNG, JPEG or PDF files up to 10 MB.');
      const category=file.type==='application/pdf'?'documents':'photos';
      let storagePath=uploadedEvidence.current.get(file);
      if(!storagePath){
        const uploadFile=await prepareDeliveryUpload(file);
        const res=await fetch(driverApi+'/mobile/jobs/'+encodeURIComponent(j.id)+'/evidence',{
          method:'POST',
          headers:{Authorization:'Bearer '+token,'Content-Type':uploadFile.type,'x-xdrive-evidence-kind':'delivery','x-xdrive-evidence-category':category,'x-xdrive-evidence-name':crypto.randomUUID()+'-'+uploadFile.name.replace(/[^A-Za-z0-9._-]/g,'_').slice(0,130)},
          body:uploadFile
        });
        const out=await res.json().catch(()=>({}));
        if(!res.ok||typeof out.storagePath!=='string')throw new Error(out.error||('Evidence upload failed (HTTP '+res.status+'). '+(res.status===413?'Photo exceeds the server request limit.':'Please retry or check your connection.')));
        const confirmedPath=out.storagePath as string;
        storagePath=confirmedPath;
        uploadedEvidence.current.set(file,confirmedPath);
      }
      if(!storagePath)throw new Error('Delivery evidence storage path was not returned.');
      (category==='photos'?photos:documents).push(storagePath);
    }
    return {photos,documents};
  }
  async function saveRecipientSignature(j:LiveJob):Promise<void> {
    if(!session||!signature)throw new Error('Draw the recipient signature before saving.');
    const s=await renewSession(session);
    setSession(s);localStorage.setItem(KEY,JSON.stringify(s));
    const endpoint=driverApi+'/web/jobs/'+encodeURIComponent(j.id)+'/pod-draft';
    const previousResponse=await fetch(endpoint,{headers:{Authorization:'Bearer '+s.token},cache:'no-store'});
    if(!previousResponse.ok)throw new Error('Could not read existing POD draft ('+previousResponse.status+').');
    const existing=await previousResponse.json().catch(()=>({}));
    if(existing.completed===true){setPodDone(true);setJobs(rows=>rows.map(row=>row.id===j.id?{...row,podRecorded:true,status:'DELIVERED'}:row));return;}
    const prior=existing.draft&&typeof existing.draft==='object'&&!Array.isArray(existing.draft)?existing.draft:{};
    const body={...prior,recipientName:draft.recipient.trim(),signatureData:signature,leftAt:draft.leftAt,itemCount:draft.items,deliveryStatus:draft.condition,notes:draft.notes};
    const saved=await fetch(endpoint,{method:'PUT',headers:{Authorization:'Bearer '+s.token,'Content-Type':'application/json'},body:JSON.stringify(body)});
    if(!saved.ok){const detail=await saved.json().catch(()=>({}));throw new Error(detail.error||'Signature save failed ('+saved.status+').');}
    const verified=await fetch(endpoint,{headers:{Authorization:'Bearer '+s.token},cache:'no-store'});
    if(!verified.ok)throw new Error('Signature submitted but verification failed. Check before retrying.');
    const confirmation=await verified.json().catch(()=>({}));
    if(confirmation?.draft?.signatureData!==signature)throw new Error('Server did not return the saved signature. It is not yet verified.');
    setVerifiedSignature(signature);
  }
  async function completeDelivery(j:LiveJob) {if(!signature||verifiedSignature!==signature){setError('Save and verify the recipient signature before confirming delivery.');return}if(!draft.recipient.trim()||!signature||!Number.isInteger(Number(draft.items))||Number(draft.items)<=0||!podFiles.some(f=>['image/png','image/jpeg'].includes(f.type))){setError('Recipient name, signature, item count and a delivery photo are required.');return}await run(async s=>{const body={recipientName:draft.recipient,leftAt:draft.leftAt,itemCount:draft.items,deliveryStatus:draft.condition,notes:draft.notes};const evidence=await uploadDeliveryEvidence(j,s.token);const updatedDraft={...body,signatureData:signature,photoUris:evidence.photos,documentUris:evidence.documents};const saved=await fetch(driverApi+'/web/jobs/'+encodeURIComponent(j.id)+'/pod-draft',{method:'PUT',headers:{Authorization:'Bearer '+s.token,'Content-Type':'application/json'},body:JSON.stringify(updatedDraft)});if(!saved.ok){const detail=await saved.json().catch(()=>({}));throw new Error(detail.error||'Signed POD draft could not be saved ('+saved.status+')')}await driverPost('/mobile/jobs/'+encodeURIComponent(j.id)+'/status',s.token,{nextStatus:'delivered'});},()=>{setJobs(rows=>rows.map(x=>x.id===j.id?{...x,status:'DELIVERED'}:x));});}
  async function savePod(j:LiveJob){if(!signature){setError('Recipient signature must be captured under Received By before POD.');return}if(!podFiles.some(f=>['image/png','image/jpeg'].includes(f.type))&&!(j.deliveryPhotos?.length)){setError('At least one delivery photo is required.');return}await run(async s=>{const officialPodComplete=async()=>{const verification=await fetch(driverApi+'/web/jobs/'+encodeURIComponent(j.id)+'/pod-draft',{headers:{Authorization:'Bearer '+s.token},cache:'no-store'});if(!verification.ok)throw new Error('Official POD state could not be read ('+verification.status+').');const verified=await verification.json().catch(()=>({}));return verified.completed===true;};if(await officialPodComplete())return;const {photos,documents}=await uploadDeliveryEvidence(j,s.token);let submitError:unknown=null;try{const response=await driverPost('/mobile/jobs/'+encodeURIComponent(j.id)+'/pod',s.token,{recipientName:draft.recipient,leftAt:draft.leftAt,itemCount:Number(draft.items),notes:draft.notes,signatureData:signature,photoUris:photos,documentUris:documents,hardCopyAcknowledged:!j.hardCopyPodRequired,deliveryStatus:draft.condition==='Refused'?'Refused':draft.condition==='Shortage'?'Partial Delivery':'Completed Delivery'});if(response.ok!==true)throw new Error('XDrive did not confirm the POD submission.');}catch(e){submitError=e;}let isComplete=false;try{isComplete=await officialPodComplete();}catch(e){if(!submitError)throw e;}if(!isComplete)throw submitError instanceof Error?submitError:new Error('POD is not confirmed complete on the server. Check its status before attempting another submission.');},()=>{setPodDone(true);setJobs(rows=>rows.map(row=>row.id===j.id?{...row,status:'DELIVERED',podRecorded:true}:row));});}

  function flow(){
    if(!job)return null;
    if(job.status==='ON_SITE_DELIVERY'){
      return <DeliveryHandover job={job} value={draft} onChange={v=>{setDraft(v);setError('');}} signature={signature} onSignature={v=>{setSignature(v);setVerifiedSignature(null);setError('');}} signatureVerified={Boolean(signature)&&verifiedSignature===signature} onSaveSignature={()=>saveRecipientSignature(job)} photos={podFiles} onPhotos={v=>{setPodFiles(v);setError('');}} busy={busy} onBack={()=>setView('list')} onConfirm={()=>void completeDelivery(job)}/>;
    }
    const step=nextStates[job.status];
    const delivered=job.status==='DELIVERED'||job.status==='POD_SUBMITTED';
    if(job.podRecorded||podDone)return <section className="rv-operation-screen"><button className="rv-back" onClick={()=>setView('statusHistory')}>← Booking status</button><h1>Completed booking · Signed POD</h1><Route job={job} full/><p>The signed POD is archived and read-only. Delivery cannot be repeated.</p>{session&&<OfficialPodDownload jobId={job.id} session={session} onSession={setSession}/>}</section>;
    return <section className="rv-operation-screen">
      {(!delivered||podDone||job.podRecorded)&&<><button className="rv-back" onClick={()=>setView('list')}>← Back to Bookings</button>
      <span className="rv-over">BOOKING OPERATIONS</span>
      <h1>{delivered?'Proof of Delivery':job.status==='ON_SITE_PICKUP'?'Complete Collection':job.status==='ALLOCATED'?'View Booking':step?.label||'Booking'}</h1>
      <span className="rv-chip rv-orange">{job.status.replaceAll('_',' ')}</span>
      <Route job={job} full/></>}
      {job.status==='ALLOCATED'&&<section className="rv-card"><h3>Assigned job</h3><Fact name="Customer" value={job.company||'Customer'}/><Fact name="Booking reference" value={job.yourRef||job.id}/><Fact name="Vehicle" value={job.vehicle}/><Fact name="Payment terms" value={job.terms||'Not provided'}/><Fact name="Instructions" value={job.notes||'None'}/></section>}
      {job.status==='ON_SITE_PICKUP'&&<section className="rv-card"><h3>Collection handover</h3><div className="rv-two"><Field label="Items collected"><input type="number" min="0" value={items} onChange={e=>setItems(e.target.value)}/></Field><Field label="Weight (kg)"><input type="number" min="0" value={weight} onChange={e=>setWeight(e.target.value)}/></Field></div><Field label="Delivery ETA"><select value={eta} onChange={e=>setEta(e.target.value)}>{quarters.map(v=><option key={v}>{v}</option>)}</select></Field><Field label="Driver notes"><textarea rows={2} value={pickupNotes} onChange={e=>setPickupNotes(e.target.value)}/></Field></section>}
      {delivered&&!podDone&&!job.podRecorded&&<DeliveryHandover job={job} value={draft} onChange={v=>{setDraft(v);setError('');}} signature={signature} onSignature={v=>{setSignature(v);setVerifiedSignature(null);setError('');}} signatureVerified={Boolean(signature)&&verifiedSignature===signature} onSaveSignature={()=>saveRecipientSignature(job)} photos={podFiles} onPhotos={v=>{setPodFiles(v);setError('');}} busy={busy} onBack={()=>setView('list')} mode="pod" onConfirm={()=>void savePod(job)}/>}
      {delivered&&(podDone||job.podRecorded)&&<section className="rv-card rv-pod-stage"><div className="rv-success">Signed POD is recorded in XDrive. The official invoice generator will use the stored delivery evidence.</div>{session&&<OfficialPodDownload jobId={job.id} session={session} onSession={setSession}/>}<button className="rv-primary rv-wide" onClick={()=>setView('invoiceJob')}>Create Invoice + Complete POD →</button></section>}
      {!delivered&&step&&<button className="rv-primary rv-wide" disabled={busy} onClick={()=>void transition(job)}>{busy?'Saving status…':job.status==='ON_SITE_PICKUP'?'Confirm Loaded →':step.label+' →'}</button>}
    </section>;
  }
  const header=<header className="rv-header"><div className="rv-brand"><img className="rv-official-logo" src="/driver/reserve-pwa/xdrive-logo-company-3150.png" alt="XDrive Logistics"/><span className="rv-workflow-caption">DRIVER</span></div><button aria-label="Driver menu" onClick={()=>setView('more')}>☰</button></header>;
  return <div className="rv-shell">{header}<main key={tab+'-'+view+'-'+(id||'')} className={'rv-main'+(view==='list'&&(tab==='Quotes'||tab==='Bookings')?' rv-card-first-list':'')}>{!connected?<section className="rv-auth"><span className="rv-over">OFFICIAL XDRIVE DRIVER PWA · LIVE AUTH</span><h1>Driver Sign In</h1><p>Connect with your real XDrive driver account. No demonstration jobs are injected.</p><form onSubmit={e=>void signIn(e)}><Field label="Email"><input type="email" required autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)}/></Field><Field label="Password"><input type="password" required autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)}/></Field><button className="rv-primary rv-wide" disabled={loading}>{loading?'Connecting…':'Sign In →'}</button></form></section>:<>{error&&<div className="rv-error" role="alert">{error}</div>}{warning&&view!=='list'&&<details className="rv-api-notes"><summary>Some live information is temporarily unavailable</summary><p>{warning}</p></details>}{view==='list'&&list()}{view==='details'&&details()}{view==='map'&&job&&<RouteMap from={job.status==='OPEN'?job.from:(job.pickupAddress||job.from)} to={job.status==='OPEN'?job.to:(job.deliveryAddress||job.to)} status={job.status} distanceMiles={job.distanceMiles} travelMinutes={job.travelMinutes} onBack={()=>setView(mapReturnView)}/>} {view==='quoteDetails'&&quoteDetails()}{view==='quote'&&quote()}{view==='incoming'&&incoming()}{view==='statusHistory'&&job&&<><button className="rv-back" onClick={()=>setView('list')}>← Back to Bookings</button><p className="rv-over">BOOKING STATUS / VERIFIED EVENTS</p><h1>{job.yourRef||job.id}</h1><Route job={job} full/><BookingStatusTimeline job={job}/>{['DELIVERED','POD_SUBMITTED'].includes(job.status)&&session&&<section className="rv-card"><h3>Archived delivery evidence</h3><p>Open the official signed POD for this completed booking.</p><OfficialPodDownload jobId={job.id} session={session} onSession={setSession}/></section>}{!['DELIVERED','POD_SUBMITTED'].includes(job.status)&&!job.podRecorded&&<button className="rv-primary rv-wide" onClick={()=>setView('flow')}>Continue Delivery →</button>}</>}{view==='flow'&&flow()}{view==='invoiceJob'&&session&&job&&<LiveInvoiceFlow key={job.id} job={job} session={session} onSession={setSession} onBack={()=>setView('flow')} onList={()=>setView('invoices')}/>}{view==='invoices'&&session&&<><button className="rv-back" onClick={()=>setView('more')}>← Menu</button><LiveInvoices session={session} onSession={setSession}/></>}{view==='more'&&<><div className="rv-heading"><div><span className="rv-over">DRIVER WORKSPACE</span><h1>More & Settings</h1><p>Your vehicle, documents, profile and finance.</p></div></div>{['My Profile','My Vehicle','Documents','Load Alerts','Availability','Return Journeys','Notifications','Invoices','GPS & Tracking','Settings'].map(name=><button className="rv-menuitem" key={name} onClick={()=>{if(name==='Invoices'){setView('invoices');return}if(name==='GPS & Tracking'){setView('gps');return}setMenuSection(name);setMenuOpen(true)}}>{name}<span>›</span></button>)}<button className="rv-outline rv-wide" onClick={()=>{if(session)void revokeLiveSession(session).catch(()=>{});localStorage.removeItem(KEY);setSession(null);setJobs([]);setId(null);setView('list');}}>Sign Out</button></>}</>}</main>{session&&<div style={{display:view==='gps'?undefined:'none'}}><GpsTracking token={session.token} jobs={jobs} visible={view==='gps'} onClose={()=>setView('more')}/></div>}<nav className="rv-nav">{(['Loads','Quotes','Bookings'] as Tab[]).map(t=><button key={t} className={(t===tab&&view!=='more'&&view!=='invoices'?'rv-active ':'')+(t==='Bookings'&&unreadBookingOffers>0?'rv-booking-unread':'')} aria-label={t==='Bookings'&&unreadBookingOffers>0?'Bookings - '+unreadBookingOffers+' new awarded job'+(unreadBookingOffers===1?'':'s'):t} onClick={()=>navigate(t)}><span>{t==='Loads'?'▣':t==='Quotes'?'▤':'▦'}</span>{t}</button>)}</nav>{menuOpen&&<DriverMenu section={menuSection} setSection={setMenuSection} onClose={()=>setMenuOpen(false)} onNavigate={destination=>{setMenuOpen(false);if(destination==='Invoices')setView('invoices');else if(['Loads','Quotes','Bookings'].includes(destination))navigate(destination as Tab);else{setMenuSection(destination);setMenuOpen(true)}}} role={role} available={available} setAvailable={setAvailable} savedCount={0} liveConnected={connected} token={session?.token??null} sharedCache={menuCache} onLogout={()=>{localStorage.removeItem(KEY);setSession(null);setJobs([]);setMenuOpen(false);}}/>}</div>;
}



