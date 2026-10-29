'use client';
import {useEffect,useState} from 'react';
import './invitation.css';
type Decision='received'|'accepted'|'declined';
export default function Invitation({onAccept}:{onAccept:()=>void}){
 const [decision,setDecision]=useState<Decision>('received');
 useEffect(()=>{const v=localStorage.getItem('xd-sandbox-invitation');if(v==='declined')setDecision('declined')},[]);
 const decline=()=>{localStorage.setItem('xd-sandbox-invitation','declined');setDecision('declined')};
 const accept=()=>{localStorage.setItem('xd-sandbox-invitation','accepted');onAccept()};
 const [info,setInfo]=useState('');
 const item=(label:string,value:string)=><div className="inv-row"><span>{label}</span><strong>{value}</strong></div>;
 return <main className="shell invitation" data-testid="booking-invitation">
 <header className="header"><div className="status">9:41 <span>DEMO / SANDBOX</span></div><div className="headrow"><span>XDrive</span><h1>Received Booking</h1><span>DEMO</span></div></header>
 <div className="content">
 <div className="notice">FICTIONAL BOOKING • NO LIVE OPERATIONS</div>
 <section className="card inv-hero"><div className="inv-meta"><span className="inv-pill">{decision==='declined'?'DECLINED':'ACCEPTANCE REQUIRED'}</span><small>28 Oct 2026 • 08:40</small></div><h2>New job awarded to you</h2><p>Review the complete booking before accepting responsibility for the transport.</p>{item('Job reference','XDL-2026-00128')}</section>
 <section className="card"><h2>Company & Booking</h2><div className="inv-company"><span className="inv-avatar">EC</span><div><b>E2E Collection</b><small>XD Member ID: XD12345</small></div></div>{item('Service','Same Day Courier')}{item('Vehicle','Luton Van • Tail Lift')}{item('Awarded quote','£240.00')}{item('Payment Terms','30 Days EOM')}<div className="inv-duo"><button onClick={()=>setInfo('Calling is disabled in this sandbox.')}>Call company</button><button onClick={()=>setInfo('Messaging is simulated; no message is sent.')}>Message company</button></div></section>
 <section className="card"><h2>Collection</h2><div className="inv-place"><span className="inv-dot green">A</span><div><h3>Blackburn BB1</h3><p>Unit 4, Logistics Park, Blackburn BB1 2BB</p></div></div>{item('Date','28 Oct 2026')}{item('Window','09:00 – 10:00')}{item('Contact','John Smith')}{item('Loading','Forklift available')}{item('Instructions','Report to gate 1')}</section>
 <section className="card"><h2>Delivery</h2><div className="inv-place"><span className="inv-dot orange">B</span><div><h3>Manchester M2</h3><p>Industrial Estate, Manchester M2 2AB</p></div></div>{item('Date','28 Oct 2026')}{item('Time','ASAP')}{item('Contact','Sarah Brown')}{item('Unloading','Forklift')}{item('Instructions','Deliver to reception; obtain signature')}</section>
 <section className="card"><h2>Cargo & Requirements</h2><div className="inv-facts"><div><small>Items</small><b>2</b></div><div><small>Pallets</small><b>2</b></div><div><small>Weight</small><b>640 kg</b></div><div><small>Dimensions</small><b>120 × 80 × 100 cm</b></div></div>{item('Packaging','Palletised goods')}{item('Handling','Forklift at both stops')}{item('Proof of Delivery','Required')}</section>
 <section className="card"><h2>Route & Navigation</h2><div className="inv-route"><b>Blackburn BB1</b><span>→</span><b>Manchester M2</b></div><p className="inv-muted">Route information is illustrative. No live GPS or ETA.</p><button className="inv-secondary" onClick={()=>setInfo('Illustrative route only. No external map is opened.')}>View on Map</button></section>
 <section className="card inv-decision"><h2>Your Decision</h2>{decision==='declined'?<><p role="status" className="inv-warning">Booking declined. No job has been started.</p><button className="inv-secondary" onClick={()=>{localStorage.removeItem('xd-sandbox-invitation');setDecision('received')}}>Reset demo invitation</button></>:<><p className="inv-muted">Check the collection, delivery, cargo and agreed rate before accepting.</p><div className="inv-actions"><button className="inv-decline" onClick={decline}>Decline Job</button><button className="inv-accept" onClick={accept}>Accept Job</button></div></>}</section>
 {info&&<div className="inv-info" role="dialog" aria-modal="true"><div><h3>Demo only</h3><p>{info}</p><button onClick={()=>setInfo('')}>Close</button></div></div>}
 </div><nav className="bottom" aria-label="Demo navigation"><button onClick={()=>setInfo('Loads navigation is outside this demo flow.')}>Loads</button><button onClick={()=>setInfo('Quotes navigation is outside this demo flow.')}>My Quotes</button><button className="selected">Bookings</button></nav>
 </main>
}
