'use client';
import {useCallback,useEffect,useState} from 'react';
import Link from 'next/link';
import ProtectedRoute from '../../components/ProtectedRoute';
import {useAuth} from '../../components/AuthContext';
import {readRouteAuthAccessToken} from '../../../lib/routeAuthCookie';
import {FreshHeader,FreshBottom} from '../FreshNavigation';
import FreshSectionTabs from '../FreshSectionTabs';
import '../booking-offers/offers.css';

type Booking={id:string;reference:string;pickupLocation:string|null;deliveryLocation:string|null;pickupTime:string|null;updatedAt:string|null;jobDistanceMiles:number|null;vehicleType:string|null;canonicalStatus:string;lifecycleGroup:string;agreedRateAmount:number|null;postingCompanyName:string|null};
type Response={jobs?:Booking[];error?:string};
type Period='current'|'week'|'month';
const fmt=(date:string|null)=>date?new Date(date).toLocaleString('en-GB',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}):'Time not provided';
export default function Bookings(){
 const {user,isLoading:authLoading}=useAuth();
 const [items,setItems]=useState<Booking[]>([]),[period,setPeriod]=useState<Period>('current'),[busy,setBusy]=useState(true),[error,setError]=useState('');
 const [pendingOffers,setPendingOffers]=useState<number|null|undefined>(undefined);
 const refresh=useCallback(async()=>{
  if(!user?.id)return;
  setBusy(true);setError('');
  try{
   const token=await readRouteAuthAccessToken();if(!token)throw new Error('Please sign in to view bookings.');
   const response=await fetch('/api/driver/jobs?scope=all&limit=250',{headers:{Authorization:'Bearer '+token},cache:'no-store'});
   const body=await response.json() as Response;
   if(!response.ok)throw new Error(body.error||'Bookings could not be loaded.');
   setItems((body.jobs||[]).filter(job=>job.lifecycleGroup!=='other'));
  }catch(e){setError(e instanceof Error?e.message:'Unable to load bookings.');}
  finally{setBusy(false);}
 },[user?.id]);
 useEffect(()=>{if(!authLoading&&user?.id)void refresh();else if(!authLoading)setBusy(false)},[authLoading,user?.id,refresh]);
 useEffect(()=>{
  if(authLoading||!user?.id)return;
  let active=true;
  void (async()=>{
   try{
    const token=await readRouteAuthAccessToken();
    if(!token)throw new Error('Authentication unavailable');
    const response=await fetch('/api/booking-offers',{cache:'no-store',headers:{Authorization:'Bearer '+token}});
    if(!response.ok)throw new Error('Booking offers unavailable');
    const data=await response.json() as {offers?:Array<{status?:string}>};
    if(active)setPendingOffers((data.offers||[]).filter(offer=>offer.status==='pending').length);
   }catch{if(active)setPendingOffers(null);}
  })();
  return ()=>{active=false};
 },[authLoading,user?.id]);
 const now=Date.now(),day=86400000;
 const visible=items.filter(job=>{
  const timestamp=job.updatedAt?new Date(job.updatedAt).getTime():NaN;
  if(period==='current')return job.lifecycleGroup==='active'||job.lifecycleGroup==='upcoming'||job.canonicalStatus.toLowerCase()==='delivered';
  if(job.lifecycleGroup==='active'||job.lifecycleGroup==='upcoming'||job.canonicalStatus.toLowerCase()==='delivered')return false;
  if(!Number.isFinite(timestamp))return false;
  const age=now-timestamp;
  return period==='week'?age>=0&&age<=7*day:age>7*day&&age<=30*day;
 });
 return <ProtectedRoute allowedRoles={['driver']}><FreshHeader/><main className="fresh-content" data-testid="fresh-bookings">
  <FreshSectionTabs />
  <h1>Bookings</h1>
  <Link className="fresh-booking-offers-link" href="/driver-pwa-fresh/booking-offers">Received Bookings ÔÇö Review &amp; Accept / Decline {pendingOffers?`(${pendingOffers})`:''}</Link>
  <div className="fresh-quote-tabs" role="tablist" aria-label="Booking period">{([['current','Current'],['week','Last week'],['month','Last month']] as const).map(([id,label])=><button key={id} type="button" role="tab" aria-selected={period===id} className={period===id?'active':''} onClick={()=>setPeriod(id)}>{label}</button>)}</div>
  {error?<p role="alert" className="fresh-message">{error} <button type="button" onClick={()=>void refresh()}>Retry</button></p>:null}
  {busy?<p role="status" className="fresh-message">Loading bookings...</p>:!error&&visible.length===0?<p className="fresh-message">No bookings for this period.</p>:visible.map(job=><article className="fresh-card" key={job.id}>
   <section className="fresh-summary"><div className="fresh-summary-top"><strong>{job.postingCompanyName||'Booking'}</strong><span className="fresh-available">{job.canonicalStatus||job.lifecycleGroup}</span></div><div className="fresh-posted">Job ID: {job.reference||job.id}</div><div className="fresh-summary-meta"><span>{job.vehicleType||'Vehicle not specified'}</span>{job.agreedRateAmount!=null?<strong>┬ú{job.agreedRateAmount.toFixed(2)}</strong>:null}</div></section>
   <section className="fresh-route"><div className="fresh-route-line" aria-hidden="true"><span className="fresh-pickup-dot"/><span className="fresh-connector"/><span className="fresh-delivery-dot"/></div><div className="fresh-route-places"><div><strong>{job.pickupLocation||'Collection'}</strong><p>{fmt(job.pickupTime)}</p></div><div><strong>{job.deliveryLocation||'Delivery'}</strong><p>{job.jobDistanceMiles!=null?job.jobDistanceMiles+' miles':'Distance not available'}</p></div></div></section>
   <div className="fresh-booking-timeline" aria-label="Booking progress">{(["On my way", "On site", "Loaded", "Delivered", "POD"] as const).map((step,index)=>{const state=job.canonicalStatus.toLowerCase();const progress=state.includes("pod")||state==="completed"||state==="invoiced"?4:state==="delivered"?3:state==="on_site_delivery"?2:state.includes("load")||state==="in_transit"?2:state.includes("site")?1:state.includes("way")?0:-1;return <div key={step} className={index<=progress?"done":""}><span className="fresh-booking-step-dot"/><small>{step}</small></div>})}</div>
   <div className="fresh-actions fresh-booking-actions"><Link className="fresh-booking-open" href={'/driver-pwa-fresh/bookings/'+encodeURIComponent(job.id)}>View Booking Details</Link></div>
  </article>)}
 </main><FreshBottom active="bookings"/></ProtectedRoute>;
}
