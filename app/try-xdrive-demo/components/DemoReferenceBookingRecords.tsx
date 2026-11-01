"use client";

import {useEffect,useMemo,useState} from "react";
import {BadgeCheck, CalendarClock, CheckCircle2, ClipboardList, FileText, Filter, PackageCheck, Search, Truck} from "lucide-react";
import {useDemoBookings,type DemoLoad} from "./demoExchange";
import DemoLoadSummary from "./DemoLoadSummary";
import {bookingMilestone,bookingEvidenceStatus} from "./bookingMilestone";
import AutonomousBookingEvidence from "./AutonomousBookingEvidence";
import AutonomousBookingEvents from "./AutonomousBookingEvents";
import AutonomousBookingMessages from "./AutonomousBookingMessages";
import DemoTransportDetails from "./DemoTransportDetails";
import XDriveLoadCard from "./XDriveLoadCard";
import "./reference-booking-records.css";

type View="tracking"|"documents"|"awards"|"pod";
type Props={view:View;onBookings:()=>void};
const details:Record<View,{title:string;subtitle:string;heading:string;filter:string}> = {
 tracking:{title:"Tracking",subtitle:"Collections, deliveries and booking milestones",heading:"Transport tracking",filter:"Find Transport"},
 documents:{title:"Documents",subtitle:"Collection records, delivery confirmation and POD",heading:"Booking documents",filter:"Find Documents"},
 awards:{title:"Awards",subtitle:"Confirmed carriers and awarded jobs",heading:"Awarded transport",filter:"Find Awards"},
 pod:{title:"POD Review",subtitle:"Proof of delivery and evidence review",heading:"Proof of Delivery",filter:"Find POD"}
};
const milestone=bookingMilestone;
const docStatus=bookingEvidenceStatus;
const states=["All","Pending Acceptance","Pending Allocation","Allocated","In Progress","Awaiting POD","Completed","Cancelled"];
export default function DemoReferenceBookingRecords({view,onBookings}:Props){
 const {loads,error}=useDemoBookings();
 const [status,setStatus]=useState("All"),[ref,setRef]=useState(""),[route,setRoute]=useState(""),
 [driver,setDriver]=useState(""),[date,setDate]=useState(""),[sort,setSort]=useState("Recent first"),
 [selected,setSelected]=useState<DemoLoad|null>(null),[onlyMissing,setOnlyMissing]=useState(false);
 // The bookings API already applies award and tenancy policy. Do not
 // mistakenly remove autonomous jobs whose status is pending/accepted/delivered.
 useEffect(()=>{
  const close=()=>{setSelected(null);setStatus("All");setOnlyMissing(false)};
  window.addEventListener("xdrive-demo-session-change",close);
  return()=>window.removeEventListener("xdrive-demo-session-change",close);
 },[]);
 const rows=useMemo(()=>loads.filter(x=>x.status==="Awarded"||Boolean(x.operationalStatus)||x.status==="Cancelled"&&Boolean(x.awardHistory?.length)),[loads]);
 const completed=rows.filter(l=>l.podReceived).length;
 const active=rows.filter(l=>milestone(l)==="In Progress").length;
 const awaiting=rows.filter(l=>milestone(l)==="Awaiting POD").length;
 const assigned=rows.filter(l=>!!l.assignedDriver).length;
 const counts=[
 {name:"Awarded Bookings",value:rows.length,sub:"Confirmed transport",tone:"orange",Icon:BadgeCheck},
 {name:"In Progress",value:active,sub:"Delivery underway",tone:"blue",Icon:Truck},
 {name:"Assigned Drivers",value:assigned,sub:"Driver allocation",tone:"green",Icon:ClipboardList},
 {name:"Awaiting POD",value:awaiting,sub:"Evidence required",tone:"amber",Icon:FileText},
 {name:"Completed",value:completed,sub:"POD received",tone:"sky",Icon:CheckCircle2}
 ];
 const filtered=rows.filter(l=>(status==="All"||milestone(l)===status)&&
 (l.id+" "+l.from+" "+l.to+" "+l.customer).toLowerCase().includes(ref.toLowerCase())&&
 (l.from+" "+l.to).toLowerCase().includes(route.toLowerCase())&&
 (l.assignedDriver||"").toLowerCase().includes(driver.toLowerCase())&&
 (!date||l.pickupDate?.slice(0,10)===date)&&
 (!onlyMissing||!l.podReceived)).sort((a,b)=>sort==="Recent first"?b.postedAt.localeCompare(a.postedAt):a.postedAt.localeCompare(b.postedAt));
 const reset=()=>{setStatus("All");setRef("");setRoute("");setDriver("");setDate("");setOnlyMissing(false);setSort("Recent first")};
 const config=details[view];
 return <section className="xd-reference-records">
  <header className="xd-rr-heading"><h1>{config.title}</h1><p>{config.subtitle}</p></header>
  <nav className="xd-rr-tabs" aria-label={config.title+" statuses"}>{states.map(x=><button type="button" key={x} className={status===x?"active":""} aria-pressed={status===x} onClick={()=>setStatus(x)}>{x} <span>{x==="All"?rows.length:rows.filter(l=>milestone(l)===x).length}</span></button>)}</nav>
  <div className="xd-rr-kpis">{counts.map(k=><article key={k.name} className={"xd-rr-kpi "+k.tone}><k.Icon size={27} aria-hidden="true"/><div><strong>{k.name}</strong><b>{k.value}</b><small>{k.sub}</small></div></article>)}</div>
  <div className="xd-rr-layout">
   <aside className="xd-rr-filters"><h2><Filter size={17}/> {config.filter}</h2>
    <label>Booking reference<input value={ref} onChange={e=>setRef(e.target.value)} placeholder="e.g. XDR-10457"/></label>
    <label>Collection / delivery<input value={route} onChange={e=>setRoute(e.target.value)} placeholder="Town or postcode"/></label>
    <label>Assigned driver<input value={driver} onChange={e=>setDriver(e.target.value)} placeholder="Driver name"/></label>
    <label>Status<select value={status} onChange={e=>setStatus(e.target.value)}>{states.map(x=><option key={x}>{x}</option>)}</select></label>
    <label>Collection date<input type="date" value={date} onChange={e=>setDate(e.target.value)}/></label>
    <label className="xd-rr-check"><input type="checkbox" checked={onlyMissing} onChange={e=>setOnlyMissing(e.target.checked)}/> POD outstanding</label>
    <button className="xd-rr-clear" type="button" onClick={reset}>↺ Clear Filters</button>
    <button className="xd-rr-search" type="button" onClick={()=>setRef(ref.trim())}><Search size={17}/> Search {config.title}</button>
   </aside>
   <div className="xd-rr-results">
    <div className="xd-rr-results-head"><strong>{config.heading} <small>({filtered.length} records)</small></strong><label>Sort by: <select value={sort} onChange={e=>setSort(e.target.value)}><option>Recent first</option><option>Oldest first</option></select></label></div>
    {error&&<p className="xd-rr-warning" role="alert">{error}. Operational records require an authenticated local test session.</p>}
    {filtered.map(l=><XDriveLoadCard key={l.id} data={{id:l.id,from:l.from,to:l.to,date:l.pickupDate||"Date not supplied",status:milestone(l),vehicle:l.vehicle,cargo:(l.pallets||"0")+" pallets",weight:(l.weight||"0")+" kg",collection:l.pickupDate||"TBC",delivery:l.deliveryDate||"TBC",company:l.customer,packaging:l.packaging,paymentTerms:l.paymentTerms,equipment:l.notes}} onDetails={()=>setSelected(l)} actions={<button className="quote" type="button" onClick={()=>setSelected(l)}>{view==="pod"?"Review POD":view==="documents"?"View Documents":"View Details"}</button>} extra={<span><CalendarClock size={13}/> {l.assignedDriver||"Driver not allocated"} · {view==="documents"||view==="pod"?docStatus(l):"Stage "+(l.deliveryStage||0)+"/7"}</span>}/>)}
    {!filtered.length&&<div className="xd-rr-empty"><PackageCheck size={29}/><h3>No matching {config.title.toLowerCase()} records</h3><p>{rows.length?"Adjust the filters to see available DEMO bookings.":"No awarded bookings are available for this session. No transport history has been invented."}</p><button type="button" onClick={onBookings}>Open Bookings</button></div>}
   </div>
  </div>
  {selected&&<DemoTransportDetails title={selected.id} subtitle={selected.from+" → "+selected.to} status={milestone(selected)} onClose={()=>setSelected(null)} sections={[
   {title:"Transport Details",fields:[{label:"Booking reference",value:selected.id},{label:"Customer",value:selected.customer},{label:"Collection",value:selected.from},{label:"Delivery",value:selected.to},{label:"Payment Terms",value:selected.paymentTerms||"Not supplied"}]},
   {title:"Collection & Delivery",fields:[{label:"Collection date",value:selected.pickupDate},{label:"Collection time",value:selected.pickupStart},{label:"Delivery date",value:selected.deliveryDate},{label:"Driver",value:selected.assignedDriver||"Unallocated"},{label:"Vehicle Registration",value:selected.assignedVehicleId||"Unallocated"},{label:"Milestone",value:String(selected.deliveryStage||0)+" / 7"}]},
   {title:"Document Verification",fields:[{label:"POD status",value:docStatus(selected)},{label:"Received by",value:selected.podRecipient||"Not supplied"},{label:"POD images",value:selected.podPhotoCount===undefined?"Not recorded":String(selected.podPhotoCount)},{label:"Awarded quote",value:selected.awardedQuoteId||"Not recorded"},{label:"Acceptance",value:selected.acceptanceStatus||"Not recorded"}]}
  ]} footer={<><DemoLoadSummary load={selected} expanded/>{process.env.NEXT_PUBLIC_XDRIVE_AUTONOMOUS_DEMO==="1"&&<><AutonomousBookingEvents jobId={selected.id}/><AutonomousBookingEvidence jobId={selected.id}/><AutonomousBookingMessages jobId={selected.id}/></>}</>}/>} 
 </section>;
}
