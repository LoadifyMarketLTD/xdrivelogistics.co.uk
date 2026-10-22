'use client';
import { useEffect, useRef, useState } from 'react';
import 'leaflet/dist/leaflet.css';
import {readRouteAuthAccessToken} from '../../../../lib/routeAuthCookie';

type Point = {latitude:number;longitude:number};
const outcode=(value:string)=>value.trim().toUpperCase().match(/^[A-Z]{1,2}\d[A-Z\d]?/)?.[0]||'';
async function centroid(value:string):Promise<Point|null>{
 const code=outcode(value);if(!code)return null;
 try {const token=readRouteAuthAccessToken();if(!token)return null;const response=await fetch(`/api/driver/web/public-outcode?outcode=${encodeURIComponent(code)}`,{headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(8000)});
  if(!response.ok)return null;
  const json=await response.json();const {latitude,longitude}=json;
  return Number.isFinite(latitude)&&Number.isFinite(longitude)?{latitude,longitude}:null;
 }catch{return null;}
}
export default function PublicRouteMap({pickup,delivery}:{pickup:string;delivery:string}){
 const container=useRef<HTMLDivElement>(null);
 const [note,setNote]=useState('Loading public route areas...');
 const [ready,setReady]=useState(false);
 useEffect(()=>{
  let cancelled=false;let map:import('leaflet').Map|null=null;
  setReady(false);
  (async()=>{
   const [start,end]=await Promise.all([centroid(pickup),centroid(delivery)]);
   if(cancelled||!container.current)return;
   if(!start||!end){setNote('Map unavailable: one or both public areas could not be located.');return;}
   const L=await import('leaflet');if(cancelled||!container.current)return;
   map=L.map(container.current,{zoomControl:true});
   L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap contributors',maxZoom:18}).addTo(map);
   const a=L.latLng(start.latitude,start.longitude),b=L.latLng(end.latitude,end.longitude);
   L.circleMarker(a,{radius:9,color:'#1d5590',fillOpacity:1}).addTo(map).bindPopup(`Collection area ${outcode(pickup)}`);
   L.circleMarker(b,{radius:9,color:'#76a918',fillOpacity:1}).addTo(map).bindPopup(`Delivery area ${outcode(delivery)}`);
   map.fitBounds(L.latLngBounds([a,b]).pad(0.35));
   setReady(true);
   requestAnimationFrame(()=>map?.invalidateSize());
   setNote('Approximate public-area markers only. This is not a calculated driving route.');
  })();
  return()=>{cancelled=true;map?.remove();};
 },[pickup,delivery]);
 return <><div ref={container} className="xd-public-route-map" style={{height:ready?270:0,minHeight:0,marginTop:ready?10:0}} role="img" aria-label="Approximate public collection and delivery locations"/><p className="xd-public-map-note">{note}</p></>;
}
