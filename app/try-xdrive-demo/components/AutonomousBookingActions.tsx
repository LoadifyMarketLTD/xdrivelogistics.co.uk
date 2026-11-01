"use client";
import {useCallback,useEffect,useState} from "react";
import {useDemoBookings} from "./demoExchange";
import AutonomousBookingEvidence from "./AutonomousBookingEvidence";
import AutonomousBookingMessages from "./AutonomousBookingMessages";
type Actor={id:string;companyId:string;role:"company"|"driver";workspace?:string};
type Fleet={drivers:{id:string;name:string}[];vehicles:{id:string;label:string}[]};
const stages=["allocated","on_way_pickup","on_site_pickup","loaded","on_way_delivery","on_site_delivery","delivered","completed"];
const labels=["Allocated","On my way to collection","On site collection","Goods loaded","On my way to delivery","On site delivery","Delivered","POD received"];
export default function AutonomousBookingActions({bookingId}:{bookingId?:string}){
 const {loads,error:loadError}=useDemoBookings();
 const [actor,setActor]=useState<Actor|null>(null),[fleet,setFleet]=useState<Fleet>({drivers:[],vehicles:[]});
 const [draft,setDraft]=useState<Record<string,{driver:string;vehicle:string}>>({});
 const [recipient,setRecipient]=useState(""),[signature,setSignature]=useState(""),[podNotes,setPodNotes]=useState("");
 const [busy,setBusy]=useState(""),[error,setError]=useState(""),[notice,setNotice]=useState("");
 const loadContext=useCallback(async()=>{
  try{
   const r=await fetch("/api/autonomous/v1/session",{credentials:"same-origin",cache:"no-store"});
   const data=await r.json() as {actor:Actor|null};if(!r.ok)throw Error("Local session unavailable");
   setActor(data.actor);
   if(data.actor){
    const f=await fetch("/api/autonomous/v1/fleet",{credentials:"same-origin",cache:"no-store"});
    if(f.ok)setFleet(await f.json() as Fleet);else setFleet({drivers:[],vehicles:[]});
   }else setFleet({drivers:[],vehicles:[]});
  }catch{setActor(null);setFleet({drivers:[],vehicles:[]})}
 },[]);
 useEffect(()=>{void loadContext();window.addEventListener("xdrive-demo-session-change",loadContext);return()=>window.removeEventListener("xdrive-demo-session-change",loadContext)},[loadContext]);
 const execute=async(id:string,endpoint:string,body:Record<string,unknown>,success:string)=>{
  setBusy(id);setError("");setNotice("");
  try{
   const response=await fetch("/api/autonomous/v1/"+endpoint,{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
   const data=await response.json() as {error?:string};
   if(!response.ok)throw Error(data.error||"Booking action was rejected");
   setNotice(success);
   for(const event of ["xdrive-demo-booking-change","xdrive-demo-loads-changed","xdrive-demo-quote-change"])window.dispatchEvent(new Event(event));
  }catch(e){setError(e instanceof Error?e.message:"Booking action failed")}
  finally{setBusy("")}
 };
 const visible=loads.filter(l=>!bookingId||l.id===bookingId);
 return <section className="panel" aria-label="Verified autonomous booking actions">
  <h2>Booking Operations · Isolated Test Ledger</h2>
  <p className="notice">Bookings, assignments, delivery milestones, files and POD are persisted in the same local ledger as loads and quotes. No real carrier, email or payment is involved.</p>
  {!actor&&<p role="alert">Select an authorised local account from the workspace bar before updating bookings.</p>}
  {loadError&&<p role="alert">{loadError}</p>}
  {error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
  {visible.length===0&&<p>No awarded booking exists for this account. Only the buyer, awarded carrier and assigned driver can access bookings.</p>}
  {visible.map(l=>{
   const stage=l.operationalStatus||"";
   const carrier=Boolean(actor&&actor.role==="company"&&actor.companyId===l.carrierCompanyId);
   const assigned=Boolean(actor&&actor.id===l.assignedDriver);
   const canAdvance=assigned&&(actor?.role==="driver"||actor?.workspace==="Owner Driver");
   const ix=stages.indexOf(stage),next=ix>=0&&ix<6?stages[ix+1]:null;
   const chosen=draft[l.id]||{driver:"",vehicle:""};
   const canCollection=canAdvance&&["on_site_pickup","loaded","on_way_delivery","on_site_delivery","delivered"].includes(stage);
   const canDelivery=canAdvance&&stage==="delivered";
   return <div className="panel" key={l.id}>
    <h3>{l.from} → {l.to}</h3><p>Job {l.id} · <b>{stage||"No status"}</b> · Driver {l.assignedDriver||"Not allocated"} · Vehicle {l.assignedVehicleId||"Not allocated"}</p>
    <p>Agreed amount: {l.quote===undefined?"Not agreed":"£"+Number(l.quote).toFixed(2)} · Payment terms: {l.paymentTerms||"Not supplied"}</p>
    {(carrier&&stage==="pending_acceptance")&&<div className="actions">
      <button className="primary" disabled={Boolean(busy)} onClick={()=>void execute(l.id,"bookings/respond",{jobId:l.id,decision:"accepted"},"Booking accepted by carrier")}>Accept Booking</button>
      <button className="outline" disabled={Boolean(busy)} onClick={()=>void execute(l.id,"bookings/respond",{jobId:l.id,decision:"rejected"},"Booking returned to Exchange")}>Decline Booking</button>
    </div>}
    {carrier&&stage==="accepted"&&<div className="form-grid">
      <label>Assign driver<select aria-label={"Driver for "+l.id} value={chosen.driver} onChange={e=>setDraft(s=>({...s,[l.id]:{...chosen,driver:e.target.value}}))}>
       <option value="">Select company driver</option>{fleet.drivers.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}
      </select></label>
      <label>Assign vehicle<select aria-label={"Vehicle for "+l.id} value={chosen.vehicle} onChange={e=>setDraft(s=>({...s,[l.id]:{...chosen,vehicle:e.target.value}}))}>
       <option value="">Select fleet vehicle</option>{fleet.vehicles.map(v=><option key={v.id} value={v.id}>{v.label}</option>)}
      </select></label>
      <button className="primary" disabled={Boolean(busy)||!chosen.driver||!chosen.vehicle} onClick={()=>void execute(l.id,"bookings/allocate",{jobId:l.id,driver:chosen.driver,vehicle:chosen.vehicle},"Driver and vehicle assigned")}>Allocate Booking</button>
    </div>}
    <div className="timeline">{stages.map((s,i)=><div key={s} className={i<=ix?"complete":""}>
      <span className="dot">{i<=ix?"✓":i+1}</span><span><strong>{labels[i]}</strong><small>{i<=ix?"Recorded in ledger":"Pending"}</small></span>
    </div>)}</div>
    {canAdvance&&next&&<button className="primary" disabled={Boolean(busy)} onClick={()=>void execute(l.id,"bookings/progress",{jobId:l.id,next},labels[ix+1]+" recorded")}>Next milestone: {labels[ix+1]}</button>}
    {canAdvance&&canCollection&&<AutonomousBookingEvidence jobId={l.id} uploadPhase="collection"/>}
    {canAdvance&&canDelivery&&<AutonomousBookingEvidence jobId={l.id} uploadPhase="delivery"/>}
    {!canAdvance&&<AutonomousBookingEvidence jobId={l.id}/>}
    {canAdvance&&stage==="delivered"&&!l.podReceived&&<div className="panel">
      <h3>Complete Proof of Delivery</h3>
      <label>Received By<input aria-label="Received by" value={recipient} onChange={e=>setRecipient(e.target.value)} maxLength={120}/></label>
      <label>Signature / name confirming handover<input aria-label="Signature name" value={signature} onChange={e=>setSignature(e.target.value)} maxLength={120}/></label>
      <label>Delivery notes<textarea value={podNotes} onChange={e=>setPodNotes(e.target.value)} maxLength={1000}/></label>
      <p>Attached delivery photographs are preserved in this local ledger. The signature is a typed confirmation, not a handwritten signature image.</p>
      <button className="primary" disabled={Boolean(busy)||!recipient.trim()||!signature.trim()} onClick={()=>void execute(l.id,"bookings/pod",{jobId:l.id,recipient:recipient.trim(),signature:signature.trim(),notes:podNotes},"POD recorded and draft invoice created")}>Complete POD</button>
    </div>}
    {l.podReceived&&<p className="notice">POD completed for {l.podRecipient}. {l.podPhotoCount||0} stored delivery photo(s). Invoice draft is available to the buyer and carrier in Invoices.</p>}
    <AutonomousBookingMessages jobId={l.id}/>
   </div>
  })}
 </section>;
}
