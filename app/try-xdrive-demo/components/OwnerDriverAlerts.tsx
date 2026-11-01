"use client";
import {useCallback,useEffect,useMemo,useRef,useState} from "react";
import {useExchangeLoads} from "./demoExchange";
import {approximateMiles,postcodeDistrict,useOutcodePositions} from "./useOutcodePositions";
import type {OwnerAlertCriteria} from "./ownerAlertCriteria";
import {getAutonomousSessionEpoch} from "../../../lib/try-xdrive-demo/authenticatedFetch";
import XDriveLoadCard from "./XDriveLoadCard";
export default function OwnerDriverAlerts({onFindLoads,onFocusLoad}:{onFindLoads:()=>void;onFocusLoad:(ref:string,action:"quote"|"details")=>void}){
 const {loads,error}=useExchangeLoads();
 const [actor,setActor]=useState(""),[criteria,setCriteria]=useState<OwnerAlertCriteria|null>(null),[notice,setNotice]=useState("");
 const requestVersion=useRef(0);
 const refresh=useCallback(async()=>{
  const version=++requestVersion.current,epoch=getAutonomousSessionEpoch();
  const current=()=>version===requestVersion.current&&epoch===getAutonomousSessionEpoch();
  try{
   const session=await fetch("/api/autonomous/v1/session",{credentials:"same-origin",cache:"no-store"});
   if(!session.ok)throw Error("Local test session unavailable");
   const data=await session.json() as {actor?:{id:string}};
   if(!current())return;
   const id=data.actor?.id||"";
   if(!id){setActor("");setCriteria(null);return}
   const r=await fetch("/api/autonomous/v1/saved-search?context=owner-alert",{credentials:"same-origin",cache:"no-store"});
   if(!r.ok)throw Error("Saved alerts unavailable");
   const saved=await r.json() as {criteria:OwnerAlertCriteria|null};
   if(current()){setActor(id);setCriteria(saved.criteria)}
  }catch{
   if(current()){setCriteria(null);setActor("")}
  }
 },[]);
 useEffect(()=>{
  const onSession=()=>{
   requestVersion.current++;setActor("");setCriteria(null);setNotice("");
   void refresh();
  };
  void refresh();
  window.addEventListener("xdrive-demo-session-change",onSession);
  window.addEventListener("xdrive-owner-alert-saved",refresh);
  return()=>{
   // eslint-disable-next-line react-hooks/exhaustive-deps -- invalidate previous actor's saved-alert fetch
   requestVersion.current++;
   window.removeEventListener("xdrive-demo-session-change",onSession);
   window.removeEventListener("xdrive-owner-alert-saved",refresh);
  };
 },[refresh]);
 const keys=useMemo(()=>[criteria?.from||"",...loads.map(l=>l.from)],[criteria,loads]);
 const {positions,loading}=useOutcodePositions(keys);
 const origin=positions[postcodeDistrict(criteria?.from||"")];
 const radiusEnabled=Boolean(criteria?.from&&postcodeDistrict(criteria.from));
 const matching=criteria?loads.filter(l=>{
  if(l.status!=="Open")return false;
  if(criteria.from){
   if(radiusEnabled){
    const destination=positions[postcodeDistrict(l.from)];
    if(!origin||!destination||approximateMiles(origin,destination)>Number(criteria.radius))return false;
   }else if(!l.from.toLowerCase().includes(criteria.from.toLowerCase()))return false;
  }
  if(criteria.to&&!l.to.toLowerCase().includes(criteria.to.toLowerCase()))return false;
  if(criteria.vehicle&&!l.vehicle.toLowerCase().includes(criteria.vehicle.toLowerCase()))return false;
  if(criteria.service&&!String(l.service||"").toLowerCase().includes(criteria.service.toLowerCase()))return false;
  if(criteria.date&&l.pickupDate!==criteria.date)return false;
  return true;
 }).slice(0,50):[];
 const clear=async()=>{
  if(!actor)return;
  try{
   const r=await fetch("/api/autonomous/v1/saved-search?context=owner-alert",{method:"DELETE",credentials:"same-origin"});
   if(!r.ok)throw Error("Could not remove the saved alert");
   setCriteria(null);setNotice("Saved alert criteria deleted from this account's isolated ledger.");
   window.dispatchEvent(new Event("xdrive-owner-alert-saved"));
  }catch(e){setNotice(e instanceof Error?e.message:"Could not delete saved alert")}
 };
 return <section className="xd-board">
  <header className="xd-board-head"><h1>Loads · My Alerts</h1>
   <p>Only available loads matching your saved search are shown here. Find Loads is the complete searchable Exchange.</p>
   <div className="actions"><button className="primary" onClick={onFindLoads}>Find Loads / Edit Search</button>
    {criteria&&<button className="outline" onClick={()=>void clear()}>Clear Saved Alerts</button>}</div>
  </header>
  {error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
  {!actor&&<p className="notice">Choose an isolated local driver account before managing alerts.</p>}
  {actor&&!criteria&&<div className="panel"><h3>No saved alerts</h3>
   <p>Open Find Loads, choose collection, radius, vehicle or service filters, and select Save Alert Search. Your search is stored under this signed local test account, not only this browser.</p>
   <button onClick={onFindLoads}>Open Find Loads</button></div>}
  {criteria&&<div className="panel"><p><b>Saved search:</b> {criteria.from||"Any collection"} · {criteria.to||"Any destination"} · {criteria.vehicle||"Any vehicle"} · {criteria.service||"Any service"} · {criteria.radius} miles</p>
   <p>{loading?"Resolving postcode-district centres…":matching.length+" matching available loads."} UK postcode radius is approximate, not driving mileage.</p></div>}
  <div className="xd-board-results">{matching.map(l=><XDriveLoadCard key={l.id} data={{id:l.id,from:l.from,to:l.to,date:l.pickupDate||l.postedAt.slice(0,10),status:l.service||"Open",vehicle:l.vehicle,cargo:l.pallets+" pallets",weight:l.weight+" kg",company:l.customer,paymentTerms:l.paymentTerms}}
   onDetails={()=>onFocusLoad(l.id,"details")} actions={<button className="quote" onClick={()=>onFocusLoad(l.id,"quote")}>Quote Now</button>}/>)}
   {criteria&&matching.length===0&&!loading&&<p>No available loads match your saved criteria at this time.</p>}
  </div>
 </section>;
}
