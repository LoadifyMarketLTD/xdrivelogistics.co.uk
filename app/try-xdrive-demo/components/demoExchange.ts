"use client";
import {useEffect,useState} from "react";
export type DemoLoad={id:string;from:string;to:string;vehicle:string;pallets:string;weight:string;customer:string;sell:string;postedAt:string;status:"Open"|"Awarded"|"Cancelled";quote?:number;driver?:string};
const event="xdrive-demo-loads-changed";
let cache:DemoLoad[]=[];
export function getDemoLoads(){return cache}
export async function refreshDemoLoads(){const response=await fetch("/api/try-xdrive-demo/loads",{cache:"no-store"});if(!response.ok)throw Error("Demo exchange unavailable");cache=await response.json();window.dispatchEvent(new Event(event));return cache}
export async function publishDemoLoad(data:Omit<DemoLoad,"id"|"postedAt"|"status">){const response=await fetch("/api/try-xdrive-demo/loads",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(data)});if(!response.ok)throw Error("Could not publish demo load");const load:DemoLoad=await response.json();await refreshDemoLoads();return load}
export async function updateDemoLoad(id:string,patch:Partial<DemoLoad>){const response=await fetch("/api/try-xdrive-demo/loads",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({id,patch})});if(!response.ok)throw Error("Could not update demo load");await refreshDemoLoads()}
export function useDemoLoads(){const [loads,setLoads]=useState<DemoLoad[]>(cache);useEffect(()=>{let active=true;const sync=()=>{if(active)setLoads([...cache])};const refresh=()=>{refreshDemoLoads().catch(()=>{})};refresh();window.addEventListener(event,sync);const timer=setInterval(refresh,4000);return()=>{active=false;window.removeEventListener(event,sync);clearInterval(timer)}},[]);return loads}
