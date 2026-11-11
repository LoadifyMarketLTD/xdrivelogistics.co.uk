"use client";
import {useMemo,useState} from "react";
import {useCompany3150Live} from "./Company3150LiveData";
import {useDemoLoads} from "./demoExchange";
import type {DemoLoad} from "./demoExchange";
import "../return-journeys.css";
const tabs=["All Returns","Matching My Routes","Posted Returns","My Bookings","Completed"];
export default function DemoReturnJourneys(){
 const live=useCompany3150Live();
 const loads=useDemoLoads();
 const [tab,setTab]=useState("All Returns"),[from,setFrom]=useState(""),[to,setTo]=useState(""),[vehicle,setVehicle]=useState("Any Vehicle"),[date,setDate]=useState("Any Date"),[sort,setSort]=useState("Date (Soonest)"),[selected,setSelected]=useState<DemoLoad|null>(null),[showMap,setShowMap]=useState(false);
 const returns=useMemo(()=>live?[]:loads.filter(l=>l.status!=="Cancelled"),[loads,live]);
 const rows=useMemo(()=>{
 let r=returns.filter(l=>(!from||l.from.toLowerCase().includes(from.toLowerCase()))&&(!to||l.to.toLowerCase().includes(to.toLowerCase()))&&(vehicle==="Any Vehicle"||l.vehicle===vehicle));
 if(tab==="My Bookings")r=r.filter(l=>l.status==="Awarded");
 if(tab==="Completed")r=r.filter(l=>l.podReceived);
 if(tab==="Posted Returns")r=r.filter(l=>l.status==="Open");
 if(tab==="Matching My Routes")r=r.filter(l=>Boolean(l.assignedDriver));
 if(sort==="Route (A-Z)")r=[...r].sort((a,b)=>a.from.localeCompare(b.from));
 else r=[...r].sort((a,b)=>(a.pickupDate||"").localeCompare(b.pickupDate||""));
 return r;
 },[returns,from,to,vehicle,tab,sort]);
 const vehicles=[...new Set(returns.map(l=>l.vehicle).filter(Boolean))];
 const count=(t:string)=>t==="All Returns"?returns.length:t==="My Bookings"?returns.filter(l=>l.status==="Awarded").length:t==="Completed"?returns.filter(l=>l.podReceived).length:t==="Posted Returns"?returns.filter(l=>l.status==="Open").length:returns.filter(l=>l.assignedDriver).length;
 return <section className="rj-page">

 <div className="rj-metrics"><article><span>🚚</span><div>Return Opportunities<strong>{returns.length}</strong><small>Available return loads</small></div></article><article><span>📍</span><div>My Return Journeys<strong>{count("My Bookings")}</strong><small>Awarded bookings</small></div></article><article><span>↓</span><div>Empty Miles Saved<strong>—</strong><small>Tracking unavailable</small></div></article><article><span>£</span><div>Estimated Value<strong>—</strong><small>No verified estimate</small></div></article><article><span>♻</span><div>CO₂ Reduction<strong>—</strong><small>No verified estimate</small></div></article></div>
 <div className="rj-tabs">{tabs.map(t=><button key={t} className={tab===t?"active":""} onClick={()=>setTab(t)}>{t} <b>{count(t)}</b></button>)}<button className="rj-post" onClick={()=>live?window.location.assign("/admin/returns"):window.dispatchEvent(new CustomEvent("xdrive-demo-navigate",{detail:"Post Load"}))}>+ Post Return Journey</button></div>
 <div className="rj-layout"><aside className="rj-filter"><h3>Find Return Journeys</h3><label>Current / Delivery Area<input placeholder="e.g. DA8 or Erith" value={from} onChange={e=>setFrom(e.target.value)}/></label><label>Return To (Town/Postcode)<input placeholder="e.g. BB1 or Blackburn" value={to} onChange={e=>setTo(e.target.value)}/></label><label>Vehicle Type<select value={vehicle} onChange={e=>setVehicle(e.target.value)}><option>Any Vehicle</option>{vehicles.map(v=><option key={v}>{v}</option>)}</select></label><label>Date<select value={date} onChange={e=>setDate(e.target.value)}><option>Any Date</option><option>Next 7 Days</option></select></label><button className="rj-clear" onClick={()=>{setFrom("");setTo("");setVehicle("Any Vehicle");setDate("Any Date")}}>↻ Clear Filters</button><button className="rj-search">⌕ Search Returns</button></aside>
 <div className="rj-results"><div className="rj-result-head"><strong>{rows.length} Return Journeys Found</strong><div>Sort by: <select value={sort} onChange={e=>setSort(e.target.value)}><option>Date (Soonest)</option><option>Route (A-Z)</option></select><button onClick={()=>setShowMap(v=>!v)}>{showMap?"List":"Map"}</button></div></div>
 {showMap?<div className="rj-empty">Map view requires geocoded return routes; no locations are invented.</div>:rows.length===0?<div className="rj-empty">No return journeys match the selected filters.</div>:rows.map(l=><article className="rj-card" key={l.id}><div className="rj-date"><strong>{l.pickupDate||"Date TBC"}</strong><small>{l.status==="Awarded"?"Booked":"Return"}</small></div><div className="rj-route"><strong>📍 {l.from} → 📍 {l.to}</strong><small>🚚 {l.vehicle} | {l.pallets} pallets | {l.weight} | {l.service||"Standard"}</small></div><div className="rj-company"><small>Posted by</small><strong>{l.customer||"Company"}</strong><small>Ref: {l.id}</small></div><div className="rj-actions"><button onClick={()=>setSelected(l)}>View Details</button><button className="rj-quote" onClick={()=>setSelected(l)}>Quote Now</button></div></article>)}</div></div>
 {selected&&<div className="rj-overlay" onClick={()=>setSelected(null)}><div className="rj-dialog" onClick={e=>e.stopPropagation()}><button className="rj-close" onClick={()=>setSelected(null)}>✕</button><h3>Return Journey Details</h3><p><strong>{selected.from} → {selected.to}</strong></p><p>Reference: {selected.id}</p><p>Vehicle: {selected.vehicle}</p><p>Cargo: {selected.pallets} pallets · {selected.weight}</p><p>Payment terms: {selected.paymentTerms||"Not specified"}</p><p>Quote submission is available through the main Loads / Quotes workflow.</p><button onClick={()=>setSelected(null)}>Close</button></div></div>}
 </section>;
}
