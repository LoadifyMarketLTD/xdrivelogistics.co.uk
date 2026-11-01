"use client";
import {useState} from "react";
import {CalendarDays,CheckCircle2,ClipboardList,Filter,Search,Truck,Users} from "lucide-react";
import DemoTransportDetails from "./DemoTransportDetails";
import XDriveLoadCard from "./XDriveLoadCard";
import "./reference-booking-records.css";
import "./reference-live-jobs.css";
type Job={id:string;from:string;to:string;vehicle:string;cargo:string;company:string;status:string;price:number;driver:string;vehicleId:string;stage:number;pod:boolean};
type Tab="All"|"Open"|"Allocated"|"In Progress"|"Completed"|"Cancelled";
const tabs:Tab[]=["All","Open","Allocated","In Progress","Completed","Cancelled"];
const status=(j:Job)=>j.pod?"Completed":j.status==="Cancelled"?"Cancelled":j.status==="Open"?"Open":j.stage>0?"In Progress":j.driver?"Allocated":"Open";
export default function DemoReferenceLiveJobs({jobs,onAllocations,onDiary}:{jobs:Job[];onAllocations:()=>void;onDiary:()=>void}){
 const [tab,setTab]=useState<Tab>("All"),[query,setQuery]=useState(""),[driver,setDriver]=useState(""),[selected,setSelected]=useState<Job|null>(null),[sort,setSort]=useState("Newest"),[onlyPOD,setOnlyPOD]=useState(false);
 const filter=jobs.filter(j=>(tab==="All"||status(j)===tab)&&(!onlyPOD||j.pod)&&[j.id,j.from,j.to,j.company,j.vehicle].join(" ").toLowerCase().includes(query.toLowerCase())&&j.driver.toLowerCase().includes(driver.toLowerCase())).sort((a,b)=>sort==="Oldest"?a.id.localeCompare(b.id):b.id.localeCompare(a.id));
 const allocated=jobs.filter(j=>!!j.driver&&!j.pod).length;
 const inProgress=jobs.filter(j=>status(j)==="In Progress").length;
 const completed=jobs.filter(j=>j.pod).length;
 const missing=jobs.filter(j=>!j.driver&&j.status!=="Cancelled").length;
 const counts=[
 {name:"All Jobs",number:jobs.length,sub:"Shared DEMO records",tone:"orange",Icon:ClipboardList},
 {name:"Allocated",number:allocated,sub:"Driver assigned",tone:"blue",Icon:Users},
 {name:"In Progress",number:inProgress,sub:"Transport underway",tone:"green",Icon:Truck},
 {name:"Completed",number:completed,sub:"POD confirmed",tone:"sky",Icon:CheckCircle2},
 {name:"Unallocated",number:missing,sub:"Allocation required",tone:"amber",Icon:CalendarDays}
 ];
 return <section className="xd-reference-records xd-dispatch-live">
  <header className="xd-rr-heading"><h1>Live Jobs</h1><p>Current dispatch assignments, milestones and delivery evidence</p></header>
  <nav className="xd-rr-tabs" aria-label="Live job status">{tabs.map(t=><button key={t} className={tab===t?"active":""} onClick={()=>setTab(t)} aria-pressed={tab===t}>{t} <span>{t==="All"?jobs.length:jobs.filter(j=>status(j)===t).length}</span></button>)}</nav>
  <div className="xd-rr-kpis">{counts.map(m=><article key={m.name} className={"xd-rr-kpi "+m.tone}><m.Icon size={26} aria-hidden="true"/><div><strong>{m.name}</strong><b>{m.number}</b><small>{m.sub}</small></div></article>)}</div>
  <div className="xd-rr-layout"><aside className="xd-rr-filters"><h2><Filter size={17}/> Find Live Jobs</h2>
   <label>Job reference or route<input placeholder="Job, town or postcode" value={query} onChange={e=>setQuery(e.target.value)}/></label>
   <label>Driver<input placeholder="Assigned driver" value={driver} onChange={e=>setDriver(e.target.value)}/></label>
   <label>Status<select value={tab} onChange={e=>setTab(e.target.value as Tab)}>{tabs.map(t=><option key={t}>{t}</option>)}</select></label>
   <label className="xd-rr-check"><input type="checkbox" checked={onlyPOD} onChange={e=>setOnlyPOD(e.target.checked)}/> With POD</label>
   <button className="xd-rr-clear" onClick={()=>{setQuery("");setDriver("");setTab("All");setOnlyPOD(false)}}>↺ Clear Filters</button>
   <button className="xd-rr-search" onClick={()=>setQuery(query.trim())}><Search size={17}/> Search Jobs</button>
  </aside><div className="xd-rr-results">
   <div className="xd-rr-results-head"><strong>Dispatch Jobs <small>({filter.length} records)</small></strong><label>Sort: <select value={sort} onChange={e=>setSort(e.target.value)}><option>Newest</option><option>Oldest</option></select></label></div>
   {filter.map(j=><XDriveLoadCard key={j.id} data={{id:j.id,from:j.from,to:j.to,date:"See booking",status:status(j),vehicle:j.vehicle,cargo:j.cargo,weight:"Not separately recorded",company:j.company}} onDetails={()=>setSelected(j)} actions={<button className="quote" onClick={()=>setSelected(j)}>View Details</button>} extra={<span>Driver: {j.driver||"Unallocated"} · {j.vehicleId||"Vehicle pending"}</span>}/>)}
   {!filter.length&&<div className="xd-rr-empty"><Truck size={29}/><h3>No live jobs match your filters</h3><p>Only authenticated shared DEMO records can appear here; no transport has been fabricated.</p><button onClick={onAllocations}>Open Allocations</button></div>}
   <div className="xd-dispatch-live-actions"><button onClick={onAllocations}>View Allocations</button><button onClick={onDiary}>Open Diary</button></div>
  </div></div>
  {selected&&<DemoTransportDetails title={selected.id} subtitle={selected.from+" → "+selected.to} status={status(selected)} onClose={()=>setSelected(null)} sections={[
    {title:"Transport",fields:[{label:"Reference",value:selected.id},{label:"Customer",value:selected.company},{label:"Vehicle requirement",value:selected.vehicle},{label:"Cargo",value:selected.cargo},{label:"Status",value:status(selected)}]},
    {title:"Assignment",fields:[{label:"Driver",value:selected.driver||"Unallocated"},{label:"Vehicle",value:selected.vehicleId||"Not allocated"},{label:"Delivery milestone",value:String(selected.stage)},{label:"POD status",value:selected.pod?"Received":"Not confirmed"}]}
   ]} footer={<button className="xd-rr-search" onClick={()=>{setSelected(null);onAllocations()}}>Open Allocations</button>}/>}
 </section>;
}
