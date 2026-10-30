'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import FreshJobCard, { type Load } from '../FreshJobCard';
import {FreshHeader,FreshBottom} from '../FreshNavigation';
import FreshSectionTabs from '../FreshSectionTabs';
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
 const [tab,setTab]=useState<'submitted'|'unsuccessful'>('submitted');
 const refresh=useCallback(async()=>{
  if(!user?.id)return;
  setLoading(true);setError('');
  try{
   const auth=await readRouteAuthHeader();
   if(!auth)throw new Error('Sign in required.');
   const response=await fetch('/api/driver/marketplace/loads?view=quote_history',{headers:{Authorization:auth},cache:'no-store'});
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
 const isUnsuccessful=(bid:Bid)=>{const s=bid.status.toLowerCase();if(s==='accepted')return false;const jobStatus=(loads[bid.job_id]?.status??'').toLowerCase();return closed.has(s)||Boolean(jobStatus&&!['posted','quoted'].includes(jobStatus));};
 const visible=bids.filter(bid=>tab==='unsuccessful'?isUnsuccessful(bid):bid.status.toLowerCase()!=='accepted'&&!isUnsuccessful(bid));
 return <ProtectedRoute allowedRoles={['driver']}>
  <FreshHeader />
  <main className="fresh-content" data-testid="fresh-quotes">
   <FreshSectionTabs />
   <div className="fresh-quote-tabs fresh-quote-status-tabs" role="tablist" aria-label="Quote status">{(['submitted','unsuccessful'] as const).map(value=><button key={value} type="button" role="tab" aria-selected={tab===value} onClick={()=>setTab(value)}>{value.toUpperCase()}</button>)}</div>
   {error?<div className="fresh-message" role="alert">{error}</div>:null}
   {loading?<div className="fresh-message" role="status">Loading quotes…</div>:visible.length===0?<div className="fresh-message">{tab==='submitted'?'No submitted quotes yet. Open Loads and submit a quote.':'No unsuccessful quotes yet.'}</div>:visible.map(bid=>{
    const load=loads[bid.job_id];const status=bid.status.toLowerCase();const jobStatus=(load?.status??'').toLowerCase();const outcomeLabel=jobStatus==='cancelled'?'Cancelled':jobStatus&&!['posted','quoted'].includes(jobStatus)?'Sold':status==='withdrawn'||status==='cancelled'?'Cancelled':isUnsuccessful(bid)?'Unsuccessful':'Submitted';
    return load ? <FreshJobCard key={bid.id} load={load} mode="quotes" actions={<><div className={'fresh-quote-outcome '+outcomeLabel.toLowerCase()}>{outcomeLabel}</div><div className="fresh-quote-amount">{isUnsuccessful(bid)?'Your Quote was Unsuccessful':'My Quote'}: £{Number(bid.bid_price_gbp??bid.amount??0).toFixed(2)}</div><Link className="fresh-detail" href={'/driver-pwa-fresh/jobs/'+encodeURIComponent(bid.job_id)+'?history=1'}>View Details</Link>{!closed.has(status)?<button className="fresh-cancel-quote" type="button" disabled={busy===bid.id} onClick={()=>void withdraw(bid)}>{busy===bid.id?'Cancelling...':'Cancel Quote'}</button>:null}</>} /> : <article className="fresh-card" key={bid.id}><section className="fresh-summary"><strong>Job {bid.job_id}</strong></section><div className="fresh-message">Job details temporarily unavailable</div></article>;
   })}
  </main>
  <FreshBottom active="quotes" />
 </ProtectedRoute>;
}
