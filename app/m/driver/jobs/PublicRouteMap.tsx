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
 const mapRef=useRef<import('leaflet').Map|null>(null);
 const positionMarker=useRef<import('leaflet').CircleMarker|null>(null);
 const [note,setNote]=useState('Loading collection and delivery areas...');
 const [error,setError]=useState(false);
 const [locationMessage,setLocationMessage]=useState('');
 const [locating,setLocating]=useState(false);
 useEffect(()=>{
  let cancelled=false;
  setError(false);
  setNote('Loading collection and delivery areas...');
  (async()=>{
   const [start,end]=await Promise.all([centroid(pickup),centroid(delivery)]);
   if(cancelled||!container.current)return;
   if(!start||!end){setError(true);setNote('Map unavailable: collection or delivery area could not be located.');return;}
   const L=await import('leaflet');if(cancelled||!container.current)return;
   // Leaflet must be initialized inside a visible, nonzero-height container.
   const map=L.map(container.current,{zoomControl:true,scrollWheelZoom:false});
   mapRef.current=map;
   L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap contributors',maxZoom:18}).addTo(map);
   const a=L.latLng(start.latitude,start.longitude),b=L.latLng(end.latitude,end.longitude);
   L.circleMarker(a,{radius:9,color:'#14559b',fillColor:'#14559b',fillOpacity:1}).addTo(map).bindPopup(`Collection area ${outcode(pickup)}`);
   L.circleMarker(b,{radius:9,color:'#76a918',fillColor:'#76a918',fillOpacity:1}).addTo(map).bindPopup(`Delivery area ${outcode(delivery)}`);
   map.fitBounds(L.latLngBounds([a,b]).pad(0.4));
   requestAnimationFrame(()=>{if(!cancelled)map.invalidateSize();});
   setNote('Showing approximate collection and delivery areas. Calculating driving route...');
   const route=await drivingRoute(start,end);
   if(cancelled)return;
   const coords=route?.geometry.coordinates.filter(pair=>Array.isArray(pair)&&pair.length>=2&&Number.isFinite(pair[0])&&Number.isFinite(pair[1])).map(pair=>L.latLng(pair[1],pair[0]))??[];
   if(coords.length>=2){
    const line=L.polyline(coords,{color:'#1476d4',weight:5,opacity:0.85}).addTo(map);
    map.fitBounds(line.getBounds().pad(0.18));
    setNote(`Driving route between approximate ${outcode(pickup)} and ${outcode(delivery)} areas: ${route?.distanceMiles} miles, about ${route?.durationMinutes} minutes. Exact job addresses are not shown before allocation.`);
   }else{
    setNote('Driving route unavailable. Collection and delivery markers represent postcode areas, not exact job addresses.');
   }
  })().catch(()=>{if(!cancelled){setError(true);setNote('Map is temporarily unavailable.');}});
  return()=>{cancelled=true;mapRef.current?.remove();mapRef.current=null;positionMarker.current=null;};
 },[pickup,delivery]);
 const locate=()=>{
  if(!navigator.geolocation){setLocationMessage('Location is not supported by this browser.');return;}
  setLocating(true);setLocationMessage('Requesting your location...');
  navigator.geolocation.getCurrentPosition(async position=>{
   setLocating(false);
   const map=mapRef.current;
   if(!map){setLocationMessage('Map is still loading. Please try again.');return;}
   const L=await import('leaflet');
   const here=L.latLng(position.coords.latitude,position.coords.longitude);
   positionMarker.current?.remove();
   positionMarker.current=L.circleMarker(here,{radius:10,color:'#ffffff',weight:3,fillColor:'#177bff',fillOpacity:1}).addTo(map).bindPopup('Your current location');
   map.panTo(here,{animate:true});
   setLocationMessage(`Your location shown (accuracy about ${Math.round(position.coords.accuracy)} m). Tap the marker to view it.`);
  },err=>{
   setLocating(false);
   setLocationMessage(err.code===1?'Location permission denied. Enable location for this website in your phone settings.':'Unable to locate you. Check GPS and browser location settings.');
  },{enableHighAccuracy:true,timeout:12000,maximumAge:30000});
 };
 return <section className="xd-public-map-section">
  {!error?<div ref={container} className="xd-public-route-map" style={{height:320,minHeight:320,marginTop:10,width:'100%'}} role="img" aria-label="Approximate driving route between collection and delivery postcode areas"/>:null}
  {!error?<button type="button" onClick={locate} disabled={locating} style={{minHeight:44,marginTop:10,padding:'8px 14px',border:'1px solid #d9d9d9',borderRadius:4,background:'#fff',fontWeight:700}}>{locating?'Locating...':'Show my location'}</button>:null}
  {locationMessage?<p role="status" className="xd-public-map-note">{locationMessage}</p>:null}
  <p role="status" className="xd-public-map-note">{note}</p>
 </section>;
}
