'use client';

import { useEffect, useRef, useState } from 'react';
import 'leaflet/dist/leaflet.css';

type Point={lat:number;lng:number};

export default function InTransitRouteMap({origin,destination,geometry}:{origin:Point;destination:Point;geometry?:Point[]|null}){
 const node=useRef<HTMLDivElement>(null);
 const [failed,setFailed]=useState(false);
 useEffect(()=>{
  let disposed=false;
  let map:import('leaflet').Map|undefined;
  const init=async()=>{
   try{
    const L=await import('leaflet');
    if(disposed||!node.current)return;
    map=L.map(node.current,{zoomControl:false,scrollWheelZoom:false,dragging:true});
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:18,attribution:'© OpenStreetMap contributors'}).addTo(map);
    L.circleMarker([origin.lat,origin.lng],{radius:8,color:'#1d57d8',fillColor:'#1d57d8',fillOpacity:1,weight:2}).bindPopup('Current driver location').addTo(map);
    L.circleMarker([destination.lat,destination.lng],{radius:9,color:'#f5a300',fillColor:'#f5a300',fillOpacity:1,weight:2}).bindPopup('Delivery').addTo(map);
    const routePoints=(geometry??[]).filter(point=>Number.isFinite(point.lat)&&Number.isFinite(point.lng));
    if(routePoints.length>=2)L.polyline(routePoints.map(point=>[point.lat,point.lng] as [number,number]),{weight:5,opacity:.85}).addTo(map);
    const bounds=routePoints.length>=2?routePoints.map(point=>[point.lat,point.lng] as [number,number]):[[origin.lat,origin.lng],[destination.lat,destination.lng]] as [number,number][];
    map.fitBounds(bounds,{padding:[28,28],maxZoom:13});
   }catch{if(!disposed)setFailed(true);}
  };
  void init();
  return()=>{disposed=true;map?.remove();};
 },[origin.lat,origin.lng,destination.lat,destination.lng,geometry]);
 if(failed)return <p className="fresh-booking-map-fallback">Live position map unavailable. Use Navigate for directions.</p>;
 return <div role="img" aria-label={geometry?.length?'Map showing the latest driver position, calculated driving route and delivery point':'Map showing the latest driver position and delivery point'} className="fresh-booking-live-map" ref={node}/>;
}
