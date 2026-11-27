import GpsTracking from './GpsTracking';
import {archiveLocalCollection,archiveLocalPod,downloadLocalPod} from './localPodEvidence';
import {localBookingFixtures} from './localBookingFixtures';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import './ReserveApp.css';
import { login, loadLiveWithDiagnostics, driverPost, driverGet, bookingOffersGet, applyBookingOffers, applyPersonalBids, bookingOfferRespond, renewSession, resetLiveSession, revokeLiveSession, mapAssigned, platformJobReference, type LiveSession, type LiveJob, type LiveStop } from './liveApi';
import {packagingOptions,availableTimes,localMinute} from './bookingFieldOptions';
import { reserveStatusSteps, reserveUndoTargets } from './reserveLifecycle';
import LiveInvoices from './LiveInvoices';
import RouteMap from './RouteMap';
import BookingDistance from './BookingDistance';
import LiveInvoiceFlow from './LiveInvoiceFlow';
import OfficialPodDownload from './OfficialPodDownload';
import { reserveJobs, type QuoteSection } from './reserveLists';
import BookingStatusTimeline from './BookingStatusTimeline';
import ReserveBookingExtras from './ReserveBookingExtras';
import DeliveryHandover from './DeliveryHandover';
import { routeLabel } from './routeLabel';
import { recoverDeliveredTime } from './podDraftRecovery';
import { driverRoleFromProfile } from './driverRoleFromProfile';
import { readDriverSessionHandoff, clearDriverSessionHandoff } from '../../lib/driverSessionHandoff';
import ReserveStopExecution, {clearReserveStopDrafts} from './ReserveStopExecution';
import {finishReserveDelivery} from './reserveDeliverySequence';
import {operationalExecutionStops,persistedStops,syncBoundaryStop} from './reserveStopSync';
import SearchLoads from './SearchLoads';
import QuoteNow036 from './QuoteNow036';
import LoadDetails036 from './LoadDetails036';
import OriginalMorePwa from './OriginalMorePwa';
import {defaults as defaultSearchFilters,restoredFilters,matchesLoad,type SearchFilters} from './loadSearchFilters';
import {searchAvailableLoads} from './searchLocation';

type Tab = 'Loads' | 'Quotes' | 'Bookings';
type BookingSection = 'Received' | 'Allocated' | 'Delivered';
const reserveViews = ['searchLoads', 'list', 'details', 'quote', 'quoteDetails', 'map', 'incoming', 'statusHistory', 'flow', 'bookingExtras', 'invoiceJob', 'invoices', 'gps', 'more'] as const;
type View = typeof reserveViews[number];

function readReserveNavigation(value: unknown, defaultTab: Tab) {
  const state = (value ?? {}) as Partial<{
    rvView: View; rvTab: Tab; rvId: string | null; rvDepth: number;
    rvBookingSection: BookingSection; rvQuoteSection: QuoteSection; rvMapReturnView: View;
  }>;
  const id = typeof state.rvId === 'string' && state.rvId ? state.rvId : null;
  const view = state.rvView && reserveViews.includes(state.rvView) ? state.rvView : 'list';
  const requiresJob = ['details', 'quote', 'quoteDetails', 'map', 'incoming', 'statusHistory', 'flow', 'bookingExtras', 'invoiceJob'].includes(view);
  return {
    id,
    view: requiresJob && !id ? 'list' as const : view,
    tab: state.rvTab === 'Loads' || state.rvTab === 'Quotes' || state.rvTab === 'Bookings' ? state.rvTab : defaultTab,
    bookingSection: state.rvBookingSection === 'Allocated' || state.rvBookingSection === 'Delivered' ? state.rvBookingSection : 'Received' as const,
    quoteSection: state.rvQuoteSection === 'Awarded' || state.rvQuoteSection === 'History' ? state.rvQuoteSection : 'Submitted' as const,
    mapReturnView: state.rvMapReturnView && reserveViews.includes(state.rvMapReturnView) ? state.rvMapReturnView : 'list' as const,
    depth: typeof state.rvDepth === 'number' && Number.isSafeInteger(state.rvDepth) && state.rvDepth >= 0 ? state.rvDepth : 0,
  };
}
type DeliveryDraft = { recipient: string; leftAt: string; items: string; condition: string; notes: string; deliveredOn: string; deliveredTime: string };
const KEY = 'xdrive-driver-reserve-live-session-v1';
const driverApi = import.meta.env.PROD ? '/api/driver' : '/xdrive-api/driver';
function restored(): LiveSession | null { try { const value = JSON.parse(localStorage.getItem(KEY) || 'null'); return value && typeof value.token === 'string' && typeof value.refreshToken === 'string' && typeof value.expiresAt === 'number' ? value : null; } catch { return null; } }
function persistDriverSession(session: LiveSession) {
  localStorage.setItem(KEY, JSON.stringify(session));
  if (location.origin === 'https://www.xdrivelogistics.co.uk' && session.token) {
    const seconds = Math.max(0, Math.floor((session.expiresAt-Date.now())/1000));
    document.cookie = 'xdrive-route-access-token='+encodeURIComponent(session.token)+'; Path=/; SameSite=Lax; Secure; Max-Age='+seconds;
  }
}
function clearDriverSession() {
  localStorage.removeItem(KEY);
  if (location.origin === 'https://www.xdrivelogistics.co.uk') document.cookie='xdrive-route-access-token=; Path=/; SameSite=Lax; Secure; Max-Age=0';
}
const gbp = (v: number) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(v);
const friendlyService = (value: string | null | undefined) => ({ timed_direct: 'Timed Direct', same_day: 'Same Day', next_day: 'Next Day', on_demand: 'On Demand' } as Record<string,string>)[String(value||'').toLowerCase()] || String(value||'Transport').replaceAll('_',' ').replace(/\b\w/g, c => c.toUpperCase());
const nextStates = reserveStatusSteps;
const localDateTimeInput = (value:string) => { const date=new Date(value); if(Number.isNaN(date.getTime())) return ''; const pad=(n:number)=>String(n).padStart(2,'0'); return date.getFullYear()+'-'+pad(date.getMonth()+1)+'-'+pad(date.getDate())+'T'+pad(date.getHours())+':'+pad(date.getMinutes()); };
const detectedDeliveryDateTime = () => { const now=new Date(); const pad=(n:number)=>String(n).padStart(2,'0'); return { deliveredOn:now.getFullYear()+'-'+pad(now.getMonth()+1)+'-'+pad(now.getDate()), deliveredTime:pad(now.getHours())+':'+pad(now.getMinutes()) }; };
function Route({job,full=false,onOpen}:{job:LiveJob;full?:boolean;onOpen?:()=>void}) {
 const allStops=job.routeStops?.length?[...job.routeStops].sort((a,b)=>a.sequence-b.sequence):undefined;
 const executing=!job.acceptanceRequired&&['ALLOCATED','ON_WAY_TO_PICKUP','ON_SITE_PICKUP','LOADED','ON_WAY_TO_DELIVERY','ON_SITE_DELIVERY'].includes(job.status);
 const collecting=['ALLOCATED','ON_WAY_TO_PICKUP','ON_SITE_PICKUP'].includes(job.status);
 const remaining=allStops?.filter(s=>!['completed','cancelled','skipped'].includes(s.status));
 const current=collecting?remaining?.find(s=>s.type==='collection'):remaining?.find(s=>s.type==='delivery');
 const next=collecting?remaining?.find(s=>s.type==='delivery'):undefined;
 const stops=full&&allStops?(executing&&allStops.length>2?[current,next].filter((s):s is LiveStop=>Boolean(s)):allStops):undefined;
 return <div className={"rv-route"+(onOpen?" rv-route-clickable":"")} role={onOpen?"button":undefined} tabIndex={onOpen?0:undefined} onClick={onOpen} onKeyDown={onOpen?(e)=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();onOpen();}}:undefined}>
 {stops?stops.map(stop=><div className="rv-stop" key={stop.id}><i/><div><b>{stop.type==='collection'?'Collection':'Delivery'}{(allStops?.length??0)>2?' '+stop.sequence:''}</b><span>{stop.company}</span><span>{stop.address||'Address not provided'}</span><span>{stop.contactPerson}</span>{stop.telephone&&<span><a href={'tel:'+stop.telephone}>{stop.telephone}</a></span>}<span>{stop.timeWindowFrom|| (stop.type==='collection'?job.pickup:job.delivery)}{stop.timeWindowTo?' - '+stop.timeWindowTo:''}</span>{stop.notes&&<span>{stop.notes}</span>}</div></div>):[true,false].map(pickup=><div className="rv-stop" key={String(pickup)}><i/><div><b>{routeLabel(pickup?job.from:job.to,pickup?job.fromOutcode:job.toOutcode)}</b>{full&&(pickup?job.pickupAddress:job.deliveryAddress)&&<span>{pickup?job.pickupAddress:job.deliveryAddress}</span>}<span className="rv-stop-schedule">{pickup?'Collection':'Delivery'}: <strong>{pickup?job.pickup:job.delivery}</strong></span></div></div>)}
 </div>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="rv-field"><span>{label}</span>{children}</label>; }
