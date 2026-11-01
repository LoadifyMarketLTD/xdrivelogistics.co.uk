"use client";
import {useEffect,useState} from "react";
import {useDemoBookings} from "./demoExchange";
import {bookingMilestone} from "./bookingMilestone";
import AutonomousBookingMessages from "./AutonomousBookingMessages";
import "./autonomous-messages.css";

/** Standalone booking conversation index using canonical awards and identity policy. */
export default function AutonomousMessagesHub({onBooking}:{onBooking?:()=>void}){
 const {loads,error}=useDemoBookings();
 const [selected,setSelected]=useState<string|null>(null),[search,setSearch]=useState("");
 useEffect(()=>{
  const clear=()=>{setSelected(null);setSearch("")};
  window.addEventListener("xdrive-demo-session-change",clear);
  return()=>window.removeEventListener("xdrive-demo-session-change",clear);
 },[]);
 const records=loads.filter(l=>[l.id,l.from,l.to,l.customer].join(" ").toLowerCase().includes(search.toLowerCase()));
 const active=records.find(l=>l.id===selected)||null;
 return <section className="panel" aria-label="Private local booking conversations">
  <header style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,flexWrap:"wrap"}}>
   <div><h1>Booking Messages</h1><p>Communicate securely with authorised participants for an awarded booking.</p></div>
   {onBooking&&<button type="button" onClick={onBooking}>View Bookings</button>}
  </header>
  {error&&<p role="alert">{error}</p>}
  <div className="xd-autonomous-messages-grid">
   <aside className="panel" style={{minWidth:0}}>
    <label>Find booking<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Job ID, pickup or delivery"/></label>
    <p>{records.length} conversation(s) available to this account</p>
    <div style={{display:"grid",gap:8,maxHeight:530,overflowY:"auto"}}>
     {records.map(l=><button key={l.id} type="button" className={l.id===selected?"active":""}
      onClick={()=>setSelected(l.id)} style={{textAlign:"left",padding:10,border:"1px solid #d4dfeb",borderRadius:8}}>
      <strong>{l.from} → {l.to}</strong><small style={{display:"block"}}>{l.id} · {bookingMilestone(l)}</small>
     </button>)}
    </div>
    {!records.length&&<p>No awarded booking conversations are accessible. No sample chats are displayed.</p>}
   </aside>
   <div style={{minWidth:0}}>
    {active?<AutonomousBookingMessages key={active.id} jobId={active.id}/>:
     <div className="panel"><h2>Select a booking</h2><p>Messages are available after Award only, to the participating companies and assigned driver.</p></div>}
   </div>
  </div>
 </section>;
}
