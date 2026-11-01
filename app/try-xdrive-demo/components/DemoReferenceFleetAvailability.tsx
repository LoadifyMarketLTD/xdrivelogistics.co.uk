"use client";
import {useMemo,useState} from "react";
import {Truck,MapPin,Users,RotateCcw,Search,CheckCircle2} from "lucide-react";
import "./demo-live-availability.css";
import "./reference-fleet-availability.css";
import {approximateMiles,postcodeDistrict,useOutcodePositions} from "./useOutcodePositions";
type Vehicle={id:string;reg:string;vehicle:string;driver:string;status:string;location:string};
export default function DemoReferenceFleetAvailability({vehicles,onOpenLoads}:{vehicles:Vehicle[];onOpenLoads:()=>void}){
 const [location,setLocation]=useState(""),[radius,setRadius]=useState("10"),[vehicle,setVehicle]=useState("Any Vehicle"),
 [availability,setAvailability]=useState("Any Status"),[sort,setSort]=useState("Registration A–Z"),
 [mode,setMode]=useState<"Map"|"List">("Map"),[zoom,setZoom]=useState(1),[selected,setSelected]=useState(""),
 [notice,setNotice]=useState("");
 const autonomous=process.env.NEXT_PUBLIC_XDRIVE_AUTONOMOUS_DEMO==="1";
 const {positions,loading:geoLoading}=useOutcodePositions([location,...vehicles.map(v=>v.location)]);
 const originKey=postcodeDistrict(location),originPoint=positions[originKey];
 const radiusEnabled=autonomous&&Boolean(location.trim())&&Boolean(originKey);
 const filtered=useMemo(()=>vehicles.filter(v=>(vehicle==="Any Vehicle"||v.vehicle===vehicle)&&
 (availability==="Any Status"||v.status===availability)&&
 (!location||radiusEnabled?(!radiusEnabled||Boolean(originPoint&&positions[postcodeDistrict(v.location)]&&
  approximateMiles(originPoint,positions[postcodeDistrict(v.location)]!)<=Number(radius))):
  v.location.toLowerCase().includes(location.trim().toLowerCase())||v.reg.toLowerCase().includes(location.trim().toLowerCase()))
 ).sort((a,b)=>sort==="Registration Z–A"?b.reg.localeCompare(a.reg):a.reg.localeCompare(b.reg)),[vehicles,vehicle,availability,location,sort,radius,radiusEnabled,positions,originPoint]);
 const chosen=filtered.find(v=>v.id===selected)||filtered[0];
 const available=vehicles.filter(v=>v.status==="Available");
 const clear=()=>{setLocation("");setRadius("10");setVehicle("Any Vehicle");setAvailability("Any Status");setSort("Registration A–Z");setNotice("")};
 const kpis=[
 ["Available Now",available.length,"Registered DEMO vehicles","♟"],
 ["Fleet Vehicles",vehicles.length,"Fleet register","▤"],
 ["Who’s Nearby","—","GPS not connected","◎"],
 ["Driver Assignments",vehicles.filter(v=>v.driver&&v.driver!=="Unassigned").length,"Named fleet drivers","♙"],
 ["On Job",vehicles.filter(v=>v.status==="On Job").length,"Unavailable right now","◷"],
 ];
 return <section className="la-page xd-reference-availability">
 <div className="xd-ra-head"><h1>Live Availability</h1><p>Fleet presence, location filters and vehicle status</p></div>
 <div className="la-kpis">{kpis.map((x,i)=><article key={String(x[0])} className={"la-kpi la-kpi-"+i}><span>{x[3]}</span><div><b>{x[0]}</b><strong>{x[1]}</strong><small>{x[2]}</small></div></article>)}</div>
 <div className="la-layout">
 <aside className="la-filters"><h3>Find Availability</h3>
  <label>Town / Postcode<input value={location} onChange={e=>setLocation(e.target.value)} placeholder="e.g. Blackburn"/></label>
  <label>Radius<select value={radius} onChange={e=>setRadius(e.target.value)}>{["5","10","25","50","100"].map(x=><option key={x} value={x}>{x} miles</option>)}</select></label>
  <label>Vehicle Type<select value={vehicle} onChange={e=>setVehicle(e.target.value)}><option>Any Vehicle</option>{[...new Set(vehicles.map(x=>x.vehicle))].map(x=><option key={x}>{x}</option>)}</select></label>
  <label>Status<select value={availability} onChange={e=>setAvailability(e.target.value)}><option>Any Status</option>{[...new Set(vehicles.map(x=>x.status))].map(x=><option key={x}>{x}</option>)}</select></label>
  <button className="la-clear" type="button" onClick={clear}><RotateCcw size={15}/> Clear Filters</button>
  <button className="la-search" type="button" onClick={()=>setNotice("Filtered the DEMO fleet register. Proximity and radius require verified GPS positions.")}><Search size={15}/> Search Availability</button>
 </aside>
 <div className="la-results"><div className="la-results-head"><h3>Fleet Available ({filtered.length})</h3><label>Sort by: <select value={sort} onChange={e=>setSort(e.target.value)}><option>Registration A–Z</option><option>Registration Z–A</option></select></label></div>
  {filtered.map(v=><article key={v.id} className={"la-driver "+(chosen?.id===v.id?"la-selected":"")}>
  <div className="la-avatar"><Truck size={23}/></div><div className="la-driver-info"><b>{v.reg}</b><strong>{v.vehicle}</strong><small><MapPin size={12}/> {v.location||"Location not recorded"} · <Users size={12}/> {v.driver||"Unassigned"}</small></div>
  <div className="la-driver-status"><span className={v.status==="Available"?"":"xd-ra-busy"}>{v.status}</span><small>No GPS distance</small></div>
  <div className="la-driver-actions"><button onClick={()=>setSelected(v.id)}>View</button></div>
  </article>)}
  {!filtered.length&&<p className="la-empty">No registered vehicles match the current filters.</p>}
  {notice&&<p className="la-notice" role="status">{notice}</p>}
  {autonomous&&location.trim()&&<p className="la-notice" role="status">{!originKey?"Enter an outward UK postcode for approximate radius search.":geoLoading?"Resolving public postcode-district centres…":originPoint?"Approximate postcode-centre radius; not live vehicle GPS.":"Outcode lookup unavailable, so no proximity result is asserted."}</p>}
 </div>
 <div className="la-map"><div className="la-map-tabs"><button className={mode==="Map"?"active":""} onClick={()=>setMode("Map")}>Map</button><button className={mode==="List"?"active":""} onClick={()=>setMode("List")}>List</button></div>
 {mode==="Map"?<div className="la-map-canvas"><div className="la-map-content" style={{transform:"scale("+zoom+")"}}><div className="la-radius"/><div className="la-center"><MapPin size={25}/><small>No verified GPS</small></div></div><div className="la-zoom"><button aria-label="Zoom in" onClick={()=>setZoom(x=>Math.min(1.8,x+.2))}>+</button><button aria-label="Zoom out" onClick={()=>setZoom(x=>Math.max(.8,x-.2))}>−</button></div><span className="la-map-disclaimer">Illustrative layout — no geocoded positions or distances</span></div>:<div className="la-map-list">{filtered.map(v=><button key={v.id} onClick={()=>setSelected(v.id)}>{v.reg} · {v.vehicle} · {v.status}</button>)}</div>}
 <div className="la-map-detail">{chosen?<><strong>{chosen.reg}</strong><small>{chosen.vehicle} · {chosen.driver||"Unassigned"}</small><span>{chosen.status}</span></>:<p>No selected vehicle</p>}<div><button onClick={onOpenLoads}><CheckCircle2 size={14}/> Find Loads</button></div></div>
 </div>
 </div>
 <p className="xd-ra-disclaimer">Locations are entered fleet records, not live GPS. Radius search is not operational without authenticated device telemetry.</p>
 </section>;
}
