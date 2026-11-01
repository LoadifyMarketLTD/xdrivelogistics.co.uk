"use client";
import {useMemo,useState} from "react";
import {Truck,Users,CheckCircle2,ClipboardList,AlertTriangle,Plus,Search,RotateCcw,MapPin,FileText,ShieldCheck,PenLine,ArrowLeft} from "lucide-react";
import DemoFleetManager from "./DemoFleetManager";
import "./reference-fleet.css";

type Vehicle={id:string;reg:string;vehicle:string;driver:string;status:string;location:string};
type Props={vehicles:Vehicle[];setVehicles:(update:(list:Vehicle[])=>Vehicle[])=>void;drivers:string[];setDrivers:(update:(list:string[])=>string[])=>void;authNotice?:string};
type View="Vehicles"|"Drivers"|"Documents"|"Compliance";
const TABS:View[]=["Vehicles","Drivers","Documents","Compliance"];
export default function DemoReferenceFleet({vehicles,setVehicles,drivers,setDrivers,authNotice}:Props){
 const [view,setView]=useState<View>("Vehicles"),[editing,setEditing]=useState(false),[selected,setSelected]=useState(""),[type,setType]=useState("Any Type"),[status,setStatus]=useState("Any Status"),[assignment,setAssignment]=useState("Any Assignment"),[search,setSearch]=useState(""),[sort,setSort]=useState("Registration (A–Z)");
 const available=vehicles.filter(v=>v.status==="Available").length;
 const onJob=vehicles.filter(v=>v.status==="On Job").length;
 const unassigned=vehicles.filter(v=>!v.driver||v.driver==="Unassigned").length;
 const filtered=useMemo(()=>vehicles.filter(v=>(type==="Any Type"||v.vehicle===type)&&(status==="Any Status"||v.status===status)&&(assignment==="Any Assignment"||(assignment==="Assigned"?!(!v.driver||v.driver==="Unassigned"):!v.driver||v.driver==="Unassigned"))&&(!search||[v.reg,v.vehicle,v.driver,v.location].some(s=>s.toLowerCase().includes(search.toLowerCase())))).sort((a,b)=>sort==="Registration (Z–A)"?b.reg.localeCompare(a.reg):a.reg.localeCompare(b.reg)),[vehicles,type,status,assignment,search,sort]);
 const reset=()=>{setType("Any Type");setStatus("Any Status");setAssignment("Any Assignment");setSearch("")};
 return <section className="xd-rf-workspace">
 <div className="xd-rf-heading"><div><h1>My Fleet</h1><p>Manage your vehicles, drivers, documents and compliance</p></div></div>
 {authNotice&&<p role="status" className="xd-rf-auth-warning">{authNotice}</p>}
 <div className="xd-rf-kpis">
  {[
   {name:"Total Vehicles",value:vehicles.length,sub:available+" Available",Icon:Truck,tone:"orange"},
   {name:"Total Drivers",value:drivers.length,sub:"Registered drivers",Icon:Users,tone:"blue"},
   {name:"Available",value:available,sub:"Ready for loads",Icon:CheckCircle2,tone:"green"},
   {name:"On Job",value:onJob,sub:"Currently allocated",Icon:ClipboardList,tone:"amber"},
   {name:"Unassigned",value:unassigned,sub:"Require driver allocation",Icon:AlertTriangle,tone:"red"}
  ].map(k=><div className={"xd-rf-kpi "+k.tone} key={k.name}><k.Icon size={28} aria-hidden="true"/><span><strong>{k.name}</strong><b>{k.value}</b><small>{k.sub}</small></span></div>)}
 </div>
 <div className="xd-rf-tabs"><div role="tablist" aria-label="Fleet sections">{TABS.map(t=><button key={t} role="tab" type="button" aria-selected={!editing&&view===t} className={!editing&&view===t?"active":""} onClick={()=>{setView(t);setEditing(false);setSelected("")}}>{t} {t==="Vehicles"&&<small>{vehicles.length}</small>}{t==="Drivers"&&<small>{drivers.length}</small>}</button>)}</div><button className="xd-rf-add" onClick={()=>setEditing(true)}><Plus size={17}/> {editing?"Edit Fleet":"Add Vehicle"}</button></div>
 {editing?<><button type="button" className="xd-rf-back" onClick={()=>setEditing(false)}><ArrowLeft size={16}/> Back to fleet overview</button><DemoFleetManager vehicles={vehicles} setVehicles={setVehicles} drivers={drivers} setDrivers={setDrivers}/></>:
 view==="Vehicles"?<div className="xd-rf-layout">
  <aside className="xd-rf-filters"><h2>Find in Fleet</h2><div><label>Vehicle Type<select value={type} onChange={e=>setType(e.target.value)}><option>Any Type</option>{[...new Set(vehicles.map(v=>v.vehicle))].map(t=><option key={t}>{t}</option>)}</select></label><label>Status<select value={status} onChange={e=>setStatus(e.target.value)}><option>Any Status</option>{[...new Set(vehicles.map(v=>v.status))].map(t=><option key={t}>{t}</option>)}</select></label><label>Driver Assignment<select value={assignment} onChange={e=>setAssignment(e.target.value)}><option>Any Assignment</option><option>Assigned</option><option>Unassigned</option></select></label><label>Search fleet<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Reg, type, area or driver"/></label><button className="xd-rf-reset" onClick={reset}><RotateCcw size={15}/> Clear Filters</button><button className="xd-rf-search" onClick={()=>setSearch(search.trim())}><Search size={18}/> Search Fleet</button></div></aside>
  <div className="xd-rf-results"><div className="xd-rf-sort"><strong>{filtered.length} Vehicles Found</strong><label>Sort by: <select value={sort} onChange={e=>setSort(e.target.value)}><option>Registration (A–Z)</option><option>Registration (Z–A)</option></select></label></div>
  {filtered.map(v=><article className={"xd-rf-row "+(v.status==="Available"?"available":v.status==="On Job"?"working":"inactive")} key={v.id}>
    <span className="xd-rf-vehicle-icon"><Truck size={30} aria-hidden="true"/><small className={v.status==="Available"?"available":v.status==="On Job"?"working":"inactive"}>{v.status}</small></span>
    <div className="xd-rf-vehicle-title"><strong>{v.reg}</strong><span>{v.vehicle}</span><small><MapPin size={13}/> {v.location||"Location not recorded"}</small></div>
    <div className="xd-rf-assigned"><Users size={18}/><span><strong>{v.driver&&v.driver!=="Unassigned"?v.driver:"Unassigned"}</strong><small>{v.driver&&v.driver!=="Unassigned"?"Driver assigned":"No driver assigned"}</small></span></div>
    <div className="xd-rf-compliance"><ShieldCheck size={20}/><span>Not verified<small>Documentation pending</small></span></div>
    <div className="xd-rf-vehicle-actions"><button onClick={()=>setSelected(selected===v.id?"":v.id)}>{selected===v.id?"Hide Details":"View Details"}</button><button onClick={()=>setEditing(true)}><PenLine size={14}/> Edit</button></div>
    {selected===v.id&&<div className="xd-rf-details"><strong>Vehicle details · {v.reg}</strong><p>Vehicle: {v.vehicle} · Driver: {v.driver||"Unassigned"} · Location: {v.location||"Not recorded"} · Status: {v.status}.</p><p>Dimensions, weight limits, compliance verification and document expiry are not recorded in this demo vehicle entry.</p><button onClick={()=>setEditing(true)}>Open fleet editor</button></div>}
  </article>)}
  {!filtered.length&&<div className="xd-rf-empty">No vehicles match the current filters.</div>}</div>
 </div>:
 view==="Drivers"?<div className="xd-rf-people"><div className="xd-rf-sort"><strong>{drivers.length} Registered Drivers</strong><button onClick={()=>setEditing(true)}><Plus size={16}/> Manage Drivers</button></div>{drivers.length?drivers.map(name=><div className="xd-rf-driver-row" key={name}><Users size={21}/><strong>{name}</strong><span>{vehicles.filter(v=>v.driver===name).length} assigned vehicle(s)</span><button onClick={()=>setEditing(true)}>Manage</button></div>):<div className="xd-rf-empty">No registered drivers.</div>}</div>:
 <div className="xd-rf-unavailable">{view==="Documents"?<FileText size={30}/>:<ShieldCheck size={30}/>}<h2>{view}</h2><p>{view==="Documents"?"Vehicle and driver documents are not yet available in this DEMO workspace.":"Compliance status cannot be verified without supporting documentation."}</p><button onClick={()=>setEditing(true)}>Open fleet administration</button></div>
 }
 </section>;
}
