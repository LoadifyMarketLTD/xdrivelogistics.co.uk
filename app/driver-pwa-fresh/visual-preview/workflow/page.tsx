'use client';
import {useEffect,useState} from 'react';
import FreshJobCard from '../../FreshJobCard';
import {demoJobs,readDemo,updateDemo,bookingStages,type DemoStore,type DemoStage} from '../../demoState';
import {FreshHeader} from '../../FreshNavigation';
type Tab='jobs'|'quotes'|'bookings';
const next:Partial<Record<DemoStage,DemoStage>>={received:'allocated',allocated:'pickup',pickup:'onsite-pickup','onsite-pickup':'loaded',loaded:'delivery',delivery:'onsite-delivery','onsite-delivery':'delivered',delivered:'pod',pod:'invoiced'};
const labels:Partial<Record<DemoStage,string>>={received:'Accept Booking',allocated:'On My Way to Pickup',pickup:'On Site Pickup','onsite-pickup':'Loaded',loaded:'On My Way to Delivery',delivery:'On Site Delivery','onsite-delivery':'Delivered',delivered:'Submit POD',pod:'Create Invoice'};
export default function Workflow(){
const [tab,setTab]=useState<Tab>('jobs'),[quoteTab,setQuoteTab]=useState('submitted'),[data,setData]=useState<DemoStore>({}),[prices,setPrices]=useState<Record<string,string>>({}),[photos,setPhotos]=useState<Record<string,string>>({}),[signatures,setSignatures]=useState<Record<string,string>>({}),[error,setError]=useState('');
useEffect(()=>{setData(readDemo());if(new URLSearchParams(window.location.search).get('tab')==='quotes')setTab('quotes')},[]);
const move=(id:string,stage:DemoStage)=>{updateDemo(id,{...data[id],stage});setData(readDemo());setError('')};
const visible=demoJobs.filter(job=>{const stage=data[job.id]?.stage||'jobs';return tab==='jobs'?stage==='jobs':tab==='quotes'?stage===quoteTab:bookingStages.includes(stage)});
return <><FreshHeader/><main className="fresh-content"><h1>Driver demo</h1><p>Simulated workflow only. No real quotes, bookings, POD or invoices.</p>
{tab==='quotes'?<div className="fresh-quote-tabs"><button onClick={()=>setQuoteTab('submitted')}>SUBMITTED</button><button onClick={()=>setQuoteTab('unsuccessful')}>UNSUCCESSFUL</button></div>:null}
{visible.length===0?<p className="fresh-message">No jobs in this section.</p>:visible.map(job=>{const entry=data[job.id]||{stage:'jobs' as DemoStage};return <FreshJobCard key={job.id} load={job} mode={tab==='jobs'?'quotes':tab} actions={<>
<p>Job ID: {job.id} | {entry.stage} | {job.payment_terms}</p>
{tab==='jobs'?<><label>Quote amount (GBP)<input type="number" min="0.01" step="0.01" value={prices[job.id]||''} onChange={e=>setPrices(v=>({...v,[job.id]:e.target.value}))}/></label><button className="quote-now" onClick={()=>{const amount=Number(prices[job.id]);if(!amount||amount<=0){setError('Enter a valid quote amount');return;}updateDemo(job.id,{stage:'submitted',amount});setData(readDemo());setTab('quotes');setQuoteTab('submitted')}}>Submit Quote</button></>:null}
{tab==='quotes'?<><strong>You Quoted: GBP {Number(entry.amount||0).toFixed(2)}</strong>{entry.stage==='submitted'?<><button onClick={()=>move(job.id,'unsuccessful')} className="fresh-demo-action">Cancel Quote</button><button onClick={()=>{move(job.id,'received');setTab('bookings')}} className="fresh-demo-action">Simulate Award</button></>:null}</>:null}
{tab==='bookings'?<><strong>Booking: {entry.stage}</strong>{entry.stage==='received'?<button onClick={()=>move(job.id,'unsuccessful')}>Decline Booking</button>:null}{entry.stage==='pod'?<><label>POD photo<input type="file" accept="image/*" onChange={e=>setPhotos(v=>({...v,[job.id]:e.target.files?.[0]?.name||''}))}/></label><label>Recipient signature<input value={signatures[job.id]||''} onChange={e=>setSignatures(v=>({...v,[job.id]:e.target.value}))}/></label></>:null}{next[entry.stage]?<button className="quote-now" onClick={()=>{if(entry.stage==='pod'&&(!photos[job.id]||!signatures[job.id]?.trim())){setError('Photo and signature required before invoice');return;}move(job.id,next[entry.stage]!)}}>{labels[entry.stage]}</button>:<p>Demo invoice complete</p>}</>:null}
</>}/>})}{error?<p role="alert">{error}</p>:null}</main><nav className="fresh-bottom fresh-demo-bottom">{(['jobs','quotes','bookings'] as const).map(t=><button key={t} style={{flex:1,minHeight:54}} onClick={()=>{setTab(t);setError('')}}>{t.toUpperCase()}</button>)}</nav></>;
}
