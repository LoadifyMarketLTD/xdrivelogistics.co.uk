'use client';

import { useCallback, useEffect, useState } from 'react';
import { readRouteAuthAccessToken } from '../../../lib/routeAuthCookie';
import { fetchAllBookingOfferPages } from '../../../lib/bookingOfferPages';
import { BOOKING_DECLINE_REASONS, type BookingDeclineReasonCode } from '../../../lib/bookingOfferDeclineReasons';
import { useVisibleRefresh } from './useVisibleRefresh';
import { ActionButton, AlertBanner, EmptyState, Panel, WorkspaceDialog } from './WorkspaceUI';

type BookingOffer = {
  id: string; job_id: string; quoted_amount: number; currency: string; status: string; offered_at: string;
  buyer_name: string;
  job: null | { pickup_location?: string|null; pickup_postcode?: string|null; delivery_location?: string|null; delivery_postcode?: string|null; pickup_datetime?: string|null; payment_terms?: string|null; booking_reference?: string|null; customer_reference?: string|null; vehicle_type?: string|null; requested_vehicle_label?: string|null };
};

export default function PendingBookingOffers({ onChanged }: { onChanged?: () => void }) {
  const [offers,setOffers]=useState<BookingOffer[]>([]); const [error,setError]=useState(''); const [message,setMessage]=useState(''); const [working,setWorking]=useState<string|null>(null); const [loading,setLoading]=useState(true);
  const [declineTarget,setDeclineTarget]=useState<BookingOffer|null>(null);
  const [declineReason,setDeclineReason]=useState<BookingDeclineReasonCode>('already_committed');
  const [declineDetail,setDeclineDetail]=useState('');
  const load=useCallback(async({background=false}:{background?:boolean}={})=>{if(!background)setLoading(true);setError(''); const token=readRouteAuthAccessToken(); if(!token){setError('Your session has expired.');if(!background)setLoading(false);return;} try { const allOffers=await fetchAllBookingOfferPages<BookingOffer>('/api/booking-offers',token); setOffers(allOffers.filter(o=>o.status==='pending')); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Booking offers could not be loaded.'); if(!background)setOffers([]); } finally { if(!background)setLoading(false); }},[]);
  useEffect(()=>{void load();},[load]);
  useVisibleRefresh(()=>load({background:true}),{intervalMs:30_000,minGapMs:5_000});
  const respond=async(offer:BookingOffer,action:'accept'|'decline')=>{
    if(working)return;
    setWorking(offer.id);setError('');setMessage('');
    const token=readRouteAuthAccessToken();
    if(!token){setError('Your session has expired.');setWorking(null);return;}
    try {
      const payload=action==='decline'
        ? {action,reasonCode:declineReason,reasonDetails:declineDetail.trim()||undefined}
        : {action};
      const response=await fetch('/api/booking-offers/'+offer.id+'/respond',{
        method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
        body:JSON.stringify(payload),
      });
      const body=await response.json().catch(()=>({})) as {error?:string;success?:boolean;status?:string};
      if(!response.ok||body.success!==true||body.status!==(action==='decline'?'declined':'accepted')) {
        setError(body.error??'Booking response could not be verified. Please refresh and retry.');
        return;
      }
      if(action==='decline'){setDeclineTarget(null);setDeclineDetail('');setDeclineReason('already_committed');}
      setMessage(action==='accept'?'Booking accepted. The transport agreement is now formed.':'Booking offer declined. The buyer can review the reason in the job history.');
      await load();onChanged?.();
    }catch{setError('Booking response could not be completed. Please check your connection.');}
    finally{setWorking(null);}
  };
  if(loading) return <Panel title="Booking offers"><EmptyState compact title="Loading booking offers…" /></Panel>;
  if(!offers.length && !error) return null;
  return <Panel title="Booking offers awaiting your acceptance" description="A buyer award is not a confirmed transport booking until you accept the commercial offer.">
    {error&&<AlertBanner tone="danger">{error}</AlertBanner>}{message&&<AlertBanner tone="success">{message}</AlertBanner>}
    <div style={{display:'grid',gap:8}}>{offers.map(offer=>{const job=offer.job; const pickup=job?.pickup_postcode||job?.pickup_location||'Collection'; const delivery=job?.delivery_postcode||job?.delivery_location||'Delivery'; return <div key={offer.id} style={{border:'1px solid #d7e0ea',borderRadius:4,padding:10,background:'#fff',display:'grid',gap:6}}>
      <div style={{display:'flex',justifyContent:'space-between',gap:12,flexWrap:'wrap'}}><strong>{pickup} → {delivery}</strong><strong>{new Intl.NumberFormat('en-GB',{style:'currency',currency:offer.currency||'GBP'}).format(Number(offer.quoted_amount))}</strong></div>
      <div style={{fontSize:12,color:'#475569'}}>Buyer: {offer.buyer_name} · Payment terms: {job?.payment_terms??'Not supplied'} · Vehicle: {job?.requested_vehicle_label??job?.vehicle_type??'Not supplied'}</div>
      <div style={{fontSize:11,color:'#64748b'}}>Awarded {new Date(offer.offered_at).toLocaleString('en-GB')} · Ref {job?.booking_reference??job?.customer_reference??offer.job_id.slice(0,8).toUpperCase()}</div>
      <div style={{display:'flex',gap:6,justifyContent:'flex-end',flexWrap:'wrap'}}><ActionButton tone="danger" disabled={working===offer.id} onClick={()=>{setDeclineTarget(offer);setDeclineReason('already_committed');setDeclineDetail('');setError('');}}>Decline</ActionButton><ActionButton tone="success" disabled={working===offer.id} onClick={()=>void respond(offer,'accept')}>{working===offer.id?'Saving…':'Accept Booking'}</ActionButton></div>
    </div>})}</div>
    {declineTarget && <WorkspaceDialog ariaLabel="Decline booking offer" title="Decline Booking Offer" description="Select why you cannot accept this booking. Your reason will be recorded for the customer or broker." dismissDisabled={Boolean(working)} onDismiss={()=>setDeclineTarget(null)} actions={<><ActionButton tone="secondary" disabled={Boolean(working)} onClick={()=>setDeclineTarget(null)}>Keep Offer</ActionButton><ActionButton tone="danger" disabled={Boolean(working)||declineReason==='other'&&!declineDetail.trim()} onClick={()=>void respond(declineTarget,'decline')}>{working?'Declining…':'Confirm Decline'}</ActionButton></>}>
      <fieldset style={{border:0,padding:0,margin:0,display:'grid',gap:10}}><legend style={{fontWeight:700,marginBottom:12}}>Reason for declining</legend>
      {(Object.entries(BOOKING_DECLINE_REASONS) as [BookingDeclineReasonCode,string][]).map(([code,label])=><label key={code} style={{display:'flex',alignItems:'center',gap:10,cursor:'pointer'}}><input type="radio" name="booking-decline-reason" checked={declineReason===code} onChange={()=>setDeclineReason(code)}/><span>{label}</span></label>)}
      </fieldset>
      <label style={{display:'grid',gap:5,marginTop:14}}><strong>Additional explanation {declineReason==='other'?'(required)':'(optional)'}</strong><textarea rows={3} maxLength={700} value={declineDetail} onChange={e=>setDeclineDetail(e.target.value)} placeholder="Additional details for the buyer, if necessary" style={{width:'100%',padding:10,border:'1px solid #cbd5e1',borderRadius:8}}/></label>
      {error&&<AlertBanner tone="danger">{error}</AlertBanner>}
    </WorkspaceDialog>}
  </Panel>;
}
