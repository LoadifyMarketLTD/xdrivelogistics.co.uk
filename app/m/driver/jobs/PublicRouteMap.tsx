'use client';
import { useEffect, useRef, useState } from 'react';
import 'leaflet/dist/leaflet.css';
import { readRouteAuthAccessToken } from '../../../../lib/routeAuthCookie';

type Point = {latitude:number;longitude:number};
type PublicRoute = {geometry:{type:'LineString';coordinates:number[][]};distanceMiles:number;durationMinutes:number};
const outcode=(value:string)=>value.trim().toUpperCase().match(/^[A-Z]{1,2}\d[A-Z\d]?/)?.[0]||'';
async function centroid(value:string):Promise<Point|null>{
 const code=outcode(value);if(!code)return null;
 try {const token=readRouteAuthAccessToken();if(!token)return null;
  const response=await fetch(`/api/driver/web/public-outcode?outcode=${encodeURIComponent(code)}`,{headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(8000)});
  if(!response.ok)return null;
  const json=await response.json();const {latitude,longitude}=json;
  return Number.isFinite(latitude)&&Number.isFinite(longitude)?{latitude,longitude}:null;
 }catch{return null;}
}
async function drivingRoute(start:Point,end:Point):Promise<PublicRoute|null>{
 try {
  const token=readRouteAuthAccessToken();if(!token)return null;
  const params=new URLSearchParams({aLat:String(start.latitude),aLng:String(start.longitude),bLat:String(end.latitude),bLng:String(end.longitude)});
  const response=await fetch(`/api/driver/web/public-route?${params}`,{headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(11000)});
  if(!response.ok)return null;
  const data=await response.json() as PublicRoute;
  if(data.geometry?.type!=='LineString'||!Array.isArray(data.geometry.coordinates)||data.geometry.coordinates.length<2)return null;
  return data;
 }catch{return null;}
}
export default function PublicRouteMap({pickup,delivery}:{pickup:string;delivery:string}){
 const container=useRef<HTMLDivElement>(null);
 const [note,setNote]=useState('Loading collection and delivery areas...');
 const [ready,setReady]=useState(false);
 useEffect(()=>{
  let cancelled=false;let map:import('leaflet').Map|null=null;
  setReady(false);
  (async()=>{
   const [start,end]=await Promise.all([centroid(pickup),centroid(delivery)]);
   if(cancelled||!container.current)return;
   if(!start||!end){setNote('Map unavailable: collection or delivery area could not be located.');return;}
   const route=await drivingRoute(start,end);
   if(cancelled||!container.current)return;
   const L=await import('leaflet');if(cancelled||!container.current)return;
   map=L.map(container.current,{zoomControl:true,scrollWheelZoom:false});
   L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap contributors',maxZoom:18}).addTo(map);
   const a=L.latLng(start.latitude,start.longitude),b=L.latLng(end.latitude,end.longitude);
   L.circleMarker(a,{radius:9,color:'#14559b',fillColor:'#14559b',fillOpacity:1}).addTo(map).bindPopup(`Collection area ${outcode(pickup)}`);
   L.circleMarker(b,{radius:9,color:'#76a918',fillColor:'#76a918',fillOpacity:1}).addTo(map).bindPopup(`Delivery area ${outcode(delivery)}`);
   const coords=route?.geometry.coordinates.filter(pair=>Array.isArray(pair)&&pair.length>=2&&Number.isFinite(pair[0])&&Number.isFinite(pair[1])).map(pair=>L.latLng(pair[1],pair[0]))??[];
   if(coords.length>=2){
    const line=L.polyline(coords,{color:'#1476d4',weight:5,opacity:0.85}).addTo(map);
    map.fitBounds(line.getBounds().pad(0.16));
    setNote(`Approximate driving route between ${outcode(pickup)} and ${outcode(delivery)} areas: ${route?.distanceMiles} miles, about ${route?.durationMinutes} minutes. Actual addresses and journey may differ.`);
   }else{
    map.fitBounds(L.latLngBounds([a,b]).pad(0.35));
    setNote('Driving route unavailable. Showing approximate collection and delivery areas only.');
   }
   setReady(true);
   requestAnimationFrame(()=>map?.invalidateSize());
  })().catch(()=>{if(!cancelled)setNote('Map is temporarily unavailable.');});
  return()=>{cancelled=true;map?.remove();};
 },[pickup,delivery]);
 return <><div ref={container} className="xd-public-route-map" style={{height:ready?300:0,minHeight:0,marginTop:ready?10:0}} role="img" aria-label="Approximate road route between public collection and delivery areas"/><p className="xd-public-map-note" role="status">{note}</p></>;
}
