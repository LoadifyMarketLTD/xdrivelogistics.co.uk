'use client';
import {useEffect,useRef,useState} from 'react';
import 'leaflet/dist/leaflet.css';
import {readRouteAuthHeader} from '../../../lib/routeAuthCookie';
type Stop={label:string;area:string;when:string};
type Point={latitude:number;longitude:number};
type Leg={geometry:{coordinates:number[][]};distanceMiles:number;durationMinutes:number};
export default function QuotePublicRouteMap({stops}:{stops:Stop[]}){
 const host=useRef<HTMLDivElement>(null);
 const [legs,setLegs]=useState<(Leg|null)[]>([]);
 const [notice,setNotice]=useState('Loading approximate driving route...');
 const key=JSON.stringify(stops);
 useEffect(()=>{
 let disposed=false; let map:import('leaflet').Map|undefined;
 const run=async()=>{
 try{
 const items=JSON.parse(key) as Stop[];
 const auth=await readRouteAuthHeader(); if(!auth) throw Error('Authorisation unavailable');
 const headers={Authorization:auth};
 const codes=items.map(s=>s.area.toUpperCase().match(/\b[A-Z]{1,2}\d[A-Z\d]?\b/g)?.at(-1));
 if(codes.some(c=>!c))throw Error('Public postcode unavailable');
 const points=await Promise.all(codes.map(async code=>{
 const res=await fetch('/api/driver/web/public-outcode?outcode='+encodeURIComponent(code!),{headers,signal:AbortSignal.timeout(10000)});
 if(!res.ok)throw Error('Public area unavailable');
 return await res.json() as Point;
 }));
 const L=await import('leaflet'); if(disposed||!host.current)return;
 map=L.map(host.current); L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'&copy; OpenStreetMap contributors'}).addTo(map);
 const bounds=L.latLngBounds(points.map(p=>[p.latitude,p.longitude]));
 points.forEach((p,i)=>L.marker([p.latitude,p.longitude],{icon:L.divIcon({className:'',html:'<span style="display:block;background:#0E3FA9;color:white;border-radius:50%;text-align:center;width:24px;line-height:24px">'+(i+1)+'</span>',iconSize:[24,24]})}).addTo(map!).bindTooltip(String(i+1)+'. '+items[i].area));
 map.fitBounds(bounds,{padding:[25,25],maxZoom:12});
 const results=await Promise.all(points.slice(1).map(async (b,i)=>{
 const a=points[i];try{
 const query=new URLSearchParams({aLat:String(a.latitude),aLng:String(a.longitude),bLat:String(b.latitude),bLng:String(b.longitude)});
 const r=await fetch('/api/driver/web/public-route?'+query,{headers,signal:AbortSignal.timeout(18000)});
 return r.ok?await r.json() as Leg:null;
 }catch{return null;}
 }));
 if(disposed)return;
 results.forEach(r=>{if(r?.geometry?.coordinates?.length){const line=L.polyline(r.geometry.coordinates.map(([lng,lat])=>[lat,lng]),{color:'#0E3FA9',weight:4}).addTo(map!);bounds.extend(line.getBounds());}});
 map.fitBounds(bounds,{padding:[25,25],maxZoom:12});setLegs(results);
 setNotice(results.every(Boolean)?'Approximate public-area driving route.':'Some road segments are unavailable; no estimated road geometry substituted.');
 }catch{if(!disposed)setNotice('Public route unavailable. Use the external map or retry.');}
 };
 setLegs([]);setNotice('Loading approximate driving route...');void run();
 return()=>{disposed=true;map?.remove();};
 },[key]);
 return <><div ref={host} style={{height:320,width:'100%'}} aria-label="Approximate driving route map"/><button type="button" onClick={()=>{if(document.fullscreenElement)void document.exitFullscreen();else void host.current?.requestFullscreen();}}>Fullscreen map</button><p role="status">{notice}</p>{legs.map((leg,i)=><p key={i}>{i+1} - {i+2}: {leg?leg.distanceMiles+' miles / '+leg.durationMinutes+' min':'Road metrics unavailable'}</p>)}{legs.length>0&&legs.every(Boolean)&&<p>Total approximate route: {legs.reduce((sum,l)=>sum+(l?.distanceMiles??0),0).toFixed(1)} miles / {legs.reduce((sum,l)=>sum+(l?.durationMinutes??0),0)} min</p>}</>;
}
