"use client";
import {useEffect,useState} from "react";
import {useCompany3150Live} from "./Company3150LiveData";
import {useMasterPreviewIsolation} from "./MasterPreviewIsolation";
import {authenticatedDemoFetch} from "../../../lib/try-xdrive-demo/authenticatedFetch";
export type DemoLoad={displayId?:string;memberId?:string;id:string;from:string;to:string;vehicle:string;pallets:string;weight:string;customer:string;sell:string;pickupDate?:string;deliveryDate?:string;pickupStart?:string;pickupEnd?:string;deliveryTime?:string;deliveryMode?:string;service?:string;packaging?:string;dimensions?:string;notes?:string;hardPod?:boolean;paymentTerms?:string;body?:string;postedAt:string;status:"Open"|"Awarded"|"Cancelled";quote?:number;driver?:string;awardedQuoteId?:string;acceptanceStatus?:"Pending"|"Accepted"|"Rejected";acceptanceAt?:string;awardHistory?:{quoteId:string;role:string;amount:number;awardedAt:string;decision?:string;decisionAt?:string}[];assignedDriver?:string;assignedVehicleId?:string;deliveryStage?:number;podReceived?:boolean;podRecipient?:string;podPhotoCount?:number;podConfirmedAt?:string;readOnly?:boolean;operationalStatus?:string};
const event="xdrive-demo-loads-changed";
let cache:DemoLoad[]=[];
export function getDemoLoads(){return cache}
export function useExchangeLoads(){
 const ctx=useCompany3150Live();
 const isolated=useMasterPreviewIsolation();
 const [loads,setLoads]=useState<DemoLoad[]>([]);
 const [error,setError]=useState("");
 useEffect(()=>{
  if(ctx||isolated)return;
  let active=true;
  const refresh=async()=>{
   try{
    const response=await authenticatedDemoFetch("/api/try-xdrive-demo/loads?view=exchange",{cache:"no-store"});
    if(!response.ok){const details=await response.json().catch(()=>({})) as {error?:string};throw new Error(response.status===401?"Authentication required":details.error||"Exchange loads unavailable")}
    const result:unknown=await response.json();
    if(active){setLoads(Array.isArray(result)?result:[]);setError("")}
   }catch(e){if(active){setLoads([]);setError(e instanceof Error?e.message:"Unable to retrieve exchange")}}
  };
  void refresh();
  const timer=setInterval(()=>void refresh(),4000);
  window.addEventListener("xdrive-demo-session-change",refresh);
  return()=>{active=false;clearInterval(timer);window.removeEventListener("xdrive-demo-session-change",refresh)};
 },[ctx,isolated]);
 return {loads:ctx?.loads??(isolated?[]:loads),error:ctx?ctx.data.error:isolated?"":error};
}
export function useDemoBookings(){
 const ctx=useCompany3150Live();
 const isolated=useMasterPreviewIsolation();
 const [loads,setLoads]=useState<DemoLoad[]>([]);
 const [error,setError]=useState("");
 useEffect(()=>{
  if(ctx||isolated)return;
  let active=true;
  const refresh=async()=>{
   try{
    const response=await authenticatedDemoFetch("/api/try-xdrive-demo/loads?view=bookings",{cache:"no-store"});
    if(!response.ok)throw new Error("Bookings unavailable");
    const result:unknown=await response.json();
    if(active){setLoads(Array.isArray(result)?result:[]);setError("")}
   }catch(e){if(active){setLoads([]);setError(e instanceof Error?e.message:"Booking lookup failed")}}
  };
  void refresh();const timer=setInterval(()=>void refresh(),4000);
  window.addEventListener("xdrive-demo-booking-change",refresh);
  return()=>{active=false;clearInterval(timer);window.removeEventListener("xdrive-demo-booking-change",refresh)};
 },[ctx,isolated]);
 return {loads:ctx?.bookings??(isolated?[]:loads),error:ctx?ctx.data.error:isolated?"":error};
}
export async function refreshDemoLoads(){const response=await authenticatedDemoFetch("/api/try-xdrive-demo/loads",{cache:"no-store"});if(!response.ok)throw Error("XDrive marketplace unavailable");cache=await response.json();window.dispatchEvent(new Event(event));return cache}
export async function publishDemoLoad(data:Omit<DemoLoad,"id"|"postedAt"|"status">){const response=await authenticatedDemoFetch("/api/try-xdrive-demo/loads",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(data)});if(!response.ok)throw Error("Load could not be saved");const load:DemoLoad=await response.json();const published=await authenticatedDemoFetch("/api/try-xdrive-demo/loads",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:load.id,status:"posted"})});if(!published.ok){const details=await published.json().catch(()=>({})) as {error?:string};throw Error("Draft saved but publishing failed: "+(details.error||"Unknown error")+". Do not resubmit; review the draft first.")}await refreshDemoLoads();return {...load,status:"Open" as const}}
export async function updateDemoLoad(id:string,patch:Partial<DemoLoad>){
 if(patch.status!=="Cancelled"||Object.keys(patch).length!==1)throw Error("This booking operation is not supported by the current authenticated endpoint. No change was saved.");
 const response=await authenticatedDemoFetch("/api/try-xdrive-demo/loads",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({id,status:"cancelled"})});
 if(!response.ok){const payload=await response.json().catch(()=>({})) as {error?:string};throw Error(payload.error||"Could not cancel demo load")}
 await refreshDemoLoads();
}
export function useDemoLoads(disabled=false){const ctx=useCompany3150Live();const isolated=useMasterPreviewIsolation();const [loads,setLoads]=useState<DemoLoad[]>(cache);useEffect(()=>{if(ctx||isolated||disabled)return;let active=true;const sync=()=>{if(active)setLoads([...cache])};const refresh=()=>{refreshDemoLoads().catch(()=>{})};refresh();window.addEventListener(event,sync);const timer=setInterval(refresh,4000);return()=>{active=false;window.removeEventListener(event,sync);clearInterval(timer)}},[ctx,isolated,disabled]);return disabled?[]:ctx?.loads??(isolated?[]:loads)}
