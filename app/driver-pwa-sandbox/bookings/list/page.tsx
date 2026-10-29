'use client';
import {useEffect,useState} from 'react';
import '../sandbox.css';
import './list.css';
type Tab='Current'|'Last week'|'Last month';
type DemoProgress={stage:number;events:string[]};
const stages=['Accepted','On My Way to Pickup','On Site at Pickup','Loaded','On My Way to Delivery','On Site at Delivery','Delivered / POD','POD Recorded','Invoice Draft','Invoice Issued','Invoice Sent'];
const archive=[
{ref:'XDL-DEMO-2026-0098',from:'Birmingham B1',to:'Coventry CV1',date:'22 Oct 2026',rate:'£165.00',status:'Completed',tab:'Last week',company:'Sample Freight (Demo)',vehicle:'Luton Van'},
{ref:'XDL-DEMO-2026-0082',from:'Leeds LS1',to:'Sheffield S1',date:'03 Oct 2026',rate:'£195.00',status:'Completed',tab:'Last month',company:'Example Haulage (Demo)',vehicle:'Luton Van'},
];
export default function DemoBookingsList(){
 const [tab,setTab]=useState<Tab>('Current');const [stage,setStage]=useState(0);const [accepted,setAccepted]=useState(false);const [filter,setFilter]=useState('');
 useEffect(()=>{try{const raw=localStorage.getItem('xd-11-booking-sandbox');if(raw){const d=JSON.parse(raw) as DemoProgress;if(typeof d.stage==='number'&&d.stage>=0&&d.stage<=10)setStage(d.stage)}setAccepted(localStorage.getItem('xd-sandbox-invitation')==='accepted')}catch{/* safe initial state */}},[]);
 const list=tab==='Current'?[{ref:'XDL-2026-00128',from:'Blackburn BB1',to:'Manchester M2',date:'28 Oct 2026',rate:'£240.00',status:accepted?stages[stage]:'Awarded · Acceptance required',tab:'Current',company:'E2E Collection',vehicle:'Luton Van · Tail Lift'}]:archive.filter(x=>x.tab===tab);
 const displayed=list.filter(x=>[x.ref,x.from,x.to,x.company].join(' ').toLowerCase().includes(filter.toLowerCase()));
 return <main className="shell sb-list-shell" data-testid="booking-sandbox-list">
 <header className="header"><div className="status">9:41 <span>DEMO / SANDBOX</span></div><div className="headrow"><span aria-hidden="true">‹</span><h1>Bookings</h1><span>DEMO</span></div></header>
 <div className="content">
 <div className="notice">SANDBOX · FICTITIOUS BOOKINGS · NO LIVE OPERATIONS</div>
 <div className="sb-list-heading"><h2>My Bookings</h2><span>{displayed.length} {displayed.length===1?'booking':'bookings'}</span></div>
 <div className="sb-list-tabs" role="tablist" aria-label="Booking period">{(['Current','Last week','Last month'] as const).map(t=><button type="button" key={t} role="tab" aria-selected={tab===t} className={tab===t?'selected':''} onClick={()=>{setTab(t);setFilter('')}}>{t}</button>)}</div>
 <label className="sb-list-search"><span aria-hidden="true">⌕</span><input aria-label="Find booking" placeholder="Search booking, company or route" value={filter} onChange={e=>setFilter(e.target.value)}/></label>
 {displayed.map(x=><article className="sb-booking-card" key={x.ref}>
 <div className="sb-booking-top"><div><small>BOOKING REFERENCE</small><strong>{x.ref}</strong></div><span className={x.tab==='Current'?'sb-booking-pill active':'sb-booking-pill'}>{x.status}</span></div>
 <div className="sb-booking-route"><div><small>COLLECTION</small><strong>{x.from}</strong></div><span aria-hidden="true">→</span><div><small>DELIVERY</small><strong>{x.to}</strong></div></div>
 <div className="sb-booking-grid"><div><small>Customer</small><strong>{x.company}</strong></div><div><small>Agreed rate</small><strong>{x.rate}</strong></div><div><small>Vehicle</small><strong>{x.vehicle}</strong></div><div><small>Collection date</small><strong>{x.date}</strong></div></div>
 <div className="sb-booking-footer"><span>{x.tab==='Current'?'30 Days EOM · POD required':'Historical record · demo'}</span>{x.tab==='Current'?<a className="sb-booking-open" href="/driver-pwa-sandbox/bookings">Open Booking &amp; Action</a>:<strong className="sb-booking-archived">Completed · read-only demo</strong>}</div>
 </article>)}
 {displayed.length===0&&<section className="card sb-empty"><strong>No bookings found</strong><p>Try another period or search. These are fictional demonstration records.</p></section>}
 <section className="sb-list-info"><strong>Demonstration only</strong><p>The current booking is linked to the 11-screen workflow. Historical cards are sample records; they do not change real bookings.</p></section>
 </div>
 <nav className="bottom" aria-label="Driver navigation"><button type="button" onClick={()=>{setTab('Current');setFilter('')}}><span aria-hidden="true">⌂</span><span>Loads</span></button><button type="button" onClick={()=>{setTab('Current');setFilter('')}}><span aria-hidden="true">▤</span><span>My Quotes</span></button><button type="button" className="active" onClick={()=>{setTab('Current');setFilter('')}}><span aria-hidden="true">⬡</span><span>Bookings</span></button></nav>
 </main>
}
