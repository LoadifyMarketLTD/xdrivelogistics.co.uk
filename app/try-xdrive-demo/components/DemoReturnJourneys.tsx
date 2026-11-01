"use client";
import {useMemo,useState} from "react";
import dynamic from "next/dynamic";
const AutonomousRoutesMap=dynamic(()=>import("./AutonomousRoutesMap"),{ssr:false});
import {publishDemoLoad,useDemoBookings,useDemoLoads,useExchangeLoads} from "./demoExchange";
import type {DemoLoad} from "./demoExchange";
import "../return-journeys.css";
const tabs=["All Returns","Matching My Routes","Posted Returns","My Bookings","Completed"];
const autonomous=process.env.NEXT_PUBLIC_XDRIVE_AUTONOMOUS_DEMO==="1";
const routeKey=(v:string)=>v.trim().toLowerCase().replace(/[,\s]+/g," ");
export default function DemoReturnJourneys({onPostReturn,onOpenLoad}:{onPostReturn?:()=>void;onOpenLoad?:(id:string)=>void}){
 const own=useDemoLoads(),exchange=useExchangeLoads(),{loads:bookings}=useDemoBookings();
 const [tab,setTab]=useState("All Returns"),[from,setFrom]=useState(""),[to,setTo]=useState(""),[vehicle,setVehicle]=useState("Any Vehicle"),[date,setDate]=useState("Any Date"),[sort,setSort]=useState("Date (Soonest)"),[selected,setSelected]=useState<DemoLoad|null>(null),[showMap,setShowMap]=useState(false);
 const [notice,setNotice]=useState(""),[postOpen,setPostOpen]=useState(false),[saving,setSaving]=useState(false);
 const [draft,setDraft]=useState({from:"",to:"",vehicle:"Luton Van",pickupDate:"",paymentTerms:"End of Calendar Month"});
 const ownIds=useMemo(()=>new Set(own.map(l=>l.id)),[own]),bookingIds=useMemo(()=>new Set(bookings.map(l=>l.id)),[bookings]);
 const returns=useMemo(()=>{
  const all=[...own,...exchange.loads.filter(l=>!own.some(x=>x.id===l.id))].filter(l=>l.status!=="Cancelled");
  return autonomous?all.filter(l=>/return/i.test(String(l.service||""))):all;
 },[own,exchange.loads]);
 const matches=(l:DemoLoad)=>bookings.some(b=>routeKey(b.to)===routeKey(l.from)&&b.id!==l.id);
 const inTab=(l:DemoLoad,t:string)=>t==="All Returns"||t==="My Bookings"&&bookingIds.has(l.id)||
  t==="Posted Returns"&&ownIds.has(l.id)&&l.status==="Open"||t==="Completed"&&Boolean(l.podReceived)||
  t==="Matching My Routes"&&matches(l);
 const rows=useMemo(()=>{
  const now=new Date();const today=now.toISOString().slice(0,10);
  const next=new Date(now.getTime()+7*86400000).toISOString().slice(0,10);
  const filtered=returns.filter(l=>inTab(l,tab)&&(!from||l.from.toLowerCase().includes(from.toLowerCase()))&&
   (!to||l.to.toLowerCase().includes(to.toLowerCase()))&&
   (vehicle==="Any Vehicle"||l.vehicle===vehicle)&&
   (date!=="Next 7 Days"||Boolean(l.pickupDate&&l.pickupDate>=today&&l.pickupDate<=next)));
  return filtered.sort((a,b)=>sort==="Route (A-Z)"?a.from.localeCompare(b.from):(a.pickupDate||"").localeCompare(b.pickupDate||""));
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[returns,from,to,vehicle,tab,sort,date,ownIds,bookingIds,bookings]);
 const count=(t:string)=>returns.filter(l=>inTab(l,t)).length;
 const vehicles=[...new Set(returns.map(l=>l.vehicle).filter(Boolean))];
 const post=async()=>{
  setSaving(true);setNotice("");
  try{
   await publishDemoLoad({from:draft.from,to:draft.to,vehicle:draft.vehicle,pallets:"0",weight:"0",
    customer:"Isolated local test",sell:"",paymentTerms:draft.paymentTerms,pickupDate:draft.pickupDate,
    service:"Return Journey",packaging:"Return freight"});
   setPostOpen(false);setTab("Posted Returns");setNotice("Return journey posted to the isolated Exchange registry.");
  }catch(e){setNotice(e instanceof Error?e.message:"Could not post the return journey")}
  finally{setSaving(false)}
 };
 return <section className="rj-page">
 <div className="rj-metrics"><article><span>🚚</span><div>Return Opportunities<strong>{returns.length}</strong><small>{autonomous?"Posted local return offers":"Available in DEMO"}</small></div></article>
 <article><span>📍</span><div>My Return Journeys<strong>{count("My Bookings")}</strong><small>Booked return offers</small></div></article>
 <article><span>↓</span><div>Empty Miles Saved<strong>—</strong><small>Verified telematics required</small></div></article>
 <article><span>£</span><div>Estimated Value<strong>—</strong><small>No verified estimate</small></div></article>
 <article><span>♻</span><div>CO₂ Reduction<strong>—</strong><small>No verified estimate</small></div></article></div>
 <p className="rj-notice" role="note">{autonomous?"Only explicit Return Journey postings appear. Matching uses confirmed delivery towns; GPS and precise route deviation remain unavailable.":"Return matching is not connected. The rows below are existing DEMO loads, not verified return offers."}</p>
 <div className="rj-tabs">{tabs.map(t=><button key={t} className={tab===t?"active":""} onClick={()=>setTab(t)}>{t} <b>{count(t)}</b></button>)}<button className="rj-post" disabled={!autonomous&&!onPostReturn} onClick={()=>autonomous?setPostOpen(true):onPostReturn?.()}>+ Post Return Journey</button></div>
 <div className="rj-layout"><aside className="rj-filter"><h3>Find Return Journeys</h3>
 <label>Current / Delivery Area<input placeholder="e.g. DA8 or Erith" value={from} onChange={e=>setFrom(e.target.value)}/></label>
 <label>Return To (Town/Postcode)<input placeholder="e.g. BB1 or Blackburn" value={to} onChange={e=>setTo(e.target.value)}/></label>
 <label>Vehicle Type<select value={vehicle} onChange={e=>setVehicle(e.target.value)}><option>Any Vehicle</option>{vehicles.map(v=><option key={v}>{v}</option>)}</select></label>
 <label>Date<select value={date} onChange={e=>setDate(e.target.value)}><option>Any Date</option><option>Next 7 Days</option></select></label>
 <button className="rj-clear" onClick={()=>{setFrom("");setTo("");setVehicle("Any Vehicle");setDate("Any Date");setNotice("")}}>↻ Clear Filters</button>
 <button className="rj-search" onClick={()=>setNotice(rows.length+" return journey records match the selected filters.")}>⌕ Search Returns</button>{notice&&<p role="status">{notice}</p>}
 </aside>
 <div className="rj-results"><div className="rj-result-head"><strong>{rows.length} Return Journeys Found</strong><div>Sort by: <select value={sort} onChange={e=>setSort(e.target.value)}><option>Date (Soonest)</option><option>Route (A-Z)</option></select><button onClick={()=>setShowMap(v=>!v)}>{showMap?"List":"Map"}</button></div></div>
 {showMap?(autonomous?<AutonomousRoutesMap routes={rows.map(l=>({id:l.id,from:l.from,to:l.to,vehicle:l.vehicle,paymentTerms:l.paymentTerms}))}/>:<div className="rj-empty">Map requires geocoded pickup/delivery coordinates. No route or location is fabricated.</div>):rows.length===0?<div className="rj-empty">No return journeys match the selected filters.</div>:rows.map(l=><article className="rj-card" key={l.id}>
 <div className="rj-date"><strong>{l.pickupDate||"Date TBC"}</strong><small>{l.status==="Awarded"?"Booked":"Return"}</small></div>
 <div className="rj-route"><strong>📍 {l.from} → 📍 {l.to}</strong><small>🚚 {l.vehicle} | {l.pallets} pallets | {l.weight} kg | {l.service||"Return Journey"}</small></div>
 <div className="rj-company"><small>Posted by</small><strong>{l.customer||"Company"}</strong><small>Ref: {l.id}</small></div>
 <div className="rj-actions"><button onClick={()=>setSelected(l)}>View Details</button><button className="rj-quote" onClick={()=>onOpenLoad?onOpenLoad(l.id):setSelected(l)}>{onOpenLoad?"Open in Loads":"View Route"}</button></div></article>)}
 </div></div>
 {selected&&<div className="rj-overlay" onClick={()=>setSelected(null)}><div className="rj-dialog" role="dialog" aria-modal="true" aria-label="Return journey details" onClick={e=>e.stopPropagation()}><button className="rj-close" onClick={()=>setSelected(null)}>✕</button><h3>Return Journey Details</h3><p><strong>{selected.from} → {selected.to}</strong></p><p>Reference: {selected.id}</p><p>Vehicle: {selected.vehicle}</p><p>Cargo: {selected.pallets} pallets · {selected.weight} kg</p><p>Payment terms: {selected.paymentTerms||"Not specified"}</p><button onClick={()=>setSelected(null)}>Close</button></div></div>}
 {postOpen&&<div className="rj-overlay" onClick={()=>setPostOpen(false)}><form className="rj-dialog" aria-label="Create Return Journey" onClick={e=>e.stopPropagation()} onSubmit={e=>{e.preventDefault();void post()}}>
 <button type="button" className="rj-close" onClick={()=>setPostOpen(false)}>✕</button><h3>Post Return Journey · LOCAL TEST</h3>
 <label>Collection town and postcode<input required placeholder="Erith DA8 1NY" value={draft.from} onChange={e=>setDraft(s=>({...s,from:e.target.value}))}/></label>
 <label>Return destination town and postcode<input required placeholder="Blackburn BB1 9QL" value={draft.to} onChange={e=>setDraft(s=>({...s,to:e.target.value}))}/></label>
 <label>Available vehicle<input required value={draft.vehicle} onChange={e=>setDraft(s=>({...s,vehicle:e.target.value}))}/></label>
 <label>Collection date<input required type="date" value={draft.pickupDate} onChange={e=>setDraft(s=>({...s,pickupDate:e.target.value}))}/></label>
 <label>Payment terms<input required value={draft.paymentTerms} onChange={e=>setDraft(s=>({...s,paymentTerms:e.target.value}))}/></label>
 <p>Public Exchange shows only town/outcode; full private addresses are not collected by this return-posting form.</p>
 <button type="submit" disabled={saving||!draft.from.trim()||!draft.to.trim()}>{saving?"Saving…":"Publish return journey"}</button></form></div>}
 </section>;
}
