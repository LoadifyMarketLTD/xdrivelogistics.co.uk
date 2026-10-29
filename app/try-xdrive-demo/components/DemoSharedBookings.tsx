"use client";
import {useState} from "react";
import {useDemoLoads,updateDemoLoad} from "./demoExchange";
import DemoLoadSummary from "./DemoLoadSummary";
import DemoPOD from "./DemoPOD";

const steps=["Booking accepted","On my way to collection","On site at collection","Goods loaded","On my way to delivery","On site at delivery","Delivered","POD received"];
export default function DemoSharedBookings({role}:{role:string}){
 const loads=useDemoLoads().filter(l=>l.status==="Awarded");
 const [drafts,setDrafts]=useState<Record<string,{driver:string;vehicle:string}>>({});
 const [error,setError]=useState("");
 const [busy,setBusy]=useState("");
 const canAssign=["Carrier / Company","Dispatcher","Fleet"].includes(role);
 const canAdvance=["Driver","Company Driver"].includes(role);
 return <section className="panel"><h2>Bookings</h2>
 {loads.length===0&&<p>No awarded shared demo bookings yet. Submit a quote and award it from Customer or Broker.</p>}
 {loads.map(l=>{
  const draft=drafts[l.id]||{driver:l.assignedDriver||"",vehicle:l.assignedVehicleId||""};
  const stage=l.deliveryStage??0;
  const ready=Boolean(l.assignedDriver&&l.assignedVehicleId);
  const save=async(patch:Record<string,unknown>)=>{setBusy(l.id);setError("");try{await updateDemoLoad(l.id,patch)}catch(e){setError(e instanceof Error?e.message:"Update failed")}finally{setBusy("")}};
  return <div className="panel" key={l.id}>
   <DemoLoadSummary load={l} expanded/>
   <p>Quote: £{l.quote} · Awarded quote: {l.awardedQuoteId}</p>
   <p>Assigned driver: {l.assignedDriver||"Unallocated"} · Vehicle: {l.assignedVehicleId||"Unallocated"}</p>
   {canAssign&&<div className="form-grid">
    <label>Driver<input aria-label={"Driver for "+l.id} value={draft.driver} maxLength={120} onChange={e=>setDrafts(x=>({...x,[l.id]:{...draft,driver:e.target.value}}))}/></label>
    <label>Vehicle ID<input aria-label={"Vehicle for "+l.id} value={draft.vehicle} maxLength={80} onChange={e=>setDrafts(x=>({...x,[l.id]:{...draft,vehicle:e.target.value}}))}/></label>
    <button className="primary" disabled={busy===l.id||!draft.driver.trim()||!draft.vehicle.trim()} onClick={()=>save({assignedDriver:draft.driver,assignedVehicleId:draft.vehicle})}>Save assignment</button>
   </div>}
   <h3>Delivery timeline</h3>
   <div className="timeline">{steps.map((name,i)=><div key={name} className={i<=stage?"complete":""}><span className="dot">{i<=stage?"✓":i+1}</span><span><strong>{name}</strong><small>{i<=stage?"Completed in demo":"Pending"}</small></span></div>)}</div>
   {!ready&&<p className="notice">Driver and vehicle assignment required before delivery actions.</p>}
   {canAdvance&&ready&&stage<6&&<button className="primary" disabled={busy===l.id} onClick={()=>save({deliveryStage:stage+1})}>Complete next milestone: {steps[stage+1]}</button>}
   {canAdvance&&ready&&stage===6&&!l.podReceived&&<DemoPOD onComplete={async evidence=>{await updateDemoLoad(l.id,{podReceived:true,podRecipient:evidence.recipient,podPhotoCount:evidence.photoCount})}}/>}
   {l.podReceived&&<p className="notice">Sample POD recorded for {l.podRecipient} · {l.podPhotoCount} photo(s) confirmed · {l.podConfirmedAt?new Date(l.podConfirmedAt).toLocaleString("en-GB"):""}. Images are not uploaded or retained.</p>}
  </div>
 })}
 {error&&<p role="alert">{error}</p>}
 </section>
}
