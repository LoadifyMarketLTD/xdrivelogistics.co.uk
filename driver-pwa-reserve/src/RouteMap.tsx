import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
type Stop = { id: string; kind: "PICKUP" | "DELIVERY"; address: string; completedAt?: string };
type Props = { from: string; to: string; status?: string; stops?: Stop[]; distanceMiles?: number; travelMinutes?: number; onBack: () => void };
type Point = { lat: number; lon: number };
declare const __BOOKING_LOCAL__: boolean;
const LOCAL = typeof __BOOKING_LOCAL__ !== "undefined" && __BOOKING_LOCAL__;
const UK: L.LatLngBoundsExpression = [[49.8, -8.7], [59.1, 2.1]];
const cache = new Map<string, Point>();
export async function geocode(address: string): Promise<Point | null> {

  if (cache.has(address)) return cache.get(address)!;
  const demo:Record<string,Point>={Blackburn:{lat:53.748,lon:-2.482},Birmingham:{lat:52.48,lon:-1.89},Manchester:{lat:53.48,lon:-2.24},Leeds:{lat:53.80,lon:-1.55},Preston:{lat:53.76,lon:-2.70},Liverpool:{lat:53.41,lon:-2.98},Bolton:{lat:53.58,lon:-2.43},Nottingham:{lat:52.95,lon:-1.15},Wigan:{lat:53.55,lon:-2.63},Sheffield:{lat:53.38,lon:-1.47},Burnley:{lat:53.79,lon:-2.24},Derby:{lat:52.92,lon:-1.48},Bradford:{lat:53.79,lon:-1.75},York:{lat:53.96,lon:-1.08},Chorley:{lat:53.65,lon:-2.63},Bristol:{lat:51.45,lon:-2.59},Lancaster:{lat:54.05,lon:-2.80},Coventry:{lat:52.41,lon:-1.51},Oldham:{lat:53.54,lon:-2.12},London:{lat:51.51,lon:-0.13}};
  if (LOCAL && /Fictional (Collection|Delivery) Estate/.test(address)) return Object.entries(demo).find(([town])=>address.includes(', '+town+' '))?.[1]??null;
  if (LOCAL) return null;
  // Marketplace routes use only published postcode districts (never an exact private stop).
  const outcodeMatch = address.trim().toUpperCase().match(/(?:^|[,\s])([A-Z]{1,2}\d[A-Z\d]?)(?=\s*(?:,|$))/);
  if (outcodeMatch) {
    try {
      const response = await fetch("https://api.postcodes.io/outcodes/" + encodeURIComponent(outcodeMatch[1]), {signal:AbortSignal.timeout(6500)});
      if (response.ok) {
        const data: {result?:{latitude?:number|null;longitude?:number|null}} = await response.json();
        const lat=data.result?.latitude,lon=data.result?.longitude;
        if(typeof lat==="number"&&typeof lon==="number"&&Number.isFinite(lat)&&Number.isFinite(lon)) {
          const point={lat,lon};cache.set(address,point);return point;
        }
      }
    } catch { /* retain the existing geocoder fallback */ }
  }
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
  const routeBounds=useRef<L.LatLngBounds|null>(null);
  const overlays = useRef<L.LayerGroup | null>(null);
  const [position,setPosition] = useState<Point | null>(LOCAL?{lat:53.735,lon:-2.515}:null);
  const [locationRequested,setLocationRequested] = useState(true);
  const [locationError,setLocationError] = useState("");
  const [routeError,setRouteError] = useState("");
  const [routeLoading,setRouteLoading] = useState(true);
  const [routeReady,setRouteReady] = useState(false);
  const [targetMinutes,setTargetMinutes]=useState<number|null>(null);const [jobMetrics,setJobMetrics]=useState<{miles:number;minutes:number}|null>(null);
  const [distanceToTarget,setDistanceToTarget] = useState<number | null>(null);
  const deliveryPhase = ["LOADED","ON_WAY_TO_DELIVERY","ON_SITE_DELIVERY","DELIVERED","POD_SUBMITTED"].includes(status ?? "") || Boolean(stops?.find(s=>s.kind==="PICKUP" && s.completedAt));
  const ordered: {address:string;kind:string;completedAt?:string}[] = useMemo(()=>stops?.length ? stops.filter(stop=>!stop.completedAt) : deliveryPhase ? [{address:to,kind:"DELIVERY"}] : [{address:from,kind:"PICKUP"},{address:to,kind:"DELIVERY"}], [from,to,deliveryPhase,stops]);
  useEffect(()=>{
    if(!element.current) return;
    const instance = L.map(element.current,{zoomControl:true,zoomAnimation:false,fadeAnimation:false,markerZoomAnimation:false}).fitBounds(UK);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{attribution:"&copy; OpenStreetMap contributors",maxZoom:19}).addTo(instance);
    map.current=instance;overlays.current=L.layerGroup().addTo(instance);
    const resizeTimer=setTimeout(()=>instance.invalidateSize(),100);
    return ()=>{clearTimeout(resizeTimer);instance.stop();instance.remove();map.current=null;overlays.current=null};
  },[]);
  useEffect(()=>{
    if(LOCAL||!locationRequested)return;
    if(!navigator.geolocation){setLocationError('GPS is not available in this browser.');return;}
    const id=navigator.geolocation.watchPosition(p=>{setPosition({lat:p.coords.latitude,lon:p.coords.longitude});setLocationError("")},e=>setLocationError(e.code===1?"Allow location access to display the driver.":"GPS position unavailable."),{enableHighAccuracy:true,maximumAge:15000,timeout:15000});
    return ()=>navigator.geolocation.clearWatch(id);
  },[locationRequested]);
  useEffect(()=>{
    const lifecycle={active:true};
    async function draw(){
      const layer=overlays.current,instance=map.current;
      if(!layer||!instance)return;
      layer.clearLayers();routeBounds.current=null;setRouteError("");setRouteLoading(true);setRouteReady(false);setDistanceToTarget(null);setTargetMinutes(null);setJobMetrics(null);

      const points: {point:Point;address:string;kind:string;completedAt?:string}[]=[];
      for(const stop of ordered){
        try {const point=await geocode(stop.address);if(point)points.push({...stop,point});else setRouteError("Some stop addresses could not be located.");}
        catch {setRouteError("Map geocoding unavailable. Check internet connection.");}
      }
      if(!lifecycle.active)return;
      points.forEach((s,i)=>{const popup=document.createElement("div");popup.textContent=s.kind+" - "+s.address;L.marker([s.point.lat,s.point.lon],{icon:marker((s.kind==="PICKUP"?"C":"D")+String(i+1),s.kind==="PICKUP"?"#f5a400":"#202020")}).bindPopup(popup).addTo(layer);});
      if(position)L.marker([position.lat,position.lon],{icon:L.divIcon({className:"route-marker",html:'<svg viewBox="0 0 42 32" width="42" height="32"><path d="M2 3h25v7h8l6 9v8H2z" fill="#ef625b" stroke="white" stroke-width="2"/><circle cx="10" cy="26" r="5" fill="#ef625b" stroke="white" stroke-width="2"/><circle cx="32" cy="26" r="5" fill="#ef625b" stroke="white" stroke-width="2"/></svg>',iconSize:[42,32],iconAnchor:[21,16]})}).bindTooltip(LOCAL?"Simulated driver":"Driver GPS").addTo(layer);
      const locations=[...(position?[position]:[]),...points.map(s=>s.point)];
      if(locations.length>0)routeBounds.current=L.latLngBounds(locations.map(p=>[p.lat,p.lon] as L.LatLngTuple));
      if(locations.length>1)instance.fitBounds(L.latLngBounds(locations.map(p=>[p.lat,p.lon] as L.LatLngTuple)),{padding:[38,38],maxZoom:12});
      else if(locations.length===1)instance.setView([locations[0].lat,locations[0].lon],11);
      if(points.length<1||points.length!==ordered.length){setRouteError('Unable to locate every stop. Road route unavailable.');setRouteLoading(false);return;}
      const legs:Point[][]=[];
      if(position)legs.push([position,points[0].point]);
      for(let i=0;i<points.length-1;i++)legs.push([points[i].point,points[i+1].point]);
      let jobMiles=0,jobMinutes=0,jobLegs=0;
      for(let i=0;i<legs.length;i++){
        const pair=legs[i];
        try{
          const coords=pair.map(p=>p.lon+","+p.lat).join(";");
          const response=await fetch("https://router.project-osrm.org/route/v1/driving/"+coords+"?overview=full&geometries=geojson");
          if(!response.ok)throw Error("routing");
          const data:{routes?:{distance:number;duration:number;geometry:{coordinates:number[][]}}[]} = await response.json();
          if(!lifecycle.active)return;
          const route=data.routes?.[0];
          if(!route)throw Error("routing");
          if(i===0&&position){setDistanceToTarget(route.distance/1609.344);setTargetMinutes(Math.round(route.duration/60));}else{jobMiles+=route.distance/1609.344;jobMinutes+=route.duration/60;jobLegs++;if(jobLegs===legs.length-(position?1:0))setJobMetrics({miles:jobMiles,minutes:Math.round(jobMinutes)});}
          L.polyline(route.geometry.coordinates.map(c=>[c[1],c[0]] as L.LatLngTuple),{color:i===0&&position?"#2687ee":"#ef625b",weight:5,opacity:.9}).addTo(layer);
          setRouteReady(true);
        }catch{
          if(!lifecycle.active)return;
          setRouteError("Road routing unavailable. Route distance unavailable.");

        }
      }
      if(lifecycle.active)setRouteLoading(false);
    }
    void draw();return()=>{lifecycle.active=false};
  },[position,ordered]);
  return <section className="xroute">
    <div className="xroute-head"><button onClick={onBack} aria-label="Back">←</button><strong>Route</strong><span>⌖</span></div>
    <div className="xroute-map" ref={element} aria-label="Live driver, collection and delivery map" /><button className="xroute-fit" aria-label="Fit entire route" onClick={()=>{if(routeBounds.current)map.current?.fitBounds(routeBounds.current,{padding:[38,38],maxZoom:12});}}>Fit route</button>
    <div className="xroute-info">
      <strong>{LOCAL?"Simulated driver location":position?"🚚 Driver location active":locationRequested?(locationError||"Locating driver…"):"Driver location not enabled"}</strong>
      {!locationRequested&&!position&&<button type="button" className="rv-outline" onClick={()=>setLocationRequested(true)}>Show my GPS position</button>}
      {distanceToTarget!==null&&<div>Distance to {deliveryPhase?"delivery":"pickup"}: {distanceToTarget.toFixed(1)} miles {targetMinutes!==null&&"("+targetMinutes+" min)"}</div>}
      {jobMetrics&&<div>Job distance: {jobMetrics.miles.toFixed(1)} miles ({jobMetrics.minutes} min)</div>}{!jobMetrics&&!deliveryPhase&&distanceMiles!==undefined&&distanceMiles>0&&<div>Job distance: {distanceMiles.toFixed(2)} miles {travelMinutes!==undefined?`(${Math.floor(travelMinutes/60)}h ${travelMinutes%60}min)`:""}</div>}
      <div>{ordered.map((s,i)=><div key={i}>{i+1}. {s.kind==="PICKUP"?"Collection":"Delivery"}: {s.address}{s.completedAt?" ✓":""}</div>)}</div>
      {routeLoading&&<div role="status">Calculating road route…</div>}
      {!routeLoading&&routeReady&&<div className="xroute-success">Road route shown · road distances are estimates.</div>}
      {!routeLoading&&!routeReady&&!routeError&&<div role="status">Road route unavailable for these stops.</div>}
      {routeError&&<div className="xroute-error" role="status">{routeError}</div>}
    </div>
  </section>;
}
