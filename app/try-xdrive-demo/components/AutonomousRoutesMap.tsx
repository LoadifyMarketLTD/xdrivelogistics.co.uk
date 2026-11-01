"use client";
import {useEffect,useMemo,useRef,useState} from "react";
import "leaflet/dist/leaflet.css";
import {approximateMiles,postcodeDistrict,useOutcodePositions,type DistrictPoint} from "./useOutcodePositions";
type Route={id:string;from:string;to:string;vehicle?:string;paymentTerms?:string};
export default function AutonomousRoutesMap({routes,activeId,onSelect}:{routes:Route[];activeId?:string;onSelect?:(id:string)=>void}){
 const mapNode=useRef<HTMLDivElement>(null);
 const mapInstance=useRef<import("leaflet").Map|null>(null);
 const drawn=useRef<import("leaflet").LayerGroup|null>(null);
 const [myPosition,setMyPosition]=useState<DistrictPoint|null>(null),[gpsError,setGpsError]=useState("");
 const sources=useMemo(()=>routes.slice(0,100),[routes]);
 const locs=useMemo(()=>sources.flatMap(r=>[r.from,r.to]),[sources]);
 const {positions,loading}=useOutcodePositions(locs);
 const known=sources.filter(r=>positions[postcodeDistrict(r.from)]&&positions[postcodeDistrict(r.to)]);
 const current=known.find(r=>r.id===activeId)||known[0];
 const lookup=(p:string)=>positions[postcodeDistrict(p)];
 useEffect(()=>{
  let cancelled=false;
  import("leaflet").then(L=>{
   if(cancelled||!mapNode.current||mapInstance.current)return;
   const map=L.map(mapNode.current,{zoomControl:true,scrollWheelZoom:true,attributionControl:true}).setView([53,-2.5],6);
   L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{
    maxZoom:18,attribution:"© OpenStreetMap contributors",crossOrigin:true,
   }).addTo(map);
   const layer=L.layerGroup().addTo(map);
   mapInstance.current=map;drawn.current=layer;
   requestAnimationFrame(()=>{if(!cancelled)map.invalidateSize()});
  }).catch(()=>setGpsError("Map provider not available"));
  return()=>{cancelled=true;const m=mapInstance.current;mapInstance.current=null;drawn.current=null;try{m?.remove()}catch{/* map was already disposed */}};
 },[]);
 useEffect(()=>{
  let mounted=true;
  import("leaflet").then(L=>{
   const map=mapInstance.current,layer=drawn.current;if(!map||!layer||!mounted)return;
   layer.clearLayers();const pts:import("leaflet").LatLngExpression[]=[];
   for(const route of known){
    const a=lookup(route.from)!,b=lookup(route.to)!;
    const from:import("leaflet").LatLngExpression=[a.latitude,a.longitude],to:import("leaflet").LatLngExpression=[b.latitude,b.longitude];
    const selected=route.id===current?.id;
    const fromPin=L.circleMarker(from,{radius:selected?10:7,color:"#1673e2",fillColor:"#1673e2",fillOpacity:.95,weight:2});
    const toPin=L.circleMarker(to,{radius:selected?10:7,color:"#f18b15",fillColor:"#f18b15",fillOpacity:.95,weight:2});
    for(const marker of [fromPin,toPin]){
     marker.on("click",()=>onSelect?.(route.id));
     marker.bindTooltip((marker===fromPin?"Collection: ":"Delivery: ")+(marker===fromPin?route.from:route.to)+" · "+route.id);
     marker.addTo(layer);
    }
    L.polyline([from,to],{weight:selected?4:2,color:selected?"#0B2F6B":"#5b92d2",opacity:selected?0.85:0.45,dashArray:"8 6"}).addTo(layer);
    if(selected||known.length<3){pts.push(from,to)}
   }
   if(myPosition){
    const at:import("leaflet").LatLngExpression=[myPosition.latitude,myPosition.longitude];
    L.circleMarker(at,{radius:10,color:"#16a34a",fillColor:"#16a34a",fillOpacity:.8,weight:3}).bindTooltip("My current location · device only").addTo(layer);
    pts.push(at);
   }
   if(pts.length>1)map.fitBounds(L.latLngBounds(pts),{padding:[42,42],maxZoom:10,animate:false});
   else if(pts.length===1)map.setView(pts[0],10);
   map.invalidateSize();
  }).catch(()=>{});
  return()=>{mounted=false};
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[positions,activeId,myPosition,sources]);
 const locate=()=>{
  setGpsError("");
  if(!navigator.geolocation){setGpsError("Geolocation is not supported on this device");return}
  navigator.geolocation.getCurrentPosition(p=>setMyPosition({outcode:"DEVICE",latitude:p.coords.latitude,longitude:p.coords.longitude,approximate:true}),
   e=>setGpsError(e.message||"Location permission was denied"),{enableHighAccuracy:false,timeout:7000,maximumAge:90000});
 };
 const ref= current?lookup(current.from):null;
 const distance=myPosition&&ref?approximateMiles(myPosition,ref):null;
 return <section className="xd-independent-map" aria-label="Interactive load pickup and delivery map" style={{display:"grid",gap:10,minWidth:0}}>
  <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
   <strong>{known.length} of {routes.length} routes geocoded by UK postcode district</strong>
   <button type="button" onClick={locate} style={{padding:"8px 12px",border:"1px solid #c3d4e8",borderRadius:7}}>Show my location</button>
  </div>
  <div ref={mapNode} style={{width:"100%",height:360,maxHeight:"56vh",borderRadius:9,border:"1px solid #d4e2ee",overflow:"hidden",zIndex:0}}/>
  {current&&<div style={{background:"#f4f7fb",borderRadius:8,padding:10,fontSize:13}}>
   <strong>{current.from} → {current.to}</strong> · {current.vehicle||"Vehicle unspecified"} · {current.id}
   {distance!==null&&<span> · Approximately {distance.toFixed(1)} miles straight-line from device to collection district</span>}
   {current.paymentTerms&&<span> · Payment: {current.paymentTerms}</span>}
  </div>}
  {loading&&<p role="status">Looking up approximate postcode-district centres…</p>}
  {gpsError&&<p role="alert">{gpsError}</p>}
  <small>Map is interactive: pan/zoom within the frame. Blue = collection, orange = delivery, green = your permitted device location. Dashed lines show straight-line connections, NOT road navigation or driving ETA. Outcode centres are approximate; never rely on them as collection addresses. Map tiles © OpenStreetMap contributors.</small>
 </section>;
}
