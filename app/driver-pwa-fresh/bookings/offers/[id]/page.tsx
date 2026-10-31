'use client';
import {useCallback,useEffect,useMemo,useState} from 'react';
import {useParams,useRouter} from 'next/navigation';
import ProtectedRoute from '../../../../components/ProtectedRoute';
import {readRouteAuthAccessToken} from '../../../../../lib/routeAuthCookie';
import {FreshBottom} from '../../../FreshNavigation';

type Offer={
 id:string; job_id:string; status:string; buyer_name:string; buyer_xd_id:string|null; public_reference:string|null;
 public_quote_notes:string|null; quoted_amount:number|null; currency:string|null;
 job:{pickup_location:string|null;pickup_city:string|null;pickup_postcode:string|null;delivery_location:string|null;delivery_city:string|null;delivery_postcode:string|null;pickup_datetime:string|null;delivery_datetime:string|null;payment_terms:string|null;load_id:string|null;load_ref:string|null;load_reference:string|null;booking_reference:string|null;customer_reference:string|null;vehicle_type:string|null;requested_vehicle_label:string|null;job_distance_miles:number|null;job_distance_minutes:number|null;load_details:unknown}|null;
};
type OffersResponse={offers?:Offer[];error?:string};
const fmt=(value:string|null)=>value?new Date(value).toLocaleString('en-GB',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}):'ASAP';
const place=(city:string|null,postcode:string|null,location:string|null)=>[city||location,postcode].filter(Boolean).join(', ').toUpperCase();

export default function AcceptJobPage(){
 const params=useParams<{id:string}>(); const router=useRouter(); const id=typeof params?.id==='string'?params.id:'';
 const [offer,setOffer]=useState<Offer|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState(''),[busy,setBusy]=useState<'accept'|'decline'|''>(''),[details,setDetails]=useState(false);
 const load=useCallback(async()=>{setLoading(true);setError('');try{const token=await readRouteAuthAccessToken();if(!token)throw new Error('Please sign in again.');const response=await fetch('/api/booking-offers',{headers:{Authorization:'Bearer '+token},cache:'no-store'});const body=await response.json() as OffersResponse;if(!response.ok)throw new Error(body.error||'Booking offer could not be loaded.');const found=(body.offers||[]).find(item=>item.id===id)||null;if(!found)throw new Error('This booking offer is no longer available.');setOffer(found)}catch(e){setError(e instanceof Error?e.message:'Booking offer could not be loaded.');setOffer(null)}finally{setLoading(false)}},[id]);
 useEffect(()=>{void load()},[load]);
 const respond=async(action:'accept'|'decline')=>{if(!offer||busy)return;setBusy(action);setError('');try{const token=await readRouteAuthAccessToken();if(!token)throw new Error('Please sign in again.');const response=await fetch('/api/booking-offers/'+encodeURIComponent(offer.id)+'/respond',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({action})});const body=await response.json() as {error?:string};if(!response.ok)throw new Error(body.error||'Booking response failed.');if(action==='accept')router.replace('/driver-pwa-fresh/bookings/'+encodeURIComponent(offer.job_id));else router.replace('/driver-pwa-fresh/bookings')}catch(e){setError(e instanceof Error?e.message:'Booking response failed.');setBusy('')}};
 const pickup=useMemo(()=>offer?.job?place(offer.job.pickup_city,offer.job.pickup_postcode,offer.job.pickup_location):'',[offer]); const delivery=useMemo(()=>offer?.job?place(offer.job.delivery_city,offer.job.delivery_postcode,offer.job.delivery_location):'',[offer]);
 const distance=offer?.job?.job_distance_miles,minutes=offer?.job?.job_distance_minutes;
 return <ProtectedRoute allowedRoles={['driver']}>
  <header className="fresh-header fresh-accept-header"><div className="fresh-brand"><span className="fresh-brand-mark">XDRIVE</span><span className="fresh-brand-sub">LOGISTICS</span></div><strong className="fresh-accept-title">Accept Job</strong><div className="fresh-accept-spacer"/><button type="button" className="fresh-header-icon" aria-label="Open driver menu" onClick={()=>router.push('/driver-pwa-fresh/bookings')}>☰</button><button type="button" className="fresh-header-icon" aria-label="Search and filter jobs" onClick={()=>router.push('/driver-pwa-fresh/jobs?view=filter')}>⌕</button></header>
  <main className="fresh-content fresh-accept-page" data-testid="accept-job-page">
   {loading?<p className="fresh-message" role="status">Loading booking offer...</p>:null}{error?<p className="fresh-message fresh-error" role="alert">{error}</p>:null}
   {offer?<article className="fresh-card fresh-accept-card">
    <section className="fresh-accept-summary"><strong>{offer.buyer_name||'Transport buyer'}</strong><span>Load ID: {offer.job?.load_id||offer.job?.load_ref||offer.public_reference||offer.job_id.slice(0,8).toUpperCase()}</span><b>Acceptance Required</b></section>
    <section className="fresh-accept-route"><div className="fresh-accept-route-icons" aria-hidden="true"><span>🚚</span><i>•<br/>•<br/>•</i><span>🚚</span></div><div className="fresh-accept-route-places"><div><strong>{pickup||'Collection'}</strong><span>{fmt(offer.job?.pickup_datetime||null)}</span></div><div><strong>{delivery||'Delivery'}</strong><span>{fmt(offer.job?.delivery_datetime||null)}</span></div></div></section>
    <section className="fresh-accept-facts"><div><b>Stops:</b><span>1</span></div><div><b>Distance:</b><span>{distance!=null?distance.toFixed(2)+' miles':''}{minutes!=null?' ('+minutes+'mins)':''}</span></div><div><b>Notes:</b><span>{offer.public_quote_notes||'No notes supplied.'}</span></div></section>
    {details?<section className="fresh-accept-details" data-testid="accept-job-details"><div><b>Vehicle</b><span>{offer.job?.requested_vehicle_label||offer.job?.vehicle_type||'Not specified'}</span></div><div><b>Payment terms</b><span>{offer.job?.payment_terms||'Not specified'}</span></div>{offer.job?.booking_reference?<div><b>Booking ref</b><span>{offer.job.booking_reference}</span></div>:null}{offer.job?.customer_reference?<div><b>Customer ref</b><span>{offer.job.customer_reference}</span></div>:null}{offer.quoted_amount!=null?<div><b>Agreed quote</b><span>£{offer.quoted_amount.toFixed(2)}</span></div>:null}</section>:null}
    <div className="fresh-accept-actions"><button type="button" className="fresh-accept-map" onClick={()=>router.push('/driver-pwa-fresh/bookings/offers/'+encodeURIComponent(offer.id)+'/map')}>Map</button><button type="button" className="fresh-accept-details-button" aria-expanded={details} onClick={()=>setDetails(v=>!v)}>{details?'Hide Details':'View Details'}</button><button type="button" className="fresh-accept-decline" disabled={Boolean(busy)} onClick={()=>void respond('decline')}>{busy==='decline'?'Declining...':'Decline'}</button><button type="button" className="fresh-accept-confirm" disabled={Boolean(busy)} onClick={()=>void respond('accept')}>{busy==='accept'?'Accepting...':'Accept'}</button></div>
   </article>:null}
  </main><FreshBottom active="bookings"/>
 </ProtectedRoute>
}
