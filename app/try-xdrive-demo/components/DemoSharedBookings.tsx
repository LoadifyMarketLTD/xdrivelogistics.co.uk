"use client";
import {useState} from "react";
import {useDemoBookings,updateDemoLoad} from "./demoExchange";
import DemoLoadSummary from "./DemoLoadSummary";
import DemoPOD from "./DemoPOD";
import DemoInvoicePreview from "./DemoInvoicePreview";
import AutonomousBookingActions from "./AutonomousBookingActions";
import {authenticatedDemoFetch} from "../../../lib/try-xdrive-demo/authenticatedFetch";

const steps=["Booking accepted","On my way to collection","On site at collection","Goods loaded","On my way to delivery","On site at delivery","Delivered","POD received"];
export default function DemoSharedBookings({role,bookingId}:{role:string;bookingId?:string}){
 const {loads,error:bookingError}=useDemoBookings();
 const [drafts,setDrafts]=useState<Record<string,{driver:string;vehicle:string}>>({});
 const [error,setError]=useState("");
 const [busy,setBusy]=useState("");
 const canAssign=["Carrier / Company","Carrier","Company","Dispatcher","Fleet"].includes(role);
 const canAdvance=["Driver","Company Driver"].includes(role);
 if(process.env.NEXT_PUBLIC_XDRIVE_AUTONOMOUS_DEMO==="1")return <AutonomousBookingActions bookingId={bookingId}/>;
 return <section className="panel"><h2>Bookings</h2>
 {bookingError&&<p role="alert">{bookingError}</p>}{loads.length===0&&!bookingError&&<p>No awarded shared demo bookings yet. Submit a quote and award it from Customer or Broker.</p>}
 {loads.filter(l=>!bookingId||l.id===bookingId).map(l=>{
  const draft=drafts[l.id]||{driver:l.assignedDriver||"",vehicle:l.assignedVehicleId||""};
  const stage=l.deliveryStage??0;
  const ready=Boolean(l.assignedDriver&&l.assignedVehicleId);const pending=l.acceptanceStatus==="Pending"||!l.acceptanceStatus;const accepted=l.acceptanceStatus==="Accepted";
  const save=async(patch:Record<string,unknown>)=>{setBusy(l.id);setError("");try{await updateDemoLoad(l.id,patch)}catch(e){setError(e instanceof Error?e.message:"Update failed")}finally{setBusy("")}};
  const respond=async(decision:"accepted"|"rejected")=>{setBusy(l.id);setError("");try{const response=await authenticatedDemoFetch("/api/try-xdrive-demo/bookings/respond",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({jobId:l.id,decision})});if(!response.ok){const payload=await response.json().catch(()=>({}));throw new Error(payload.error||"Booking response failed")}window.dispatchEvent(new Event("xdrive-demo-booking-change"))}catch(e){setError(e instanceof Error?e.message:"Booking response failed")}finally{setBusy("")}};
  const allocate=async()=>{setBusy(l.id);setError("");try{const response=await authenticatedDemoFetch("/api/try-xdrive-demo/bookings/allocate",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({jobId:l.id,driver:draft.driver,vehicle:draft.vehicle})});if(!response.ok){const payload=await response.json().catch(()=>({}));throw new Error(payload.error||"Allocation failed")}window.dispatchEvent(new Event("xdrive-demo-booking-change"))}catch(e){setError(e instanceof Error?e.message:"Allocation failed")}finally{setBusy("")}};
  return <div className="panel" key={l.id}>
   {l.readOnly&&l.operationalStatus==="pending_acceptance"&&["Carrier","Carrier / Company","Company","Fleet","Dispatcher"].includes(role)&&<div className="actions"><button className="primary" disabled={busy===l.id} onClick={()=>void respond("accepted")}>Accept booking</button><button className="outline" disabled={busy===l.id} onClick={()=>void respond("rejected")}>Reject booking</button></div>}
   {l.readOnly&&l.operationalStatus==="accepted"&&canAssign&&<div className="form-grid"><label>Driver<input value={draft.driver} maxLength={120} onChange={e=>setDrafts(x=>({...x,[l.id]:{...draft,driver:e.target.value}}))}/></label><label>Vehicle ID<input value={draft.vehicle} maxLength={80} onChange={e=>setDrafts(x=>({...x,[l.id]:{...draft,vehicle:e.target.value}}))}/></label><button className="primary" disabled={busy===l.id||!draft.driver.trim()||!draft.vehicle.trim()} onClick={()=>void allocate()}>Allocate driver and vehicle</button></div>}
   <DemoLoadSummary load={l} expanded/>{l.readOnly&&<p className="notice">Verified booking status: {l.operationalStatus||"Unknown"} (read-only). Acceptance, allocation and POD actions require authenticated booking operations.</p>}
   <p>Quote: £{l.quote} · Awarded quote: {l.awardedQuoteId}</p>
   {!l.readOnly&&<p>Acceptance: <strong>{l.acceptanceStatus||"Pending (legacy demo booking)"}</strong> · Assigned driver: {l.assignedDriver||"Unallocated"} · Vehicle: {l.assignedVehicleId||"Unallocated"}</p>}{!l.readOnly&&pending&&["Driver","Company Driver","Fleet","Carrier","Company"].includes(role)&&<div className="actions"><button className="primary" disabled={busy===l.id} onClick={()=>save({acceptanceStatus:"Accepted"})}>Accept allocated job</button><button className="outline" disabled={busy===l.id} onClick={()=>save({acceptanceStatus:"Rejected"})}>Reject allocated job</button></div>}{l.acceptanceStatus==="Rejected"&&<p className="notice">Job rejected. No collection or delivery actions are available.</p>}
   {!l.readOnly&&canAssign&&accepted&&<div className="form-grid">
    <label>Driver<input aria-label={"Driver for "+l.id} value={draft.driver} maxLength={120} onChange={e=>setDrafts(x=>({...x,[l.id]:{...draft,driver:e.target.value}}))}/></label>
    <label>Vehicle ID<input aria-label={"Vehicle for "+l.id} value={draft.vehicle} maxLength={80} onChange={e=>setDrafts(x=>({...x,[l.id]:{...draft,vehicle:e.target.value}}))}/></label>
    <button className="primary" disabled={busy===l.id||!draft.driver.trim()||!draft.vehicle.trim()} onClick={()=>save({assignedDriver:draft.driver,assignedVehicleId:draft.vehicle})}>Save assignment</button>
   </div>}
   {!l.readOnly&&<h3>Delivery timeline</h3>}
   {!l.readOnly&&<div className="timeline">{steps.map((name,i)=><div key={name} className={i<=stage?"complete":""}><span className="dot">{i<=stage?"✓":i+1}</span><span><strong>{name}</strong><small>{i<=stage?"Completed in demo":"Pending"}</small></span></div>)}</div>}
   {!l.readOnly&&!ready&&<p className="notice">Driver and vehicle assignment required before delivery actions.</p>}
   {!l.readOnly&&canAdvance&&accepted&&ready&&stage<6&&<button className="primary" disabled={busy===l.id} onClick={()=>save({deliveryStage:stage+1})}>Complete next milestone: {steps[stage+1]}</button>}
   {!l.readOnly&&canAdvance&&accepted&&ready&&stage===6&&!l.podReceived&&<DemoPOD onComplete={async evidence=>{await updateDemoLoad(l.id,{podReceived:true,podRecipient:evidence.recipient,podPhotoCount:evidence.photoCount})}}/>}
   {l.podReceived&&<p className="notice">Sample POD recorded for {l.podRecipient} · {l.podPhotoCount} photo(s) confirmed · {l.podConfirmedAt?new Date(l.podConfirmedAt).toLocaleString("en-GB"):""}. Images are not uploaded or retained.</p>}
   <DemoInvoicePreview booking={l}/>
  </div>
 })}
 {error&&<p role="alert">{error}</p>}
 </section>
}
