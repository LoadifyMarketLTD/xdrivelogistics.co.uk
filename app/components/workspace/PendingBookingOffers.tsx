'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { ActionButton, AlertBanner, EmptyState, Panel } from './WorkspaceUI';

type BookingOffer = {
  id: string; job_id: string; quoted_amount: number; currency: string; status: string; offered_at: string;
  buyer_name: string;
  job: null | { pickup_location?: string|null; pickup_postcode?: string|null; delivery_location?: string|null; delivery_postcode?: string|null; pickup_datetime?: string|null; payment_terms?: string|null; booking_reference?: string|null; customer_reference?: string|null; vehicle_type?: string|null; requested_vehicle_label?: string|null };
};

export default function PendingBookingOffers({ onChanged }: { onChanged?: () => void }) {
  const [offers,setOffers]=useState<BookingOffer[]>([]); const [error,setError]=useState(''); const [message,setMessage]=useState(''); const [working,setWorking]=useState<string|null>(null); const [loading,setLoading]=useState(true);
  const load=useCallback(async()=>{setLoading(true);setError(''); const {data}=await supabase.auth.getSession(); const token=data.session?.access_token; if(!token){setError('Your session has expired.');setLoading(false);return;} const response=await fetch('/api/booking-offers',{headers:{Authorization:`Bearer ${token}`},cache:'no-store'}); const body=await response.json().catch(()=>({})) as {offers?:BookingOffer[];error?:string}; if(!response.ok){setError(body.error??'Booking offers could not be loaded.');setOffers([]);} else setOffers((body.offers??[]).filter(o=>o.status==='pending')); setLoading(false);},[]);
  useEffect(()=>{void load();},[load]);
  const respond=async(offer:BookingOffer,action:'accept'|'decline')=>{setWorking(offer.id);setError('');setMessage(''); const {data}=await supabase.auth.getSession(); const token=data.session?.access_token; if(!token){setError('Your session has expired.');setWorking(null);return;} const response=await fetch(`/api/booking-offers/${offer.id}/respond`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({action})}); const body=await response.json().catch(()=>({})) as {error?:string}; if(!response.ok)setError(body.error??'Booking response failed.'); else {setMessage(action==='accept'?'Booking accepted. The transport agreement is now formed.':'Booking offer declined.'); await load(); onChanged?.();} setWorking(null);};
  if(loading) return <Panel title="Booking offers"><EmptyState compact title="Loading booking offers…" /></Panel>;
  if(!offers.length && !error) return null;
  return <Panel title="Booking offers awaiting your acceptance" description="A buyer award is not a confirmed transport booking until you accept the commercial offer.">
    {error&&<AlertBanner tone="danger">{error}</AlertBanner>}{message&&<AlertBanner tone="success">{message}</AlertBanner>}
    <div style={{display:'grid',gap:8}}>{offers.map(offer=>{const job=offer.job; const pickup=job?.pickup_postcode||job?.pickup_location||'Collection'; const delivery=job?.delivery_postcode||job?.delivery_location||'Delivery'; return <div key={offer.id} style={{border:'1px solid #d7e0ea',borderRadius:4,padding:10,background:'#fff',display:'grid',gap:6}}>
      <div style={{display:'flex',justifyContent:'space-between',gap:12,flexWrap:'wrap'}}><strong>{pickup} → {delivery}</strong><strong>{new Intl.NumberFormat('en-GB',{style:'currency',currency:offer.currency||'GBP'}).format(Number(offer.quoted_amount))}</strong></div>
      <div style={{fontSize:12,color:'#475569'}}>Buyer: {offer.buyer_name} · Payment terms: {job?.payment_terms??'Not supplied'} · Vehicle: {job?.requested_vehicle_label??job?.vehicle_type??'Not supplied'}</div>
      <div style={{fontSize:11,color:'#64748b'}}>Awarded {new Date(offer.offered_at).toLocaleString('en-GB')} · Ref {job?.booking_reference??job?.customer_reference??offer.job_id.slice(0,8).toUpperCase()}</div>
      <div style={{display:'flex',gap:6,justifyContent:'flex-end',flexWrap:'wrap'}}><ActionButton tone="danger" disabled={working===offer.id} onClick={()=>void respond(offer,'decline')}>Decline</ActionButton><ActionButton tone="success" disabled={working===offer.id} onClick={()=>void respond(offer,'accept')}>{working===offer.id?'Saving…':'Accept Booking'}</ActionButton></div>
    </div>})}</div>
  </Panel>;
}
