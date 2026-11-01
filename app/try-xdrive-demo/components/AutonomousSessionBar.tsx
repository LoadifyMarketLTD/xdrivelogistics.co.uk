"use client";

import {useEffect,useState} from "react";
import Link from "next/link";
import {markAutonomousLocalActor} from "../../../lib/try-xdrive-demo/authenticatedFetch";
import "./autonomous-session-bar.css";

type Persona={id:string;name:string;companyName:string;role:string};
type Session={actor:Persona|null;personas:Persona[];mode:string};
const empty:Session={actor:null,personas:[],mode:"LOCAL TEST"};
const permitted:Record<string,string[]>={
 "buyer-a":["buyer-a","carrier-b"],"customer-a":["customer-a","buyer-c"],
 "broker-c":["broker-c"],"fleet-b":["fleet-b","carrier-b"],
 "dispatcher-b":["dispatcher-b"],"owner-driver-d":["owner-driver-d"],
 "company-driver-b":["company-driver-b","driver-b"]
};

export default function AutonomousSessionBar({preferredPersona="buyer-a"}:{preferredPersona?:string}){
 const [session,setSession]=useState<Session>(empty);
 const [choice,setChoice]=useState(preferredPersona);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 useEffect(()=>{
  let active=true;
  fetch("/api/autonomous/v1/session",{cache:"no-store",credentials:"same-origin"}).then(r=>r.json())
   .then((value:Session)=>{if(active){markAutonomousLocalActor(Boolean(value.actor));setSession(value);if(value.actor)setChoice(value.actor.id);window.dispatchEvent(new Event("xdrive-demo-session-change"))}})
   .catch(()=>{if(active)setError("Autonomous test session service unavailable")});
  return()=>{active=false};
 },[]);
 const select=async(id:string)=>{
  setBusy(true);setError("");
  try{
   const r=await fetch("/api/autonomous/v1/session",{method:"POST",credentials:"same-origin",
    headers:{"Content-Type":"application/json"},body:JSON.stringify({persona:id})});
   const data=await r.json() as {actor?:Persona;error?:string};
   if(!r.ok||!data.actor)throw Error(data.error||"Unable to select local workspace");
   markAutonomousLocalActor(true);setSession(v=>({...v,actor:data.actor||null}));setChoice(id);
   for(const name of ["xdrive-demo-session-change","xdrive-demo-loads-changed","xdrive-demo-quote-change","xdrive-demo-booking-change"])
    window.dispatchEvent(new Event(name));
  }catch(e){setError(e instanceof Error?e.message:"Session unavailable")}
  finally{setBusy(false)}
 };
 return <div className="xd-autonomous-session" role="region" aria-label="Isolated XDrive local test environment">
  <span className="xd-autonomous-label">NEW XDRIVE · ISOLATED LOCAL TEST</span>
  <label>Workspace
   <select aria-label="Autonomous local workspace" value={choice} onChange={e=>setChoice(e.target.value)}>
    {(session.personas.length?session.personas:[{id:preferredPersona,name:"LOCAL TEST ACCOUNT",companyName:"Local",role:"company"}]).filter(a=>!permitted[preferredPersona]||permitted[preferredPersona].includes(a.id)).map(a=>
      <option key={a.id} value={a.id}>{a.name}</option>)}
   </select>
  </label>
  <button disabled={busy} onClick={()=>void select(choice)}>{busy?"Selecting…":session.actor?.id===choice?"Refresh session":"Use workspace"}</button>
  <Link href="/autonomous-driver">New Driver PWA</Link>
  <span className="xd-autonomous-current">{session.actor?"Signed in: "+session.actor.name:"No test workspace selected"}</span>
  {error&&<span className="xd-autonomous-error" role="alert">{error}</span>}
 </div>;
}
