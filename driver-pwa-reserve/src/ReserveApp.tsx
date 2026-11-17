import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import './ReserveApp.css';
import { login, loadLiveWithDiagnostics, driverPost, driverGet, bookingOffersGet, applyBookingOffers, applyPersonalBids, bookingOfferRespond, renewSession, revokeLiveSession, mapAssigned, platformJobReference, type LiveSession, type LiveJob } from './liveApi';
import { acceptAndStartCollection } from './acceptAndStartCollection';
import { reserveStatusSteps, reserveUndoTargets } from './reserveLifecycle';
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
import { routeLabel, isDuplicateRouteAddress } from './routeLabel';
import { recoverDeliveredTime } from './podDraftRecovery';
import { driverRoleFromProfile } from './driverRoleFromProfile';

type Tab = 'Loads' | 'Quotes' | 'Bookings';
type BookingSection = 'Received' | 'Allocated' | 'Delivered';
type View = 'list' | 'details' | 'quote' | 'quoteDetails' | 'map' | 'incoming' | 'statusHistory' | 'flow' | 'invoiceJob' | 'more' | 'invoices' | 'gps';
type DeliveryDraft = { recipient: string; leftAt: string; items: string; condition: string; notes: string; deliveredOn: string; deliveredTime: string };
const KEY = 'xdrive-driver-reserve-live-session-v1';
const driverApi = import.meta.env.PROD ? '/api/driver' : '/xdrive-api/driver';
function restored(): LiveSession | null { try { const value = JSON.parse(localStorage.getItem(KEY) || 'null'); return value && typeof value.token === 'string' && typeof value.refreshToken === 'string' && typeof value.expiresAt === 'number' ? value : null; } catch { return null; } }
const gbp = (v: number) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(v);
const friendlyService = (value: string | null | undefined) => ({ timed_direct: 'Timed Direct', same_day: 'Same Day', next_day: 'Next Day', on_demand: 'On Demand' } as Record<string,string>)[String(value||'').toLowerCase()] || String(value||'Transport').replaceAll('_',' ').replace(/\b\w/g, c => c.toUpperCase());
const nextStates = reserveStatusSteps;
const localDateTimeInput = (value:string) => { const date=new Date(value); if(Number.isNaN(date.getTime())) return ''; const pad=(n:number)=>String(n).padStart(2,'0'); return date.getFullYear()+'-'+pad(date.getMonth()+1)+'-'+pad(date.getDate())+'T'+pad(date.getHours())+':'+pad(date.getMinutes()); };
const detectedDeliveryDateTime = () => { const now=new Date(); const pad=(n:number)=>String(n).padStart(2,'0'); return { deliveredOn:now.getFullYear()+'-'+pad(now.getMonth()+1)+'-'+pad(now.getDate()), deliveredTime:pad(now.getHours())+':'+pad(now.getMinutes()) }; };
function Route({ job, full = false, onOpen }: { job: LiveJob; full?: boolean; onOpen?: () => void }) { return <div className={"rv-route"+(onOpen?" rv-route-clickable":"")} role={onOpen?"button":undefined} tabIndex={onOpen?0:undefined} aria-label={onOpen?"Open load details":undefined} onClick={onOpen} onKeyDown={onOpen?(e)=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();onOpen();}}:undefined}><div className="rv-stop"><i/><div><b>{routeLabel(job.from,job.fromOutcode)}</b>{full && job.pickupAddress && !isDuplicateRouteAddress(routeLabel(job.from,job.fromOutcode),job.pickupAddress) ? <span>{job.pickupAddress}</span> : <span className="rv-stop-schedule"><span>Collection · </span><strong className="rv-stop-time">{job.pickup}</strong>{job.pickupDate && <span className="rv-stop-date"> · {job.pickupDate}</span>}</span>}</div></div><div className="rv-stop"><i/><div><b>{routeLabel(job.to,job.toOutcode)}</b>{full && job.deliveryAddress && !isDuplicateRouteAddress(routeLabel(job.to,job.toOutcode),job.deliveryAddress) ? <span>{job.deliveryAddress}</span> : <span className="rv-stop-schedule"><span>Delivery · </span><strong className="rv-stop-time">{job.delivery}</strong>{job.deliveryDate && <span className="rv-stop-date"> · {job.deliveryDate}</span>}</span>}</div></div></div>; }
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
  const [historicalSearchResults,setHistoricalSearchResults]=useState<LiveJob[]|null>(null);
  const [historicalSearchBusy,setHistoricalSearchBusy]=useState(false);
  const [historicalSearchError,setHistoricalSearchError]=useState('');
  const [bookingPeriod,setBookingPeriod]=useState('all');
  const [withdrawId,setWithdrawId]=useState<string|null>(null);
  const [mapReturnView,setMapReturnView]=useState<View>('list');
  const [quoteAmount,setQuoteAmount]=useState('');const [quoteEta,setQuoteEta]=useState('30');const [quoteNotes,setQuoteNotes]=useState('');
  const [items,setItems]=useState('');const [weight,setWeight]=useState('');const [pickupItems,setPickupItems]=useState('');const [pickupWeight,setPickupWeight]=useState('');const [yourReference,setYourReference]=useState('');const [carrierReference,setCarrierReference]=useState('');const [pickupNotes,setPickupNotes]=useState('');const [packaging,setPackaging]=useState('');const [deliveryEtaAt,setDeliveryEtaAt]=useState('');
  const [collectionStage,setCollectionStage]=useState<'arrival'|'loaded'>('arrival');
  const [draft,setDraft]=useState<DeliveryDraft>({recipient:'',leftAt:'Goods Inwards',items:'',condition:'Good condition',notes:'',deliveredOn:'',deliveredTime:''});
  const [signature,setSignature]=useState<string|null>(null);const [verifiedSignature,setVerifiedSignature]=useState<string|null>(null);const [podFiles,setPodFiles]=useState<File[]>([]);const [hardCopyAcknowledged,setHardCopyAcknowledged]=useState(false);
  const uploadedEvidence=useRef(new Map<File,string>());
  const [podDone,setPodDone]=useState(false);const [deliveryArrivalSaved,setDeliveryArrivalSaved]=useState(false);const [collectionFiles,setCollectionFiles]=useState<File[]>([]);const uploadedCollectionEvidence=useRef(new Map<File,string>());
  const [collectionCameraOpen,setCollectionCameraOpen]=useState(false);const [collectionCameraBusy,setCollectionCameraBusy]=useState(false);const collectionVideoRef=useRef<HTMLVideoElement>(null);const collectionStreamRef=useRef<MediaStream|null>(null);
  const stopCollectionCamera=()=>{collectionStreamRef.current?.getTracks().forEach(track=>track.stop());collectionStreamRef.current=null;setCollectionCameraOpen(false);};
  useEffect(()=>()=>{collectionStreamRef.current?.getTracks().forEach(track=>track.stop());},[]);
  useEffect(()=>{if(collectionCameraOpen&&collectionVideoRef.current&&collectionStreamRef.current){collectionVideoRef.current.srcObject=collectionStreamRef.current;void collectionVideoRef.current.play().catch(()=>setError('Camera preview could not start. Check camera permissions.'));}},[collectionCameraOpen]);
  const openCollectionCamera=async()=>{setCollectionCameraBusy(true);setError('');try{if(!navigator.mediaDevices?.getUserMedia)throw new Error('Live camera requires HTTPS or localhost and camera permission.');collectionStreamRef.current=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false});setCollectionCameraOpen(true);}catch(reason){setError(reason instanceof Error?reason.message:'Camera could not be opened. Check camera permissions.');stopCollectionCamera();}finally{setCollectionCameraBusy(false);}};
  const captureCollectionPhoto=async()=>{const video=collectionVideoRef.current;if(!video?.videoWidth){setError('Camera is starting. Wait for the preview and try again.');return;}const canvas=document.createElement('canvas');canvas.width=video.videoWidth;canvas.height=video.videoHeight;const context=canvas.getContext('2d');if(!context){setError('Camera capture is unavailable.');return;}context.drawImage(video,0,0);const blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,'image/jpeg',0.9));if(!blob){setError('Photo could not be captured.');return;}const timestamp=Date.now();setCollectionFiles(previous=>[...previous,new File([blob],'loaded-camera-'+timestamp+'.jpg',{type:'image/jpeg',lastModified:timestamp})]);stopCollectionCamera();setError('');};
  const menuCache=useRef<{token:string;entries:Record<string,DriverRecord>}>({token:'',entries:{}});
  const [menuOpen,setMenuOpen]=useState(false);const [menuSection,setMenuSection]=useState<string|null>(null);
  const [available,setAvailable]=useState(true);const [role,setRole]=useState<'Owner Driver'|'Company Driver'>('Company Driver');
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
  useEffect(()=>{const st={rvView:view,rvTab:tab,rvId:id};if(!historyInitialized.current){historyInitialized.current=true;window.history.replaceState({...window.history.state,...st,rvDepth:0},'');return;}if(browserBackRef.current){browserBackRef.current=false;return;}window.history.pushState({...st,rvDepth:Number(window.history.state?.rvDepth||0)+1},'');},[view,tab,id]);
  const offersFetchRef=useRef(0);
  const offersPendingRef=useRef(false);
  const [offersLoading,setOffersLoading]=useState(false);
  const bidsFetchRef=useRef(0);
  const bidsPendingRef=useRef(false);
  const [bidsLoading,setBidsLoading]=useState(false);
  const fetchJobs=useCallback(async (token:string) => { let result=await loadLiveWithDiagnostics(token, undefined, false, (_feed, freshJobs)=>{setJobs(previous=>{const merged=new Map(previous.map(job=>[job.id,job]));for(const fresh of freshJobs){const prior=merged.get(fresh.id);merged.set(fresh.id,prior&&prior.status!=='OPEN'&&fresh.status==='OPEN'?{...fresh,status:prior.status,backendStatus:prior.backendStatus,podRecorded:prior.podRecorded||fresh.podRecorded}:fresh);}return [...merged.values()];});});if(result.warnings.filter(message=>/invalid session|unauthorized|jwt expired|401/i.test(message)).length>=2)throw new Error('Invalid session: the driver API rejected the saved token.');setJobs(previous=>{const previousById=new Map(previous.map(job=>[job.id,job]));const missingExecutionFeed=result.warnings.some(message=>/Active bookings|Completed bookings/.test(message));const merged=result.jobs.map(fresh=>{const prior=previousById.get(fresh.id);if(!prior||!missingExecutionFeed||prior.status==='OPEN'||fresh.status!=='OPEN')return fresh;return {...prior,...fresh,status:prior.status,backendStatus:prior.backendStatus,podRecorded:prior.podRecorded||fresh.podRecorded,deliveryPhotos:prior.deliveryPhotos?.length?prior.deliveryPhotos:fresh.deliveryPhotos};});if(missingExecutionFeed){const returnedIds=new Set(merged.map(j=>j.id));for(const prior of previous){if(prior.status!=='OPEN'&&!returnedIds.has(prior.id))merged.push(prior);}}return merged;});setWarning(result.warnings.join(' | '));const now=Date.now();if(!offersPendingRef.current&&now-offersFetchRef.current>=15000){offersPendingRef.current=true;offersFetchRef.current=now;setOffersLoading(true);void bookingOffersGet(token).then(offers=>{setJobs(previous=>applyBookingOffers(previous,offers));setOffersLoading(false);setWarning(previous=>previous.split(' | ').filter(message=>message&&!message.startsWith('Booking offers:')).join(' | '));}).catch(reason=>{offersFetchRef.current=0;setOffersLoading(false);setWarning(previous=>[...previous.split(' | ').filter(message=>message&&!message.startsWith('Booking offers:')),'Booking offers: '+(reason instanceof Error?reason.message:'Service unavailable')].filter(Boolean).join(' | '));}).finally(()=>{offersPendingRef.current=false;});}
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
  // Historical reference lookup is authenticated on every request and searches
  // all jobs assigned to this driver, not only the recent History window.
  useEffect(()=>{
    if(!session || tab!=='Bookings' || bookingSection!=='Delivered' || bookingSearch.trim().length<2){
      setHistoricalSearchResults(null);setHistoricalSearchBusy(false);setHistoricalSearchError('');return;
    }
    let cancelled=false;
    setHistoricalSearchResults(null);setHistoricalSearchBusy(true);setHistoricalSearchError('');
    const timeout=setTimeout(()=>{
      void (async()=>{
        const s=await renewSession(session);
        const result=await driverGet('/mobile/jobs?scope=completed&compact=1&reference='+encodeURIComponent(bookingSearch.trim()),s.token,30000);
        if(!cancelled)setHistoricalSearchResults((Array.isArray(result.jobs)?result.jobs:[]).map(mapAssigned));
      })().catch(e=>{
        if(!cancelled)setHistoricalSearchError(e instanceof Error?e.message:'Historical search unavailable. Retry.');
      }).finally(()=>{if(!cancelled)setHistoricalSearchBusy(false);});
    },350);
    return ()=>{cancelled=true;clearTimeout(timeout);};
  },[session?.token,tab,bookingSection,bookingSearch]);
  async function retryLive(){if(!session||loading)return;setLoading(true);setError('');setWarning('');try{const s=await renewSession(session);setSession(s);localStorage.setItem(KEY,JSON.stringify(s));const verifiedRole=driverRoleFromProfile(await driverGet('/profile',s.token,7000));if(!verifiedRole)throw new Error('Driver type could not be verified. Reconnect your account.');setRole(verifiedRole);await fetchJobs(s.token);}catch(e){if(isAuthFailure(e))clearInvalidSession();else setError(e instanceof Error?e.message:'Live service unavailable');}finally{setLoading(false);}}

  useEffect(()=>{if(!session)return;let active=true;setLoading(true);void (async()=>{try{let s=await renewSession(session);let profile:unknown;try{profile=await driverGet('/profile',s.token,7000)}catch(e){if(!isAuthFailure(e))throw e;s=await renewSession(s,true);profile=await driverGet('/profile',s.token,7000)}if(!active)return;const verifiedRole=driverRoleFromProfile(profile);if(!verifiedRole)throw new Error('Driver type could not be verified. Reconnect your account.');setRole(verifiedRole);setSession(s);localStorage.setItem(KEY,JSON.stringify(s));await fetchJobs(s.token);}catch(e){if(active){if(isAuthFailure(e))clearInvalidSession();else setError(e instanceof Error?e.message:'Could not restore session');}}finally{if(active)setLoading(false);}})();return()=>{active=false};},[]);
  async function run<T>(action:(s:LiveSession)=>Promise<T>,done?:(result:T)=>void){if(!session||busy)return;setBusy(true);setError('');try{const s=await renewSession(session);setSession(s);localStorage.setItem(KEY,JSON.stringify(s));const result=await action(s);done?.(result);void fetchJobs(s.token).catch(refreshError=>{setWarning('Job action saved, but live lists could not refresh: '+(refreshError instanceof Error?refreshError.message:'Unknown refresh failure'));});}catch(e){if(isAuthFailure(e))clearInvalidSession();else setError(e instanceof Error?e.message:'Request failed. Please retry.');}finally{setBusy(false)}}
  async function signIn(e:React.FormEvent){e.preventDefault();setLoading(true);setError('');try{const s=await login(email.trim(),password);setSession(s);localStorage.setItem(KEY,JSON.stringify(s));setPassword('');const verifiedRole=driverRoleFromProfile(await driverGet('/profile',s.token,7000));if(!verifiedRole)throw new Error('Driver type could not be verified. Reconnect your account.');setRole(verifiedRole);await fetchJobs(s.token);setTab('Loads');setView('list');}catch(e){if(isAuthFailure(e))clearInvalidSession();else setError(e instanceof Error?e.message:'Authentication failed');}finally{setLoading(false)}}
  function open(j:LiveJob,target:View){if(tab==='Bookings'&&['incoming','details'].includes(target))markOfferSeen(j);setHardCopyAcknowledged(false);setId(j.id);setView(target);setWithdrawId(null);setError('');setPodDone(Boolean(j.podRecorded));setDeliveryArrivalSaved(false);setCollectionStage('arrival');setItems(String(j.items??''));setWeight(j.weight?String(j.weight):'');setPickupItems(String(j.items??''));setPickupWeight(j.weight?String(j.weight):'');setYourReference(platformJobReference(j.id,j.yourRef)||'');setCarrierReference('');setPackaging('');setDeliveryEtaAt('');setPickupNotes('');setCollectionFiles([]);uploadedCollectionEvidence.current.clear();setDraft({recipient:'',leftAt:'Goods Inwards',items:String(j.items??''),condition:'Good condition',notes:'',deliveredOn:'',deliveredTime:''});setSignature(null);setVerifiedSignature(null);setPodFiles([]);uploadedEvidence.current.clear();setQuoteAmount(j.quote!=null&&j.bidStatus!=='withdrawn'?String(j.quote):'');setQuoteNotes(j.bidStatus==='withdrawn'?'':j.quoteNotes||'');setQuoteEta(j.bidStatus==='withdrawn'?'30':j.quoteEtaMinutes!=null?String(j.quoteEtaMinutes):'30');}
  useEffect(()=>{
    if(!session||!job||view!=='flow'||!['DELIVERED','POD_SUBMITTED'].includes(job.status)||job.podRecorded||podDone)return;
    let active=true;
    void (async()=>{
      try{
        // A completed delivery may be reopened after the JWT expires. Refresh
        // credentials before restoring its server-side signed POD draft.
        let authorised=await renewSession(session);
        if(!active)return;
        if(authorised.token!==session.token){setSession(authorised);localStorage.setItem(KEY,JSON.stringify(authorised));}
        const endpoint=driverApi+'/web/jobs/'+encodeURIComponent(job.id)+'/pod-draft';
        let res=await fetch(endpoint,{headers:{Authorization:'Bearer '+authorised.token},cache:'no-store'});
        if(res.status===401){
          authorised=await renewSession(authorised,true);
          if(!active)return;
          setSession(authorised);localStorage.setItem(KEY,JSON.stringify(authorised));
          res=await fetch(endpoint,{headers:{Authorization:'Bearer '+authorised.token},cache:'no-store'});
        }
        if(!res.ok)throw new Error('Could not restore the saved POD draft ('+res.status+'). Your stored evidence is preserved. Reconnect and retry.');
        if(!active)return;
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
          notes:previous.notes||String(saved.notes||''),
          deliveredOn:String(saved.deliveredOn||previous.deliveredOn||''),
          deliveredTime:recoverDeliveredTime(saved.deliveredTime,previous.deliveredTime,job.statusHistory||[],saved.deliveredOn||previous.deliveredOn)
        }));
        if(typeof saved.signatureData==='string'&&/^data:image\/(png|jpeg);base64,/i.test(saved.signatureData)){setSignature(previous=>previous||saved.signatureData);setVerifiedSignature(saved.signatureData);}
      }catch(e){if(active)setError(e instanceof Error?e.message:'Saved POD draft could not be restored. Your evidence has not been deleted.');}
    })();
    return ()=>{active=false};
  },[id,view,job?.status,job?.podRecorded,session?.token]);
  useEffect(()=>{
    if(!session||!job||view!=='flow'||job.status!=='ON_SITE_PICKUP')return;
    let active=true;
    void fetch(driverApi+'/mobile/jobs/'+encodeURIComponent(job.id)+'/handover',{headers:{Authorization:'Bearer '+session.token},cache:'no-store'})
      .then(async response=>{if(!response.ok)throw new Error('Collection stage could not be read');return response.json();})
      .then(data=>{
        if(!active)return;
        const handover=data?.handover&&typeof data.handover==='object'?data.handover:{};
        if(handover.arrival||handover.loaded){
          setCollectionStage('loaded');
          if(handover.loaded&&typeof handover.loaded==='object'){
            const loaded=handover.loaded;
            if(loaded.itemCount!=null)setItems(String(loaded.itemCount));
            if(loaded.weightKg!=null)setWeight(String(loaded.weightKg));
            if(loaded.packaging!=null)setPackaging(String(loaded.packaging));
            if(loaded.etaAt)setDeliveryEtaAt(localDateTimeInput(String(loaded.etaAt)));else if(loaded.etaMinutes!=null)setDeliveryEtaAt(localDateTimeInput(new Date(Date.now()+Number(loaded.etaMinutes)*60000).toISOString()));
            if(typeof loaded.notes==='string')setPickupNotes(loaded.notes);
          }
        }
      })
      .catch(()=>{});
    return ()=>{active=false;};
  },[id,view,job?.status,session?.token]);
  useEffect(()=>{
    if(!session||!job||view!=='flow'||job.status!=='ON_SITE_DELIVERY')return;
    let active=true;
    setDeliveryArrivalSaved(false);
    void fetch(driverApi+'/web/jobs/'+encodeURIComponent(job.id)+'/pod-draft',{headers:{Authorization:'Bearer '+session.token},cache:'no-store'})
      .then(async response=>{if(!response.ok)throw new Error('Delivery arrival record could not be read');return response.json();})
      .then(data=>{
        if(!active)return;
        let saved=false;
        try{
          const record=JSON.parse(data?.draft?.deliveryArrival||'null');
          saved=Boolean(record?.confirmedAt);
          if(saved&&typeof record.notes==='string')setDraft(previous=>({...previous,notes:previous.notes||record.notes}));
        }catch{}
        if(saved)setDraft(previous=>({...previous,...(!previous.deliveredOn||!previous.deliveredTime?detectedDeliveryDateTime():{})}));setDeliveryArrivalSaved(saved);
      })
      .catch(()=>{if(active)setDeliveryArrivalSaved(false);});
    return ()=>{active=false;};
  },[id,view,job?.status,session?.token]);  function navigate(t:Tab){setTab(t);setView('list');setId(null);setWithdrawId(null);setError('');if(t==='Bookings')setBookingSection('Received');}
  function openMap(j:LiveJob,back:View='list'){setId(j.id);setMapReturnView(back);setView('map');setError('');}
  function card(j:LiveJob, mode:'list'|'details'='list'){
    const offered=Boolean(j.acceptanceRequired&&j.offerId);
    const expired=Boolean(j.offerExpired);
    const canWithdraw=tab==='Quotes'&&j.personalBid===true&&j.bidStatus==='submitted'&&Boolean(j.bidId);
    const canEdit=canWithdraw&&j.status==='OPEN';
    const isWithdrawn=j.bidStatus==='withdrawn'||j.quoteOutcome==='CANCELLED';
    const status=tab==='Quotes'&&isWithdrawn?'WITHDRAWN':offered?(j.acceptanceBlocked?'OFFER BLOCKED':expired?'EXPIRED OFFER':'NEW OFFER'):tab==='Quotes'?(isWithdrawn?'WITHDRAWN':j.quoteOutcome==='UNSUCCESSFUL'?'UNSUCCESSFUL':j.quoteOutcome==='AWARDED'?'AWARDED':'SUBMITTED'):j.status==='OPEN'?(j.quote!=null&&j.quoteOutcome!=='CANCELLED'&&j.bidStatus!=='withdrawn'?'QUOTED':'AVAILABLE'):j.status.replaceAll('_',' ');
    return <article key={j.id} className="rv-card rv-job">
      <div className="rv-jobhead"><div className="rv-job-identity"><strong>{j.company||'Transport buyer'}</strong><div className="rv-job-service"><span>{friendlyService(j.service)}</span><b>{j.vehicle}</b></div>{(j.yourRef||j.customerRef)&&<small>Ref: {j.yourRef||j.customerRef}</small>}</div><div className="rv-card-head-actions"><span className={'rv-chip '+(offered?'rv-orange':status==='SUBMITTED'?'rv-green':'')}>{status}</span>{j.postedAt&&!Number.isNaN(Date.parse(j.postedAt))&&<div className="rv-posted-at">Posted: {new Date(j.postedAt).toLocaleString('en-GB',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:false})}</div>}{mode==='details'&&<button className="rv-card-back" aria-label="Back" onClick={()=>setView('list')}>← Back</button>}</div></div>
      <Route job={j} onOpen={()=>open(j,'details')}/>
      {j.notes?.trim()&&<p className="rv-job-notes"><strong>Notes:</strong> {j.notes}</p>}

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
        {!offered&&(j.podRecorded||j.status==='POD_SUBMITTED')&&<p className="rv-sub">Company owners can create or view an invoice after POD validation.</p>}
        {!offered&&j.podRecorded&&role==='Owner Driver'&&<button className="rv-primary rv-wide" onClick={()=>open(j,'invoiceJob')}>Create / View Invoice</button>}{!offered&&j.podRecorded&&<button className="rv-outline rv-wide" onClick={()=>open(j,'flow')}>View Signed POD →</button>}
      </div>}
    </article>;
  }
  async function withdrawQuote(j:LiveJob){
    if(!j.bidId||j.bidStatus!=='submitted'||j.personalBid!==true){setError('Only your submitted quotation can be withdrawn.');return;}
    await run(s=>driverPost('/mobile/bids/'+encodeURIComponent(j.bidId!),s.token,{action:'withdraw'}),()=>{
      setWithdrawId(null);setQuoteSection('History');setView('list');
    });
  }
  function completedAt(j:LiveJob):number {
    const events=(j.statusHistory||[]).filter(e=>/deliver|pod|complet/i.test(e.status));
    const timestamps=events.map(e=>Date.parse(e.at)).filter(Number.isFinite);
    return timestamps.length?Math.max(...timestamps):Date.parse(j.deliveryDate||'')||Date.parse(j.postedAt||'')||0;
  }
  function list(){
    const waitingOffers=tab==='Bookings'&&bookingSection==='Received'&&offersLoading;
    const waitingQuotes=tab==='Quotes'&&bidsLoading;
    const searchingByReference=tab==='Bookings'&&bookingSection==='Delivered'&&bookingSearch.trim().length>=2;
    const sourceJobs=searchingByReference?(historicalSearchResults||[]):jobs;
    const shown = reserveJobs(sourceJobs, tab, '', 'All', quoteSection).filter(j=>tab!=='Bookings'||(bookingSection==='Received'?Boolean(j.acceptanceRequired):bookingSection==='Delivered'?searchingByReference||['DELIVERED','POD_SUBMITTED'].includes(j.status)||Boolean(j.podRecorded):!j.acceptanceRequired&&!['DELIVERED','POD_SUBMITTED'].includes(j.status)&&!j.podRecorded)).filter(j=>tab!=='Bookings'||bookingSection!=='Delivered'||((searchingByReference||!bookingSearch.trim()||[j.id,j.yourRef,j.customerRef,...(j.legacyReferences||[]),j.from,j.to,j.company,j.pickupAddress,j.deliveryAddress].some(v=>String(v||'').toLowerCase().includes(bookingSearch.trim().toLowerCase())))&&(searchingByReference||bookingPeriod==='all'||(Boolean(j.postedAt)&&completedAt(j)>=Date.now()-Number(bookingPeriod)*86400000)))).sort((a,b)=>tab==='Bookings'&&bookingSection==='Delivered'?completedAt(b)-completedAt(a):0);
    return <>
      {tab==='Bookings'&&<div className="rv-quote-tabs rv-booking-tabs" role="group" aria-label="Booking categories">{(['Received','Allocated','Delivered'] as BookingSection[]).map(s=><button key={s} className={bookingSection===s?'rv-selected':''} aria-pressed={bookingSection===s} onClick={()=>setBookingSection(s)}>{s==='Received'?'Pending':s==='Allocated'?'Active':'History'}</button>)}</div>}
      {tab==='Bookings'&&bookingSection==='Delivered'&&<div className="rv-booking-history-tools" style={{display:'flex',gap:8,flexWrap:'wrap',margin:'10px 0 14px'}}><input aria-label="Search booking history" placeholder="Search reference, town, postcode, customer" value={bookingSearch} onChange={e=>setBookingSearch(e.target.value)} style={{flex:'1 1 200px',minWidth:0,padding:11,borderRadius:9,border:'1px solid #cbd5e1'}}/><select aria-label="Booking history period" value={bookingPeriod} onChange={e=>setBookingPeriod(e.target.value)} style={{padding:10,borderRadius:9,border:'1px solid #cbd5e1'}}><option value="all">All time</option><option value="7">7 days</option><option value="30">30 days</option><option value="90">90 days</option></select></div>}
      {tab==='Quotes'&&<div className="rv-quote-tabs" role="group" aria-label="Quote sections">{(['Submitted','Awarded','History'] as QuoteSection[]).map(s=><button key={s} className={quoteSection===s?'rv-selected':''} aria-pressed={quoteSection===s} onClick={()=>{setQuoteSection(s);setWithdrawId(null)}}>{s}</button>)}</div>}
      {loading&&shown.length===0&&<p className="rv-loading-inline" role="status">Refreshing live jobs…</p>}
      {historicalSearchBusy&&searchingByReference&&<p className="rv-loading-inline" role="status">Searching all historical jobs by reference…</p>}
      {historicalSearchError&&searchingByReference&&<p className="rv-warning" role="alert">Historical reference search unavailable: {historicalSearchError}</p>}
      {searchingByReference&&historicalSearchResults&&historicalSearchResults.length>1&&<p className="rv-warning">Several jobs match this historical reference. Check the route and date; no job has been selected automatically.</p>}
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
  function quoteDetails(){if(!job)return null;return <>{detailHeader(job)}<section className="rv-card"><h3>Submitted quote</h3><Fact name="Load reference" value={platformJobReference(job.id,job.yourRef)||'Not provided'}/><Fact name="Company" value={job.company||'Transport buyer'}/><Fact name="Quote amount" value={job.quote==null?'Unavailable':gbp(job.quote)}/><Fact name="Status" value={job.bidStatus==='withdrawn'?'Withdrawn':job.quoteOutcome==='AWARDED'?'Awarded':job.quoteOutcome==='UNSUCCESSFUL'?'Unsuccessful':job.bidStatus==='submitted'?'Submitted':job.bidStatus||job.status.replaceAll('_',' ')}/><Fact name="Vehicle requested" value={job.vehicle}/><Fact name="Payment terms" value={job.terms||'Not provided'}/><Fact name="Collection ETA" value={job.quoteEtaMinutes==null?'Not provided':job.quoteEtaMinutes+' minutes'}/><Fact name="Quote notes" value={job.quoteNotes||'No notes supplied'}/>{job.quoteOutcome==='AWARDED'&&<p className="rv-warning">This quote has been awarded. Editing or withdrawing it would change an accepted commercial commitment and is blocked by XDrive.</p>}{(job.bidStatus==='withdrawn'||job.quoteOutcome==='CANCELLED')&&<p className="rv-warning">This quotation has already been withdrawn. It remains in History for the commercial audit trail.</p>}</section>{tab==='Quotes'&&job.personalBid===true&&job.bidId&&job.bidStatus==='submitted'&&<><div className="rv-actions">{job.status==='OPEN'&&<button className="rv-primary" onClick={()=>setView('quote')}>Edit Quote</button>}<button className="rv-danger" disabled={busy} onClick={()=>setWithdrawId(job.id)}>Withdraw Quote</button></div>{withdrawId===job.id&&<section className="rv-withdraw-confirm" role="alertdialog" aria-label="Confirm quote withdrawal"><strong>Withdraw this quotation?</strong><p>Your quotation will be withdrawn, not erased from the audit history. It can be quoted again only if the job is still available and you are eligible.</p><div className="rv-actions"><button className="rv-outline" onClick={()=>setWithdrawId(null)} disabled={busy}>Keep Quote</button><button className="rv-danger" disabled={busy} onClick={()=>void withdrawQuote(job)}>{busy?'Withdrawing…':'Confirm Withdraw'}</button></div></section>}</>}<button className="rv-outline rv-wide" onClick={()=>setView('details')}>View Load Details →</button></>}
  function details(){if(!job)return null;return <>{detailHeader(job)}<button className="rv-map-action rv-wide" onClick={()=>openMap(job,'details')}>View on Map</button><section className="rv-card"><h3>Transport details</h3><Fact name="Vehicle" value={job.vehicle}/><Fact name="Weight" value={job.weight+' kg'}/><Fact name="Items" value={job.items??'Not stated'}/><Fact name="Payment Terms" value={job.terms||'Not provided'}/><Fact name="Agreed rate / quote" value={job.quote!=null?gbp(job.quote):'Quote required'}/></section><section className="rv-card"><h3>Instructions & References</h3><p>{job.notes||'No additional handling instructions.'}</p>{job.status!=='OPEN'&&<><Fact name="Customer reference" value={job.customerRef||'Not provided'}/><Fact name="Your reference" value={platformJobReference(job.id,job.yourRef)||'Not provided'}/></>}</section>{job.status === 'OPEN'
  ? job.quote == null || job.quoteOutcome==='CANCELLED'||job.bidStatus==='withdrawn'
    ? <button className="rv-primary rv-wide" onClick={()=>setView('quote')}>Quote Now →</button>
    : <><div className="rv-success">Quotation submitted: {gbp(job.quote)}. A second quote cannot be submitted for the same job.</div><button className="rv-outline rv-wide" onClick={()=>setView('quoteDetails')}>View Submitted Quote →</button></>
  : <button className="rv-primary rv-wide" onClick={()=>setView(job.acceptanceRequired?'incoming':'flow')}>{job.acceptanceRequired?'Review Incoming Booking':'Open Booking'} →</button>}</>}
  useEffect(()=>{
    if(!session||!job||view!=='flow'||job.status!=='ON_SITE_PICKUP')return;
    let active=true;
    void driverGet('/mobile/jobs/'+encodeURIComponent(job.id)+'/handover',session.token,10000)
      .then(data=>{if(!active)return;const refs=data?.references as {jobReference?:unknown;carrierCompanyReference?:unknown}|undefined;if(typeof refs?.jobReference!=='string'||typeof refs.carrierCompanyReference!=='string'||!refs.jobReference||!refs.carrierCompanyReference)throw new Error('The XDrive job and carrier IDs could not be verified. Reconnect and retry.');setYourReference(refs.jobReference);setCarrierReference(refs.carrierCompanyReference);const h=data?.handover as Record<string,any>|null;if(h?.arrival){if(h.arrival.itemCount!=null)setPickupItems(String(h.arrival.itemCount));if(h.arrival.weightKg!=null)setPickupWeight(String(h.arrival.weightKg));}if(h?.loaded){if(h.loaded.itemCount!=null)setItems(String(h.loaded.itemCount));if(h.loaded.weightKg!=null)setWeight(String(h.loaded.weightKg));}setCollectionStage(h?.loaded||h?.capturedAt?'loaded':'arrival');})
      .catch(reason=>{if(active){setCarrierReference('');setError(reason instanceof Error?reason.message:'Collection identifiers could not be loaded.');setCollectionStage('arrival');}});
    return ()=>{active=false;};
  },[id,view,job?.status,session?.token]);  useEffect(()=>{
    if(!session||!job||view!=='flow'||job.status!=='ON_SITE_DELIVERY')return;
    let active=true;
    void fetch(driverApi+'/web/jobs/'+encodeURIComponent(job.id)+'/pod-draft',{headers:{Authorization:'Bearer '+session.token},cache:'no-store'})
      .then(async response=>{if(!response.ok)throw new Error('Delivery arrival record could not be read');return response.json();})
      .then(data=>{if(!active)return;let saved=false;try{const record=JSON.parse(data?.draft?.deliveryArrival||'null');saved=Boolean(record?.confirmedAt);}catch{}setDeliveryArrivalSaved(saved);})
      .catch(()=>{if(active)setDeliveryArrivalSaved(false);});
    return ()=>{active=false;};
  },[id,view,job?.status,session?.token]);  function quote(){
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
  async function acceptIncomingJob(j:LiveJob){
    if(!j.offerId||j.acceptanceBlocked)return;
    await run(s=>acceptAndStartCollection(j.id,{
      accept:()=>bookingOfferRespond(s.token,j.offerId!,'accept'),
      setStatus:next=>driverPost('/mobile/jobs/'+encodeURIComponent(j.id)+'/status',s.token,{nextStatus:next}),
      readStatus:async()=>{
        const response=await driverGet('/mobile/jobs/'+encodeURIComponent(j.id),s.token);
        const row=response.job&&typeof response.job==='object'&&!Array.isArray(response.job)
          ? response.job as Record<string,unknown>:null;
        return String(row?.currentStatus||row?.current_status||row?.status||'');
      },
    }),outcome=>{
      setTab('Bookings');
      // A contract response we cannot verify must stay in Pending, not vanish into Active.
      setBookingSection(outcome.accepted?'Allocated':'Received');
      if(!outcome.departed){
        setView('list');
        setWarning(outcome.reason||(outcome.accepted
          ? 'Booking accepted, but the departure status is not confirmed. Refresh before continuing.'
          : 'Acceptance could not be confirmed. Refresh the offer before taking another action.'));
        return;
      }
      setWarning('');
      setJobs(rows=>rows.map(row=>row.id===j.id
        ? {...row,status:'ON_WAY_TO_PICKUP',backendStatus:'on_my_way',acceptanceRequired:false}:row));
      setId(j.id);setView('flow');
    });
  }
  function incoming(){if(!job)return null;return <><button className="rv-back" onClick={()=>setView('list')}>← Bookings</button><span className="rv-over">BOOKINGS / INCOMING JOB</span><h1>{'New Job Received'}</h1><div className="rv-attention">{job.acceptanceBlocked?'This awarded booking cannot be accepted because its quotation is no longer active. Contact the transport buyer to issue a valid new offer.':'Booking awarded. Your response is required.'}</div><section className="rv-card rv-offer"><div className="rv-jobhead"><div><strong>{job.company}</strong><small>{platformJobReference(job.id,job.yourRef)||'Reference unavailable'}</small></div><span className="rv-chip rv-orange">{'AWARDED'}</span></div><Route job={job} full/><Fact name="Vehicle" value={job.vehicle}/><Fact name="Your agreed rate" value={job.quote!=null?gbp(job.quote):'Not supplied'}/><Fact name="Payment terms" value={job.terms||'Not supplied'}/><Fact name="Collection" value={(job.pickupDate||'')+' '+job.pickup}/><Fact name="Delivery" value={(job.deliveryDate||'')+' '+job.delivery}/><button className="rv-outline rv-wide" onClick={()=>setView('details')}>View Booking Details →</button></section><div className="rv-actions"><button className="rv-danger" disabled={busy} onClick={()=>void run(s=>bookingOfferRespond(s.token,job.offerId!,'decline'),()=>navigate('Bookings'))}>Decline Job</button><button className="rv-primary" disabled={busy||job.acceptanceBlocked} onClick={()=>void acceptIncomingJob(job)}>Accept Job</button></div></>}
  const undoTargets = reserveUndoTargets;
  async function undoLatestStatus(j:LiveJob){
    const target=undoTargets[j.status];
    if(!target||!window.confirm('Undo the last confirmed transport status? This change will be recorded in booking history.'))return;
    await run(s=>driverPost('/mobile/jobs/'+encodeURIComponent(j.id)+'/undo-status',s.token,{expectedCurrentStatus:target.expected}),result=>{
      const confirmed=result.job&&typeof result.job==='object'&&!Array.isArray(result.job)?result.job as Record<string,unknown>:null;
      const restored=confirmed?mapAssigned(confirmed):null;
      const expectedServerStatus:Record<string,string>={on_my_way:'accepted',on_site_pickup:'on_my_way',loaded:'on_site_pickup',in_transit:'loaded',on_site_delivery:'in_transit'};
      const serverStatus=String(confirmed?.currentStatus||'').toLowerCase();
      if(!confirmed||confirmed.id!==j.id||serverStatus!==expectedServerStatus[target.expected]||restored?.status!==target.previous){
        setWarning('Undo returned an unexpected status. Refresh the booking before another action.');
        return;
      }
      setJobs(rows=>rows.map(row=>row.id===j.id?{...row,status:restored.status,backendStatus:serverStatus,statusHistory:restored.statusHistory?.length?restored.statusHistory:row.statusHistory}:row));
      setDeliveryArrivalSaved(false);setCollectionStage('arrival');setError('');
    });
  }
  async function transition(j:LiveJob) {
    const step=nextStates[j.status];if(!step)return;
    await run(async s=>{
      if(j.status==='ALLOCATED'&&['allocated','assigned'].includes(j.backendStatus||'allocated'))await driverPost('/mobile/jobs/'+encodeURIComponent(j.id)+'/status',s.token,{nextStatus:'accepted'});
      if(j.status==='ON_SITE_DELIVERY'&&!deliveryArrivalSaved){
        const endpoint=driverApi+'/web/jobs/'+encodeURIComponent(j.id)+'/pod-draft';
        const existingResponse=await fetch(endpoint,{headers:{Authorization:'Bearer '+s.token},cache:'no-store'});
        if(!existingResponse.ok)throw new Error('Could not read the delivery arrival record.');
        const existing=await existingResponse.json().catch(()=>({}));
        const prior=existing.draft&&typeof existing.draft==='object'&&!Array.isArray(existing.draft)?existing.draft:{};
        const deliveryArrival=JSON.stringify({confirmedAt:new Date().toISOString()});
        const saved=await fetch(endpoint,{method:'PUT',headers:{Authorization:'Bearer '+s.token,'Content-Type':'application/json'},body:JSON.stringify({...prior,deliveryArrival})});
        if(!saved.ok){const detail=await saved.json().catch(()=>({}));throw new Error(detail.error||'Delivery arrival could not be saved.');}
        return;
      }      if(j.status==='ON_SITE_PICKUP'){
        // Validate before uploading evidence so invalid inputs cannot leave orphaned files.
        if(collectionStage==='loaded'){
          if(!items.trim()||!weight.trim())throw new Error('Items and Weight (kg) are required at loading.');
          if(deliveryEtaAt.trim()){
            const candidate=new Date(deliveryEtaAt);
            if(!Number.isFinite(candidate.getTime()))throw new Error('Enter a valid delivery ETA or leave it blank.');
            if(candidate.getTime()<=Date.now())throw new Error('Delivery ETA must be in the future.');
          }
        }
        if(collectionStage==='arrival'){
          const arrivalItems=pickupItems.trim()===''?null:Number(pickupItems);
          const arrivalWeight=pickupWeight.trim()===''?null:Number(pickupWeight);
          if(arrivalItems!==null&&(!Number.isInteger(arrivalItems)||arrivalItems<1))throw new Error('If supplied, Items Collected must be a positive whole number.');
          if(arrivalWeight!==null&&(!Number.isFinite(arrivalWeight)||arrivalWeight<=0))throw new Error('If supplied, Weight (kg) must be positive.');
        }
        const evidence=await uploadCollectionEvidence(j,s.token);
        if(collectionStage==='loaded'&&!evidence.photos.length)throw new Error('XDrive requires at least one collection/loading photo before confirming Loaded Info. Add a photo and retry.');
        if(collectionStage==='arrival'){
          const arrivalItems=pickupItems.trim()===''?null:Number(pickupItems);const arrivalWeight=pickupWeight.trim()===''?null:Number(pickupWeight);if(arrivalItems!==null&&(!Number.isInteger(arrivalItems)||arrivalItems<1))throw new Error('If supplied, Items Collected must be a positive whole number.');if(arrivalWeight!==null&&(!Number.isFinite(arrivalWeight)||arrivalWeight<=0))throw new Error('If supplied, Weight (kg) must be positive.');await driverPost('/mobile/jobs/'+encodeURIComponent(j.id)+'/handover',s.token,{stage:'arrival',itemCount:arrivalItems,weightKg:arrivalWeight,notes:pickupNotes,photoPaths:evidence.photos,documentPaths:evidence.documents});
          return;
        }
        if(!yourReference||!carrierReference)throw new Error('XDrive job reference and carrier ID must be loaded from the server before saving. Reconnect and retry.');
        if(items.trim()===''||weight.trim()==='')throw new Error('Items and Weight (kg) are required at loading.'); const itemCount=items.trim()===''?null:Number(items);
        const weightKg=weight.trim()===''?null:Number(weight);
        const etaDate=deliveryEtaAt.trim()===''?null:new Date(deliveryEtaAt);
        if(itemCount!==null&&(!Number.isInteger(itemCount)||itemCount<1))throw new Error('Enter a whole item count greater than zero, or leave it blank.');
        if(weightKg!==null&&(!Number.isFinite(weightKg)||weightKg<=0))throw new Error('Enter a weight greater than zero, or leave it blank.');
        if(etaDate&&!Number.isFinite(etaDate.getTime()))throw new Error('Enter a valid ETA date and time, or leave it blank.');if(etaDate&&etaDate.getTime()<=Date.now())throw new Error('Delivery ETA must be in the future.');
        const etaAt=etaDate?etaDate.toISOString():null;
        await driverPost('/mobile/jobs/'+encodeURIComponent(j.id)+'/handover',s.token,{stage:'loaded',itemCount,packaging:packaging.trim(),weightKg,etaAt,notes:pickupNotes,photoPaths:evidence.photos,documentPaths:evidence.documents});
      }
      await driverPost('/mobile/jobs/'+encodeURIComponent(j.id)+'/status',s.token,{nextStatus:step.backend,notes:pickupNotes.trim()});
    },()=>{
      if(j.status==='ON_SITE_DELIVERY'&&!deliveryArrivalSaved){setDraft(previous=>({...previous,...detectedDeliveryDateTime()}));setDeliveryArrivalSaved(true);setError('');return;}
            if(j.status==='ON_SITE_PICKUP'&&collectionStage==='arrival'){
        setCollectionStage('loaded');setItems(pickupItems);setWeight(pickupWeight);setPickupNotes('');setCollectionFiles([]);uploadedCollectionEvidence.current.clear();setError('');return;
      }
      setJobs(rows=>rows.map(x=>x.id===j.id?{...x,status:step.status}:x));
    });
  }
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
  async function uploadCollectionEvidence(j:LiveJob, token:string):Promise<{photos:string[];documents:string[]}>{
    const photos:string[]=[];
    const documents:string[]=[];
    for(const file of collectionFiles){
      if(!['image/png','image/jpeg','application/pdf'].includes(file.type)||file.size<=0||file.size>10*1024*1024)throw new Error('Collection evidence must be JPEG, PNG or PDF under 10 MB.');
      const category=file.type==='application/pdf'?'documents':'photos';
      let path=uploadedCollectionEvidence.current.get(file);
      if(!path){
        const uploadFile=await prepareDeliveryUpload(file);
        const response=await fetch(driverApi+'/mobile/jobs/'+encodeURIComponent(j.id)+'/evidence',{
          method:'POST',
          headers:{Authorization:'Bearer '+token,'Content-Type':uploadFile.type,'x-xdrive-evidence-kind':'collection','x-xdrive-evidence-category':category,'x-xdrive-evidence-name':crypto.randomUUID()+'-'+uploadFile.name.replace(/[^A-Za-z0-9._-]/g,'_').slice(0,130)},
          body:uploadFile,
        });
        const data=await response.json().catch(()=>({}));
        if(!response.ok||typeof data.storagePath!=='string')throw new Error(data.error||'Collection evidence upload failed (HTTP '+response.status+').');
        const uploadedPath=data.storagePath as string;
        path=uploadedPath;
        uploadedCollectionEvidence.current.set(file,uploadedPath);
      }
      if(!path)throw new Error('Collection evidence storage path was not returned.');
      (category==='photos'?photos:documents).push(path);
    }
    return {photos,documents};
  }
  async function uploadDeliveryEvidence(j:LiveJob, token:string) {
    const photos:string[]=[...(j.deliveryPhotos||[])];
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
    const body={...prior,recipientName:draft.recipient.trim(),signatureData:signature,leftAt:draft.leftAt,itemCount:draft.items,deliveryStatus:draft.condition,deliveredOn:draft.deliveredOn,deliveredTime:draft.deliveredTime,notes:draft.notes};
    const saved=await fetch(endpoint,{method:'PUT',headers:{Authorization:'Bearer '+s.token,'Content-Type':'application/json'},body:JSON.stringify(body)});
    if(!saved.ok){const detail=await saved.json().catch(()=>({}));throw new Error(detail.error||'Signature save failed ('+saved.status+').');}
    const verified=await fetch(endpoint,{headers:{Authorization:'Bearer '+s.token},cache:'no-store'});
    if(!verified.ok)throw new Error('Signature submitted but verification failed. Check before retrying.');
    const confirmation=await verified.json().catch(()=>({}));
    if(confirmation?.draft?.signatureData!==signature)throw new Error('Server did not return the saved signature. It is not yet verified.');
    setVerifiedSignature(signature);
  }
  async function completeDelivery(j:LiveJob) {if(!deliveryArrivalSaved){setError('Save On Site Delivery arrival before confirming delivery.');return}if(!signature||verifiedSignature!==signature){setError('Save and verify the recipient signature before confirming delivery.');return}if(!draft.recipient.trim()||!draft.leftAt.trim()||!/^\d{4}-\d{2}-\d{2}$/.test(draft.deliveredOn)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(draft.deliveredTime)||!Number.isInteger(Number(draft.items))||Number(draft.items)<=0 ){setError('Recipient, Left At, Delivered On, Delivery Time and a valid item count are required.');return}await run(async s=>{const body={recipientName:draft.recipient,leftAt:draft.leftAt,itemCount:draft.items,deliveryStatus:draft.condition,deliveredOn:draft.deliveredOn,deliveredTime:draft.deliveredTime,notes:draft.notes};const evidence=await uploadDeliveryEvidence(j,s.token);const updatedDraft={...body,signatureData:signature,photoUris:evidence.photos,documentUris:evidence.documents};const saved=await fetch(driverApi+'/web/jobs/'+encodeURIComponent(j.id)+'/pod-draft',{method:'PUT',headers:{Authorization:'Bearer '+s.token,'Content-Type':'application/json'},body:JSON.stringify(updatedDraft)});if(!saved.ok){const detail=await saved.json().catch(()=>({}));throw new Error(detail.error||'Signed POD draft could not be saved ('+saved.status+')')}if(!evidence.photos.length)throw new Error('XDrive requires at least one verified delivery photo before Delivered. Add a delivery photo and retry.');const confirmation=await fetch(driverApi+'/mobile/jobs/'+encodeURIComponent(j.id)+'/confirmation',{method:'POST',headers:{Authorization:'Bearer '+s.token,'Content-Type':'application/json'},body:JSON.stringify({recipientName:draft.recipient.trim(),signatureData:signature,evidencePath:evidence.photos[0]})});const confirmationResult=await confirmation.json().catch(()=>({}));if(!confirmation.ok||confirmationResult.ok!==true)throw new Error(confirmationResult.error||'Recipient signature could not be verified by XDrive ('+confirmation.status+').');await driverPost('/mobile/jobs/'+encodeURIComponent(j.id)+'/status',s.token,{nextStatus:'delivered'});},()=>{setJobs(rows=>rows.map(x=>x.id===j.id?{...x,status:'DELIVERED'}:x));});}
  async function savePod(j:LiveJob){if(j.hardCopyPodRequired&&!hardCopyAcknowledged){setError('Confirm that the required paper POD will be retained and handed over before submitting.');return}if(!signature||verifiedSignature!==signature){setError('Save and verify the recipient signature before submitting POD.');return}if(!draft.recipient.trim()||!draft.leftAt.trim()||!/^\d{4}-\d{2}-\d{2}$/.test(draft.deliveredOn)||!Number.isInteger(Number(draft.items))||Number(draft.items)<=0){setError('Recipient, Left At, Delivered On and item count are required for POD.');return}await run(async s=>{const officialPodComplete=async()=>{const verification=await fetch(driverApi+'/web/jobs/'+encodeURIComponent(j.id)+'/pod-draft',{headers:{Authorization:'Bearer '+s.token},cache:'no-store'});if(!verification.ok)throw new Error('Official POD state could not be read ('+verification.status+').');const verified=await verification.json().catch(()=>({}));return verified.completed===true;};if(await officialPodComplete())return;const {photos,documents}=await uploadDeliveryEvidence(j,s.token);let submitError:unknown=null;try{const response=await driverPost('/mobile/jobs/'+encodeURIComponent(j.id)+'/pod',s.token,{recipientName:draft.recipient,leftAt:draft.leftAt,deliveredOn:draft.deliveredOn,deliveredTime:draft.deliveredTime,itemCount:Number(draft.items),notes:draft.notes,signatureData:signature,photoUris:photos,documentUris:documents,hardCopyAcknowledged:j.hardCopyPodRequired?hardCopyAcknowledged:false,deliveryStatus:draft.condition==='Refused'?'Refused':draft.condition==='Shortage'?'Partial Delivery':'Completed Delivery'});if(response.ok!==true)throw new Error('XDrive did not confirm the POD submission.');}catch(e){submitError=e;}let isComplete=false;try{isComplete=await officialPodComplete();}catch(e){if(!submitError)throw e;}if(!isComplete)throw submitError instanceof Error?submitError:new Error('POD is not confirmed complete on the server. Check its status before attempting another submission.');},()=>{setPodDone(true);setJobs(rows=>rows.map(row=>row.id===j.id?{...row,status:'DELIVERED',podRecorded:true}:row));});}

  function flow(){
    if(!job)return null;
    if(job.status==='ON_SITE_DELIVERY'){
      return <DeliveryHandover job={job} value={draft} onChange={v=>{if(v.recipient!==draft.recipient||v.leftAt!==draft.leftAt||v.items!==draft.items||v.condition!==draft.condition||v.notes!==draft.notes)setVerifiedSignature(null);setDraft(v);setError('');}} signature={signature} onSignature={v=>{setSignature(v);setVerifiedSignature(null);setError('');}} signatureVerified={Boolean(signature)&&verifiedSignature===signature} onSaveSignature={()=>saveRecipientSignature(job)} photos={podFiles} onPhotos={v=>{setPodFiles(v);setError('');}} busy={busy} onUndo={()=>void undoLatestStatus(job)} onBack={()=>setView('list')} mode={deliveryArrivalSaved?"delivery":"arrival"} onConfirm={()=>void (deliveryArrivalSaved?completeDelivery(job):transition(job))}/>;
    }    const step=nextStates[job.status];
    const delivered=job.status==='DELIVERED'||job.status==='POD_SUBMITTED';
    if(job.podRecorded||podDone)return <section className="rv-operation-screen"><button className="rv-back" onClick={()=>setView('statusHistory')}>← Booking status</button><h1>Completed booking · Signed POD</h1><Route job={job} full/><p>The signed POD is archived and read-only. Delivery cannot be repeated.</p>{session&&<OfficialPodDownload jobId={job.id} session={session} onSession={setSession}/>}{role==='Owner Driver'&&<button className="rv-primary rv-wide" onClick={()=>setView('invoiceJob')}>Create / View Invoice</button>}<p className="rv-sub">Company owners can create or view an invoice after POD validation.</p></section>;
    return <section className="rv-operation-screen">
      {(!delivered||podDone||job.podRecorded)&&<><button className="rv-back" onClick={()=>setView('list')}>← Back to Bookings</button>
      <span className="rv-over">BOOKING OPERATIONS</span>
      <h1>{delivered?'Proof of Delivery':job.status==='ON_SITE_PICKUP'?'Complete Collection':job.status==='ALLOCATED'?'View Booking':step?.label||'Booking'}</h1>
      <span className="rv-chip rv-orange">{job.status.replaceAll('_',' ')}</span>
      <Route job={job} full/>{undoTargets[job.status]&&<button type="button" className="rv-undo-action rv-wide" disabled={busy} onClick={()=>void undoLatestStatus(job)}>Undo Last Status</button>}</>}
      {job.status==='ALLOCATED'&&<section className="rv-card"><h3>On my Way to Pickup</h3><Fact name="Customer" value={job.company||'Customer'}/><Fact name="Booking reference" value={platformJobReference(job.id,job.yourRef)||'Not provided'}/><Field label="Driver’s Notes"><textarea rows={4} maxLength={1000} value={pickupNotes} onChange={e=>setPickupNotes(e.target.value)} placeholder="Add collection notes"/></Field></section>}
      {job.status==='ON_SITE_PICKUP'&&<section className="rv-card">
        <span className="rv-over">COLLECTION / {collectionStage==='arrival'?'ARRIVAL':'LOADED INFO'}</span>
        <h3>{collectionStage==='arrival'?'On Site (Pickup)':'Loaded'}</h3>
        <div className="rv-two">
          <Field label="XDrive Job Reference"><input readOnly aria-readonly="true" value={yourReference} placeholder="Loading from XDrive…"/></Field>
          <Field label="Transport Operator XDrive ID"><input readOnly aria-readonly="true" value={carrierReference} placeholder="Loading from XDrive…"/></Field>
        </div>
        {collectionStage==='arrival'?<>
          <p>Record arrival notes or photos if useful. Quantity and weight can be confirmed once the vehicle is loaded.</p>
          <div className="rv-two"><Field label="Items Collected (optional)"><input type="number" min="1" step="1" value={pickupItems} onChange={e=>setPickupItems(e.target.value)}/></Field><Field label="Weight (kg) (optional)"><input type="number" min="0.000001" step="any" value={pickupWeight} onChange={e=>setPickupWeight(e.target.value)}/></Field></div>
          <Field label="Driver Notes"><textarea rows={3} maxLength={1000} value={pickupNotes} onChange={e=>setPickupNotes(e.target.value)}/></Field>
          <Field label="Collection documents and photos"><input type="file" accept="image/jpeg,image/png,application/pdf" multiple onChange={e=>{const selected=Array.from(e.target.files||[]);setCollectionFiles(previous=>[...previous,...selected]);e.target.value='';}}/></Field>
          <Field label="Take collection photo"><button type="button" className="rv-outline" disabled={collectionCameraBusy} onClick={()=>void openCollectionCamera()}>{collectionCameraBusy?'Opening camera…':'Open Camera'}</button></Field>
          {collectionCameraOpen&&<section className="rv-card" aria-label="Live collection camera"><video ref={collectionVideoRef} autoPlay playsInline muted aria-label="Live collection camera preview" style={{width:"100%",maxHeight:"65vh",background:"#111",borderRadius:12}}/><div className="rv-two"><button type="button" className="rv-primary" onClick={()=>void captureCollectionPhoto()}>Take Photo</button><button type="button" className="rv-outline" onClick={stopCollectionCamera}>Cancel</button></div></section>}
        </>:<>
          <p>Enter the load details before confirming that the vehicle is loaded.</p>
          <div className="rv-two"><Field label="Items *"><input required type="number" min="1" step="1" value={items} onChange={e=>setItems(e.target.value)}/></Field><Field label="Weight (kg) *"><input required type="number" min="0.000001" step="any" value={weight} onChange={e=>setWeight(e.target.value)}/></Field></div>
          <Field label="Packaging"><input type="text" maxLength={120} placeholder="e.g. Pallets, boxes" value={packaging} onChange={e=>setPackaging(e.target.value)}/></Field>
          <Field label="ETA to delivery (date and time) (optional)"><input type="datetime-local" value={deliveryEtaAt} onChange={e=>setDeliveryEtaAt(e.target.value)}/></Field>
          <Field label="Driver notes"><textarea rows={2} maxLength={1000} value={pickupNotes} onChange={e=>setPickupNotes(e.target.value)}/></Field>
          <Field label="Loaded documents and photos (at least one photo required)"><input type="file" accept="image/jpeg,image/png,application/pdf" multiple onChange={e=>{const selected=Array.from(e.target.files||[]);setCollectionFiles(previous=>[...previous,...selected]);e.target.value='';}}/></Field>
          <Field label="Take loaded photo"><button type="button" className="rv-outline" disabled={collectionCameraBusy} onClick={()=>void openCollectionCamera()}>{collectionCameraBusy?'Opening camera…':'Open Camera'}</button></Field>
          {collectionCameraOpen&&<section className="rv-card" aria-label="Live loaded cargo camera"><video ref={collectionVideoRef} autoPlay playsInline muted aria-label="Live loaded cargo camera preview" style={{width:"100%",maxHeight:"65vh",background:"#111",borderRadius:12}}/><div className="rv-two"><button type="button" className="rv-primary" onClick={()=>void captureCollectionPhoto()}>Take Photo</button><button type="button" className="rv-outline" onClick={stopCollectionCamera}>Cancel</button></div></section>}
        </>}
        {collectionFiles.length>0&&<ul>{collectionFiles.map((file,index)=><li key={file.name+'-'+index}>{file.name} <button type="button" className="rv-outline" onClick={()=>setCollectionFiles(previous=>previous.filter((_,i)=>i!==index))}>Remove</button></li>)}</ul>}
      </section>}
      {delivered&&!podDone&&!job.podRecorded&&<section className="rv-card rv-pod-stage"><span className="rv-over">DELIVERED / POD</span><h2>Recipient details and signature saved</h2><Fact name="Received By" value={draft.recipient}/><Fact name="Left At" value={draft.leftAt}/><Fact name="Items" value={draft.items}/><Fact name="Delivered On" value={draft.deliveredOn}/><Field label="Delivery Time *"><input type="time" required value={draft.deliveredTime} onChange={e=>setDraft(previous=>({...previous,deliveredTime:e.target.value}))}/></Field><p>The delivery signature was verified before the Delivered status. Submit the final POD to archive the evidence.</p>{job.hardCopyPodRequired&&<label className="rv-hard-copy-ack"><input type="checkbox" checked={hardCopyAcknowledged} onChange={e=>setHardCopyAcknowledged(e.target.checked)}/> I acknowledge that the required paper POD must be retained and handed over as instructed.</label>}<button className="rv-primary rv-wide" disabled={busy||!signature||verifiedSignature!==signature||(job.hardCopyPodRequired&&!hardCopyAcknowledged)} onClick={()=>void savePod(job)}>{busy?'Saving POD…':'Confirm and Save Signed POD →'}</button></section>}
      {delivered&&(podDone||job.podRecorded)&&<section className="rv-card rv-pod-stage"><div className="rv-success">Signed POD is recorded in XDrive. The official invoice generator will use the stored delivery evidence.</div>{session&&<OfficialPodDownload jobId={job.id} session={session} onSession={setSession}/>}{role==='Owner Driver'&&<button className="rv-primary rv-wide" onClick={()=>setView('invoiceJob')}>Create / View Invoice</button>}<p className="rv-sub">Company owners can create or view an invoice after POD validation.</p></section>}
      {!delivered&&step&&<button className="rv-primary rv-wide" disabled={busy} onClick={()=>void transition(job)}>{busy?'Saving status…':job.status==='ALLOCATED'?'Save':job.status==='ON_SITE_PICKUP'?(collectionStage==='arrival'?'Save':'Save'):step.label+' →'}</button>}
    </section>;
  }
  const header=<header className="rv-header rv-official-header"><div className="rv-official-brand"><img src={`${import.meta.env.BASE_URL}xdrive-logo-company-3150.png`} alt="XDrive Logistics"/></div><button className="rv-official-menu" aria-label="Open driver menu" onClick={()=>{setMenuSection(null);setMenuOpen(true)}}>Menu</button></header>;
  return <div className="rv-shell">{header}<main key={tab+'-'+view+'-'+(id||'')} className={'rv-main'+(view==='list'&&(tab==='Quotes'||tab==='Bookings')?' rv-card-first-list':'')}>{!connected?<section className="rv-auth"><span className="rv-over">OFFICIAL XDRIVE DRIVER PWA · LIVE AUTH</span><h1>Driver Sign In</h1><p>Connect with your real XDrive driver account. No demonstration jobs are injected.</p><form onSubmit={e=>void signIn(e)}><Field label="Email"><input type="email" required autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)}/></Field><Field label="Password"><input type="password" required autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)}/></Field><button className="rv-primary rv-wide" disabled={loading}>{loading?'Connecting…':'Sign In →'}</button></form></section>:<>{error&&<div className="rv-error" role="alert">{error}</div>}{warning&&view!=='list'&&<details className="rv-api-notes"><summary>Some live information is temporarily unavailable</summary><p>{warning}</p></details>}{view==='list'&&list()}{view==='details'&&details()}{view==='map'&&job&&<RouteMap from={job.status==='OPEN'?job.from:(job.pickupAddress||job.from)} to={job.status==='OPEN'?job.to:(job.deliveryAddress||job.to)} status={job.status} distanceMiles={job.distanceMiles} travelMinutes={job.travelMinutes} onBack={()=>setView(mapReturnView)}/>} {view==='quoteDetails'&&quoteDetails()}{view==='quote'&&quote()}{view==='incoming'&&incoming()}{view==='statusHistory'&&job&&<><button className="rv-back" onClick={()=>setView('list')}>← Back to Bookings</button><p className="rv-over">BOOKING STATUS</p><h1>{platformJobReference(job.id,job.yourRef)||'Reference unavailable'}</h1>{!(job.podRecorded||['DELIVERED','POD_SUBMITTED','COMPLETED'].includes(job.status))&&<Route job={job} full/>}<BookingStatusTimeline job={job}/>{undoTargets[job.status]&&<button className="rv-undo-action rv-wide" disabled={busy} onClick={()=>void undoLatestStatus(job)}>Undo Last Status</button>}{job.podRecorded&&role==='Owner Driver'&&<section className="rv-card"><h3>Invoice after signed POD</h3><p>Signed POD is archived. XDrive Finance checks your permissions, invoice eligibility and whether an invoice already exists before allowing creation.</p><button className="rv-primary rv-wide" onClick={()=>setView('invoiceJob')}>Create / View Invoice</button></section>}{['DELIVERED','POD_SUBMITTED'].includes(job.status)&&!job.podRecorded&&<section className="rv-card"><h3>Finalise Proof of Delivery</h3><p>Delivery is marked as completed, but the signed POD has not yet been confirmed as archived. Complete the recipient details, signature and required evidence before invoice eligibility can be checked.</p><button className="rv-primary rv-wide" onClick={()=>setView('flow')}>Complete / Save Signed POD →</button></section>}{!['DELIVERED','POD_SUBMITTED'].includes(job.status)&&!job.podRecorded&&<button className="rv-primary rv-wide" onClick={()=>setView('flow')}>Continue Booking Workflow →</button>}</>}{view==='flow'&&flow()}{view==='invoiceJob'&&session&&job&&<LiveInvoiceFlow key={job.id} job={job} session={session} onSession={setSession} onBack={()=>setView('flow')} onList={()=>setView('invoices')}/>}{view==='invoices'&&session&&<><button className="rv-back" onClick={()=>setView('more')}>← Menu</button><LiveInvoices session={session} onSession={setSession}/></>}{view==='more'&&<><div className="rv-heading"><div><span className="rv-over">DRIVER WORKSPACE</span><h1>More & Settings</h1><p>Your vehicle, documents, profile and finance.</p></div></div>{['My Profile','My Vehicle','Documents','Load Alerts','Availability','Return Journeys','Notifications','Invoices','GPS & Tracking','Settings'].map(name=><button className="rv-menuitem" key={name} onClick={()=>{if(name==='Invoices'){setView('invoices');return}if(name==='GPS & Tracking'){setView('gps');return}setMenuSection(name);setMenuOpen(true)}}>{name}<span>›</span></button>)}<button className="rv-outline rv-wide" onClick={()=>{if(session)void revokeLiveSession(session).catch(()=>{});localStorage.removeItem(KEY);setSession(null);setJobs([]);setId(null);setView('list');}}>Sign Out</button></>}</>}</main>{session&&<div style={{display:view==='gps'?undefined:'none'}}><GpsTracking token={session.token} jobs={jobs} visible={view==='gps'} onClose={()=>setView('more')}/></div>}<nav className="rv-nav rv-official-nav">{([{key:'Loads',label:'Loads',icon:'📦'},{key:'Quotes',label:'Quotes',icon:'💬'},{key:'Bookings',label:'Bookings',icon:'🚚'}] as const).map(item=><button key={item.key} className={(item.key===tab&&view!=='more'&&view!=='invoices'?'rv-active ':'')+(item.key==='Bookings'&&unreadBookingOffers>0?'rv-booking-unread':'')} aria-label={item.key==='Bookings'&&unreadBookingOffers>0?'Bookings - '+unreadBookingOffers+' new awarded jobs':item.label} onClick={()=>navigate(item.key)}><span>{item.icon}</span>{item.label}</button>)}</nav>{menuOpen&&<DriverMenu section={menuSection} setSection={setMenuSection} onClose={()=>setMenuOpen(false)} onNavigate={destination=>{setMenuOpen(false);if(destination==='Invoices')setView('invoices');else if(['Loads','Quotes','Bookings'].includes(destination))navigate(destination as Tab);else{setMenuSection(destination);setMenuOpen(true)}}} role={role} available={available} setAvailable={setAvailable} savedCount={0} liveConnected={connected} token={session?.token??null} sharedCache={menuCache} onLogout={()=>{if(session)void revokeLiveSession(session).catch(()=>{});localStorage.removeItem(KEY);setSession(null);setJobs([]);setMenuOpen(false);setView('list');}}/>}</div>;
}