function Fact({ name, value }: { name: string; value: string | number }) { return <div className="rv-fact"><span>{name}</span><strong>{value || 'Not provided'}</strong></div>; }
declare const __BOOKING_LOCAL__: boolean;
const LOCAL = typeof __BOOKING_LOCAL__ !== "undefined" && __BOOKING_LOCAL__;
export default function ReserveApp() {
  const [session,setSession] = useState<LiveSession|null>(()=>LOCAL?null:readDriverSessionHandoff() ?? restored());
  const [email,setEmail]=useState('');const [password,setPassword]=useState('');
  const [loading,setLoading]=useState(false);const [busy,setBusy]=useState(false);
  const [undoConfirmation,setUndoConfirmation]=useState<LiveJob|null>(null); const [declineConfirmation,setDeclineConfirmation]=useState<LiveJob|null>(null); const [error,setError]=useState('');const [warning,setWarning]=useState('');
  const [jobs,setJobs]=useState<LiveJob[]>(()=>{if(!LOCAL)return [];try{const saved=JSON.parse(localStorage.getItem("xdrive-local-bookings-v4")||"null") as LiveJob[]|null;return saved?[...localBookingFixtures.filter(f=>f.customerRef==="DEMO-MULTIDROP-03"&&!saved.some(j=>j.id===f.id)&&!localStorage.getItem("xdrive-local-declined-v4-"+f.id)),...saved].map(j=>{const f=localBookingFixtures.find(f=>f.id===j.id);return {...j,pickupAddress:f?.pickupAddress||j.pickupAddress,deliveryAddress:f?.deliveryAddress||j.deliveryAddress,routeStops:j.routeStops?.map(stop=>({...f?.routeStops?.find(x=>x.id===stop.id),...stop,address:f?.routeStops?.find(x=>x.id===stop.id)?.address||stop.address}))||f?.routeStops};}):localBookingFixtures;}catch{return localBookingFixtures;}}); useEffect(()=>{if(LOCAL)localStorage.setItem("xdrive-local-bookings-v4",JSON.stringify(jobs));},[jobs]);
  const [initialNavigation] = useState(() => readReserveNavigation(LOCAL || session ? window.history.state : null, LOCAL ? 'Bookings' : 'Loads'));
  const [tab,setTab]=useState<Tab>(initialNavigation.tab);const [view,setView]=useState<View>(initialNavigation.view);
  const [moreNavigationKey,setMoreNavigationKey]=useState(0);
  const [id,setId]=useState<string|null>(initialNavigation.id);
  const [quoteSection,setQuoteSection]=useState<QuoteSection>(initialNavigation.quoteSection);
  const [bookingSection,setBookingSection]=useState<BookingSection>(initialNavigation.bookingSection);
  const [searchFilters,setSearchFilters]=useState<SearchFilters>(()=>{try{return restoredFilters(localStorage.getItem('xdrive-reserve-load-search-v1'));}catch{return defaultSearchFilters();}});
  const [searchResult,setSearchResult]=useState<{ids:Set<string>;unknown:number;pickupRoadMiles:Record<string,number>;filters:SearchFilters}|null>(null);
  const [searchBusy,setSearchBusy]=useState(false);
  const [searchError,setSearchError]=useState('');
  const searchAbort=useRef<AbortController|null>(null);
  useEffect(()=>{if(view!=='searchLoads'){searchAbort.current?.abort();searchAbort.current=null;setSearchBusy(false);}},[view]);
  useEffect(()=>{if(!session?.token){searchAbort.current?.abort();setSearchResult(null);}},[session?.token]);
  function clearLoadSearch(){searchAbort.current?.abort();searchAbort.current=null;setSearchBusy(false);setSearchError('');setSearchFilters(defaultSearchFilters());setSearchResult(null);try{localStorage.removeItem('xdrive-reserve-load-search-v1');}catch{/* preference only */}}
  async function applyLoadSearch(f:SearchFilters){
    if(!session?.token){setSearchError('Sign in with your real driver account to search live loads.');return;}
    searchAbort.current?.abort();const controller=new AbortController();searchAbort.current=controller;setSearchBusy(true);setSearchError('');
    try{const activeSession=await renewSession(session);if(controller.signal.aborted)return;const result=await searchAvailableLoads(reserveJobs(jobs,'Loads'),f,activeSession.token,controller.signal);if(!controller.signal.aborted&&searchAbort.current===controller){setSearchFilters(f);setSearchResult({...result,filters:f});setView('list');}}
    catch(e){if(!controller.signal.aborted)setSearchError(e instanceof Error?e.message:'Search could not be completed.');}
    finally{if(searchAbort.current===controller){searchAbort.current=null;setSearchBusy(false);}}
  }
  const [bookingSearch,setBookingSearch]=useState('');
  const [historicalSearchResults,setHistoricalSearchResults]=useState<LiveJob[]|null>(null);
  const [historicalSearchBusy,setHistoricalSearchBusy]=useState(false);
  const [historicalSearchError,setHistoricalSearchError]=useState('');
  const [bookingPeriod,setBookingPeriod]=useState('all');
  const [withdrawId,setWithdrawId]=useState<string|null>(null);
  const [mapReturnView,setMapReturnView]=useState<View>(initialNavigation.mapReturnView);
  const [quoteAmount,setQuoteAmount]=useState('');const [quoteEta,setQuoteEta]=useState('30');const [quoteNotes,setQuoteNotes]=useState('');
  const [items,setItems]=useState('');const [weight,setWeight]=useState('');const [pickupItems,setPickupItems]=useState('');const [pickupWeight,setPickupWeight]=useState('');const [yourReference,setYourReference]=useState('');const [carrierReference,setCarrierReference]=useState('');const [pickupNotes,setPickupNotes]=useState('');const [packaging,setPackaging]=useState('');const [deliveryEtaAt,setDeliveryEtaAt]=useState('');
  const [collectionStage,setCollectionStage]=useState<'arrival'|'loaded'>('arrival');
  const [draft,setDraft]=useState<DeliveryDraft>({recipient:'',leftAt:'Goods Inwards',items:'',condition:'Completed Delivery',notes:'',deliveredOn:'',deliveredTime:''});
  const [signature,setSignature]=useState<string|null>(null);const [verifiedSignature,setVerifiedSignature]=useState<string|null>(null);const [podFiles,setPodFiles]=useState<File[]>([]);const [hardCopyAcknowledged,setHardCopyAcknowledged]=useState(false);
  const uploadedEvidence=useRef(new Map<File,string>());
  const boundaryEvidence=useRef(new Map<string,Map<File,string>>());
  const [podDone,setPodDone]=useState(false);const [collectionFiles,setCollectionFiles]=useState<File[]>([]);const uploadedCollectionEvidence=useRef(new Map<File,string>());
   const [collectionCameraOpen,setCollectionCameraOpen]=useState(false);const [collectionCameraBusy,setCollectionCameraBusy]=useState(false);const collectionVideoRef=useRef<HTMLVideoElement>(null);const collectionStreamRef=useRef<MediaStream|null>(null);
  const stopCollectionCamera=()=>{collectionStreamRef.current?.getTracks().forEach(track=>track.stop());collectionStreamRef.current=null;setCollectionCameraOpen(false);};
  useEffect(()=>()=>{collectionStreamRef.current?.getTracks().forEach(track=>track.stop());},[]);
  useEffect(()=>{if(collectionCameraOpen&&collectionVideoRef.current&&collectionStreamRef.current){collectionVideoRef.current.srcObject=collectionStreamRef.current;void collectionVideoRef.current.play().catch(()=>setError('Camera preview could not start. Check camera permissions.'));}},[collectionCameraOpen]);
  const openCollectionCamera=async()=>{setCollectionCameraBusy(true);setError('');try{if(!navigator.mediaDevices?.getUserMedia)throw new Error('Live camera requires HTTPS or localhost and camera permission.');collectionStreamRef.current=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false});setCollectionCameraOpen(true);}catch(reason){setError(reason instanceof Error?reason.message:'Camera could not be opened. Check camera permissions.');stopCollectionCamera();}finally{setCollectionCameraBusy(false);}};
  const captureCollectionPhoto=async()=>{const video=collectionVideoRef.current;if(!video?.videoWidth){setError('Camera is starting. Wait for the preview and try again.');return;}const canvas=document.createElement('canvas');canvas.width=video.videoWidth;canvas.height=video.videoHeight;const context=canvas.getContext('2d');if(!context){setError('Camera capture is unavailable.');return;}context.drawImage(video,0,0);const blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,'image/jpeg',0.9));if(!blob){setError('Photo could not be captured.');return;}const timestamp=Date.now();setCollectionFiles(previous=>[...previous,new File([blob],'loaded-camera-'+timestamp+'.jpg',{type:'image/jpeg',lastModified:timestamp})]);stopCollectionCamera();setError('');};
  const [role,setRole]=useState<'Owner Driver'|'Company Driver'>(LOCAL?'Owner Driver':'Company Driver');
  const job=jobs.find(j=>j.id===id);
  const [financeHistory,setFinanceHistory]=useState<Record<string,{invoiceExists:boolean;canCreate:boolean;blocker:string}>>({});
  const [financeHistoryLoaded,setFinanceHistoryLoaded]=useState(false);
  useEffect(()=>{setFinanceHistory({});setFinanceHistoryLoaded(false);},[session?.token]);
  useEffect(()=>{if(view==='invoiceJob'){setFinanceHistory({});setFinanceHistoryLoaded(false);}},[view]);
  useEffect(()=>{
    if(LOCAL||!session?.token||role!=='Owner Driver'||tab!=='Bookings'||view!=='list'||bookingSection!=='Delivered')return;
    let cancelled=false;
    setFinanceHistoryLoaded(false);
    void driverGet('/finance/jobs/eligible?reserveContexts=1',session.token,15000).then(data=>{
      if(cancelled)return;
      const next:Record<string,{invoiceExists:boolean;canCreate:boolean;blocker:string}>={};
      for(const raw of Array.isArray(data.contexts)?data.contexts:[]){
        if(!raw||typeof raw!=='object'||typeof raw.id!=='string')continue;
        next[raw.id]={invoiceExists:Boolean(raw.invoice?.id),canCreate:raw.can_create_invoice===true,blocker:typeof raw.blocker==='string'?raw.blocker:''};
      }
      setFinanceHistory(next);setFinanceHistoryLoaded(true);
    }).catch(()=>{if(!cancelled){setFinanceHistory({});setFinanceHistoryLoaded(true);}});
    return()=>{cancelled=true;};
  },[session?.token,role,tab,view,bookingSection]);
  function invoiceAction(j:LiveJob):{label:string;target:View}{
    if(LOCAL)return {label:localStorage.getItem("xdrive-booking-invoice-v4-"+j.id)?'View Invoice':'Create Invoice',target:'invoiceJob'};
    const state=financeHistory[j.id];
    if(state?.invoiceExists)return {label:'View Invoice',target:'invoiceJob'};
    if(role==='Owner Driver'&&!financeHistoryLoaded)return {label:'Checking Invoice…',target:'invoiceJob'};
    if(state?.canCreate)return {label:'Create Invoice',target:'invoiceJob'};
    if(!j.podRecorded&&j.podEvidenceComplete===false)return {label:'Complete POD',target:'flow'};
    if(state?.blocker||j.podEvidenceComplete===false)return {label:'Review Invoice Eligibility',target:'invoiceJob'};
    return {label:'Check Invoice',target:'invoiceJob'};
  }
  const [localDriver,setLocalDriver]=useState('Me (Owner Driver)');const [localVehicle,setLocalVehicle]=useState('');const [localAllocations,setLocalAllocations]=useState<Record<string,{driver:string;vehicle:string}>>(()=>{try{return JSON.parse(localStorage.getItem('xdrive-local-allocations-v4')||'{}')}catch{return {}}});
  // Read receipts are per authenticated driver and per awarded offer, not per tab visit.
  const receiptKey=(()=>{try{const payload=JSON.parse(atob((session?.token||'').split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));return 'xdrive-reserve-booking-seen-v1:'+String(payload.sub||'unknown');}catch{return 'xdrive-reserve-booking-seen-v1:unknown';}})();
  const [seenOffers,setSeenOffers]=useState<string[]>([]);
  useEffect(()=>{try{const value=JSON.parse(localStorage.getItem(receiptKey)||'[]');setSeenOffers(Array.isArray(value)?value.filter((v:unknown)=>typeof v==='string'):[]);}catch{setSeenOffers([]);}},[receiptKey]);
  const markOfferSeen=(j:LiveJob)=>{if(!j.offerId||!j.acceptanceRequired)return;setSeenOffers(previous=>{if(previous.includes(j.offerId!))return previous;const next=[...previous,j.offerId!];try{localStorage.setItem(receiptKey,JSON.stringify(next));}catch{}return next;});};
  const unreadBookingOffers=jobs.filter(j=>j.acceptanceRequired&&j.offerId&&!seenOffers.includes(j.offerId)).length;
  const isAuthFailure=(e:unknown)=>/invalid session|unauthorized|session expired|invalid.grant|refresh.token|already.used|jwt expired|401/i.test(e instanceof Error?e.message:String(e));
  const clearInvalidSession=()=>{refreshGeneration.current++;refreshPending.current=false;feedCache.current.clear();commercialCache.current={};setVerifiedSession(false);setOffersLoading(false);setBidsLoading(false);setPendingFeeds({marketplace:true,bookings:true,completed:true});resetLiveSession();clearReserveStopDrafts();clearDriverSession();setSession(null);setJobs([]);setId(null);setError('Session expired. Please sign in again.');};
  useLayoutEffect(()=>{window.scrollTo(0,0);document.documentElement.scrollTop=0;document.body.scrollTop=0;const frame=requestAnimationFrame(()=>window.scrollTo(0,0));return()=>cancelAnimationFrame(frame);},[view,tab,id]);
  useEffect(()=>{if('scrollRestoration' in history)history.scrollRestoration='manual';},[]);
  const browserBackRef = useRef(false);
  useEffect(() => {
    const pop = (event: PopStateEvent) => {
      const next = readReserveNavigation(event.state, LOCAL ? 'Bookings' : 'Loads');
      browserBackRef.current = true;
      setView(next.view);
      setTab(next.tab);
      setId(next.id);
      setBookingSection(next.bookingSection);
      setQuoteSection(next.quoteSection);
      setMapReturnView(next.mapReturnView);
    };
    window.addEventListener('popstate', pop);
    return () => window.removeEventListener('popstate', pop);
  }, []);
  const historyInitialized = useRef(false);
  useEffect(() => {
    const state = { rvView: view, rvTab: tab, rvId: id, rvBookingSection: bookingSection, rvQuoteSection: quoteSection, rvMapReturnView: mapReturnView };
    if (browserBackRef.current) {
      browserBackRef.current = false;
      return;
    }
    const current = window.history.state;
    const depth = readReserveNavigation(current, tab).depth;
    if (!historyInitialized.current) {
      historyInitialized.current = true;
      window.history.replaceState({ ...current, ...state, rvDepth: depth }, '');
    } else if (Object.entries(state).some(([key, value]) => current?.[key] !== value)) {
      window.history.pushState({ ...current, ...state, rvDepth: depth + 1 }, '');
    }
  }, [view, tab, id, bookingSection, quoteSection, mapReturnView]);
  const [pendingFeeds,setPendingFeeds]=useState({marketplace:true,bookings:true,completed:true});
  const [failedFeeds,setFailedFeeds]=useState({marketplace:false,bookings:false,completed:false});
  const refreshGeneration=useRef(0);
  const [offersLoading,setOffersLoading]=useState(false);
  const [bidsLoading,setBidsLoading]=useState(false);
  const refreshPending=useRef(false);
  const signInPending = useRef(false);
  // Session-only snapshots. A successful feed replaces its own previous snapshot;
  // an unavailable feed cannot erase an unrelated feed or expose another account.
  const feedCache=useRef(new Map<string,LiveJob[]>());
  const commercialCache=useRef<{offers?:Awaited<ReturnType<typeof bookingOffersGet>>;bids?:Awaited<ReturnType<typeof driverGet>>}>({});
  const [verifiedSession,setVerifiedSession]=useState(false);
  const connected=LOCAL||Boolean(session&&verifiedSession);

  const fetchJobs=useCallback(async (token:string) => {
    const generation=++refreshGeneration.current;
    const current=()=>generation===refreshGeneration.current;
    refreshPending.current=true;
    const firstLoad=feedCache.current.size===0;
    setPendingFeeds({marketplace:!feedCache.current.has('marketplace'),bookings:!feedCache.current.has('bookings'),completed:!feedCache.current.has('completed')});
    setOffersLoading(!commercialCache.current.offers);setBidsLoading(!commercialCache.current.bids);
    // Give the initial marketplace request first access to the connection; never
    // hold other tabs behind a stalled request for more than two seconds.
    let releaseSecondary=()=>{};
    let priorityTimer: ReturnType<typeof setTimeout>|undefined;
    const secondaryReady=firstLoad?new Promise<void>(resolve=>{releaseSecondary=()=>{clearTimeout(priorityTimer);resolve();};priorityTimer=setTimeout(releaseSecondary,2000);}):Promise.resolve();
    const render=()=>{
      if(!current())return;
      const next=new Map<string,LiveJob>();
      for(const source of ['marketplace','bookings','completed']){
        for(const row of feedCache.current.get(source)||[])next.set(row.id,row);
      }
      const {offers,bids}=commercialCache.current;
      const withOffers=offers?applyBookingOffers([...next.values()],offers):[...next.values()];
      const rows=bids?applyPersonalBids(withOffers,bids):withOffers;
      setJobs(previous=>{
        const byId=new Map(previous.map(row=>[row.id,row]));
        // Retain object identity for unchanged cards.
        return rows.map(row=>{const prior=byId.get(row.id);return prior&&JSON.stringify(prior)===JSON.stringify(row)?prior:row;});
      });
    };
    const notice=(source:string,reason?:unknown)=>{
      if(!current())return;
      setWarning(previous=>[...previous.split(' | ').filter(message=>message&&!message.startsWith(source+':')),reason?source+': '+(reason instanceof Error?reason.message:'Service unavailable'):''].filter(Boolean).join(' | '));
    };
    const failed=(source:string,reason:unknown)=>{
      const message=reason instanceof Error?reason.message:String(reason);
      notice(source,reason);
      if(/invalid session|unauthorized|jwt expired|401|403/i.test(message)){
        // Do not retain restricted data after an authority failure.
        refreshGeneration.current++;refreshPending.current=false;feedCache.current.clear();commercialCache.current={};setVerifiedSession(false);setOffersLoading(false);setBidsLoading(false);setPendingFeeds({marketplace:false,bookings:false,completed:false});setJobs([]);resetLiveSession();clearReserveStopDrafts();clearDriverSession();setSession(null);setId(null);setError('Session expired or access denied. Sign in again.');
      }
    };
    const offersRequest=secondaryReady.then(()=>current()?bookingOffersGet(token):Promise.reject(new Error('Refresh superseded'))).then(data=>{
      if(!current())return;if(!Array.isArray(data.offers))throw Error('Invalid booking offers response');
      commercialCache.current.offers=data;render();notice('Booking offers');
    }).catch(reason=>{if(current()){delete commercialCache.current.offers;failed('Booking offers',reason);render();}}).finally(()=>{if(current())setOffersLoading(false);});
    const bidsRequest=secondaryReady.then(()=>current()?driverGet('/mobile/bids',token,30000):Promise.reject(new Error('Refresh superseded'))).then(data=>{
      if(!current())return;if(!Array.isArray(data.bids))throw Error('Invalid quote history response');
      commercialCache.current.bids=data;render();notice('Quote history');
    }).catch(reason=>{if(current()){delete commercialCache.current.bids;failed('Quote history',reason);render();}}).finally(()=>{if(current())setBidsLoading(false);});
    try{
      const result=await loadLiveWithDiagnostics(token,undefined,false,(feed,freshJobs)=>{
        if(!current())return;
        feedCache.current.set(feed,freshJobs);render();
      },(feed,reason)=>{
        if(feed==='marketplace')releaseSecondary();
        if(!current())return;
        if(reason){
          // Marketplace and executable records must not remain actionable after
          // their own authority/source fails. Completed history is also cleared.
          feedCache.current.delete(feed);failed(feed,reason);render();
        }else notice(feed);
        setFailedFeeds(previous=>({...previous,[feed]:Boolean(reason)}));
        setPendingFeeds(previous=>({...previous,[feed]:false}));
      },secondaryReady,current);
      if(!current())return;
      if(result.warnings.filter(message=>/invalid session|unauthorized|jwt expired|401/i.test(message)).length>=2)throw new Error('Invalid session: the driver API rejected the saved token.');
    }finally{
      releaseSecondary();
      void Promise.allSettled([offersRequest,bidsRequest]).then(()=>{if(current())refreshPending.current=false;});
    }
  },[]);
  // Refresh only while the list is visible, never interrupt a proof or booking action.
  useEffect(()=>{
    if(LOCAL||!session||!verifiedSession||view!=='list'||busy||loading)return;
    let disposed=false;let running=false;
    const refresh=async()=>{
      if(disposed||running||refreshPending.current||document.visibilityState!=='visible'||!navigator.onLine)return;
      running=true;const epoch=refreshGeneration.current;
      try{
        const next=await renewSession(session);
        if(disposed||epoch!==refreshGeneration.current)return;
        if(next.token!==session.token){setSession(next);persistDriverSession(next);}
        await fetchJobs(next.token);
      }catch(reason){
        if(disposed)return;
        if(isAuthFailure(reason))clearInvalidSession();
        else setWarning(previous=>[previous,'Live sync: '+(reason instanceof Error?reason.message:'Unavailable')].filter(Boolean).join(' | '));
      }finally{running=false;}
    };
    const timer=window.setInterval(()=>{void refresh();},15000);
    const resume=()=>{void refresh();};
    window.addEventListener('online',resume);
    document.addEventListener('visibilitychange',resume);
    return()=>{disposed=true;window.clearInterval(timer);window.removeEventListener('online',resume);document.removeEventListener('visibilitychange',resume);};
  },[session?.token,verifiedSession,view,busy,loading,fetchJobs]);
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
  async function retryLive(){if(!session||loading)return;setLoading(true);setError('');setWarning('');try{const s=await renewSession(session);setSession(s);persistDriverSession(s);const verifiedRole=driverRoleFromProfile(await driverGet('/profile',s.token,7000));if(!verifiedRole)throw new Error('Driver type could not be verified. Reconnect your account.');setRole(verifiedRole);setVerifiedSession(true);await fetchJobs(s.token);}catch(e){if(isAuthFailure(e))clearInvalidSession();else setError(e instanceof Error?e.message:'Live service unavailable');}finally{setLoading(false);}}

  useEffect(()=>{if(!LOCAL)clearDriverSessionHandoff();if(!session)return;let active=true;setLoading(true);void (async()=>{try{let s=await renewSession(session);let profile:unknown;try{profile=await driverGet('/profile',s.token,7000)}catch(e){if(!isAuthFailure(e))throw e;s=await renewSession(s,true);profile=await driverGet('/profile',s.token,7000)}if(!active)return;const verifiedRole=driverRoleFromProfile(profile);if(!verifiedRole)throw new Error('Driver type could not be verified. Reconnect your account.');setRole(verifiedRole);setVerifiedSession(true);setSession(s);persistDriverSession(s);await fetchJobs(s.token);}catch(e){if(active){if(isAuthFailure(e))clearInvalidSession();else setError(e instanceof Error?e.message:'Could not restore session');}}finally{if(active)setLoading(false);}})();return()=>{active=false};},[]);
  async function run<T>(action:(s:LiveSession)=>Promise<T>,done?:(result:T)=>void){if(!session||busy)return;setBusy(true);setError('');try{const s=await renewSession(session);setSession(s);persistDriverSession(s);const result=await action(s);done?.(result);void fetchJobs(s.token).catch(refreshError=>{setWarning('Job action saved, but live lists could not refresh: '+(refreshError instanceof Error?refreshError.message:'Unknown refresh failure'));});}catch(e){if(isAuthFailure(e))clearInvalidSession();else setError(e instanceof Error?e.message:'Request failed. Please retry.');}finally{setBusy(false)}}
  async function signIn(event: React.FormEvent) {
    event.preventDefault();
    if (signInPending.current) return;
    signInPending.current = true;
    setLoading(true);
    setError('');
    let profileApproved = false;
    try {
      const signedIn = await login(email.trim(), password);
      setPassword('');
      const profile = await driverGet('/profile', signedIn.token, 7000);
      const verifiedRole = driverRoleFromProfile(profile);
      if (!verifiedRole) throw new Error('Driver type could not be verified. Reconnect your account.');
      setSession(signedIn);
      persistDriverSession(signedIn);
      setRole(verifiedRole);
      setVerifiedSession(true);
      profileApproved = true;
      await fetchJobs(signedIn.token);
    } catch (reason) {
      if (!profileApproved || isAuthFailure(reason)) clearInvalidSession();
      setError(reason instanceof Error ? reason.message : 'Authentication failed.');
    } finally {
      signInPending.current = false;
      setLoading(false);
    }
  }
  function open(j:LiveJob,target:View){if(tab==='Bookings'&&['incoming','details'].includes(target))markOfferSeen(j);setHardCopyAcknowledged(false);setId(j.id);setView(target);setWithdrawId(null);setError('');setPodDone(Boolean(j.podRecorded));setCollectionStage('arrival');setItems(String(j.items??''));setWeight(j.weight?String(j.weight):'');setPickupItems(String(j.items??''));setPickupWeight(j.weight?String(j.weight):'');setYourReference(platformJobReference(j.id,j.yourRef)||'');setCarrierReference(LOCAL?'TEST-OPERATOR-001':'');setPackaging(j.packaging||'');setDeliveryEtaAt('');setPickupNotes('');setCollectionFiles([]);uploadedCollectionEvidence.current.clear();boundaryEvidence.current.clear();setDraft({recipient:'',leftAt:'Goods Inwards',items:String(j.items??''),condition:'Completed Delivery',notes:'',deliveredOn:'',deliveredTime:''});setSignature(null);setVerifiedSignature(null);setPodFiles([]);uploadedEvidence.current.clear();setQuoteAmount(j.quote!=null&&j.bidStatus!=='withdrawn'?String(j.quote):'');setQuoteNotes(j.bidStatus==='withdrawn'?'':j.quoteNotes||'');setQuoteEta(j.bidStatus==='withdrawn'?'30':j.quoteEtaMinutes!=null?String(j.quoteEtaMinutes):'30');}
  const awaitingRestoredJob = useRef(Boolean(initialNavigation.id));
  useEffect(() => {
    if (!awaitingRestoredJob.current) return;
    if (id !== initialNavigation.id || view !== initialNavigation.view) {
      awaitingRestoredJob.current = false;
    } else if (job && connected) {
      awaitingRestoredJob.current = false;
      open(job, view);
    }
  }, [connected, id, initialNavigation, job, view]);
  useEffect(()=>{
    if(!session||!job||view!=='flow'||!['DELIVERED','POD_SUBMITTED'].includes(job.status)||job.podRecorded||podDone)return;
    let active=true;
    void (async()=>{
      try{
        // A completed delivery may be reopened after the JWT expires. Refresh
        // credentials before restoring its server-side signed POD draft.
        let authorised=await renewSession(session);
        if(!active)return;
        if(authorised.token!==session.token){setSession(authorised);persistDriverSession(authorised);}
        const endpoint=driverApi+'/web/jobs/'+encodeURIComponent(job.id)+'/pod-draft';
        let res=await fetch(endpoint,{headers:{Authorization:'Bearer '+authorised.token},cache:'no-store'});
        if(res.status===401){
          authorised=await renewSession(authorised,true);
          if(!active)return;
          setSession(authorised);persistDriverSession(authorised);
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
          condition:previous.condition==='Completed Delivery'?String(saved.deliveryStatus||previous.condition):previous.condition,
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
  function navigate(t:Tab){setTab(t);setView('list');setId(null);setWithdrawId(null);setError('');}
  function openMap(j:LiveJob,back:View='list'){setId(j.id);setMapReturnView(back);setView('map');setError('');}
  function card(j:LiveJob, mode:'list'|'details'='list'){
    const offered=Boolean(j.acceptanceRequired&&j.offerId);
    const expired=Boolean(j.offerExpired);
    const canWithdraw=tab==='Quotes'&&j.personalBid===true&&j.bidStatus==='submitted'&&Boolean(j.bidId);
    const canEdit=canWithdraw&&j.status==='OPEN';
    const isWithdrawn=j.bidStatus==='withdrawn'||j.quoteOutcome==='CANCELLED';
    const status=tab==='Quotes'&&isWithdrawn?'WITHDRAWN':offered?(j.acceptanceBlocked?'OFFER BLOCKED':expired?'EXPIRED OFFER':'NEW OFFER'):tab==='Quotes'?(isWithdrawn?'WITHDRAWN':j.quoteOutcome==='UNSUCCESSFUL'?'UNSUCCESSFUL':j.quoteOutcome==='AWARDED'?'AWARDED':'SUBMITTED'):j.status==='OPEN'?(j.quote!=null&&j.quoteOutcome!=='CANCELLED'&&j.bidStatus!=='withdrawn'?'QUOTED':'AVAILABLE'):(tab==='Bookings'&&['completed','invoiced','paid'].includes(j.backendStatus||'')?(j.backendStatus||'').toUpperCase():j.status.replaceAll('_',' '));
    return <article key={j.id} className={'rv-card rv-job'+(tab==='Bookings'&&['DELIVERED','POD_SUBMITTED'].includes(j.status)?' rv-history-card':'')}>
      <div className="rv-jobhead"><div className="rv-job-identity"><strong>{j.company||'Transport buyer'}</strong><div className="rv-job-service"><span>{friendlyService(j.service)}</span><b>{j.vehicle}</b></div>{(j.yourRef||j.customerRef)&&<small>Ref: {j.yourRef||j.customerRef}</small>}</div><div className="rv-card-head-actions"><span className={'rv-chip '+(offered?'rv-orange':status==='SUBMITTED'?'rv-green':'')}>{status}</span>{j.postedAt&&!Number.isNaN(Date.parse(j.postedAt))&&<div className="rv-posted-at">Posted: {new Date(j.postedAt).toLocaleString('en-GB',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:false})}</div>}{mode==='details'&&<button className="rv-card-back" aria-label="Back" onClick={()=>setView('list')}>← Back</button>}</div></div>
      <Route job={j} onOpen={()=>open(j,'details')}/>
      {j.notes?.trim()&&<p className="rv-job-notes"><strong>Notes:</strong> {j.notes}</p>}

      <div className="rv-chips"><span><strong>{j.weight || '—'}</strong> kg</span>{j.terms&&<span>Payment: {j.terms}</span>}{tab==='Loads'&&searchResult?.pickupRoadMiles[j.id]!=null&&<span>{searchResult.pickupRoadMiles[j.id]} road miles to collection area</span>}{j.distanceMiles!=null&&<span>{j.distanceMiles} {tab==='Loads'?'job miles':'miles'}</span>}</div>
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
        <div className="rv-actions"><button className="rv-outline" onClick={()=>open(j,'details')}>View Booking Details</button><button className="rv-primary" disabled={offered&&!expired&&(busy||j.acceptanceBlocked)} onClick={()=>{if(offered&&!expired){void acceptIncomingJob(j);}else{open(j,offered?'incoming':'statusHistory');}}}>{offered?(expired?'View Expired Offer':'Accept'):j.status==='DELIVERED'||j.status==='POD_SUBMITTED'?'View POD & Status':'Booking Status'}</button></div>
        {!offered&&!['DELIVERED','POD_SUBMITTED'].includes(j.status)&&<button className="rv-outline rv-wide" onClick={()=>open(j,'flow')}>Continue Delivery →</button>}
        {!offered&&['DELIVERED','POD_SUBMITTED'].includes(j.status)&&role==='Owner Driver'&&<button className="rv-primary rv-wide" onClick={()=>open(j,invoiceAction(j).target)}>{invoiceAction(j).label}</button>}
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
    const waitingOffers=!LOCAL&&tab==='Bookings'&&bookingSection==='Received'&&(!verifiedSession||offersLoading);
    const waitingQuotes=!LOCAL&&tab==='Quotes'&&(!verifiedSession||bidsLoading);
    const waitingFeed=!LOCAL&&(loading||refreshPending.current)&&(tab==='Loads'?pendingFeeds.marketplace:tab==='Bookings'?(bookingSection==='Delivered'?pendingFeeds.completed:bookingSection==='Received'?false:pendingFeeds.bookings):false);
    const failedFeed=!LOCAL&&(tab==='Loads'?failedFeeds.marketplace:tab==='Bookings'?(bookingSection==='Delivered'?failedFeeds.completed:failedFeeds.bookings):false);
    const searchingByReference=tab==='Bookings'&&bookingSection==='Delivered'&&bookingSearch.trim().length>=2;
    const sourceJobs=searchingByReference?(historicalSearchResults||[]):jobs;
    const shown = reserveJobs(sourceJobs, tab, '', 'All', quoteSection).filter(j=>tab!=='Loads'||!searchResult||(searchResult.ids.has(j.id)&&matchesLoad(j,searchResult.filters))).filter(j=>tab!=='Bookings'||(bookingSection==='Received'?Boolean(j.acceptanceRequired):bookingSection==='Delivered'?searchingByReference||['DELIVERED','POD_SUBMITTED'].includes(j.status)||Boolean(j.podRecorded):!j.acceptanceRequired&&!['DELIVERED','POD_SUBMITTED'].includes(j.status)&&!j.podRecorded)).filter(j=>tab!=='Bookings'||bookingSection!=='Delivered'||((searchingByReference||!bookingSearch.trim()||[j.id,j.yourRef,j.customerRef,...(j.legacyReferences||[]),j.from,j.to,j.company,j.pickupAddress,j.deliveryAddress].some(v=>String(v||'').toLowerCase().includes(bookingSearch.trim().toLowerCase())))&&(searchingByReference||bookingPeriod==='all'||(Boolean(j.postedAt)&&completedAt(j)>=Date.now()-Number(bookingPeriod)*86400000)))).sort((a,b)=>tab==='Bookings'&&bookingSection==='Delivered'?completedAt(b)-completedAt(a):0);
    return <>
      {tab==='Loads'&&searchResult&&<div className="rv-search-results-note" role="status"><p>{shown.length} matching loads · {searchResult.filters.radius} road miles{searchResult.unknown>0?' · '+searchResult.unknown+' unverified road distances excluded':''}. Search again to include newly received loads.</p><button type="button" onClick={()=>{setSearchError('');setView('searchLoads')}}>Edit</button><button type="button" onClick={clearLoadSearch}>Clear</button></div>}
      {tab==='Bookings'&&<div className="rv-quote-tabs rv-booking-tabs" role="group" aria-label="Booking categories">{(['Received','Allocated','Delivered'] as BookingSection[]).map(s=><button key={s} className={bookingSection===s?'rv-selected':''} aria-pressed={bookingSection===s} onClick={()=>setBookingSection(s)}>{s==='Received'?'Pending':s==='Allocated'?'Active':'History'}</button>)}</div>}
      {tab==='Bookings'&&bookingSection==='Delivered'&&<div className="rv-booking-history-tools" style={{display:'flex',gap:8,flexWrap:'wrap',margin:'10px 0 14px'}}><input aria-label="Search booking history" placeholder="Search reference, town, postcode, customer" value={bookingSearch} onChange={e=>setBookingSearch(e.target.value)} style={{flex:'1 1 200px',minWidth:0,padding:11,borderRadius:9,border:'1px solid #cbd5e1'}}/><select aria-label="Booking history period" value={bookingPeriod} onChange={e=>setBookingPeriod(e.target.value)} style={{padding:10,borderRadius:9,border:'1px solid #cbd5e1'}}><option value="all">All time</option><option value="7">7 days</option><option value="30">30 days</option><option value="90">90 days</option></select></div>}
      {tab==='Quotes'&&<div className="rv-quote-tabs" role="group" aria-label="Quote sections">{(['Submitted','Awarded','History'] as QuoteSection[]).map(s=><button key={s} className={quoteSection===s?'rv-selected':''} aria-pressed={quoteSection===s} onClick={()=>{setQuoteSection(s);setWithdrawId(null)}}>{s}</button>)}</div>}
      {historicalSearchBusy&&searchingByReference&&<p className="rv-loading-inline" role="status">Searching all historical jobs by reference…</p>}
      {historicalSearchError&&searchingByReference&&<p className="rv-warning" role="alert">Historical reference search unavailable: {historicalSearchError}</p>}
      {searchingByReference&&historicalSearchResults&&historicalSearchResults.length>1&&<p className="rv-warning">Several jobs match this historical reference. Check the route and date; no job has been selected automatically.</p>}
      {shown.length ? shown.map(j=>card(j)) : (waitingFeed||waitingOffers||waitingQuotes)&&!error ? <div className="rv-empty" role="status" aria-live="polite"><span className="rv-feed-spinner" aria-hidden="true"/><span className="rv-feed-loading-label">{waitingQuotes?'Loading quotes':tab==='Bookings'?'Loading bookings':'Loading loads'}</span></div> : <div className="rv-empty">
        <b>{(warning||failedFeed||error)?'Some sources are temporarily unavailable':jobs.length===0?'No jobs returned by the server':tab==='Bookings'&&bookingSection==='Received'?'No current booking offers':tab==='Loads'?'No available marketplace loads':'No matching '+tab.toLowerCase()}</b>
        <p>{(warning||failedFeed||error)?'Some live sources failed. Check the notices below or retry. This does not mean that the marketplace is empty.':tab==='Bookings'&&bookingSection==='Received'?'Pending awarded jobs appear here, including overdue collections. You can review and respond to an offer even after the scheduled collection time.':tab==='Loads'&&jobs.length>0?'No currently OPEN marketplace loads match the selected filters. Your submitted quotes remain under Quotes.':'No matching authenticated records. Nothing fictitious is displayed.'}</p>
        {!loading&&(error||warning||jobs.length===0)&&<button className="rv-outline rv-wide" onClick={()=>void retryLive()}>Retry Live Data →</button>}
        {tab==='Loads'&&jobs.some(j=>j.quote!=null)&&<button className="rv-outline rv-wide" onClick={()=>navigate('Quotes')}>View My Quotes →</button>}
      </div>}
      {warning&&<details className="rv-api-notes"><summary>Live data notices</summary><p>{warning}</p></details>}
    </>;
  }
  function detailHeader(j:LiveJob) { return card(j,'details'); }
  function quoteDetails(){if(!job)return null;return <>{detailHeader(job)}<section className="rv-card"><h3>Submitted quote</h3><Fact name="Load reference" value={platformJobReference(job.id,job.yourRef)||'Not provided'}/><Fact name="Company" value={job.company||'Transport buyer'}/><Fact name="Quote amount" value={job.quote==null?'Unavailable':gbp(job.quote)}/><Fact name="Status" value={job.bidStatus==='withdrawn'?'Withdrawn':job.quoteOutcome==='AWARDED'?'Awarded':job.quoteOutcome==='UNSUCCESSFUL'?'Unsuccessful':job.bidStatus==='submitted'?'Submitted':job.bidStatus||job.status.replaceAll('_',' ')}/><Fact name="Vehicle requested" value={job.vehicle}/><Fact name="Payment terms" value={job.terms||'Not provided'}/><Fact name="Collection ETA" value={job.quoteEtaMinutes==null?'Not provided':job.quoteEtaMinutes+' minutes'}/><Fact name="Quote notes" value={job.quoteNotes||'No notes supplied'}/>{job.quoteOutcome==='AWARDED'&&<p className="rv-warning">This quote has been awarded. Editing or withdrawing it would change an accepted commercial commitment and is blocked by XDrive.</p>}{(job.bidStatus==='withdrawn'||job.quoteOutcome==='CANCELLED')&&<p className="rv-warning">This quotation has already been withdrawn. It remains in History for the commercial audit trail.</p>}</section>{tab==='Quotes'&&job.personalBid===true&&job.bidId&&job.bidStatus==='submitted'&&<><div className="rv-actions">{job.status==='OPEN'&&<button className="rv-primary" onClick={()=>setView('quote')}>Edit Quote</button>}<button className="rv-danger" disabled={busy} onClick={()=>setWithdrawId(job.id)}>Withdraw Quote</button></div>{withdrawId===job.id&&<section className="rv-withdraw-confirm" role="alertdialog" aria-label="Confirm quote withdrawal"><strong>Withdraw this quotation?</strong><p>Your quotation will be withdrawn, not erased from the audit history. It can be quoted again only if the job is still available and you are eligible.</p><div className="rv-actions"><button className="rv-outline" onClick={()=>setWithdrawId(null)} disabled={busy}>Keep Quote</button><button className="rv-danger" disabled={busy} onClick={()=>void withdrawQuote(job)}>{busy?'Withdrawing…':'Confirm Withdraw'}</button></div></section>}</>}<button className="rv-outline rv-wide" onClick={()=>setView('details')}>View Load Details →</button></>}
  function details(){if(!job)return null;
    if(tab==='Loads'){
      const quoted=job.quote!=null&&job.quoteOutcome!=='CANCELLED'&&job.bidStatus!=='withdrawn';
      return <LoadDetails036
        reference={platformJobReference(job.id,job.yourRef)||job.id}
        company={job.company||'Transport buyer'}
        service={friendlyService(job.service)}
        vehicle={job.vehicle}
        postedAt={job.postedAt}
        route={<Route job={job} full/>}
        weightKg={job.weight}
        items={job.items}
        packaging={job.packaging}
        terms={job.terms}
        distanceMiles={job.distanceMiles}
        pickupRoadMiles={searchResult?.pickupRoadMiles[job.id]}
        notes={job.notes}
        customerReference={job.customerRef}
        quoted={quoted}
        existingQuote={job.quote}
        onBack={()=>setView('list')}
        onMap={()=>openMap(job,'details')}
        onQuote={()=>setView('quote')}
        onSubmittedQuote={()=>setView('quoteDetails')}
      />;
    }
    if(tab==='Bookings'&&job.acceptanceRequired)return incoming();return <>{tab==='Bookings'&&job.status!=='OPEN'?<section className="rv-card rv-booking-detail-header"><div className="rv-jobhead"><div><strong>{job.company}</strong><small>{platformJobReference(job.id,job.yourRef)||'Reference unavailable'}</small></div><div><button className="rv-outline" onClick={()=>setView(job.acceptanceRequired?'incoming':'flow')}>Back</button></div></div></section>:detailHeader(job)}{tab==='Bookings'&&job.status!=='OPEN'&&<section className="rv-card rv-booking-full-stops"><h3>Collection & Delivery Details</h3><Route job={job} full/></section>}<button className="rv-map-action rv-wide" onClick={()=>openMap(job,'details')}>View on Map</button><section className="rv-card">{tab!=='Bookings'&&<span className="rv-over">LOAD REQUIREMENTS</span>}<h3>Transport details</h3><Fact name="Vehicle" value={job.vehicle}/><Fact name="Weight" value={job.weight+' kg'}/><Fact name="Items" value={job.items??'Not stated'}/><Fact name="Packaging" value={job.packaging||'Not specified'}/></section><section className="rv-card rv-commercial-panel">{tab!=='Bookings'&&<span className="rv-over">COMMERCIAL AGREEMENT</span>}<h3>Rate and payment</h3><Fact name="Payment Terms" value={job.terms||'Not provided'}/><Fact name="Agreed rate / quote" value={job.quote!=null?gbp(job.quote):'Quote required'}/></section><section className="rv-card">{tab!=='Bookings'&&<span className="rv-over">OPERATIONAL INSTRUCTIONS</span>}<h3>Instructions & References</h3><p className="rv-booking-instructions">{job.notes||'No additional handling instructions.'}</p>{job.status!=='OPEN'&&<><Fact name="Customer reference" value={job.customerRef||'Not provided'}/><Fact name="Your reference" value={platformJobReference(job.id,job.yourRef)||'Not provided'}/></>}</section>{job.status === 'OPEN'
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
  },[id,view,job?.status,session?.token]);  function quote(){
    if(!job)return null;
    const editing = tab==='Quotes' && job.personalBid===true && job.quote != null && job.bidStatus==='submitted' && Boolean(job.bidId);
    const minutes = quoteEta===''?null:Number(quoteEta);
    // Android visual iteration 036, implemented as the real React quote form.
    // Keep all role authorization and server submission checks unchanged.
    if(tab==='Loads'&&!editing)return <QuoteNow036
      key={job.id}
      company={job.company||'Transport buyer'}
      reference={platformJobReference(job.id,job.yourRef)||job.id}
      service={friendlyService(job.service)}
      vehicle={job.vehicle.replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase())}
      distanceMiles={job.distanceMiles}
      travelMinutes={job.travelMinutes}
      terms={job.terms||'Terms not stated'}
      route={<Route job={job}/>}
      quoteAmount={quoteAmount} setQuoteAmount={setQuoteAmount}
      quoteEta={quoteEta} setQuoteEta={setQuoteEta}
      quoteNotes={quoteNotes} setQuoteNotes={setQuoteNotes}
      busy={busy}
      onBack={()=>setView('details')}
      onSubmit={(extrasTotal,extraDetails)=>{
        const base=Number(quoteAmount);
        const total=Number((base+extrasTotal).toFixed(2));
        const message=[quoteNotes.trim(),extraDetails].filter(Boolean).join('\n');
        void run(s=>driverPost('/mobile/bids',s.token,{
          jobId:job.id,amount:total,baseAmount:base,additionalExtrasGbp:extrasTotal,
          collectWithinMinutes:minutes,message
        }),()=>navigate('Quotes'));
      }}
    />;
    if(editing)return <div className="rv-load-quote">
      <div className="rv-load-view-toolbar"><button type="button" onClick={()=>setView(editing?'quoteDetails':'details')}>← Back to details</button><span>{editing?'Edit quote':'New quotation'}</span></div>
      <section className="rv-load-quote-context"><span className="rv-load-eyebrow">QUOTE FOR LOAD</span><h1>{job.company||'Transport buyer'}</h1><p>{platformJobReference(job.id,job.yourRef)||job.id}</p><Route job={job}/></section>
      <section className="rv-load-quote-form">
        <div className="rv-load-quote-intro"><div><span className="rv-load-eyebrow">YOUR OFFER</span><h2>Quote & availability</h2></div><span className="rv-load-rate-tag">{job.terms||'Terms not stated'}</span></div>
        {editing&&<p className="rv-warning">Updating your existing submitted quote. This does not create a second bid.</p>}
        <label className="rv-load-form-field"><span>Your total quote <small>(GBP, VAT included where applicable)</small></span><div className="rv-load-money-input"><b>£</b><input type="number" inputMode="decimal" min="1" step=".01" aria-label="Your total quote in GBP" placeholder="0.00" value={quoteAmount} onChange={e=>setQuoteAmount(e.target.value)}/></div></label>
        <label className="rv-load-form-field"><span>Collection ETA</span><select value={quoteEta} onChange={e=>setQuoteEta(e.target.value)}>{[['5','ASAP · 5 min'],['15','15 min'],['30','30 min'],['45','45 min'],['60','60 min'],['90','90 min'],['120','120 min'],['','On Time']].map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
        <label className="rv-load-form-field"><span>Driver notes <small>(optional)</small></span><textarea rows={3} placeholder="Useful collection information for the customer" value={quoteNotes} onChange={e=>setQuoteNotes(e.target.value)}/></label>
        <div className="rv-load-quote-total"><span>Total quote</span><strong>{gbp(Number(quoteAmount)||0)}</strong></div>
        <details className="rv-load-quote-policy"><summary>Vehicle & quote conditions</summary><p>Required vehicle: {job.vehicle.replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase()).replace(/\bLwb\b/g,'LWB')}. XDrive validates the vehicle registered to the driver. The amount submitted is the total quote, inclusive of VAT where applicable.</p></details>
        <button className="rv-primary rv-wide" disabled={busy||!(Number(quoteAmount)>0)} onClick={()=>void run(s=>editing
          ? driverPost('/mobile/bids/'+encodeURIComponent(job.bidId!),s.token,{action:'edit',amount:Number(quoteAmount),baseAmount:Number(quoteAmount),additionalExtrasGbp:0,collectWithinMinutes:minutes,message:quoteNotes.trim()})
          : driverPost('/mobile/bids',s.token,{jobId:job.id,amount:Number(quoteAmount),baseAmount:Number(quoteAmount),additionalExtrasGbp:0,collectWithinMinutes:minutes,message:quoteNotes.trim()}),()=>navigate('Quotes'))}>{busy?'Saving…':editing?'Save Updated Quote':'Submit Quote →'}</button>
      </section>
    </div>;
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
    if(LOCAL){setJobs(rows=>rows.map(row=>row.id===j.id?{...row,status:'ALLOCATED',backendStatus:'accepted',acceptanceRequired:false,statusHistory:[...(row.statusHistory||[]),{status:'accepted',at:new Date().toISOString()}]}:row));setBookingSection('Allocated');setId(j.id);setView('flow');return;}
    await run(async s=>{
      const accepted=await bookingOfferRespond(s.token,j.offerId!,'accept');
      const acceptedRecord=accepted&&typeof accepted==='object'&&!Array.isArray(accepted)?accepted as Record<string,unknown>:{};
      const acceptedStatus=String(acceptedRecord.job_status||acceptedRecord.status||'').toLowerCase();
      if(['allocated','assigned'].includes(acceptedStatus)){
        await driverPost('/mobile/jobs/'+encodeURIComponent(j.id)+'/status',s.token,{nextStatus:'accepted'});
      }
      const response=await driverGet('/mobile/jobs/'+encodeURIComponent(j.id),s.token);
      const row=response.job&&typeof response.job==='object'&&!Array.isArray(response.job)
        ? response.job as Record<string,unknown>:null;
      const serverStatus=String(row?.currentStatus||row?.current_status||row?.status||'').toLowerCase();
      if(serverStatus!=='accepted')throw new Error('Booking acceptance was not confirmed by the server. Refresh before continuing.');
      return serverStatus;
    },()=>{
      setTab('Bookings');
      setBookingSection('Allocated');
      setWarning('');
      setJobs(rows=>rows.map(row=>row.id===j.id
        ? {...row,status:'ALLOCATED',backendStatus:'accepted',acceptanceRequired:false}:row));
      setId(j.id);setView('flow');
    });
  }
  async function confirmDecline(j:LiveJob){setDeclineConfirmation(null);if(!j.acceptanceRequired||!j.offerId)return;if(LOCAL){localStorage.setItem("xdrive-local-declined-v4-"+j.id,JSON.stringify({...j,declinedAt:new Date().toISOString()}));setJobs(rows=>rows.filter(row=>row.id!==j.id));navigate("Bookings");return;}await run(s=>bookingOfferRespond(s.token,j.offerId!,"decline"),()=>navigate("Bookings"));}
  function incoming(){if(!job)return null;return <><button className="rv-back" onClick={()=>setView('list')}>← Bookings</button>{job.acceptanceBlocked&&<div className="rv-attention" role="alert">This awarded booking cannot be accepted because its quotation is no longer active. Contact the transport buyer to issue a valid new offer.</div>}<section className="rv-card rv-offer rv-booking-decision"><div className="rv-jobhead"><div><strong>{job.company}</strong><small>{platformJobReference(job.id,job.yourRef)||'Reference unavailable'}</small></div></div><section className="rv-incoming-facts"><h3>Notes</h3><p>{job.notes||'No additional instructions'}</p><h3>Booking Footer</h3><p>No additional booking terms supplied.</p><h3>Payment</h3><Fact name="Agreed rate" value={job.quote!=null?gbp(job.quote):'Not supplied'}/><Fact name="Payment terms" value={job.terms||'Not supplied'}/>{LOCAL?<BookingDistance key={job.id} job={job}/>:<><Fact name="Distance" value={job.distanceMiles!=null?job.distanceMiles.toFixed(2)+" miles":"Not supplied"}/><Fact name="Estimated journey duration" value={job.travelMinutes!=null?job.travelMinutes+" min":"Not supplied"}/></>}<h3>Collection & Delivery Details</h3><Route job={job} full/><h3>Job Details</h3><Fact name="Customer reference" value={job.customerRef||'Not supplied'}/><Fact name="Vehicle" value={job.vehicle}/><Fact name="Weight" value={job.weight+' kg'}/><Fact name="Items" value={job.items??'Not stated'}/><Fact name="Packaging" value={job.packaging||'Not specified'}/></section><button className="rv-map-action rv-wide" onClick={()=>openMap(job,'incoming')}>View on Map</button></section><div className="rv-actions rv-booking-decision-actions"><button className="rv-danger" disabled={busy} onClick={()=>setDeclineConfirmation(job)}>Decline</button><button className="rv-primary" disabled={busy||job.acceptanceBlocked} onClick={()=>void acceptIncomingJob(job)}>Accept</button></div></>}
  const undoTargets = reserveUndoTargets;
  async function undoLatestStatus(j:LiveJob,confirmed=false){
    const target=undoTargets[j.status];
    if(!target)return; if(!confirmed){setUndoConfirmation(j);return;} setUndoConfirmation(null);
    if(LOCAL){setJobs(rows=>rows.map(row=>row.id===j.id?{...row,status:target.previous,backendStatus:({ALLOCATED:"accepted",ON_WAY_TO_PICKUP:"on_my_way",ON_SITE_PICKUP:"on_site_pickup",LOADED:"loaded",ON_WAY_TO_DELIVERY:"in_transit"} as Record<string,string>)[target.previous]||row.backendStatus,statusHistory:[...(row.statusHistory||[]),{status:target.previous,at:new Date().toISOString(),notes:'Undo '+j.status}]}:row));setCollectionStage('arrival');return;}
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
      setCollectionStage('arrival');setError('');
    });
  }
  async function transition(j:LiveJob) {
    const step=nextStates[j.status];if(!step)return;
    if(LOCAL&&j.status==='ALLOCATED'&&!localAllocations[j.id]){setError('Allocate driver and vehicle first.');return;}
    if(LOCAL){
      if(j.status==='ON_SITE_PICKUP'&&collectionStage==='arrival'){setCollectionStage('loaded');setItems(pickupItems||String(j.items||1));setWeight(pickupWeight||String(j.weight));setPickupNotes('');setCollectionFiles([]);return;}
      if(j.status==='ON_SITE_PICKUP'){if(!Number.isInteger(Number(items))||Number(items)<1||!Number.isFinite(Number(weight))||Number(weight)<=0){setError('Enter valid items and weight.');return;}if(!deliveryEtaAt||!(new Date(deliveryEtaAt).getTime()>Date.now())){setError('Choose a valid future ETA.');return;}if(!collectionFiles.some(f=>f.type.startsWith('image/'))){setError('Add a collection photo.');return;}if(busy)return;setBusy(true);try{await archiveLocalCollection(j.id,{items,weight,pickupItems,pickupWeight,yourReference,carrierReference,pickupNotes,packaging,deliveryEtaAt},collectionFiles);}catch{setError('Collection evidence could not be saved. Retry before continuing.');return;}finally{setBusy(false);}}
      setJobs(rows=>rows.map(row=>row.id===j.id?{...row,status:step.status,backendStatus:step.backend,routeStops:row.routeStops?.map((stop,index)=>index===0&&j.status==="ON_SITE_PICKUP"?{...stop,status:"completed" as const,completedAt:new Date().toISOString()}:stop),statusHistory:[...(row.statusHistory||[]),{status:step.backend,at:new Date().toISOString(),notes:pickupNotes}]}:row));setError('');if(j.status==='ON_WAY_TO_DELIVERY')setDraft(previous=>({...previous,...detectedDeliveryDateTime()}));if(j.status==='ON_WAY_TO_PICKUP')setCollectionStage('loaded');setPickupNotes('');setView('statusHistory');return;
    }
    await run(async s=>{
      const latest=await driverGet('/mobile/jobs/'+encodeURIComponent(j.id),s.token);const server=mapAssigned(latest.job);if(latest.multiDropPartial===true)throw new Error('Route stops could not be verified. Refresh booking.');const persisted=server.isTest===true?persistedStops(j.id,server.routeStops):[];const first=persisted[0];const last=persisted.at(-1);if(server.id!==j.id||!server.backendStatus||!['allocated','assigned','accepted','on_my_way','on_site_pickup','loaded','in_transit','on_site_delivery'].includes(server.backendStatus))throw new Error('Booking is not in an executable server stage. Refresh booking.');if(server.status!==j.status){setJobs(rows=>rows.map(row=>row.id===j.id?{...row,...server}:row));setView('statusHistory');throw new Error('Booking status changed. Review its current stage.');}if(j.status==='ALLOCATED'&&['allocated','assigned'].includes(server.backendStatus))await driverPost('/mobile/jobs/'+encodeURIComponent(j.id)+'/status',s.token,{nextStatus:'accepted'});
      if(j.status==='ON_SITE_PICKUP'){
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
        if(first&&first.type==='collection'&&first.status!=='completed'){
          const stopEvidence=await uploadBoundaryEvidence(j,first,s.token,collectionFiles);
          await syncPersistedBoundary(j,first,'completed',s.token,{itemCount,weightKg,packaging:packaging.trim(),etaAt,notes:pickupNotes,...stopEvidence});
        }
      }
      if((step.backend==='in_transit'||step.backend==='on_site_delivery')&&persisted.length){
        if(!last||last.type!=='delivery'||persisted.slice(0,-1).some(stop=>stop.status!=='completed'))throw new Error('Complete all earlier route stops before final delivery.');
      }
      await driverPost('/mobile/jobs/'+encodeURIComponent(j.id)+'/status',s.token,{nextStatus:step.backend,notes:pickupNotes.trim()});
      if(first&&step.backend==='on_my_way')await syncPersistedBoundary(j,first,'en_route',s.token);
      if(first&&step.backend==='on_site_pickup')await syncPersistedBoundary(j,first,'arrived',s.token);
      if(last&&step.backend==='in_transit')await syncPersistedBoundary(j,last,'en_route',s.token);
      if(last&&step.backend==='on_site_delivery')await syncPersistedBoundary(j,last,'arrived',s.token);
      if(persisted.length)await fetchJobs(s.token);
    },()=>{
            if(j.status==='ON_SITE_PICKUP'&&collectionStage==='arrival'){
        setCollectionStage('loaded');setItems(pickupItems);setWeight(pickupWeight);setPickupNotes('');setCollectionFiles([]);uploadedCollectionEvidence.current.clear();setError('');return;
      }
      if(j.status==='ON_WAY_TO_DELIVERY'){
        setDraft(previous=>({...previous,...detectedDeliveryDateTime()}));
      }
      setJobs(rows=>rows.map(x=>x.id===j.id?{...x,status:step.status,backendStatus:step.backend}:x));
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
  async function uploadBoundaryEvidence(j:LiveJob,stop:LiveStop,token:string,files:File[],signedData?:string) {
    const photoPaths:string[]=[];const documentPaths:string[]=[];
    const stageCache=boundaryEvidence.current.get(stop.id)||new Map<File,string>();
    boundaryEvidence.current.set(stop.id,stageCache);
    async function upload(file:File,category:'photos'|'documents'|'signature'){
      if(!['image/png','image/jpeg','application/pdf'].includes(file.type)||file.size<=0||file.size>10*1024*1024)throw new Error('Invalid stop evidence.');
      const cached=stageCache.get(file);if(cached)return cached;
      const prepared=await prepareDeliveryUpload(file);
      const response=await fetch(driverApi+'/mobile/jobs/'+encodeURIComponent(j.id)+'/evidence',{
        method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':prepared.type,'x-xdrive-evidence-kind':stop.type,'x-xdrive-evidence-category':category,'x-xdrive-stop-id':stop.id,'x-xdrive-evidence-name':crypto.randomUUID()+'-'+prepared.name.replace(/[^A-Za-z0-9._-]/g,'_').slice(0,130)},body:prepared
      });
      const data=await response.json().catch(()=>({}));if(!response.ok||typeof data.storagePath!=='string')throw new Error(data.error||'Stop evidence upload failed.');
      stageCache.set(file,data.storagePath);return data.storagePath as string;
    }
    for(const file of files){const category=file.type==='application/pdf'?'documents':'photos';(category==='photos'?photoPaths:documentPaths).push(await upload(file,category));}
    if(!photoPaths.length)throw new Error('At least one verified stop photograph is required.');
    let signaturePath:string|null=null;
    if(signedData){
      const match=/^data:(image\/(?:png|jpeg));base64,(.+)$/.exec(signedData);
      if(!match)throw new Error('Invalid recipient signature format.');
      const bytes=Uint8Array.from(atob(match[2]),c=>c.charCodeAt(0));
      signaturePath=await upload(new File([bytes],'recipient-signature.'+(match[1]==='image/png'?'png':'jpg'),{type:match[1]}),'signature');
    }
    return {photoPaths,documentPaths,signaturePath};
  }
  async function syncPersistedBoundary(j:LiveJob,stop:LiveStop,target:'en_route'|'arrived'|'completed',token:string,proof?:Record<string,unknown>){
    await syncBoundaryStop(stop,target,(stopId,status,handover)=>driverPost('/mobile/jobs/'+encodeURIComponent(j.id)+'/reserve-stop-status',token,{stop_id:stopId,status,...(handover?{handover}:{})}),proof);
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
    if(LOCAL){if(!signature||!draft.recipient.trim())throw new Error('Enter recipient and draw signature.');localStorage.setItem('xdrive-local-signature-v4-'+j.id,JSON.stringify({signature,draft}));setVerifiedSignature(signature);return;}
    if(!session||!signature)throw new Error('Draw the recipient signature before saving.');
    const s=await renewSession(session);
    setSession(s);persistDriverSession(s);
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
  async function uploadFinalStopExceptionEvidence(j:LiveJob, stop:LiveStop, token:string){
    const photoPaths:string[]=[];const documentPaths:string[]=[];
    for(const file of podFiles){
      if(!['image/png','image/jpeg','application/pdf'].includes(file.type)||file.size<=0||file.size>10*1024*1024)throw new Error('Exception evidence must be JPEG, PNG or PDF up to 10 MB.');
      const uploadFile=await prepareDeliveryUpload(file);
      const category=file.type==='application/pdf'?'documents':'damage';
      const response=await fetch(driverApi+'/mobile/jobs/'+encodeURIComponent(j.id)+'/evidence',{
        method:'POST',
        headers:{
          Authorization:'Bearer '+token,'Content-Type':uploadFile.type,
          'x-xdrive-evidence-kind':'delivery','x-xdrive-evidence-category':category,
          'x-xdrive-stop-id':stop.id,
          'x-xdrive-evidence-name':crypto.randomUUID()+'-'+uploadFile.name.replace(/[^A-Za-z0-9._-]/g,'_').slice(0,130),
        },
        body:uploadFile,
      });
      const data=await response.json().catch(()=>({})) as {storagePath?:string;error?:string};
      if(!response.ok||!data.storagePath)throw new Error(data.error||'Exception evidence upload failed ('+response.status+').');
      (category==='documents'?documentPaths:photoPaths).push(data.storagePath);
    }
    return {photoPaths,documentPaths};
  }

  async function completeDelivery(j:LiveJob) {
    if(j.status!=='ON_SITE_DELIVERY'){setError('Record On Site (Final Delivery) before recording the delivery outcome.');return;}
    if(LOCAL&&draft.condition==="Completed Delivery"){if((j.hardCopyPodRequired&&!hardCopyAcknowledged)||!signature||verifiedSignature!==signature||!draft.recipient.trim()||!draft.leftAt.trim()||!draft.deliveredOn||!draft.deliveredTime||!Number.isInteger(Number(draft.items))||Number(draft.items)<1||!podFiles.some(f=>["image/jpeg","image/png"].includes(f.type))){setError("Complete delivery details, verified signature and delivery photo.");return;}try{await archiveLocalPod(j.id,draft,signature,podFiles);}catch{setError("POD evidence could not be archived. Retry before completing.");return;}const at=new Date().toISOString();setJobs(rows=>rows.map(row=>row.id===j.id?{...row,status:"DELIVERED",backendStatus:"delivered",podRecorded:true,statusHistory:[...(row.statusHistory||[]),{status:"delivered",at,notes:["Received By: "+draft.recipient,"Left At: "+draft.leftAt,"Delivery Status: "+draft.condition,"Items: "+draft.items,"Delivered On: "+draft.deliveredOn+" "+draft.deliveredTime,"Local test evidence only"].join(" | ")}]}:row));setPodDone(true);setError("");setView("statusHistory");return;}
    const finalStop=j.routeStops?.at(-1);
    if(finalStop&&finalStop.type!=='delivery'){setError('The final operation is a collection. Record collection and resolve any goods custody before delivery POD.');return;}
    if(finalStop?.handover?.stopKind==='return'||finalStop?.handover?.stopKind==='redirect'){
      setError('This route now ends with a return or redirected stop. Complete that stop instead of final delivery POD.');
      return;
    }
    if(draft.condition==='Job Cancelled'){setError('Contact the company that allocated this booking by phone.');return;}
    if(draft.condition!=='Completed Delivery'){
      if(!finalStop){setError('An exception requires a persisted route stop.');return;}if(draft.notes.trim().length<3){setError('Describe the delivery exception in Driver Notes.');return;}
      if(['Damaged Goods','Incorrect Goods'].includes(draft.condition)&&!podFiles.some(file=>file.type==='image/jpeg'||file.type==='image/png')){
        setError('Photographic evidence is required for damaged or incorrect goods.');return;
      }
      await run(async current=>{
        const evidence=await uploadFinalStopExceptionEvidence(j,finalStop,current.token);
        await driverPost('/mobile/jobs/'+encodeURIComponent(j.id)+(j.isTest===true?'/reserve-stop-status':'/stop-status'),current.token,{
          stop_id:finalStop.id,status:'exception',
          exception:{deliveryStatus:draft.condition,notes:draft.notes.trim(),photoPaths:evidence.photoPaths,documentPaths:evidence.documentPaths},
        });
      },()=>{setWarning('Delivery exception recorded. The stop remains unresolved until authorised instructions are recorded.');setView('statusHistory');});
      return;
    }

    if(!signature||verifiedSignature!==signature){setError('Save and verify the recipient signature before sending POD.');return;}
    if(!draft.recipient.trim()||!draft.leftAt.trim()||!/^\d{4}-\d{2}-\d{2}$/.test(draft.deliveredOn)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(draft.deliveredTime)||!Number.isInteger(Number(draft.items))||Number(draft.items)<=0){
      setError('Recipient, Left At, Delivered On, Delivery Time and a valid item count are required.');return;
    }
    if(j.hardCopyPodRequired&&!hardCopyAcknowledged){setError('Confirm that the required paper POD will be retained and handed over before submitting.');return;}
    await run(async current=>{
      const path='/mobile/jobs/'+encodeURIComponent(j.id);
      const latest=await driverGet(path,current.token);
      if(latest.multiDropPartial===true)throw new Error('Route stops could not be verified.');
      const canonical=mapAssigned(latest.job);
      if(canonical.id!==j.id||canonical.backendStatus!=='on_site_delivery')throw new Error('Final delivery stage was not confirmed.');
      const route=canonical.isTest===true?persistedStops(j.id,canonical.routeStops):[];
      if(route.length){
        const final=route.at(-1)!;
        if(final.type!=='delivery'||route.slice(0,-1).some(stop=>stop.status!=='completed'))throw new Error('Resolve every preceding stop before final delivery.');
        if(final.status!=='completed'){
          const proof=await uploadBoundaryEvidence(j,final,current.token,podFiles,signature!);
          await syncPersistedBoundary(j,final,'completed',current.token,{...proof,recipientName:draft.recipient.trim(),leftAt:draft.leftAt.trim(),itemCount:Number(draft.items),deliveredOn:new Date(draft.deliveredOn+'T'+draft.deliveredTime+':00').toISOString(),deliveryStatus:'Completed Delivery',notes:draft.notes.trim()});
        }
      }
      await finishReserveDelivery(j.id,{
        read:async()=>{const detail=await driverGet(path,current.token);return {job:mapAssigned(detail.job),partial:detail.multiDropPartial===true};},
        upload:()=>uploadDeliveryEvidence(j,current.token),
        delivered:async()=>{await driverPost(path+'/status',current.token,{nextStatus:'delivered'});},
        onDelivered:()=>setJobs(rows=>rows.map(row=>row.id===j.id?{...row,status:'DELIVERED',backendStatus:'delivered'}:row)),
        archive:evidence=>driverPost(path+'/pod',current.token,{
          recipientName:draft.recipient.trim(),leftAt:draft.leftAt.trim(),
          deliveredOn:draft.deliveredOn,deliveredTime:draft.deliveredTime,
          deliveredAt:new Date(draft.deliveredOn+'T'+draft.deliveredTime+':00').toISOString(),
          itemCount:Number(draft.items),weightKg:j.weight||null,notes:draft.notes.trim()||null,
          signatureData:signature,photoUris:evidence.photos,documentUris:evidence.documents,
          hardCopyAcknowledged:j.hardCopyPodRequired?hardCopyAcknowledged:false,deliveryStatus:'Completed Delivery',
        }),
        verify:async()=>{const detail=await driverGet('/web/jobs/'+encodeURIComponent(j.id)+'/pod-draft',current.token);return detail.completed===true;},
      });
    },()=>{
      setPodDone(true);
      setJobs(rows=>rows.map(row=>row.id===j.id?{...row,status:'DELIVERED',backendStatus:'delivered',podRecorded:true}:row));
      setWarning('');
      setView('statusHistory');
    });
  }

  async function savePod(j:LiveJob){if(LOCAL){if(j.podRecorded||podDone)return;if(!signature||verifiedSignature!==signature||!draft.recipient.trim()||!draft.leftAt.trim()||!draft.deliveredOn||!draft.deliveredTime||!podFiles.some(f=>["image/jpeg","image/png"].includes(f.type))||(j.hardCopyPodRequired&&!hardCopyAcknowledged)){setError("Complete and verify delivery evidence before sending POD.");return;}try{await archiveLocalPod(j.id,draft,signature,podFiles);}catch{setError("POD evidence could not be archived. Retry before completing.");return;}const at=new Date().toISOString();setJobs(rows=>rows.map(row=>row.id===j.id?{...row,podRecorded:true,statusHistory:[...(row.statusHistory||[]),{status:"pod_submitted",at,notes:["Received By: "+draft.recipient,"Left At: "+draft.leftAt,"Delivery Status: "+draft.condition,"Items: "+draft.items,"Delivered On: "+draft.deliveredOn+" "+draft.deliveredTime,"Local test evidence only"].join(" | ")}]}:row));setPodDone(true);setView("statusHistory");return;}
    if(j.hardCopyPodRequired&&!hardCopyAcknowledged){setError('Confirm that the required paper POD will be retained and handed over before submitting.');return;}
    if(!signature||verifiedSignature!==signature){setError('Save and verify the recipient signature before submitting POD.');return;}
    if(draft.condition!=='Completed Delivery'){setError('Legacy POD recovery supports only a successful Completed Delivery. Record exceptions through the booking workflow.');return;}
    if(!draft.recipient.trim()||!draft.leftAt.trim()||!/^\d{4}-\d{2}-\d{2}$/.test(draft.deliveredOn)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(draft.deliveredTime)||!Number.isInteger(Number(draft.items))||Number(draft.items)<=0){
      setError('Recipient, Left At, Delivered On, Delivery Time and item count are required for POD.');return;
    }
    await run(async current=>{
      const officialPodComplete=async()=>{
        const verification=await fetch(driverApi+'/web/jobs/'+encodeURIComponent(j.id)+'/pod-draft',{headers:{Authorization:'Bearer '+current.token},cache:'no-store'});
        if(!verification.ok)throw new Error('Official POD state could not be read ('+verification.status+').');
        const verified=await verification.json().catch(()=>({}));
        return verified.completed===true;
      };
      if(await officialPodComplete())return;
      const {photos,documents}=await uploadDeliveryEvidence(j,current.token);
      const response=await driverPost('/mobile/jobs/'+encodeURIComponent(j.id)+'/pod',current.token,{
        recipientName:draft.recipient.trim(),leftAt:draft.leftAt.trim(),
        deliveredOn:draft.deliveredOn,deliveredTime:draft.deliveredTime,
        deliveredAt:new Date(draft.deliveredOn+'T'+draft.deliveredTime+':00').toISOString(),
        itemCount:Number(draft.items),weightKg:j.weight||null,notes:draft.notes.trim()||null,
        signatureData:signature,photoUris:photos,documentUris:documents,
        hardCopyAcknowledged:j.hardCopyPodRequired?hardCopyAcknowledged:false,
        deliveryStatus:'Completed Delivery',
      });
      if(response.ok!==true)throw new Error('XDrive did not confirm the POD submission.');
      if(!(await officialPodComplete()))throw new Error('POD is not confirmed complete on the server. Refresh before retrying.');
    },()=>{setPodDone(true);setJobs(rows=>rows.map(row=>row.id===j.id?{...row,status:'DELIVERED',podRecorded:true}:row));});
  }

  function flow(){
    if(!job)return null;
    const routeStops=job.routeStops||[];
    const operationalStops=operationalExecutionStops(job.id,routeStops,job.isTest===true);
    const legacySkipped=operationalStops.find(stop=>stop.status==='skipped');
    const activeStop=operationalStops.find(stop=>!['completed','cancelled'].includes(stop.status)&&stop.status!=='skipped');
    const collectionCancelled=routeStops[0]?.status==='cancelled'&&['ALLOCATED','ON_WAY_TO_PICKUP','ON_SITE_PICKUP'].includes(job.status);
    if(collectionCancelled)return <section className="rv-operation-screen"><button className="rv-back" onClick={()=>setView('statusHistory')}>← Booking status</button><h1>Cancellation recorded</h1><p>The collection stop was cancelled on instruction. XDrive will not advance this booking as a normal collection.</p><button className="rv-outline rv-wide" onClick={()=>setView('statusHistory')}>View audit history</button></section>;
    if(legacySkipped)return <section className="rv-operation-screen"><button className="rv-back" onClick={()=>setView('statusHistory')}>← Booking status</button><h1>Stop review required</h1><div className="rv-warning" role="alert">A legacy skipped stop exists. XDrive will not treat it as completed or cancelled until an authorised resolution is recorded.</div></section>;
    const localNext=LOCAL&&routeStops.length>2?[...routeStops].sort((a,b)=>a.sequence-b.sequence).find(s=>s.status!=='completed'):undefined;
    if(localNext&&['LOADED','ON_WAY_TO_DELIVERY','ON_SITE_DELIVERY'].includes(job.status)){
      return <ReserveStopExecution key={job.id+':'+localNext.id} job={job} stop={localNext} session={null} onSession={setSession} onRefresh={async()=>{}} onBack={()=>setView('statusHistory')} localTransition={async(status,handover,files=[],sig)=>{
        const expected=localNext.status==='pending'?'en_route':localNext.status==='en_route'?'arrived':localNext.status==='arrived'?'completed':null;
        if(status!==expected)throw new Error('Invalid stop transition.');
        const at=new Date().toISOString();
        const last=routeStops.every(s=>s.id===localNext.id||s.status==='completed');
        if(status==='completed'){
          if(localNext.type==='delivery'){
            if(!sig||!handover?.recipientName)throw new Error('Signed POD required.');
            const data=await new Promise<string>((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result));r.onerror=()=>reject(r.error);r.readAsDataURL(sig);});
            const dt=handover.deliveredOn||at;
            const proof={recipient:handover.recipientName,leftAt:handover.leftAt||'',items:String(handover.itemCount),condition:'Completed Delivery',notes:handover.notes||'',deliveredOn:dt.slice(0,10),deliveredTime:dt.slice(11,16)};
            await archiveLocalPod(job.id+':'+localNext.id,proof,data,files);
            if(last)await archiveLocalPod(job.id,proof,data,files);
          }else await archiveLocalCollection(job.id+':'+localNext.id,{items:String(handover?.itemCount),weight:String(handover?.weightKg??''),notes:handover?.notes||''},files);
        }
        setJobs(rows=>rows.map(row=>row.id===job.id?{...row,status:status==='completed'&&last?'DELIVERED':'LOADED',backendStatus:status==='completed'&&last?'delivered':'loaded',podRecorded:status==='completed'&&last,routeStops:row.routeStops?.map(s=>s.id!==localNext.id?s:{...s,status,...(status==='en_route'?{enRouteAt:at}:status==='arrived'?{arrivedAt:at}:{completedAt:at,handover})}),statusHistory:[...(row.statusHistory||[]),{status:status==='completed'&&last?'delivered':'loaded',at,notes:'Stop '+localNext.sequence+' '+status}]}:row));
        if(status==='completed'&&last)setView('statusHistory');
      }}/>;
    }
    if(activeStop&&['LOADED','ON_WAY_TO_DELIVERY','ON_SITE_DELIVERY'].includes(job.status)&&session){
      return <ReserveStopExecution key={job.id+':'+activeStop.id} job={job} stop={activeStop} session={session} onSession={setSession}
        onRefresh={async token=>{await fetchJobs(token);}}
        onParentTransition={()=>void transition(job)} parentBusy={busy}
        onBack={()=>setView('statusHistory')}
        />;
    }
    if(job.status==='ON_SITE_DELIVERY'){
      return <DeliveryHandover job={job} value={draft} onChange={v=>{if(v.recipient!==draft.recipient||v.leftAt!==draft.leftAt||v.items!==draft.items||v.condition!==draft.condition||v.notes!==draft.notes)setVerifiedSignature(null);setDraft(v);setError('');}} signature={signature} onSignature={v=>{setSignature(v);setVerifiedSignature(null);setError('');}} signatureVerified={Boolean(signature)&&verifiedSignature===signature} onSaveSignature={()=>saveRecipientSignature(job)} photos={podFiles} onPhotos={v=>{setPodFiles(v);setError('');}} busy={busy} onBack={()=>setView('statusHistory')} mode="delivery" onConfirm={()=>void completeDelivery(job)}/>;
    }
    const step=nextStates[job.status];
    const delivered=job.status==='DELIVERED'||job.status==='POD_SUBMITTED';
    if(job.podRecorded||podDone)return <section className="rv-operation-screen"><button className="rv-back" onClick={()=>setView('statusHistory')}>← Booking status</button><h1>{job.podEvidenceComplete===false?'Archived POD requires review':'Completed booking - Signed POD'}</h1><Route job={job} full/>{job.podEvidenceComplete===false?<p className="rv-warning">Archived POD requires evidence review. Delivery cannot be repeated.</p>:<p>Delivery recorded. Download the verified POD below.</p>}{session&&job.podEvidenceComplete!==false&&<OfficialPodDownload jobId={job.id} session={session} onSession={setSession}/>}{LOCAL&&(()=>{try{const saved=JSON.parse(localStorage.getItem("xdrive-local-signature-v4-"+job.id)||"null");return saved?.signature?<section className="rv-card"><h3>Signed POD evidence</h3><p>{saved.draft?.recipient}</p><img alt="Captured recipient signature" src={saved.signature} style={{width:"100%"}}/><small>Local evidence - not an official PDF</small></section>:null}catch{return null}})()}{role==='Owner Driver'&&<button className="rv-primary rv-wide" onClick={()=>setView(invoiceAction(job).target)}>{invoiceAction(job).label}</button>}</section>;
    // Delivered jobs with an incomplete POD must remain editable as a signed POD draft.
    // Never claim the signature is saved until the driver captures and verifies it.
    if(delivered)return <DeliveryHandover
      job={job}
      value={draft}
      onChange={value=>{
        if(value.recipient!==draft.recipient||value.leftAt!==draft.leftAt||value.items!==draft.items||value.condition!==draft.condition||value.notes!==draft.notes)setVerifiedSignature(null);
        setDraft(value);setError('');
      }}
      signature={signature}
      onSignature={value=>{setSignature(value);setVerifiedSignature(null);setError('');}}
      signatureVerified={Boolean(signature)&&verifiedSignature===signature}
      onSaveSignature={()=>saveRecipientSignature(job)}
      photos={podFiles}
      onPhotos={value=>{setPodFiles(value);setError('');}}
      busy={busy}
      onBack={()=>setView('statusHistory')}
      mode="pod"
      hardCopyRequired={Boolean(job.hardCopyPodRequired)}
      hardCopyAcknowledged={hardCopyAcknowledged}
      onHardCopyAcknowledged={setHardCopyAcknowledged}
      onConfirm={()=>void savePod(job)}
    />;
    return <section className="rv-operation-screen">
      {(!delivered||podDone||job.podRecorded)&&<><button className="rv-back" onClick={()=>setView('list')}>← Back to Bookings</button>
      <span className="rv-over">BOOKING OPERATIONS</span>
      <h1>{delivered?'Proof of Delivery':job.status==='ON_SITE_PICKUP'?'Complete Collection':job.status==='ALLOCATED'?'View Booking':step?.label||'Booking'}</h1>
      <span className="rv-chip rv-orange">{job.status.replaceAll('_',' ')}</span>
      <Route job={job} full/>{undoTargets[job.status]&&<button type="button" className="rv-undo-action rv-wide" disabled={busy} onClick={()=>void undoLatestStatus(job)}>Undo Last Status</button>}</>}
      {LOCAL&&job.status==='ALLOCATED'&&!localAllocations[job.id]&&<section className="rv-card"><h3>Allocate Driver / Vehicle</h3><Field label="Driver"><select value={localDriver} onChange={e=>setLocalDriver(e.target.value)}><option>Me (Owner Driver)</option><option>Demo Company Driver</option></select></Field><Field label="Vehicle"><select value={localVehicle} onChange={e=>setLocalVehicle(e.target.value)}><option value="">Select vehicle</option><option>Luton / Tail lift - TEST 01</option><option>LWB Van - TEST 02</option></select></Field><button className="rv-primary rv-wide" disabled={!localVehicle} onClick={()=>{const next={...localAllocations,[job.id]:{driver:localDriver,vehicle:localVehicle}};setLocalAllocations(next);localStorage.setItem('xdrive-local-allocations-v4',JSON.stringify(next));setJobs(rows=>rows.map(row=>row.id===job.id?{...row,statusHistory:[...(row.statusHistory||[]),{status:'allocated',at:new Date().toISOString(),notes:localDriver+' / '+localVehicle}]}:row));setLocalVehicle('');setError('');}}>Confirm Allocation</button></section>}{job.status==='ALLOCATED'&&(!LOCAL||localAllocations[job.id])&&<section className="rv-card"><h3>On my Way to Pickup</h3><Fact name="Customer" value={job.company||'Customer'}/><Fact name="Booking reference" value={platformJobReference(job.id,job.yourRef)||'Not provided'}/><Field label="Driver’s Notes"><textarea rows={4} maxLength={1000} value={pickupNotes} onChange={e=>setPickupNotes(e.target.value)} placeholder="Add collection notes"/></Field></section>}
            {LOCAL&&['ON_WAY_TO_PICKUP','ON_WAY_TO_DELIVERY'].includes(job.status)&&<section className="rv-card"><h3>{job.status==='ON_WAY_TO_PICKUP'?'On Site (Pickup)':'On Site (Delivery)'}</h3><h4>Job Details</h4><Fact name="Required vehicle" value={job.vehicle}/><Field label="Driver's Notes"><textarea rows={4} maxLength={1000} value={pickupNotes} onChange={e=>setPickupNotes(e.target.value)} placeholder={job.status==='ON_WAY_TO_PICKUP'?'Please add any notes regarding the arrival to the pickup location if required':'Please add any notes regarding the arrival to the delivery location if required'}/></Field></section>}
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
          <Field label="Packaging"><select value={packaging} onChange={e=>setPackaging(e.target.value)}><option value="">Select packaging</option>{packagingOptions(packaging).map(v=><option key={v} value={v}>{v}</option>)}</select></Field>
          <section className="rv-collection-group"><h4>Estimated arrival at delivery</h4><div className="rv-two"><Field label="Date"><input type="date" min={localMinute().slice(0,10)} value={deliveryEtaAt.split("T")[0]||""} onChange={e=>setDeliveryEtaAt(e.target.value?e.target.value+"T":"")}/></Field><Field label="Time"><select disabled={!deliveryEtaAt.split("T")[0]} aria-label="Delivery ETA time (15-minute intervals)" value={deliveryEtaAt.split("T")[1]||""} onChange={e=>setDeliveryEtaAt(deliveryEtaAt.split("T")[0]+"T"+e.target.value)}><option value="" disabled>Select time</option>{availableTimes(deliveryEtaAt.split("T")[0]||"",localMinute(),"",15,true).map(t=><option key={t} value={t}>{t}</option>)}</select></Field></div></section><section className="rv-collection-group"><h4>Booked load details</h4><Fact name="Required vehicle" value={job.vehicle}/><Fact name="Booked weight" value={job.weight+" kg"}/><Fact name="Booked items" value={job.items??"Not stated"}/><Fact name="Booked packaging" value={job.packaging||"Not specified"}/></section>
          <Field label="Driver notes"><textarea rows={2} maxLength={1000} value={pickupNotes} onChange={e=>setPickupNotes(e.target.value)}/></Field>
          <Field label="Loaded documents and photos (at least one photo required)"><input type="file" accept="image/jpeg,image/png,application/pdf" multiple onChange={e=>{const selected=Array.from(e.target.files||[]);setCollectionFiles(previous=>[...previous,...selected]);e.target.value='';}}/></Field>
          <Field label="Take loaded photo"><button type="button" className="rv-outline" disabled={collectionCameraBusy} onClick={()=>void openCollectionCamera()}>{collectionCameraBusy?'Opening camera…':'Open Camera'}</button></Field>
          {collectionCameraOpen&&<section className="rv-card" aria-label="Live loaded cargo camera"><video ref={collectionVideoRef} autoPlay playsInline muted aria-label="Live loaded cargo camera preview" style={{width:"100%",maxHeight:"65vh",background:"#111",borderRadius:12}}/><div className="rv-two"><button type="button" className="rv-primary" onClick={()=>void captureCollectionPhoto()}>Take Photo</button><button type="button" className="rv-outline" onClick={stopCollectionCamera}>Cancel</button></div></section>}
        </>}
        {collectionFiles.length>0&&<ul>{collectionFiles.map((file,index)=><li key={file.name+'-'+index}>{file.name} <button type="button" className="rv-outline" onClick={()=>setCollectionFiles(previous=>previous.filter((_,i)=>i!==index))}>Remove</button></li>)}</ul>}
      </section>}
      {delivered&&!podDone&&!job.podRecorded&&<section className="rv-card rv-pod-stage"><span className="rv-over">DELIVERED / POD</span><h2>Recipient details and signature saved</h2><Fact name="Received By" value={draft.recipient}/><Fact name="Left At" value={draft.leftAt}/><Fact name="Items" value={draft.items}/><Fact name="Delivered On" value={draft.deliveredOn}/><Field label="Delivery Time *"><input type="time" required value={draft.deliveredTime} onChange={e=>setDraft(previous=>({...previous,deliveredTime:e.target.value}))}/></Field><p>The delivery signature was verified before the Delivered status. Submit the final POD to archive the evidence.</p>{job.hardCopyPodRequired&&<label className="rv-hard-copy-ack"><input type="checkbox" checked={hardCopyAcknowledged} onChange={e=>setHardCopyAcknowledged(e.target.checked)}/> I acknowledge that the required paper POD must be retained and handed over as instructed.</label>}<button className="rv-primary rv-wide" disabled={busy||!signature||verifiedSignature!==signature||(job.hardCopyPodRequired&&!hardCopyAcknowledged)} onClick={()=>void savePod(job)}>{busy?'Saving POD…':'Send POD →'}</button></section>}
      {delivered&&(podDone||job.podRecorded)&&<section className="rv-card rv-pod-stage"><div className="rv-success">Delivery evidence is recorded in XDrive. Official POD download and invoice eligibility remain subject to verification of the required evidence.</div>{session&&job.podEvidenceComplete!==false&&<OfficialPodDownload jobId={job.id} session={session} onSession={setSession}/>}{LOCAL&&(()=>{try{const saved=JSON.parse(localStorage.getItem("xdrive-local-signature-v4-"+job.id)||"null");return saved?.signature?<section className="rv-card"><h3>Signed POD evidence</h3><p>{saved.draft?.recipient}</p><img alt="Captured recipient signature" src={saved.signature} style={{width:"100%"}}/><small>Local evidence - not an official PDF</small></section>:null}catch{return null}})()}{role==='Owner Driver'&&<button className="rv-primary rv-wide" onClick={()=>setView(invoiceAction(job).target)}>{invoiceAction(job).label}</button>}</section>}

      {!delivered&&step&&(!LOCAL||job.status!=='ALLOCATED'||localAllocations[job.id])&&<button className="rv-primary rv-wide" disabled={busy} onClick={()=>void transition(job)}>{busy?'Saving status…':job.status==='ALLOCATED'?'On My Way to Pickup':LOCAL&&['ON_WAY_TO_PICKUP','ON_WAY_TO_DELIVERY'].includes(job.status)?'Save':job.status==='ON_SITE_PICKUP'?(collectionStage==='arrival'?'Save Arrival Details':'Confirm Loaded'):step.label+' →'}</button>}
    </section>;
  }
  const logout=()=>{if(session)void revokeLiveSession(session).catch(()=>{});clearInvalidSession();setError("");setId(null);setView("list");};
  const header=<header className="rv-header rv-official-header"><div className="rv-official-brand"><img src={`${import.meta.env.BASE_URL}xdrive-logo-company-3150.png`} alt="XDrive Logistics"/></div>{connected&&tab==='Loads'&&(view==='list'||view==='searchLoads')?<div className="rv-search-controls"><button className="rv-search-open" type="button" aria-label="Search loads" onClick={()=>{setSearchError('');setView('searchLoads')}}><svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" stroke="currentColor" strokeWidth="2.4" fill="none"/><path d="m15.5 15.5 6 6" stroke="currentColor" strokeWidth="2.4"/></svg></button></div>:null}{connected&&<button className="rv-official-logout" type="button" onClick={logout}>Logout</button>}</header>;
  return <div className={LOCAL?"rv-shell rv-local-preview":"rv-shell"}>{header}{declineConfirmation&&<div className="rv-confirm-overlay" onClick={()=>setDeclineConfirmation(null)}><section className="rv-confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="rv-decline-title" onClick={e=>e.stopPropagation()} onKeyDown={e=>{if(e.key==="Escape")setDeclineConfirmation(null);}}><h2 id="rv-decline-title">Decline booking?</h2><p>This booking from {declineConfirmation.company} will be declined.</p><div className="rv-actions"><button autoFocus className="rv-outline" onClick={()=>setDeclineConfirmation(null)}>Keep booking</button><button className="rv-danger" disabled={busy} onClick={()=>void confirmDecline(declineConfirmation)}>Decline booking</button></div></section></div>}{undoConfirmation&&<div className="rv-confirm-overlay" onClick={()=>setUndoConfirmation(null)}><section className="rv-confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="rv-undo-title" aria-describedby="rv-undo-description" onClick={e=>e.stopPropagation()} onKeyDown={e=>{if(e.key==='Escape')setUndoConfirmation(null);}}><h2 id="rv-undo-title">Undo last status?</h2><p id="rv-undo-description">The booking will return to its previous transport status. This action will be recorded in booking history.</p><div className="rv-actions"><button autoFocus className="rv-outline" onClick={()=>setUndoConfirmation(null)}>Keep status</button><button className="rv-danger" disabled={busy} onClick={()=>void undoLatestStatus(undoConfirmation,true)}>Undo status</button></div></section></div>}<main key={tab+'-'+view+'-'+(id||'')} className={'rv-main'+(view==='list'&&(tab==='Quotes'||tab==='Bookings')?' rv-card-first-list':'')}>{!connected&&session?<section className="rv-auth" aria-busy={loading}><h1>{loading?'Restoring session…':'Reconnect to XDrive'}</h1><p role="status">{error||'Verifying your existing secure session.'}</p>{!loading&&<button className="rv-primary rv-wide" onClick={()=>void retryLive()}>Retry connection</button>}{!loading&&<button className="rv-outline rv-wide" onClick={logout}>Sign out</button>}</section>:!connected?<section className="rv-auth rv-android-auth"><img className="rv-android-logo" src="/driver/reserve-pwa/xdrive-logo-horizontal.png" alt="XDrive Logistics"/><h1>Secure XDrive sign in</h1><p>Your company and operational workspace are confirmed by XDrive after authentication.</p><form onSubmit={e=>void signIn(e)}><Field label="Email"><input type="email" required autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)}/></Field><Field label="Password"><input type="password" required autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)}/></Field>{error&&<p role="alert" className="rv-android-error">{error}</p>}<button className="rv-primary rv-wide" disabled={loading}>{loading?'Connecting...':'Sign in'}</button></form><p>Only active, backend-authorised XDrive accounts can access company or driver operations.</p></section>:<>{error&&<div className="rv-error" role="alert">{error}</div>}{warning&&view!=='list'&&<details className="rv-api-notes"><summary>Some live information is temporarily unavailable</summary><p>{warning}</p></details>}{view==='searchLoads'&&<SearchLoads initial={searchFilters} busy={searchBusy} error={searchError} onSearch={f=>void applyLoadSearch(f)} onClear={clearLoadSearch} onBack={()=>setView('list')} onSave={f=>{setSearchFilters(f);try{localStorage.setItem('xdrive-reserve-load-search-v1',JSON.stringify(f));}catch{setSearchError('Search preferences could not be saved.');}}}/>}{id&&!job&&view!=='list'&&<section className='rv-card' role='status'><p>{loading||Object.values(pendingFeeds).some(Boolean)?'Restoring this page…':'This item is unavailable in your current workspace.'}</p><button className='rv-back' onClick={()=>navigate(tab)}>Back to {tab}</button></section>}{view==='list'&&list()}{view==='more'&&session&&<OriginalMorePwa key={moreNavigationKey} token={session.token} ownerDriver={verifiedSession&&role==='Owner Driver'} onOpenInvoices={()=>{setTab('Bookings');setView('invoices');setId(null);setError('');}}/>} {view==='details'&&details()}{view==='map'&&job&&<RouteMap bookingJobId={tab==='Bookings'?job.id:undefined} token={session?.token} from={job.status==='OPEN'?(job.fromOutcode||job.from):(job.pickupAddress||job.from)} to={job.status==='OPEN'?(job.toOutcode||job.to):(job.deliveryAddress||job.to)} stops={job.status==="OPEN"?undefined:job.routeStops?.length?job.routeStops.map(s=>({id:s.id,kind:s.type==="collection"?"PICKUP":"DELIVERY",address:s.address?.trim()||(s.type==="collection"?(job.pickupAddress||job.fromOutcode||job.from):(job.deliveryAddress||job.toOutcode||job.to)),completedAt:s.completedAt})):undefined} status={job.status} distanceMiles={job.distanceMiles} travelMinutes={job.travelMinutes} onBack={()=>setView(mapReturnView)}/>} {view==='quoteDetails'&&quoteDetails()}{view==='quote'&&quote()}{view==='incoming'&&incoming()}{view==='statusHistory'&&job&&<><button className="rv-back" onClick={()=>setView('list')}>← Back to Bookings</button><p className="rv-over">BOOKING STATUS</p><h1>{platformJobReference(job.id,job.yourRef)||'Reference unavailable'}</h1>{!job.podRecorded&&!['DELIVERED','POD_SUBMITTED','COMPLETED'].includes(job.status)&&<button className="rv-primary rv-wide" onClick={()=>{if(LOCAL&&job.status==='ON_SITE_PICKUP')setCollectionStage('loaded');setView('flow');}}>{nextStates[job.status]?.label||(job.status==='ON_SITE_DELIVERY'?'Delivered / POD':'View Booking')}</button>}{["DELIVERED","POD_SUBMITTED"].includes(job.status)&&!job.podRecorded&&<button className="rv-primary rv-wide" onClick={()=>setView("flow")}>Send POD</button>}{job.podRecorded&&role==="Owner Driver"&&<button className="rv-primary rv-wide" onClick={()=>setView(invoiceAction(job).target)}>{invoiceAction(job).label}</button>}{!LOCAL&&session&&job.isTest===true&&<button className="rv-outline rv-wide" onClick={()=>setView('bookingExtras')}>Additional Charges / Add item</button>}<BookingStatusTimeline job={job}/>{LOCAL&&job.podRecorded&&<button className="rv-outline rv-wide" onClick={()=>void downloadLocalPod(job.id).catch(e=>setError(e.message))}>Signed POD.pdf (Test)</button>}{job.podRecorded&&session&&job.podEvidenceComplete!==false&&<OfficialPodDownload jobId={job.id} session={session} onSession={setSession}/>}{job.podRecorded&&job.podEvidenceComplete===false&&<p className="rv-warning">Archived POD requires evidence review. This delivery cannot be repeated.</p>}{LOCAL&&job.podRecorded&&localStorage.getItem("xdrive-local-signature-v4-"+job.id)&&<button className="rv-outline rv-wide" onClick={()=>setView("flow")}>View signed POD evidence</button>}{undoTargets[job.status]&&<button className="rv-undo-action rv-wide" disabled={busy} onClick={()=>void undoLatestStatus(job)}>Undo Last Status</button>}{job.podRecorded&&!LOCAL&&role==='Owner Driver'&&null}{['DELIVERED','POD_SUBMITTED'].includes(job.status)&&!job.podRecorded&&<section className="rv-card"><h3>Finalise Proof of Delivery</h3><p>Delivery is marked as completed, but the signed POD has not yet been confirmed as archived. Complete the recipient details, signature and required evidence before invoice eligibility can be checked.</p><button className="rv-primary rv-wide" onClick={()=>setView('flow')}>Complete / Save Signed POD →</button></section>}</>}{view==='flow'&&flow()}{view==='bookingExtras'&&session&&job&&<ReserveBookingExtras key={job.id} job={job} session={session} onSession={setSession} onBack={()=>setView('statusHistory')}/>}{view==='invoiceJob'&&(LOCAL||session)&&job&&<LiveInvoiceFlow key={job.id} job={job} session={session} onSession={setSession} onBack={()=>setView('statusHistory')} onList={()=>setView('invoices')}/>}{view==='invoices'&&session&&<><button className="rv-back" onClick={()=>navigate('Bookings')}>← Bookings</button><LiveInvoices session={session} onSession={setSession}/></>}</>}</main>{connected&&session&&tab==='Bookings'&&job&&view==='statusHistory'&&<button className="rv-outline rv-wide" onClick={()=>setView('gps')}>GPS Tracking</button>}{connected&&session&&<GpsTracking token={session.token} jobs={jobs} visible={view==='gps'} onClose={()=>setView('statusHistory')}/>} {connected&&<nav className="rv-nav rv-official-nav">{([{key:'Loads',label:'Loads',icon:'📦'},{key:'Quotes',label:'Quotes',icon:'💬'},{key:'Bookings',label:'Bookings',icon:'🚚'}] as const).map(item=><button key={item.key} className={(item.key===tab&&view!=='invoices'&&view!=='more'?'rv-active ':'')+(item.key==='Bookings'&&unreadBookingOffers>0?'rv-booking-unread':'')} aria-label={item.key==='Bookings'&&unreadBookingOffers>0?'Bookings - '+unreadBookingOffers+' new awarded jobs':item.label} onClick={()=>navigate(item.key)}><span>{item.icon}</span>{item.label}</button>)}<button type="button" className={view==='more'?'rv-active':''} aria-label="More" aria-current={view==='more'?'page':undefined} onClick={()=>{setMoreNavigationKey(value=>value+1);setView('more');setId(null);setError('');}}><span aria-hidden="true">☰</span>More</button></nav>}</div>;
}



