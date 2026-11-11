'use client';
import {useState} from 'react';
import {useRouter,useSearchParams} from 'next/navigation';
import {demoJobs,readDemo,updateDemo} from '../../demoState';
export default function DemoQuoteForm(){
 const router=useRouter(),params=useSearchParams();
 const id=params.get('load')||'';
 const [price,setPrice]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const submit=()=>{
  const amount=Number(price);
  if(!demoJobs.some(job=>job.id===id)){setError('Demo job not found.');return;}
  if(!price.trim()||!Number.isFinite(amount)||amount<=0){setError('Enter a valid quote amount.');return;}
  if(readDemo()[id]?.stage==='submitted'){setError('This job has already been quoted.');return;}
  setBusy(true);updateDemo(id,{stage:'submitted',amount});router.push('/driver-pwa-fresh/visual-preview/workflow?tab=quotes');
 };
 return <><section className="fresh-quote-panel"><label>My Quote (GBP) *<input aria-label="My Quote (GBP)" type="number" min="0.01" step="0.01" inputMode="decimal" placeholder="Price excluding VAT" value={price} onChange={e=>setPrice(e.target.value)} disabled={busy}/></label></section>
 <div className="fresh-quote-submit"><button type="button" disabled={busy} onClick={submit}>{busy?'Saving demo quote...':'Submit Quote'}</button>{error?<p role="alert">{error}</p>:null}<p>Demo only. No real quote will be sent.</p></div></>;
}
