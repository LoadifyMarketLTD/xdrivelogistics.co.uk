'use client';

import {useEffect,useRef,useState} from 'react';
import 'leaflet/dist/leaflet.css';

type Point={lat:number;lng:number};
const postcodeQuery=(input:string|null|undefined)=>{
 const compact=String(input||'').toUpperCase().replace(/\s+/g,'');
 if(/^[A-Z]{1,2}\d[A-Z\d]?\d[A-Z]{2}$/.test(compact))return 'postcodes/'+compact;
 const outcode=compact.match(/^[A-Z]{1,2}\d[A-Z\d]?/)?.[0];
 return outcode?'outcodes/'+outcode:null;
};
async function coords(postcode:string|null|undefined):Promise<Point|null>{
 const query=postcodeQuery(postcode);
 if(!query)return null;
 const response=await fetch('https://api.postcodes.io/'+query,{cache:'force-cache'});
 if(!response.ok)return null;
 const data=await response.json() as {result?:{latitude?:number;longitude?:number}};
 const lat=data.result?.latitude,lng=data.result?.longitude;
 return typeof lat==='number'&&typeof lng==='number'?{lat,lng}:null;
}
export default function BookingRouteMap({pickup,delivery,focus}:{pickup:string|null|undefined;delivery:string|null|undefined;focus:'pickup'|'delivery'}){
 const node=useRef<HTMLDivElement>(null);
 const [failure,setFailure]=useState(false);
 useEffect(()=>{
  let disposed=false;
  let map:import('leaflet').Map|undefined;
  const init=async()=>{
   try{
    const [L,from,to]=await Promise.all([import('leaflet'),coords(pickup),coords(delivery)]);
    if(disposed||!node.current)return;
    const target=(focus==='pickup'?from:to)||from||to;
    if(!target){setFailure(true);return;}
    map=L.map(node.current,{zoomControl:false,scrollWheelZoom:false}).setView([target.lat,target.lng],11);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:18,attribution:'┬® OpenStreetMap contributors'}).addTo(map);
    if(from)L.circleMarker([from.lat,from.lng],{radius:9,color:'#16a34a',fillColor:'#16a34a',fillOpacity:1}).bindPopup('Collection area').addTo(map);
    if(to)L.circleMarker([to.lat,to.lng],{radius:9,color:'#f5a300',fillColor:'#f5a300',fillOpacity:1}).bindPopup('Delivery area').addTo(map);
    if(from&&to&&focus==='delivery')map.fitBounds([[from.lat,from.lng],[to.lat,to.lng]],{padding:[26,26],maxZoom:12});
   }catch{if(!disposed)setFailure(true);}
  };
  void init();
  return ()=>{disposed=true;map?.remove();};
 },[pickup,delivery,focus]);
 if(failure)return <p className="fresh-booking-map-fallback">Map unavailable. Use Navigate for directions.</p>;
 return <div role="img" aria-label="Map showing booking collection and delivery postcode areas; not a calculated road route" className="fresh-booking-live-map" ref={node}/>;
}
