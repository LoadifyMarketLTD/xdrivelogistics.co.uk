"use client";
import {useEffect,useState} from "react";
import {authenticatedDemoFetch,getAutonomousSessionEpoch} from "../../../lib/try-xdrive-demo/authenticatedFetch";
export type DemoLoad={id:string;from:string;to:string;vehicle:string;pallets:string;weight:string;customer:string;sell:string;pickupDate?:string;deliveryDate?:string;pickupStart?:string;pickupEnd?:string;deliveryTime?:string;deliveryMode?:string;service?:string;packaging?:string;dimensions?:string;notes?:string;hardPod?:boolean;paymentTerms?:string;body?:string;postedAt:string;status:"Open"|"Awarded"|"Cancelled";quote?:number;driver?:string;awardedQuoteId?:string;acceptanceStatus?:"Pending"|"Accepted"|"Rejected";acceptanceAt?:string;awardHistory?:{quoteId:string;role:string;amount:number;awardedAt:string;decision?:string;decisionAt?:string}[];assignedDriver?:string;assignedVehicleId?:string;deliveryStage?:number;podReceived?:boolean;podRecipient?:string;podPhotoCount?:number;podConfirmedAt?:string;readOnly?:boolean;operationalStatus?:string;buyerCompanyId?:string;carrierCompanyId?:string;privatePickupAddress?:string;privateDeliveryAddress?:string;};
const event="xdrive-demo-loads-changed";
let cache:DemoLoad[]=[];
let currentLoadRequest=0;
export function getDemoLoads(){return cache}
export function useExchangeLoads(){
 const [loads,setLoads]=useState<DemoLoad[]>([]);
 const [error,setError]=useState("");
 useEffect(()=>{
  let active=true,version=0;
  const refresh=async()=>{
   const myVersion=++version,epoch=getAutonomousSessionEpoch();
   try{
    const response=await authenticatedDemoFetch("/api/try-xdrive-demo/loads?view=exchange",{cache:"no-store"});
    if(!response.ok){const details=await response.json().catch(()=>({})) as {error?:string};throw new Error(response.status===401?"Authentication required":details.error||"Exchange loads unavailable")}
    const result:unknown=await response.json();
    if(active&&myVersion===version&&epoch===getAutonomousSessionEpoch()){setLoads(Array.isArray(result)?result:[]);setError("")}
   }catch(e){if(active&&myVersion===version&&epoch===getAutonomousSessionEpoch()){setLoads([]);setError(e instanceof Error?e.message:"Unable to retrieve exchange")}}
  };
  void refresh();
  const timer=setInterval(()=>void refresh(),4000);
  const onSession=()=>{if(active){setLoads([]);setError("")}void refresh()};
  window.addEventListener("xdrive-demo-session-change",onSession);
  return()=>{active=false;clearInterval(timer);window.removeEventListener("xdrive-demo-session-change",onSession)};
 },[]);
 return {loads,error};
}
export function useDemoBookings(){
 const [loads,setLoads]=useState<DemoLoad[]>([]);
 const [error,setError]=useState("");
 useEffect(()=>{
  let active=true,version=0;
  const refresh=async()=>{
   const myVersion=++version,epoch=getAutonomousSessionEpoch();
   try{
    const response=await authenticatedDemoFetch("/api/try-xdrive-demo/loads?view=bookings",{cache:"no-store"});
    if(!response.ok)throw new Error("Bookings unavailable");
    const result:unknown=await response.json();
    if(active&&myVersion===version&&epoch===getAutonomousSessionEpoch()){setLoads(Array.isArray(result)?result:[]);setError("")}
   }catch(e){if(active&&myVersion===version&&epoch===getAutonomousSessionEpoch()){setLoads([]);setError(e instanceof Error?e.message:"Booking lookup failed")}}
  };
  void refresh();const timer=setInterval(()=>void refresh(),4000);
  const onSession=()=>{if(active){setLoads([]);setError("")}void refresh()};window.addEventListener("xdrive-demo-booking-change",refresh);window.addEventListener("xdrive-demo-session-change",onSession);
  return()=>{active=false;clearInterval(timer);window.removeEventListener("xdrive-demo-booking-change",refresh);window.removeEventListener("xdrive-demo-session-change",onSession)};
 },[]);
 return {loads,error};
}
export async function refreshDemoLoads(){
 const epoch=getAutonomousSessionEpoch(),request=++currentLoadRequest;
 const response=await authenticatedDemoFetch("/api/try-xdrive-demo/loads",{cache:"no-store"});
 if(!response.ok)throw Error("Transport requests unavailable");
 const result=await response.json() as DemoLoad[];
 if(epoch!==getAutonomousSessionEpoch()||request!==currentLoadRequest)throw Error("Stale local account response discarded");
 cache=Array.isArray(result)?result:[];
 window.dispatchEvent(new Event(event));return cache;
}
export async function publishDemoLoad(data:Omit<DemoLoad,"id"|"postedAt"|"status">){const response=await authenticatedDemoFetch("/api/try-xdrive-demo/loads",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(data)});if(!response.ok)throw Error("Could not save transport request");const load:DemoLoad=await response.json();const published=await authenticatedDemoFetch("/api/try-xdrive-demo/loads",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:load.id,status:"posted"})});if(!published.ok){const details=await published.json().catch(()=>({})) as {error?:string};throw Error("Draft saved but publishing failed: "+(details.error||"Unknown error")+". Do not resubmit; review the draft first.")}await refreshDemoLoads();return {...load,status:"Open" as const}}
export async function updateDemoLoad(id:string,patch:Partial<DemoLoad>){
 if(patch.status!=="Cancelled"||Object.keys(patch).length!==1)throw Error("This booking action is not yet supported. No change was saved.");
 const response=await authenticatedDemoFetch("/api/try-xdrive-demo/loads",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({id,status:"cancelled"})});
 if(!response.ok){const payload=await response.json().catch(()=>({})) as {error?:string};throw Error(payload.error||"Could not cancel transport request")}
 await refreshDemoLoads();
}
export function useDemoLoads(){const [loads,setLoads]=useState<DemoLoad[]>(cache);useEffect(()=>{let active=true;const sync=()=>{if(active)setLoads([...cache])};const refresh=()=>{refreshDemoLoads().catch(()=>{})};const onPersonaChange=()=>{cache=[];sync();refresh()};refresh();window.addEventListener(event,sync);window.addEventListener("xdrive-demo-session-change",onPersonaChange);const timer=setInterval(refresh,4000);return()=>{active=false;window.removeEventListener(event,sync);window.removeEventListener("xdrive-demo-session-change",onPersonaChange);clearInterval(timer)}},[]);return loads}
