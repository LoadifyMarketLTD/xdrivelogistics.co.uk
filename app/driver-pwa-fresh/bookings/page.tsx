'use client';
import {useCallback,useEffect,useState} from 'react';
import Link from 'next/link';
import ProtectedRoute from '../../components/ProtectedRoute';
import {useAuth} from '../../components/AuthContext';
import {readRouteAuthAccessToken} from '../../../lib/routeAuthCookie';
import {FreshHeader,FreshBottom} from '../FreshNavigation';
import FreshJobCard, { type Load } from '../FreshJobCard';

type Booking={id:string;reference:string;pickupLocation:string|null;deliveryLocation:string|null;pickupTime:string|null;updatedAt:string|null;jobDistanceMiles:number|null;vehicleType:string|null;canonicalStatus:string;lifecycleGroup:string;agreedRateAmount:number|null;postingCompanyName:string|null};
type PendingOffer={id:string;job_id:string;status:string;buyer_name:string;public_reference:string|null;quoted_amount:number|null;job:{pickup_city:string|null;pickup_location:string|null;pickup_postcode:string|null;delivery_city:string|null;delivery_location:string|null;delivery_postcode:string|null;pickup_datetime:string|null;job_distance_miles:number|null}|null};
type Response={jobs?:Booking[];error?:string};
type OffersResponse={offers?:PendingOffer[];error?:string};
type Period='current'|'week'|'month';
const fmt=(date:string|null)=>date?new Date(date).toLocaleString('en-GB',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}):'Time not provided';
const fmtOfferPlace=(place:string|null|undefined,postcode:string|null|undefined)=>{const name=(place||'').trim(),code=(postcode||'').trim();if(!code)return name.toUpperCase();if(!name)return code.toUpperCase();const normalized=(value:string)=>value.toUpperCase().replace(/[^A-Z0-9]/g,'');return (normalized(name).includes(normalized(code))?name:name+', '+code).toUpperCase();};
export default function Bookings(){
 const {user,isLoading:authLoading}=useAuth();
 const [items,setItems]=useState<Booking[]>([]),[offers,setOffers]=useState<PendingOffer[]>([]),[period,setPeriod]=useState<Period>('current'),[busy,setBusy]=useState(true),[error,setError]=useState('');
 const refresh=useCallback(async()=>{
  if(!user?.id)return;
  setBusy(true);setError('');
  try{
   const token=await readRouteAuthAccessToken();if(!token)throw new Error('Please sign in to view bookings.');
   const [jobsResponse,offersResponse]=await Promise.all([fetch('/api/driver/jobs?scope=all&limit=250',{headers:{Authorization:'Bearer '+token},cache:'no-store'}),fetch('/api/booking-offers',{headers:{Authorization:'Bearer '+token},cache:'no-store'})]);
   const body=await jobsResponse.json() as Response; const offerBody=await offersResponse.json() as OffersResponse;
   if(!jobsResponse.ok)throw new Error(body.error||'Bookings could not be loaded.');
   if(!offersResponse.ok)throw new Error(offerBody.error||'Booking offers could not be loaded.');
   setItems((body.jobs||[]).filter(job=>job.lifecycleGroup!=='other'));
   setOffers((offerBody.offers||[]).filter(offer=>offer.status==='pending'));
  }catch(e){setError(e instanceof Error?e.message:'Unable to load bookings.');}
  finally{setBusy(false);}
 },[user?.id]);
 useEffect(()=>{if(!authLoading&&user?.id)void refresh();else if(!authLoading)setBusy(false)},[authLoading,user?.id,refresh]);
 useEffect(()=>{if(authLoading||!user?.id)return;const onResume=()=>{if(document.visibilityState==='visible')void refresh();};window.addEventListener('focus',onResume);document.addEventListener('visibilitychange',onResume);return()=>{window.removeEventListener('focus',onResume);document.removeEventListener('visibilitychange',onResume);};},[authLoading,user?.id,refresh]);
 const now=Date.now(),day=86400000;
 const visible=items.filter(job=>{
  const timestamp=job.updatedAt?new Date(job.updatedAt).getTime():NaN;
  if(period==='current')return job.lifecycleGroup==='active'||job.lifecycleGroup==='upcoming'||job.canonicalStatus.toLowerCase()==='delivered';
  if(job.lifecycleGroup==='active'||job.lifecycleGroup==='upcoming'||job.canonicalStatus.toLowerCase()==='delivered')return false;
  if(!Number.isFinite(timestamp))return false;
  const age=now-timestamp;
  return period==='week'?age>=0&&age<=7*day:age>7*day&&age<=30*day;
 });
 return <ProtectedRoute allowedRoles={['driver']}><FreshHeader title="Bookings"/><main className="fresh-content" data-testid="fresh-bookings">
  <div className="fresh-quote-tabs" role="tablist" aria-label="Booking period">{([['current','Current'],['week','Last week'],['month','Last month']] as const).map(([id,label])=><button key={id} type="button" role="tab" aria-selected={period===id} className={period===id?'active':''} onClick={()=>setPeriod(id)}>{label}</button>)}</div>
  {period==='current'?offers.map(offer=><article className="fresh-card fresh-pending-offer" key={offer.id}><section className="fresh-summary"><div className="fresh-summary-top"><strong>{offer.buyer_name||'Transport buyer'}</strong><span className="fresh-pending-badge">Acceptance Required</span></div><div className="fresh-posted">Load ID: {offer.public_reference||offer.job_id.slice(0,8).toUpperCase()}</div></section><section className="fresh-route"><div className="fresh-route-places"><div><strong>{fmtOfferPlace(offer.job?.pickup_city||offer.job?.pickup_location,offer.job?.pickup_postcode)}</strong><p>{fmt(offer.job?.pickup_datetime||null)}</p></div><div><strong>{fmtOfferPlace(offer.job?.delivery_city||offer.job?.delivery_location,offer.job?.delivery_postcode)}</strong><p>{offer.job?.job_distance_miles!=null?offer.job.job_distance_miles.toFixed(2)+' miles':'Distance not available'}</p></div></div></section><div className="fresh-actions"><Link className="fresh-booking-open" href={'/driver-pwa-fresh/bookings/offers/'+encodeURIComponent(offer.id)}>Review &amp; Accept</Link></div></article>):null}
  {error?<p role="alert" className="fresh-message">{error} <button type="button" onClick={()=>void refresh()}>Retry</button></p>:null}
  {busy?<p role="status" className="fresh-message">Loading bookings...</p>:!error&&visible.length===0?<p className="fresh-message">No bookings for this period.</p>:visible.map(job=><FreshJobCard key={job.id} mode="bookings" load={{
   id:job.id,status:job.canonicalStatus,pickup_area:job.pickupLocation||'Collection',pickup_postcode_area:null,
   delivery_area:job.deliveryLocation||'Delivery',delivery_postcode_area:null,
   pickup_datetime:job.pickupTime,delivery_datetime:null,pickup_time_slot:null,delivery_time_slot:null,
   vehicle_type:job.vehicleType,requested_vehicle_label:job.vehicleType,requested_vehicle_type:job.vehicleType,
   service_mode:'DIRECT',public_quote_notes:null,distance_to_pickup_miles:null,distance_to_delivery_miles:null,
   distance_miles:job.jobDistanceMiles,weight_kg:null,pallets:null,payment_terms:null,exchange_posted_at:job.updatedAt,
   member:{name:job.postingCompanyName||'Booking',postedBy:job.postingCompanyName||'Booking'}
 } satisfies Load} actions={<>
   <section className="fresh-booking-timeline" aria-label="Booking progress"><strong>{job.canonicalStatus}</strong><div>{(["On my way","On site","Loaded","Delivered","POD"] as const).map((step,index)=>{const state=job.canonicalStatus.toLowerCase();const progress=state.includes("pod")||state==="completed"||state==="invoiced"?4:state==="delivered"?3:state==="on_site_delivery"?2:state.includes("load")||state==="in_transit"?2:state.includes("site")?1:state.includes("way")?0:-1;return <div key={step} className={index<=progress?"done":""}><span className="fresh-booking-step-dot"/><small>{step}</small></div>})}</div></section>
   <Link className="fresh-booking-open" href={'/driver-pwa-fresh/bookings/'+encodeURIComponent(job.id)}>Booking Details</Link>
 </>}/>)}
 </main><FreshBottom active="bookings"/></ProtectedRoute>;
}
