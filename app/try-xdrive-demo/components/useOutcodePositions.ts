"use client";
import {useEffect,useState} from "react";
export type DistrictPoint={outcode:string;latitude:number;longitude:number;approximate:true};
export function postcodeDistrict(raw:string){
 const matches=[...raw.toUpperCase().matchAll(/\b([A-Z]{1,2}\d[A-Z\d]?)(?:\s*\d[A-Z]{2})?\b/g)];
 return matches.length?matches[matches.length-1][1]:"";
}
export function approximateMiles(a:DistrictPoint,b:DistrictPoint){
 const rad=Math.PI/180,dLat=(a.latitude-b.latitude)*rad,dLon=(a.longitude-b.longitude)*rad;
 const value=Math.sin(dLat/2)**2+Math.cos(a.latitude*rad)*Math.cos(b.latitude*rad)*Math.sin(dLon/2)**2;
 return 3958.7613*2*Math.asin(Math.min(1,Math.sqrt(value)));
}
export function useOutcodePositions(locations:string[]){
 const keys=[...new Set(locations.map(postcodeDistrict).filter(Boolean))].slice(0,40);
 const [positions,setPositions]=useState<Record<string,DistrictPoint|null>>({});
 const [loading,setLoading]=useState(false);
 const joined=keys.join("|");
 useEffect(()=>{
  if(process.env.NEXT_PUBLIC_XDRIVE_AUTONOMOUS_DEMO!=="1"||!keys.length)return;
  let active=true;setLoading(true);
  void Promise.all(keys.map(async key=>{
   try{
    const r=await fetch("/api/autonomous/v1/geocode?area="+encodeURIComponent(key),{credentials:"same-origin",cache:"no-store"});
    if(!r.ok)return [key,null] as const;
    return [key,await r.json() as DistrictPoint] as const;
   }catch{return [key,null] as const}
  })).then(results=>{if(active)setPositions(old=>({...old,...Object.fromEntries(results)}))})
   .finally(()=>{if(active)setLoading(false)});
  return()=>{active=false};
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[joined]);
 return {positions,loading};
}
