"use client";
import {useCallback,useEffect,useMemo,useRef,useState} from "react";
import {getAutonomousSessionEpoch} from "../../../lib/try-xdrive-demo/authenticatedFetch";
import dynamic from "next/dynamic";
import {approximateMiles,postcodeDistrict,useOutcodePositions} from "./useOutcodePositions";
const AutonomousAvailabilityMap=dynamic(()=>import("./AutonomousAvailabilityMap"),{ssr:false});
type Row={id:string;vehicle:string;registration:string;company:string;publicArea:string;status:string;owned:boolean;lastConfirmed:string};
type Fleet={vehicles:{id:string;reg:string;vehicle:string;status:string;location:string}[]};
export default function AutonomousNetworkAvailability({allowShare=false}:{allowShare?:boolean}){
 const [rows,setRows]=useState<Row[]>([]),[fleet,setFleet]=useState<Fleet>({vehicles:[]}),[role,setRole]=useState("");
 const [area,setArea]=useState(""),[radius,setRadius]=useState("10"),[type,setType]=useState("Any Vehicle"),[mode,setMode]=useState("List");
 const [vehicleId,setVehicleId]=useState(""),[shareArea,setShareArea]=useState(""),[notice,setNotice]=useState(""),[error,setError]=useState(""),[busy,setBusy]=useState(false);
 const requestVersion=useRef(0);
 const locations=useMemo(()=>[area,...rows.map(x=>x.publicArea)],[area,rows]),{positions,loading}=useOutcodePositions(locations);
 const code=postcodeDistrict(area),anchor=positions[code],byRadius=Boolean(area.trim()&&code);
 const refresh=useCallback(async()=>{
  const request=++requestVersion.current,epoch=getAutonomousSessionEpoch();
  const current=()=>request===requestVersion.current&&epoch===getAutonomousSessionEpoch();
  try{
   const [a,b,s]=await Promise.all([fetch("/api/autonomous/v1/availability",{credentials:"same-origin",cache:"no-store"}),
    fetch("/api/autonomous/v1/fleet?view=workspace",{credentials:"same-origin",cache:"no-store"}),
    fetch("/api/autonomous/v1/session",{credentials:"same-origin",cache:"no-store"})]);
   if(!a.ok)throw Error(a.status===401?"Select a local test workspace":"Availability ledger unavailable");
   const [available,fleetResult,sessionResult]=await Promise.all([
    a.json() as Promise<Row[]>,b.ok?b.json() as Promise<Fleet>:Promise.resolve({vehicles:[]} as Fleet),
    s.ok?s.json() as Promise<{actor?:{role:string}}>:Promise.resolve({actor:undefined})
   ]);
   if(!current())return;
   setRows(available);setFleet(fleetResult);setRole(sessionResult.actor?.role||"");setError("");
  }catch(e){if(current()){setRows([]);setFleet({vehicles:[]});setRole("");setError(e instanceof Error?e.message:"Availability unavailable")}}
 },[]);
 useEffect(()=>{
  const onSession=()=>{
   requestVersion.current++;setRows([]);setFleet({vehicles:[]});setRole("");setVehicleId("");setShareArea("");setNotice("");
   void refresh();
  };
  void refresh();
  const interval=setInterval(()=>void refresh(),10000);
  window.addEventListener("xdrive-demo-session-change",onSession);
  return()=>{
   // eslint-disable-next-line react-hooks/exhaustive-deps -- cancel pending account-specific results
   requestVersion.current++;clearInterval(interval);window.removeEventListener("xdrive-demo-session-change",onSession);
  };
 },[refresh]);
 const visible=rows.filter(r=>{
  if(type!=="Any Vehicle"&&r.vehicle!==type)return false;
  if(!area.trim())return true;
  if(!byRadius)return [r.publicArea,r.vehicle,r.company].join(" ").toLowerCase().includes(area.toLowerCase());
  const point=positions[postcodeDistrict(r.publicArea)];
  return Boolean(anchor&&point&&approximateMiles(anchor,point)<=Number(radius));
 });
 const publish=async(method:"PUT"|"PATCH",id:string,location:string)=>{
  setBusy(true);setNotice("");setError("");
  try{const r=await fetch("/api/autonomous/v1/availability",{method,credentials:"same-origin",
   headers:{"Content-Type":"application/json"},body:JSON.stringify({vehicleId:id,publicArea:location})});
   const data=await r.json() as {error?:string};if(!r.ok)throw Error(data.error||"Share denied");
   setNotice(method==="PUT"?"Vehicle advertised to the local Exchange":"Availability withdrawn");
   await refresh();
  }catch(e){setError(e instanceof Error?e.message:"Update failed")}finally{setBusy(false)}
 };
 const availableVehicles=fleet.vehicles.filter(v=>["Available","available"].includes(v.status));
 return <section className="la-page xd-reference-availability">
  <header className="xd-ra-head"><h1>Live Availability</h1><p>Consent-based public availability · LOCAL TEST</p></header>
  <div className="la-kpis">
   {[["Advertised Vehicles",rows.length,"Manual member postings"],["Matching",visible.length,"Current filters"],["Nearby","—","GPS not collected"],["Available Carriers",new Set(rows.map(r=>r.company)).size,"Opt-in companies"],["Verified GPS","—","Not connected"]].map(([name,value,sub],i)=>
    <article className={"la-kpi la-kpi-"+i} key={name}><span>▤</span><div><b>{name}</b><strong>{value}</strong><small>{sub}</small></div></article>)}
  </div>
  <div className="la-layout"><aside className="la-filters"><h3>Find Availability</h3>
   <label>Town / Outward Postcode<input value={area} onChange={e=>setArea(e.target.value)} placeholder="e.g. BB1"/></label>
   <label>Approximate Radius<select value={radius} onChange={e=>setRadius(e.target.value)}>{["5","10","25","50","100"].map(v=><option key={v} value={v}>{v} miles</option>)}</select></label>
   <label>Vehicle<select value={type} onChange={e=>setType(e.target.value)}><option>Any Vehicle</option>{[...new Set(rows.map(r=>r.vehicle))].map(v=><option key={v}>{v}</option>)}</select></label>
   <button className="la-clear" onClick={()=>{setArea("");setRadius("10");setType("Any Vehicle");setNotice("")}}>Clear Filters</button>
   <button className="la-search" onClick={()=>setNotice(visible.length+" available vehicles found")}>Search Availability</button>
   {allowShare&&role==="company"&&<div style={{display:"grid",gap:8,marginTop:16}}>
    <h3>Advertise my vehicle</h3>
    <label>Available vehicle<select value={vehicleId} onChange={e=>setVehicleId(e.target.value)}><option value="">Select vehicle</option>{availableVehicles.map(v=><option key={v.id} value={v.id}>{v.reg}</option>)}</select></label>
    <label>Public town and outcode<input value={shareArea} placeholder="Blackburn BB1" onChange={e=>setShareArea(e.target.value)}/></label>
    <button disabled={busy||!vehicleId||!shareArea.trim()} onClick={()=>void publish("PUT",vehicleId,shareArea)}>Share Availability</button>
    <small>Only public town and outward postcode are exposed. Your precise GPS position is never published.</small>
   </div>}
  </aside><div className="la-results">
   <div className="la-results-head"><h3>Available Vehicles ({visible.length})</h3><div><button onClick={()=>setMode("List")}>List</button><button onClick={()=>setMode("Map")}>Map</button></div></div>
   {error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
   {loading&&byRadius&&<p role="status">Resolving public postcode districts…</p>}
   {byRadius&&<p className="notice">Approximate postcode-centre radius. This is not driving distance or live GPS; unresolved postcode matches are withheld.</p>}
   {mode==="Map"?<AutonomousAvailabilityMap records={visible}/>:visible.map(item=><article key={item.id} className="la-driver">
    <div className="la-avatar">🚚</div><div className="la-driver-info"><b>{item.vehicle}</b><strong>{item.publicArea}</strong><small>{item.company} · {item.registration}</small></div>
    <div className="la-driver-status"><span>{item.status}</span><small>Manual · {new Date(item.lastConfirmed).toLocaleString("en-GB")}</small></div>
    {item.owned&&<button disabled={busy} onClick={()=>void publish("PATCH",item.id,"")}>Withdraw</button>}
   </article>)}
   {!visible.length&&<p>No voluntarily advertised availability matches the filters. No fabricated drivers or GPS positions are shown.</p>}
  </div></div><p className="xd-ra-disclaimer">Only approved public area disclosures are shown. No production or legacy data is used.</p>
 </section>;
}
