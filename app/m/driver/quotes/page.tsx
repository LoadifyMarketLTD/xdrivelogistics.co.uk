'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { readRouteAuthAccessToken } from '../../../../lib/routeAuthCookie';

type Quote = { id:string; jobId:string; amount:number|null; currency:string; status:string; createdAt:string; pickupLocation:string; deliveryLocation:string; pickupDatetime:string|null; executionUnlocked:boolean };
export default function MobileQuotesPage() {
 const [quotes,setQuotes]=useState<Quote[]>([]);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 const load=useCallback(async()=>{
  setLoading(true);setError('');
  try {
   const token=readRouteAuthAccessToken();
   if(!token) throw new Error('Please sign in to view your quotes.');
   const response=await fetch('/api/driver/mobile/bids',{headers:{Authorization:`Bearer ${token}`},cache:'no-store'});
   if(!response.ok) throw new Error(response.status===503?'Quotes are currently unavailable. Please try again.':'Unable to load your quotes.');
   const payload=await response.json();setQuotes(Array.isArray(payload.bids)?payload.bids:[]);
  } catch(e){setError(e instanceof Error?e.message:'Unable to load quotes.');}
  finally{setLoading(false);}
 },[]);
 useEffect(()=>{void load();const onFocus=()=>void load();window.addEventListener('focus',onFocus);return()=>window.removeEventListener('focus',onFocus)},[load]);
 return <section className="xd-mobile-list"><header><h1>Quotes</h1><p>Your submitted quotes and their outcomes</p></header>{loading?<p role="status">Loading quotes…</p>:error?<div role="alert"><p>{error}</p><button onClick={()=>void load()}>Retry</button></div>:quotes.length===0?<p>No submitted quotes yet.</p>:quotes.map(q=><article className="xd-mobile-card" key={q.id}><div className="xd-mobile-card__top"><strong>{q.status}</strong><span>{q.amount==null?'Amount unavailable':new Intl.NumberFormat('en-GB',{style:'currency',currency:q.currency||'GBP'}).format(q.amount)}</span></div><p className="xd-mobile-route">{q.pickupLocation} → {q.deliveryLocation}</p><p>{q.pickupDatetime?new Date(q.pickupDatetime).toLocaleString('en-GB'):'Collection time to be confirmed'}</p><p>Quoted {new Date(q.createdAt).toLocaleString('en-GB')}</p>{q.executionUnlocked?<Link href="/m/driver/bookings">View booking</Link>:<Link href={`/driver/loads/${encodeURIComponent(q.jobId)}`}>Job details</Link>}</article>)}</section>;
}
