"use client";
import {useEffect,useRef} from "react";
import "leaflet/dist/leaflet.css";
import {postcodeDistrict,useOutcodePositions} from "./useOutcodePositions";
type Available={id:string;publicArea:string;vehicle:string;registration:string;company:string};
export default function AutonomousAvailabilityMap({records}:{records:Available[]}){
 const node=useRef<HTMLDivElement>(null);
 const mapRef=useRef<import("leaflet").Map|null>(null);
 const {positions,loading}=useOutcodePositions(records.map(v=>v.publicArea));
 useEffect(()=>{
  let live=true;
  import("leaflet").then(L=>{
   if(!live||!node.current||mapRef.current)return;
   const map=L.map(node.current,{zoomControl:true,scrollWheelZoom:true}).setView([53.2,-2.2],6);
   L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:18,
    attribution:"© OpenStreetMap contributors"}).addTo(map);
   mapRef.current=map;
   setTimeout(()=>{if(live)map.invalidateSize()},80);
  });
  return()=>{live=false;const m=mapRef.current;mapRef.current=null;try{m?.remove()}catch{/* disposed */}};
 },[]);
 useEffect(()=>{
  let live=true,layer:import("leaflet").LayerGroup|null=null;
  import("leaflet").then(L=>{
   if(!live||!mapRef.current)return;
   const map=mapRef.current;layer=L.layerGroup().addTo(map);
   const bounds:import("leaflet").LatLngExpression[]=[];
   for(const item of records){
    const pos=positions[postcodeDistrict(item.publicArea)];if(!pos)continue;
    const at:import("leaflet").LatLngExpression=[pos.latitude,pos.longitude];bounds.push(at);
    L.circleMarker(at,{radius:9,color:"#16a34a",fillColor:"#16a34a",fillOpacity:.75,weight:2})
     .bindTooltip(item.vehicle+" · "+item.publicArea+" · "+item.company)
     .addTo(layer);
   }
   if(bounds.length>1)map.fitBounds(L.latLngBounds(bounds),{padding:[35,35],maxZoom:10});
   else if(bounds.length===1)map.setView(bounds[0],9);
  });
  return()=>{live=false;layer?.remove()};
 },[positions,records]);
 return <div>
  <div ref={node} style={{width:"100%",height:340,border:"1px solid #dce5f0",borderRadius:8,zIndex:0}}/>
  {loading&&<p role="status">Resolving public outcode centres…</p>}
  <small>Only manually shared approximate postcode-district areas are shown; no live GPS or exact vehicle position. Map tiles © OpenStreetMap contributors.</small>
 </div>;
}
