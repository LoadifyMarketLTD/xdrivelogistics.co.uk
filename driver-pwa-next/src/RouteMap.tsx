import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
type Stop = { id: string; kind: "PICKUP" | "DELIVERY"; address: string; completedAt?: string };
type Props = { from: string; to: string; status?: string; stops?: Stop[]; distanceMiles?: number; travelMinutes?: number; onBack: () => void };
type Point = { lat: number; lon: number };
const UK: L.LatLngBoundsExpression = [[49.8, -8.7], [59.1, 2.1]];
const cache = new Map<string, Point>();
async function geocode(address: string): Promise<Point | null> {
  if (cache.has(address)) return cache.get(address)!;
  const cleaned = address.replace(/\s*\(TEST ADDRESS\)/gi, "")
    .replace(/,\s*(?:GB|United Kingdom)\s*,\s*([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})\s*$/i, "")
    .replace(/,\s*(?:GB|United Kingdom)\s*$/i, "").trim();
  const postcode = cleaned.match(/\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/i)?.[0] ?? "";
  const town = cleaned.replace(/,\s*[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\s*$/i, "").trim();
  const queries = [...new Set([cleaned, town, postcode].filter(Boolean))];
  for (const query of queries) {
    try {
      const response = await fetch("https://nominatim.openstreetmap.org/search?format=json&countrycodes=gb&limit=1&q=" + encodeURIComponent(query + ", United Kingdom"));
      if (!response.ok) continue;
      const results: {lat: string; lon: string}[] = await response.json();
      if (results.length) {
        const point = {lat: Number(results[0].lat), lon: Number(results[0].lon)};
        if (Number.isFinite(point.lat) && Number.isFinite(point.lon)) { cache.set(address, point); return point; }
      }
    } catch { /* try less-specific location */ }
  }
  return null;
}
const marker = (label: string, color: string) => L.divIcon({className:"route-marker",html:`<span style="background:${color}">${label}</span>`,iconSize:[34,34],iconAnchor:[17,17]});
export default function RouteMap({from,to,status,stops,distanceMiles,travelMinutes,onBack}:Props) {
  const element = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const overlays = useRef<L.LayerGroup | null>(null);
  const [position,setPosition] = useState<Point | null>(null);
  const [locationRequested,setLocationRequested] = useState(true);
  const [locationError,setLocationError] = useState("");
  const [routeError,setRouteError] = useState("");
  const [distanceToTarget,setDistanceToTarget] = useState<number | null>(null);
  const deliveryPhase = ["LOADED","ON_WAY_TO_DELIVERY","ON_SITE_DELIVERY","DELIVERED","POD_SUBMITTED"].includes(status ?? "") || Boolean(stops?.find(s=>s.kind==="PICKUP" && s.completedAt));
  const ordered: {address:string;kind:string;completedAt?:string}[] = useMemo(()=>deliveryPhase ? [{address:to,kind:"DELIVERY"}] : [{address:from,kind:"PICKUP"},{address:to,kind:"DELIVERY"}], [from,to,deliveryPhase]);
  useEffect(()=>{
    if(!element.current) return;
    const instance = L.map(element.current,{zoomControl:true}).fitBounds(UK);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{attribution:"&copy; OpenStreetMap contributors",maxZoom:19}).addTo(instance);
    map.current=instance;overlays.current=L.layerGroup().addTo(instance);
    setTimeout(()=>instance.invalidateSize(),100);
    return ()=>{instance.remove();map.current=null;overlays.current=null};
  },[]);
  useEffect(()=>{
    if(!locationRequested)return;
    if(!navigator.geolocation){setLocationError('GPS is not available in this browser.');return;}
    const id=navigator.geolocation.watchPosition(p=>{setPosition({lat:p.coords.latitude,lon:p.coords.longitude});setLocationError("")},e=>setLocationError(e.code===1?"Allow location access to display the driver.":"GPS position unavailable."),{enableHighAccuracy:true,maximumAge:15000,timeout:15000});
    return ()=>navigator.geolocation.clearWatch(id);
  },[locationRequested]);
  useEffect(()=>{
    const lifecycle={active:true};
    async function draw(){
      const layer=overlays.current,instance=map.current;
      if(!layer||!instance)return;
      layer.clearLayers();setRouteError("");setDistanceToTarget(null);

      const points: {point:Point;address:string;kind:string;completedAt?:string}[]=[];
      for(const stop of ordered){
        try {const point=await geocode(stop.address);if(point)points.push({...stop,point});else setRouteError("Some stop addresses could not be located.");}
        catch {setRouteError("Map geocoding unavailable. Check internet connection.");}
      }
      if(!lifecycle.active)return;
      points.forEach((s,i)=>L.marker([s.point.lat,s.point.lon],{icon:marker(String(i+1),s.kind==="PICKUP"?"#f5a400":"#202020")}).bindPopup(s.kind+" — "+s.address).addTo(layer));
      const locations=[...(position?[position]:[]),...points.map(s=>s.point)];
      if(locations.length>1)instance.fitBounds(L.latLngBounds(locations.map(p=>[p.lat,p.lon] as L.LatLngTuple)),{padding:[38,38],maxZoom:12});
      else if(locations.length===1)instance.setView([locations[0].lat,locations[0].lon],11);
      if(points.length<1)return;
      const legs:Point[][]=[];
      if(position)legs.push([position,points[0].point]);
      for(let i=0;i<points.length-1;i++)legs.push([points[i].point,points[i+1].point]);
      for(let i=0;i<legs.length;i++){
        const pair=legs[i];
        try{
          const coords=pair.map(p=>p.lon+","+p.lat).join(";");
          const response=await fetch("https://router.project-osrm.org/route/v1/driving/"+coords+"?overview=full&geometries=geojson");
          if(!response.ok)throw Error("routing");
          const data:{routes?:{distance:number;geometry:{coordinates:number[][]}}[]} = await response.json();
          if(!lifecycle.active)return;
          const route=data.routes?.[0];
          if(!route)throw Error("routing");
          if(i===0&&position)setDistanceToTarget(route.distance/1609.344);
          L.polyline(route.geometry.coordinates.map(c=>[c[1],c[0]] as L.LatLngTuple),{color:i===0&&position?"#2687ee":"#ef625b",weight:5,opacity:.9}).addTo(layer);
        }catch{
          if(!lifecycle.active)return;
          setRouteError("Road routing unavailable. Showing straight-line stop connections.");
          L.polyline(pair.map(p=>[p.lat,p.lon] as L.LatLngTuple),{color:"#ef625b",weight:3,dashArray:"8 8"}).addTo(layer);
        }
      }
    }
    void draw();return()=>{lifecycle.active=false};
  },[position,ordered]);
  return <section className="xroute">
    <div className="xroute-head"><button onClick={onBack} aria-label="Back">←</button><strong>Route</strong><span>⌖</span></div>
    <div className="xroute-map" ref={element} aria-label="Live driver, collection and delivery map" />
    <div className="xroute-info">
      <strong>{position?"🚚 Driver location active":locationRequested?(locationError||"Locating driver…"):"Driver location not enabled"}</strong>
      {!locationRequested&&!position&&<button type="button" className="rv-outline" onClick={()=>setLocationRequested(true)}>Show my GPS position</button>}
      {distanceToTarget!==null&&<div>Distance to {deliveryPhase?"delivery":"pickup"}: {distanceToTarget.toFixed(1)} miles</div>}
      {!deliveryPhase&&distanceMiles!==undefined&&<div>Job distance: {distanceMiles.toFixed(2)} miles {travelMinutes!==undefined?`(${Math.floor(travelMinutes/60)}h ${travelMinutes%60}min)`:""}</div>}
      <div>{ordered.map((s,i)=><div key={i}>{i+1}. {s.kind==="PICKUP"?"Collection":"Delivery"}: {s.address}{s.completedAt?" ✓":""}</div>)}</div>
      {routeError&&<small role="status">{routeError}</small>}
    </div>
  </section>;
}
