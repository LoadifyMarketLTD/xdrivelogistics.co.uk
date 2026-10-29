'use client';

import {useCallback,useEffect,useState} from 'react';
import Link from 'next/link';
import ProtectedRoute from '../../components/ProtectedRoute';
import {useAuth} from '../../components/AuthContext';
import {readRouteAuthAccessToken} from '../../../lib/routeAuthCookie';
import {FreshHeader,FreshBottom} from '../FreshNavigation';
import {getLoadDetailSections} from '../../../lib/loadPostingDetails';
import {navigationDestination,navigationUrl,isAreaOnlyStop} from '../../../lib/jobs/driverNavigationLinks';
import './offers.css';

type JobInfo={
 pickup_location?:string|null;pickup_city?:string|null;pickup_postcode?:string|null;pickup_datetime?:string|null;
 delivery_location?:string|null;delivery_city?:string|null;delivery_postcode?:string|null;delivery_datetime?:string|null;
 payment_terms?:string|null;booking_reference?:string|null;load_reference?:string|null;load_ref?:string|null;
 vehicle_type?:string|null;requested_vehicle_label?:string|null;job_distance_miles?:number|null;
 load_details?:string|Record<string,unknown>|null;
};
type Offer={
 id:string;job_id:string;status:string;offered_at:string;quoted_amount:number;currency:string|null;
 buyer_name:string;buyer_xd_id:string|null;buyer_company_id:string;public_quote_notes:string|null;
 job:JobInfo|null;
};
type Response={offers?:Offer[];error?:string};
const showDate=(value:string|null|undefined)=>{if(!value)return null;const date=new Date(value);return Number.isFinite(date.getTime())?date.toLocaleString('en-GB',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}):null};
const fmtMoney=(amount:number,currency:string|null)=>{try{return new Intl.NumberFormat('en-GB',{style:'currency',currency:currency||'GBP'}).format(amount)}catch{return '┬ú'+amount.toFixed(2)}};
const place=(location?:string|null,town?:string|null,postcode?:string|null)=>[location,town,postcode].filter((v,i,a)=>Boolean(v)&&a.findIndex(t=>t?.trim().toLowerCase()===v?.trim().toLowerCase())===i).join(', ');

