"use client";
import {useState} from "react";
import {ArrowDown,MapPin,Navigation2,Package,Truck,ZoomIn,ZoomOut} from "lucide-react";
import type {DemoLoad} from "./demoExchange";
import "./owner-driver-load-map.css";
export default function DemoDriverLoadsMap({loads,preview,onDetails,onQuote}:{loads:DemoLoad[];preview:boolean;onDetails:(id:string)=>void;onQuote:(id:string)=>void}){
 const [selected,setSelected]=useState(""),[zoom,setZoom]=useState(1);
 const active=loads.find(l=>l.id===selected)||loads[0];
 return <section className="xd-owner-map" aria-label="Available load route overview">
  <div className="xd-owner-map-head"><div><h2>Loads Map</h2><p>Collection and delivery overview within the selected filters</p></div><b>{loads.length} available routes</b></div>
  <div className="xd-owner-map-layout">
   <aside className="xd-owner-map-list">
    <h3>Available Routes</h3>
    {loads.slice(0,70).map(l=><button key={l.id} className={active?.id===l.id?"active":""} onClick={()=>setSelected(l.id)} aria-pressed={active?.id===l.id}>
      <strong>{l.from} → {l.to}</strong>
      <small>{l.id} · {l.vehicle}</small>
      <span>{l.paymentTerms||"Terms not specified"}</span>
    </button>)}
    {!loads.length&&<p>No loads match the current filters.</p>}
   </aside>
   <div className="xd-owner-map-body">
    <div className="xd-owner-map-canvas">
     {active?<div className="xd-owner-map-route" style={{transform:"scale("+zoom+")"}}>
      <div className="xd-owner-map-location"><MapPin size={27}/><div><small>COLLECTION AREA</small><strong>{active.from}</strong></div></div>
      <div className="xd-owner-map-track"><div className="xd-owner-map-dash"/><Truck size={26}/><ArrowDown size={21}/></div>
      <div className="xd-owner-map-location destination"><Navigation2 size={27}/><div><small>DELIVERY AREA</small><strong>{active.to}</strong></div></div>
     </div>:<p>No route selected.</p>}
     <div className="xd-owner-map-zoom"><button aria-label="Zoom in" onClick={()=>setZoom(z=>Math.min(1.5,Number((z+.1).toFixed(2))))}><ZoomIn size={18}/></button><button aria-label="Zoom out" onClick={()=>setZoom(z=>Math.max(.8,Number((z-.1).toFixed(2))))}><ZoomOut size={18}/></button></div>
     <span className="xd-owner-map-legend">Schematic view · GPS, driving route and distances not connected</span>
    </div>
    {active&&<div className="xd-owner-map-selected">
      <h3>{active.from} → {active.to}</h3><div className="xd-owner-map-facts"><span><Truck size={14}/> {active.vehicle}</span><span><Package size={14}/> {active.pallets||"0"} pallets, {active.weight||"—"} kg</span><span>Collection: {active.pickupDate||"To be confirmed"}</span><span>Payment: {active.paymentTerms||"Not supplied"}</span></div>
      <div className="xd-owner-map-actions"><button onClick={()=>onDetails(active.id)}>View Details</button><button onClick={()=>onQuote(active.id)}>{preview?"Preview Quote":"Quote Now"}</button></div>
      {preview&&<p>This is an illustrative route. No quotation can be submitted until a real load is available.</p>}
    </div>}
   </div>
  </div>
 </section>;
}
