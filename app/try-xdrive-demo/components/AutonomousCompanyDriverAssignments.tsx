"use client";
import {useMemo,useState} from "react";
import {useDemoBookings} from "./demoExchange";
import {bookingMilestone} from "./bookingMilestone";
import XDriveLoadCard from "./XDriveLoadCard";

/** An employed driver may act on assigned bookings, never on the carrier Exchange.
 * All visible rows come from the server-scoped /loads?view=bookings endpoint.
 */
export default function AutonomousCompanyDriverAssignments({mode,onOpenBooking}:{
 mode:"loads"|"quotes";onOpenBooking:(id:string)=>void;
}){
 const {loads,error}=useDemoBookings();
 const [search,setSearch]=useState(""),[status,setStatus]=useState("All");
 const rows=useMemo(()=>loads.filter(l=>(status==="All"||bookingMilestone(l)===status)&&
  (!search||[l.id,l.from,l.to,l.vehicle,l.paymentTerms].join(" ").toLowerCase().includes(search.toLowerCase()))),[loads,search,status]);
 const statuses=["All","Pending Acceptance","Pending Allocation","Allocated","In Progress","Awaiting POD","Completed"];
 return <section className="xd-board" aria-label={mode==="loads"?"My assigned loads":"Assigned booking payment terms"}>
  <div className="xd-board-head">
   <h1>{mode==="loads"?"Assigned Loads":"My Quotes · Assigned Transport"}</h1>
   <p>{mode==="loads"
    ?"Only loads assigned to this company driver appear here. New jobs are allocated by the carrier or dispatcher."
    :"Company Drivers cannot submit, withdraw or award carrier quotations. These agreed charges and payment terms belong to already-assigned bookings and are read-only."}</p>
  </div>
  <div className="xd-board-layout">
   <aside className="xd-board-filters"><h3>Find {mode==="loads"?"Assigned Loads":"Booking Terms"}</h3>
    <label>Booking reference / route<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Job ID, BB1 or destination"/></label>
    <label>Status<select value={status} onChange={e=>setStatus(e.target.value)}>{statuses.map(x=><option key={x}>{x}</option>)}</select></label>
    <button type="button" onClick={()=>{setStatus("All");setSearch("")}}>Clear Filters</button>
    <p className="notice">Results are isolated to the authenticated, allocated company driver.</p>
   </aside>
   <div className="xd-board-results">
    <div className="xd-board-result-head"><strong>{rows.length} assigned booking{rows.length===1?"":"s"}</strong></div>
    {error&&<p role="alert">{error}</p>}
    {rows.map(l=><XDriveLoadCard key={l.id} data={{
     id:l.id,from:l.from,to:l.to,date:l.pickupDate||"Date TBC",status:bookingMilestone(l),
     vehicle:l.vehicle,cargo:(l.pallets||"0")+" pallets",weight:(l.weight||"0")+" kg",
     company:l.customer||"My company",paymentTerms:l.paymentTerms||"Not recorded"
    }} onDetails={()=>onOpenBooking(l.id)}
     actions={<button className="quote" type="button" onClick={()=>onOpenBooking(l.id)}>
      {mode==="quotes"?"View Agreed Terms":"Open Booking"}
     </button>}
     extra={mode==="quotes"?<span>Agreed amount: {typeof l.quote==="number"?"£"+l.quote.toFixed(2):"Not recorded"} · {l.paymentTerms||"Payment terms not recorded"}</span>:
       <span>Vehicle: {l.assignedVehicleId||"Not allocated"} · Booking status: {bookingMilestone(l)}</span>}/>)}
    {!rows.length&&<p className="xd-bookings-empty">
     {loads.length?"No assigned bookings match the selected filters.":"No jobs are currently assigned to this employee. Other companies' or unallocated jobs are not shown."}
    </p>}
   </div>
  </div>
 </section>;
}
