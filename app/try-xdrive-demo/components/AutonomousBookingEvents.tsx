"use client";
import {useEffect,useState} from "react";
import {getAutonomousSessionEpoch} from "../../../lib/try-xdrive-demo/authenticatedFetch";
type EventRow={actor_id:string;kind:string;created_at:string;detail:string};
export default function AutonomousBookingEvents({jobId}:{jobId:string}){
 const [events,setEvents]=useState<EventRow[]>([]),[error,setError]=useState("");
 useEffect(()=>{
  let active=true,version=0;
  const refresh=async()=>{
   const request=++version,epoch=getAutonomousSessionEpoch();
   const current=()=>active&&request===version&&epoch===getAutonomousSessionEpoch();
   try{
    const r=await fetch("/api/autonomous/v1/loads/"+encodeURIComponent(jobId),{cache:"no-store",credentials:"same-origin"});
    if(!r.ok)throw Error(r.status===403?"This booking is not assigned to your account":"Event history unavailable");
    const data=await r.json() as {events?:EventRow[]};
    if(current()){setEvents(data.events||[]);setError("")}
   }catch(e){if(current()){setEvents([]);setError(e instanceof Error?e.message:"Cannot read events")}}
  };
  const onSession=()=>{
   version++;setEvents([]);setError("");
   void refresh();
  };
  void refresh();
  window.addEventListener("xdrive-demo-booking-change",refresh);
  window.addEventListener("xdrive-demo-session-change",onSession);
  return()=>{
   active=false;version++;
   window.removeEventListener("xdrive-demo-booking-change",refresh);
   window.removeEventListener("xdrive-demo-session-change",onSession);
  }
 },[jobId]);
 return <section className="panel" aria-label="Booking event history">
  <h3>Verified Booking Timeline</h3>{error&&<p role="alert">{error}</p>}
  {events.length===0&&!error&&<p>No recorded events for this job.</p>}
  {events.map((e,i)=><p key={i}><strong>{e.kind.replaceAll("_"," ")}</strong> · {new Date(e.created_at).toLocaleString("en-GB")} · Actor {e.actor_id}</p>)}
 </section>;
}
