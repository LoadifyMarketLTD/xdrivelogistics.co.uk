'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import FreshJobCard, { type Load } from '../FreshJobCard';
import {FreshHeader,FreshBottom} from '../FreshNavigation';
import ProtectedRoute from '../../components/ProtectedRoute';
import { useAuth } from '../../components/AuthContext';
import { readRouteAuthHeader } from '../../../lib/routeAuthCookie';

type Bid = { id:string; job_id:string; amount:number|null; bid_price_gbp:number|null; status:string; created_at:string };
const closed = new Set(['accepted','withdrawn','rejected','unsuccessful','expired','cancelled','archived']);
export default function FreshQuotes() {
 const {user,isLoading:authLoading}=useAuth();
 const [bids,setBids]=useState<Bid[]>([]);
 const [loads,setLoads]=useState<Record<string,Load>>({});
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 const [busy,setBusy]=useState('');
 const [tab,setTab]=useState<'active'|'pending'|'won'|'lost'>('active');
 const refresh=useCallback(async()=>{
  if(!user?.id)return;
  setLoading(true);setError('');
  try{
   const auth=await readRouteAuthHeader();
   if(!auth)throw new Error('Sign in required.');
   // A stalled browser request must not trap My Quotes on a loading screen.
   const response=await fetch('/api/driver/marketplace/loads?view=quote_history',{headers:{Authorization:auth},cache:'no-store',signal:AbortSignal.timeout(12000)});
   if(!response.ok)throw new Error('Unable to retrieve submitted quotes.');
   const data=await response.json() as {loads?:Load[]};
   const history=data.loads??[];
   setLoads(Object.fromEntries(history.map(load=>[load.id,load])));
   setBids(history.flatMap(load=>load.myBid?.id?[{id:load.myBid.id,job_id:load.id,amount:load.myBid.amount,bid_price_gbp:load.myBid.amount,status:load.myBid.status??'submitted',created_at:load.exchange_posted_at??''}]:[]));
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
 const visible=bids.filter(bid=>{const s=bid.status.toLowerCase();if(tab==='won')return s==='accepted';if(tab==='lost')return closed.has(s)&&s!=='accepted';if(tab==='pending')return ['pending','awaiting','under_review'].some(v=>s.includes(v));return !closed.has(s)&&!['pending','awaiting','under_review'].some(v=>s.includes(v));});
 return <ProtectedRoute allowedRoles={['driver']}>
  <FreshHeader />
  <main className="fresh-content" data-testid="fresh-quotes">
   <div className="fresh-quote-tabs fresh-quote-status-tabs" role="tablist" aria-label="Quote status">{(["active","pending","won","lost"] as const).map(value=><button key={value} type="button" role="tab" aria-selected={tab===value} onClick={()=>setTab(value)}>{value[0].toUpperCase()+value.slice(1)}</button>)}</div>
   {error?<div className="fresh-message" role="alert">{error} <button type="button" onClick={()=>void refresh()}>Retry quotes</button></div>:null}
   {loading?<div className="fresh-message" role="status">Loading quotes…</div>:visible.length===0?<div className="fresh-message">No {tab} quotes.</div>:visible.map(bid=>{
    const load=loads[bid.job_id];const status=bid.status.toLowerCase();
    return load ? <FreshJobCard key={bid.id} load={load} mode="quotes" actions={<><div className="fresh-quote-amount">{closed.has(status) ? (status === 'accepted' ? 'Accepted quote' : status === 'withdrawn' || status === 'cancelled' ? 'Cancelled quote' : 'Your Quote was Unsuccessful') : 'My Quote'}: £{Number(bid.bid_price_gbp??bid.amount??0).toFixed(2)}</div><Link className="fresh-detail" href={'/driver-pwa-fresh/jobs/'+encodeURIComponent(bid.job_id)+'?history=1'}>View Details</Link>{!closed.has(status)?<button className="fresh-cancel-quote" type="button" disabled={busy===bid.id} onClick={()=>void withdraw(bid)}>{busy===bid.id?'Cancelling...':'Cancel Quote'}</button>:null}</>} /> : <article className="fresh-card" key={bid.id}><section className="fresh-summary"><strong>Job {bid.job_id}</strong></section><div className="fresh-message">Job details temporarily unavailable</div></article>;
   })}
  </main>
  <FreshBottom active="quotes" />
 </ProtectedRoute>;
}
