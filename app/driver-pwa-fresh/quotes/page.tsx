'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import ProtectedRoute from '../../components/ProtectedRoute';
import { useAuth } from '../../components/AuthContext';
import { supabase } from '../../../lib/supabaseClient';
import { readRouteAuthHeader } from '../../../lib/routeAuthCookie';

type Bid = { id:string; job_id:string; amount:number|null; bid_price_gbp:number|null; status:string; created_at:string };
type Load = { id:string; pickup_area:string; pickup_postcode_area:string|null; delivery_area:string; delivery_postcode_area:string|null; member?:{name:string}|null };
const closed = new Set(['accepted','withdrawn','rejected','unsuccessful','expired','cancelled','archived']);
export default function FreshQuotes() {
 const {user,isLoading:authLoading}=useAuth();
 const [bids,setBids]=useState<Bid[]>([]);
 const [loads,setLoads]=useState<Record<string,Load>>({});
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 const [busy,setBusy]=useState('');
 const [tab,setTab]=useState<'submitted'|'unsuccessful'>('submitted');
 const refresh=useCallback(async()=>{
  if(!user?.id)return;
  setLoading(true);setError('');
  try{
   const result=await supabase.from('job_bids').select('id,job_id,amount,bid_price_gbp,status,created_at').eq('bidder_user_id',user.id).order('created_at',{ascending:false}).limit(150);
   if(result.error)throw new Error('Unable to retrieve submitted quotes.');
   setBids((result.data??[]) as Bid[]);
   const auth=await readRouteAuthHeader();
   if(auth){const response=await fetch('/api/driver/marketplace/loads?view=quote_history',{headers:{Authorization:auth},cache:'no-store'});
    if(response.ok){const data=await response.json() as {loads?:Load[]};setLoads(Object.fromEntries((data.loads??[]).map(load=>[load.id,load])));}
    else setLoads({});
   }
  }catch(e){setError(e instanceof Error?e.message:'Unable to load quotes.');}
  finally{setLoading(false);}
 },[user?.id]);
 useEffect(()=>{if(!authLoading&&user?.id)void refresh();else if(!authLoading)setLoading(false);},[authLoading,user?.id,refresh]);
 const withdraw=async(bid:Bid)=>{
  if(busy||closed.has(bid.status.toLowerCase())||!window.confirm('Withdraw this quote?'))return;
  setBusy(bid.id);setError('');
  try{const auth=await readRouteAuthHeader();if(!auth)throw new Error('Sign in again.');
   const response=await fetch('/api/driver/bids/'+encodeURIComponent(bid.id)+'/withdraw',{method:'POST',headers:{Authorization:auth}});
   if(!response.ok){const data=await response.json().catch(()=>({})) as {error?:string};throw new Error(data.error||'Withdrawal failed.');}
   await refresh();
  }catch(e){setError(e instanceof Error?e.message:'Withdrawal failed.');}
  finally{setBusy('');}
 };
 const visible=bids.filter(bid=>{const s=bid.status.toLowerCase();return tab==='submitted'?!closed.has(s):closed.has(s)&&s!=='accepted';});
 return <ProtectedRoute allowedRoles={['driver']}>
  <header className="fresh-header"><h1>Quotes</h1><button className="fresh-header-icon" type="button" onClick={()=>void refresh()} aria-label="Refresh quotes">↻</button></header>
  <main className="fresh-content" data-testid="fresh-quotes">
   <div className="fresh-actions" role="tablist" aria-label="Quote status"><button type="button" role="tab" aria-selected={tab==='submitted'} onClick={()=>setTab('submitted')}>SUBMITTED</button><button type="button" role="tab" aria-selected={tab==='unsuccessful'} onClick={()=>setTab('unsuccessful')}>UNSUCCESSFUL</button></div>
   {error?<div className="fresh-message" role="alert">{error}</div>:null}
   {loading?<div className="fresh-message" role="status">Loading quotes…</div>:visible.length===0?<div className="fresh-message">No active quotes.</div>:visible.map(bid=>{
    const load=loads[bid.job_id];const status=bid.status.toLowerCase();
    return <article className="fresh-card" key={bid.id} data-testid="quote-card">
     <section className="fresh-summary"><div className="fresh-summary-top"><strong>{load?.member?.name||'Submitted quote'}</strong><span className="fresh-tag">{bid.status}</span></div><div className="fresh-muted">Submitted {new Date(bid.created_at).toLocaleString('en-GB')}</div></section>
     <section className="fresh-route"><div><div className="fresh-town">{load?[load.pickup_area,load.pickup_postcode_area].filter(Boolean).join(' ').toUpperCase():'Route protected'}</div><div className="fresh-muted">Collection</div></div><div><div className="fresh-town">{load?[load.delivery_area,load.delivery_postcode_area].filter(Boolean).join(' ').toUpperCase():'Route unavailable'}</div><div className="fresh-muted">Delivery</div></div></section>
     <section className="fresh-notes"><strong>£{Number(bid.bid_price_gbp??bid.amount??0).toFixed(2)}</strong></section>
     <div className="fresh-actions">{load&&!closed.has(status)?<Link className="fresh-detail" href={'/driver-pwa-fresh/jobs/'+encodeURIComponent(bid.job_id)}>View Details</Link>:null}
     {!closed.has(status)?<button className="fresh-detail" type="button" disabled={busy===bid.id} onClick={()=>void withdraw(bid)}>{busy===bid.id?'Withdrawing…':'Cancel Quote'}</button>:null}</div>
    </article>;
   })}
  </main>
  <nav className="fresh-bottom" aria-label="Driver tabs"><Link href="/driver-pwa-fresh/jobs">Jobs</Link><Link className="selected" aria-current="page" href="/driver-pwa-fresh/quotes">Quotes</Link><Link href="/driver/won-work">Bookings</Link><Link href="/driver">More</Link></nav>
 </ProtectedRoute>;
}