export default function BookingOffersPage(){
 const {user,isLoading:authLoading}=useAuth();
 const [offers,setOffers]=useState<Offer[]>([]),[loading,setLoading]=useState(true),[busy,setBusy]=useState(''),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const refresh=useCallback(async()=>{
  if(!user?.id)return;
  setLoading(true);setError('');
  try{
   const token=await readRouteAuthAccessToken();
   if(!token)throw new Error('Sign in again to view awarded jobs.');
   const response=await fetch('/api/booking-offers',{cache:'no-store',headers:{Authorization:'Bearer '+token}});
   const data=await response.json().catch(()=>({})) as Response;
   if(!response.ok)throw new Error(data.error||'Could not load awarded jobs.');
   setOffers((data.offers||[]).filter(o=>o.status==='pending'));
  }catch(cause){setError(cause instanceof Error?cause.message:'Unable to load booking offers.');}
  finally{setLoading(false);}
 },[user?.id]);
 useEffect(()=>{if(!authLoading&&user?.id)void refresh();else if(!authLoading)setLoading(false)},[user?.id,authLoading,refresh]);
 const respond=async(offer:Offer,action:'accept'|'decline')=>{
  if(busy||offer.status!=='pending')return;
  if(action==='decline'&&!window.confirm('Decline this awarded job? This action cannot be undone.'))return;
  setBusy(offer.id);setError('');setNotice('');
  try{
   const token=await readRouteAuthAccessToken();
   if(!token)throw new Error('Sign in again before responding.');
   const response=await fetch('/api/booking-offers/'+encodeURIComponent(offer.id)+'/respond',{
    method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({action}),cache:'no-store'
   });
   const data=await response.json().catch(()=>({})) as {error?:string};
   if(!response.ok)throw new Error(data.error||'Booking response failed.');
   setNotice(action==='accept'?'Booking accepted and recorded by XDrive.':'Booking declined and recorded by XDrive.');
   await refresh();
  }catch(cause){setError(cause instanceof Error?cause.message:'Booking response failed.');}
  finally{setBusy('');}
 };
 return <ProtectedRoute allowedRoles={['driver']}><FreshHeader/><main className="fresh-content fresh-offer-page" data-testid="driver-booking-offers">
  <div className="fresh-offer-top"><Link href="/driver-pwa-fresh/bookings">ÔÇ╣ Back to Bookings</Link><h1>Received Booking</h1><p>New job awarded to you. Review the complete booking before accepting responsibility for the transport.</p></div>
  {error&&<div className="fresh-message" role="alert">{error}<button type="button" onClick={()=>void refresh()}>Retry</button></div>}
  {notice&&<div className="fresh-offer-notice" role="status">{notice}<Link href="/driver-pwa-fresh/bookings">View Bookings</Link></div>}
  {loading?<p className="fresh-message" role="status">Loading awarded jobs...</p>:!error&&offers.length===0?<div className="fresh-message">No jobs currently awaiting acceptance. <Link href="/driver-pwa-fresh/bookings">Return to Bookings</Link></div>:offers.map(offer=>{
   const job=offer.job;
   const pickup=navigationDestination(place(job?.pickup_location,job?.pickup_city),job?.pickup_postcode);
   const delivery=navigationDestination(place(job?.delivery_location,job?.delivery_city),job?.delivery_postcode);
   const additional=getLoadDetailSections({load_details:typeof job?.load_details==='string'?job.load_details:job?.load_details?JSON.stringify(job.load_details):null,requested_vehicle_label:job?.requested_vehicle_label??null,vehicle_type:job?.vehicle_type??null,pickup_postcode:job?.pickup_postcode??null,delivery_postcode:job?.delivery_postcode??null}).filter(section=>['Cargo','Contacts','Loading','Requirements','Documents'].includes(section.title)).map(section=>({...section,items:section.items.filter(item=>item.label!=='Vehicle')})).filter(section=>section.items.length>0);
   return <article className="fresh-offer-card" key={offer.id}>
    <div className="fresh-offer-invitation-hero"><span className="fresh-offer-pending">ACCEPTANCE REQUIRED</span><h2>New job awarded to you</h2><p>Review the complete booking before accepting responsibility for the transport.</p></div>
    <div className="fresh-offer-identity"><div><small>Company &amp; Booking</small><strong>{offer.buyer_name||'Company unavailable'}</strong>{offer.buyer_xd_id&&<span>XD Member ID: {offer.buyer_xd_id}</span>}</div></div>
    {job?.booking_reference&&<div className="fresh-offer-reference">Booking reference: <strong>{job.booking_reference}</strong></div>}
    {(job?.load_reference||job?.load_ref)&&<div className="fresh-offer-reference">Job reference: <strong>{job.load_reference||job.load_ref}</strong></div>}
    {showDate(offer.offered_at)&&<div className="fresh-offer-reference">Awarded: {showDate(offer.offered_at)}</div>}
    <div className="fresh-offer-financials"><div><small>Agreed quote</small><strong>{fmtMoney(Number(offer.quoted_amount),offer.currency)}</strong></div>{job?.payment_terms&&<div><small>Payment Terms</small><strong>{job.payment_terms}</strong></div>}</div>
    <div className="fresh-offer-stop"><h2>Collection</h2><strong>{pickup||'Collection address not provided'}</strong>{isAreaOnlyStop(pickup,null)&&<small className="fresh-booking-area-warning">Approximate postcode area only</small>}{showDate(job?.pickup_datetime)&&<span>{showDate(job?.pickup_datetime)}</span>}{pickup&&<div className="fresh-offer-mapactions"><a href={navigationUrl(pickup,null,'navigate')!} target="_blank" rel="noopener noreferrer">Navigate</a><a href={navigationUrl(pickup,null,'view')!} target="_blank" rel="noopener noreferrer">View Map</a></div>}</div>
    <div className="fresh-offer-stop"><h2>Delivery</h2><strong>{delivery||'Delivery address not provided'}</strong>{isAreaOnlyStop(delivery,null)&&<small className="fresh-booking-area-warning">Approximate postcode area only</small>}{showDate(job?.delivery_datetime)&&<span>{showDate(job?.delivery_datetime)}</span>}{delivery&&<div className="fresh-offer-mapactions"><a href={navigationUrl(delivery,null,'navigate')!} target="_blank" rel="noopener noreferrer">Navigate</a><a href={navigationUrl(delivery,null,'view')!} target="_blank" rel="noopener noreferrer">View Map</a></div>}</div>
    <div className="fresh-offer-facts">
      {(job?.requested_vehicle_label||job?.vehicle_type)&&<div><small>Vehicle</small><strong>{job.requested_vehicle_label||job.vehicle_type}</strong></div>}
      {job?.job_distance_miles!=null&&<div><small>Route distance</small><strong>{job.job_distance_miles} miles</strong></div>}
    </div>
    {offer.public_quote_notes&&<div className="fresh-offer-notes"><strong>Job Notes</strong><p>{offer.public_quote_notes}</p></div>}
    {additional.length>0&&<section className="fresh-offer-additional" aria-label="Full job information"><h2>Job information</h2>{additional.map(section=><div key={section.title} className="fresh-offer-extra-section"><h3>{section.title}</h3><dl>{section.items.map(item=><div key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}</dl></div>)}</section>}
    <div className="fresh-offer-decision"><button type="button" className="fresh-offer-decline" disabled={busy===offer.id} onClick={()=>void respond(offer,'decline')}>Decline Job</button><button type="button" className="fresh-offer-accept" disabled={busy===offer.id} onClick={()=>void respond(offer,'accept')}>{busy===offer.id?'Saving...':'Accept Job'}</button></div>
   </article>;
  })}
 </main><FreshBottom active="bookings"/></ProtectedRoute>;
}
