"use client";
import {useEffect,useState} from "react";
export type DemoLoad={id:string;from:string;to:string;vehicle:string;pallets:string;weight:string;customer:string;sell:string;postedAt:string;status:"Open"|"Awarded"|"Cancelled";quote?:number;driver?:string};
const KEY="xdrive-try-demo-loads-v1";
const event="xdrive-demo-loads-changed";
export function getDemoLoads():DemoLoad[]{if(typeof window==="undefined")return [];try{const v=JSON.parse(localStorage.getItem(KEY)||"[]");return Array.isArray(v)?v:[]}catch{return []}}
export function saveDemoLoads(loads:DemoLoad[]){localStorage.setItem(KEY,JSON.stringify(loads));window.dispatchEvent(new Event(event))}
export function publishDemoLoad(data:Omit<DemoLoad,"id"|"postedAt"|"status">){const load:DemoLoad={...data,id:"XDL-DEMO-"+Date.now(),postedAt:new Date().toISOString(),status:"Open"};saveDemoLoads([load,...getDemoLoads()]);return load}
export function updateDemoLoad(id:string,patch:Partial<DemoLoad>){saveDemoLoads(getDemoLoads().map(x=>x.id===id?{...x,...patch}:x))}
export function useDemoLoads(){const [loads,setLoads]=useState<DemoLoad[]>([]);useEffect(()=>{const sync=()=>setLoads(getDemoLoads());sync();window.addEventListener("storage",sync);window.addEventListener(event,sync);return()=>{window.removeEventListener("storage",sync);window.removeEventListener(event,sync)}},[]);return loads}
