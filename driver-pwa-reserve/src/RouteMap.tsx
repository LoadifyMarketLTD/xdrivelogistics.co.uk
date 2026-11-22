import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./NativeRoutePwa.css";

type Stop = { id: string; kind: "PICKUP" | "DELIVERY"; address: string; completedAt?: string };
type Point = { lat: number; lon: number };
type Props = { from: string; to: string; status?: string; stops?: Stop[]; distanceMiles?: number; travelMinutes?: number; token?: string; bookingJobId?: string; onBack: () => void };
type RecordedPosition = { lat: number; lng: number; recorded_at: string };
type BookingRouteData = { pickup: Point|null; delivery: Point|null; gps_trail: RecordedPosition[]; truncated: boolean };
type Metrics = { miles: number; minutes: number };
type RoadRoute = { geometry: { type: "LineString"; coordinates: number[][] }; distanceMiles: number; durationMinutes: number };

declare const __BOOKING_LOCAL__: boolean;
const LOCAL = typeof __BOOKING_LOCAL__ !== "undefined" && __BOOKING_LOCAL__;
const UK: L.LatLngBoundsExpression = [[49.8,-8.7],[59.1,2.1]];
const CITY: Record<string,Point> = { blackburn:{lat:53.748,lon:-2.482},manchester:{lat:53.48,lon:-2.24},bolton:{lat:53.58,lon:-2.43},burnley:{lat:53.79,lon:-2.24},"st helens":{lat:53.453,lon:-2.737},"st. helens":{lat:53.453,lon:-2.737},preston:{lat:53.76,lon:-2.70},liverpool:{lat:53.41,lon:-2.98},birmingham:{lat:52.48,lon:-1.89},leeds:{lat:53.80,lon:-1.55},wigan:{lat:53.55,lon:-2.63},sheffield:{lat:53.38,lon:-1.47},nottingham:{lat:52.95,lon:-1.15},bradford:{lat:53.79,lon:-1.75},london:{lat:51.51,lon:-0.13},lancaster:{lat:54.05,lon:-2.80},chorley:{lat:53.65,lon:-2.63},derby:{lat:52.92,lon:-1.48},york:{lat:53.96,lon:-1.08},bristol:{lat:51.45,lon:-2.59},coventry:{lat:52.41,lon:-1.51},oldham:{lat:53.54,lon:-2.12} };
const geocache = new Map<string,Point>();
const goodPoint = (p:Point) => Number.isFinite(p.lat)&&Number.isFinite(p.lon)&&Math.abs(p.lat)<=90&&Math.abs(p.lon)<=180;
const requestPath = (api:string) => (import.meta.env.PROD?"/api":"/xdrive-api")+api;
const authHeaders = (token:string) => ({ Authorization: "Bearer "+token });

/** Geocode published postcode districts, not guessed street addresses or a random Nominatim POI. */
export async function geocode(address:string, token?:string, signal?:AbortSignal, precise=false):Promise<Point|null> {
  const normalized=address.trim().replace(/\s*\(TEST ADDRESS\)/gi, "").replace(/,\s*(?:GB|United Kingdom)\s*$/i, "").trim();
  if(!normalized)return null;
  const key=(precise?'postcode:':'public:')+normalized;
  if(geocache.has(key))return geocache.get(key)!;
  const town=CITY[normalized.toLowerCase()];
  if(town){geocache.set(key,town);return town;}
  if(LOCAL) {
    const demoTown=Object.keys(CITY).find(key=>normalized.toLowerCase().includes(", "+key+" "));
    return demoTown?CITY[demoTown]:null;
  }
  // Exact postcodes are permitted after award; open loads remain postcode-area only.
  const fullPostcode=normalized.toUpperCase().match(/\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/)?.[0];
  if(precise&&fullPostcode&&token){
    try {
      const response=await fetch("https://api.postcodes.io/postcodes/"+encodeURIComponent(fullPostcode.replace(/\s/g,"")),{signal});
      if(response.ok){
        const data=await response.json() as {result?:{latitude?:number;longitude?:number}};
        const p={lat:data.result?.latitude??NaN,lon:data.result?.longitude??NaN};
        if(goodPoint(p)){geocache.set(key,p);return p;}
      }
    }catch{/* Fall back to public outcode if precise postcode lookup is unavailable. */}
  }
  const code=normalized.toUpperCase().match(/(?:^|[,\s])([A-Z]{1,2}\d[A-Z\d]?)(?:\s+\d[A-Z]{2})?(?=\s*(?:,|$))/)?.[1];
  if(code&&token){
    try {
      const response=await fetch(requestPath("/driver/web/public-outcode")+"?outcode="+encodeURIComponent(code),{headers:authHeaders(token),signal,cache:"no-store"});
      if(response.ok) {
        const data=await response.json() as { latitude?:number;longitude?:number };
        const point={lat:data.latitude??NaN,lon:data.longitude??NaN};
        if(goodPoint(point)){geocache.set(key,point);return point;}
      }
    }catch {/* Prefer lower-resolution public routing over inventing a private location. */}
  }
  // The authenticated outcode endpoint can be temporarily unavailable for a
  // valid public area (e.g. BB1, M1, BL1). Resolve that public area directly
  // from postcodes.io rather than losing every marker in Quotes/Bookings.
  if(code){
    try {
      const response=await fetch("https://api.postcodes.io/outcodes/"+encodeURIComponent(code),{signal});
      if(response.ok){
        const data=await response.json() as {result?:{latitude?:number;longitude?:number}};
        const p={lat:data.result?.latitude??NaN,lon:data.result?.longitude??NaN};
        if(goodPoint(p)){geocache.set(key,p);return p;}
      }
    }catch{/* No invented location when both providers fail. */}
  }
  // For non-postcode stops, retain the existing geocoder used by the approved map.
  // Never geocode a complete private street address on an unawarded public load.
  // Restore the pre-18-November retry strategy: a failed complete address
  // must not hide an otherwise resolvable postcode or town. A fallback is
  // approximate and is never represented as an exact collection address.
  const townQuery=normalized.replace(/,?\s*[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\s*$/i, "").trim();
  const queries=[...new Set([normalized,fullPostcode,townQuery].filter((v):v is string=>Boolean(v)))];
  for(const query of queries){
    try {
      const response=await fetch("https://nominatim.openstreetmap.org/search?format=json&countrycodes=gb&limit=1&q="+encodeURIComponent(query+", United Kingdom"),{signal});
      if(!response.ok)continue;
      const matches=await response.json() as Array<{lat:string;lon:string}>;
      const point={lat:Number(matches[0]?.lat),lon:Number(matches[0]?.lon)};
      if(matches.length&&goodPoint(point)){geocache.set(key,point);return point;}
    } catch {if(signal?.aborted)return null;}
  }
  return null;
}

/** Use the existing XDrive MAIN authenticated road engine: Mapbox, then OSRM fallback. */
async function roadRoute(start:Point,end:Point,token:string,signal:AbortSignal):Promise<RoadRoute> {
  const params=new URLSearchParams({aLat:String(start.lat),aLng:String(start.lon),bLat:String(end.lat),bLng:String(end.lon)});
  let result:Partial<RoadRoute>|null=null;
  try {
    const response=await fetch(requestPath("/driver/web/public-route")+"?"+params,{headers:authHeaders(token),signal,cache:"no-store"});
    if(response.ok)result=await response.json() as Partial<RoadRoute>;
  }catch {if(signal.aborted)throw new Error("Routing cancelled");}
  // Restore the verified pre-18-November OSRM fallback when the XDrive
  // routing proxy is unavailable. Never substitute straight-line mileage.
  if(!result){
    const coordinates=[start,end].map(p=>p.lon+","+p.lat).join(";");
    const fallback=await fetch("https://router.project-osrm.org/route/v1/driving/"+coordinates+"?overview=full&geometries=geojson",{signal});
    if(!fallback.ok)throw new Error("Road routing services unavailable");
    const payload=await fallback.json() as {routes?:Array<{distance:number;duration:number;geometry:{type:string;coordinates:number[][]}}>};
    const road=payload.routes?.[0];
    if(!road)throw new Error("No verified road route");
    result={geometry:road.geometry as RoadRoute["geometry"],distanceMiles:road.distance/1609.344,durationMinutes:road.duration/60};
  }
  if(result.geometry?.type!=="LineString"||!Array.isArray(result.geometry.coordinates)||result.geometry.coordinates.length<2
     ||!result.geometry.coordinates.every(p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite))
     ||!Number.isFinite(result.distanceMiles)||!Number.isFinite(result.durationMinutes)
     ||(result.distanceMiles??0)<0||(result.durationMinutes??0)<0)throw Error("Invalid road route response");
  return result as RoadRoute;
}
const marker=(label:string,color:string)=>L.divIcon({
  className:"route-marker",
  html:'<span style="background:'+color+'">'+label+'</span>',
  iconSize:[34,34],iconAnchor:[17,17],
});
// Original XDrive native Route uses V for current driver and 1 / 2 for stops.
// Keep the marker labels and colors consistent with the recovered APK.
const truckIcon=()=>marker("V","#ef5350");

export default function RouteMap({from,to,status,stops,distanceMiles,travelMinutes,token,bookingJobId,onBack}:Props){
  const host=useRef<HTMLDivElement>(null);
  const map=useRef<L.Map|null>(null);
  const layer=useRef<L.LayerGroup|null>(null);
  const bounds=useRef<L.LatLngBounds|null>(null);
  const [position,setPosition]=useState<Point|null>(LOCAL?{lat:53.735,lon:-2.515}:null);
  const [gpsError,setGpsError]=useState("");
  const [pickupMetrics,setPickupMetrics]=useState<Metrics|null>(null);
  const [jobMetrics,setJobMetrics]=useState<Metrics|null>(null);
  const [routeError,setRouteError]=useState("");
  const [routeLoading,setRouteLoading]=useState(true);
  const [bookingData,setBookingData]=useState<BookingRouteData|null>(null);
  const [bookingError,setBookingError]=useState('');
  const afterCollection=["LOADED","ON_WAY_TO_DELIVERY","ON_SITE_DELIVERY","DELIVERED","POD_SUBMITTED"].includes(status??"")||Boolean(stops?.some(s=>s.kind==="PICKUP"&&s.completedAt));
  const ordered=useMemo(()=>{
    if(stops?.length){
      const remaining=stops.filter(s=>!s.completedAt);
      // If a single pickup has already happened but its timestamp is unavailable,
      // use the booking's authoritative status to avoid sending the driver back there.
      if(afterCollection && remaining.length && remaining[0].kind==="PICKUP" && !stops.some(s=>s.completedAt)) return remaining.slice(1);
      return remaining;
    }
    return afterCollection?[{id:"delivery",kind:"DELIVERY" as const,address:to}]:
      [{id:"pickup",kind:"PICKUP" as const,address:from},{id:"delivery",kind:"DELIVERY" as const,address:to}];
  },[stops,from,to,afterCollection]);

  useEffect(()=>{
    if(!host.current)return;
    const instance=L.map(host.current,{zoomControl:true,zoomAnimation:false,fadeAnimation:false,markerZoomAnimation:false}).fitBounds(UK);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{attribution:"&copy; OpenStreetMap contributors",maxZoom:19}).addTo(instance);
    map.current=instance;layer.current=L.layerGroup().addTo(instance);
    const timer=setTimeout(()=>instance.invalidateSize(),100);
    return ()=>{clearTimeout(timer);instance.stop();instance.remove();map.current=null;layer.current=null;bounds.current=null;};
  },[]);

  useEffect(()=>{
    if(!bookingJobId||!token){setBookingData(null);setBookingError('');return;}
    let active=true;
    let pending:AbortController|null=null;
    const url=requestPath('/driver/web/booking-route')+'?jobId='+encodeURIComponent(bookingJobId);
    const load=()=>{
      if(!active)return;
      pending?.abort();
      const controller=new AbortController();
      pending=controller;
      void fetch(url,{headers:authHeaders(token),signal:controller.signal,cache:'no-store'})
        .then(async response=>{
          if(!response.ok)throw Error('Recorded booking route unavailable (HTTP '+response.status+').');
          return await response.json() as BookingRouteData;
        }).then(data=>{if(active&&!controller.signal.aborted){setBookingData(data);setBookingError('');}})
        .catch(()=>{if(active&&!controller.signal.aborted)setBookingError('Booking coordinates or recorded GPS history could not be retrieved.');});
    };
    setBookingData(null);setBookingError('');load();
    const interval=window.setInterval(load,60_000);
    const onVisible=()=>{if(document.visibilityState==='visible')load();};
    document.addEventListener('visibilitychange',onVisible);
    return ()=>{active=false;pending?.abort();window.clearInterval(interval);document.removeEventListener('visibilitychange',onVisible);};
  },[bookingJobId,token]);

  useEffect(()=>{
    if(LOCAL)return;
    if(!navigator.geolocation){setGpsError("GPS unavailable on this device.");return;}
    // Recalculate from the latest actual driver position; never use a fixed location.
    const id=navigator.geolocation.watchPosition(
      p=>{const next={lat:p.coords.latitude,lon:p.coords.longitude};if(goodPoint(next)){setPosition(previous=>previous&&Math.abs(previous.lat-next.lat)<0.0005&&Math.abs(previous.lon-next.lon)<0.0005?previous:next);setGpsError("");}},
      e=>setGpsError(e.code===1?"Enable location permission to calculate distance to the next stop.":"Driver GPS temporarily unavailable."),
      {enableHighAccuracy:true,maximumAge:15000,timeout:15000}
    );
    return ()=>navigator.geolocation.clearWatch(id);
  },[]);

  useEffect(()=>{
    const current=layer.current,instance=map.current;
    if(!current||!instance)return;
    const controller=new AbortController();
    let active=true;
    const draw=async()=>{
      current.clearLayers();bounds.current=null;setPickupMetrics(null);setJobMetrics(null);setRouteError("");setRouteLoading(true);
      const points:Array<{stop:Stop;point:Point}>=[];
      let missingStops=0;
      // One failed geocode must not suppress all valid stops or leave only a
      // driver truck in Quotes/Bookings. Keep original stop indices.
      for(let index=0;index<ordered.length;index++){
        const stop=ordered[index];
        const primary=bookingData?.pickup;
        const finalStop=bookingData?.delivery;
        const knownPoint=stop.kind==='PICKUP' && primary ? primary
          : stop.kind==='DELIVERY' && finalStop && stop.id===ordered.at(-1)?.id ? finalStop : null;
        const point=knownPoint ?? await geocode(stop.address,token,controller.signal,status!=='OPEN');
        if(!active)return;
        if(!point){missingStops++;continue;}
        points.push({stop,point});
        const popup=document.createElement("div");popup.textContent=stop.kind+" — "+stop.address;
        const originalIndex=stops?.findIndex(s=>s.id===stop.id) ?? -1;
        L.marker([point.lat,point.lon],{icon:marker(String(originalIndex>=0?originalIndex+1:index+1),"#111827")}).bindPopup(popup).addTo(current);
      }
      if(!active)return;
      // Completed stops remain visible as historical waypoints, but are not
      // incorrectly treated as the next destination for live navigation.
      if(bookingData && stops?.length){
        for(let index=0;index<stops.length;index++){
          const stop=stops[index];
          if(!stop.completedAt || points.some(item=>item.stop.id===stop.id))continue;
          const point=stop.kind==='PICKUP'?bookingData.pickup:
            index===stops.length-1?bookingData.delivery:null;
          if(!point)continue;
          L.marker([point.lat,point.lon],{icon:marker(String(index+1),'#64748b')})
            .bindTooltip('Completed '+stop.kind.toLowerCase()+': '+stop.address).addTo(current);
        }
      }
      if(missingStops)setRouteError(missingStops+" stop location(s) could not be verified. Complete road distance unavailable.");

      if(position)L.marker([position.lat,position.lon],{icon:truckIcon()}).bindTooltip(LOCAL?"Simulated driver":"Driver GPS").addTo(current);
      const trail=bookingData?.gps_trail ?? [];
      const gpsPoints=trail.filter(p=>goodPoint({lat:p.lat,lon:p.lng}));
      // Historical positions are sampled GPS observations. Avoid drawing
      // misleading straight connectors across long recording gaps.
      let segment: L.LatLngTuple[]=[];
      const recordedLines:L.Polyline[]=[];
      const flush=()=>{
        if(segment.length>=2)recordedLines.push(L.polyline(segment,{color:'#7c3aed',weight:5,opacity:1,dashArray:'9 5'}).addTo(current));
        segment=[];
      };
      let previousTime=0;
      for(const point of gpsPoints){
        const stamp=Date.parse(point.recorded_at);
        if(!Number.isFinite(stamp))continue;
        if(previousTime && (stamp-previousTime)>20*60_000)flush();
        segment.push([point.lat,point.lng]);previousTime=stamp;
      }
      flush();
      const coords=[...(position?[position]:[]),...points.map(p=>p.point),...gpsPoints.map(p=>({lat:p.lat,lon:p.lng})),
        ...(bookingData?.pickup?[bookingData.pickup]:[]),...(bookingData?.delivery?[bookingData.delivery]:[])];
      if(coords.length){bounds.current=L.latLngBounds(coords.map(p=>[p.lat,p.lon] as L.LatLngTuple));instance.fitBounds(bounds.current,{padding:[38,38],maxZoom:12});}
      if(!points.length && !(afterCollection && bookingData?.pickup && bookingData?.delivery)){
        setRouteLoading(false);return;
      }
      if(!token&&!LOCAL){setRouteError("Driver session unavailable. Road distances cannot be verified.");setRouteLoading(false);return;}
      const authToken=token || "local-qa-route-only";
      const addRoad=(route:RoadRoute,color:string)=>L.polyline(route.geometry.coordinates.map(c=>[c[1],c[0]] as L.LatLngTuple),{color,weight:color==='#ef5350'?8:4,opacity:.95}).addTo(current);
      // The complete job route is independent of GPS and should remain visible
      // before quotation even if location permission is denied.
      if(missingStops===0&&points.length>=2){
        let totalMiles=0,totalMinutes=0;
        let complete=true;
        for(let i=0;i<points.length-1;i++){
          if(controller.signal.aborted)return;
          const a=points[i].point,b=points[i+1].point;
          if(a.lat===b.lat&&a.lon===b.lon){
            complete=false;
            setRouteError("Exact stop locations are required to verify this same-area journey.");
            continue;
          }
          try{
            const road=await roadRoute(a,b,authToken,controller.signal);
            if(!active)return;
            addRoad(road,"#ef5350");totalMiles+=road.distanceMiles;totalMinutes+=road.durationMinutes;
          }catch{
            if(!active)return;
            complete=false;
            setRouteError("Real road route unavailable. Check connection or stop location.");
          }
        }
        if(complete && totalMiles>0)setJobMetrics({miles:totalMiles,minutes:totalMinutes});
      }
      // After collection the remaining-stop list omits pickup. Keep the
      // original booked collection -> delivery road leg visible separately.
      if(afterCollection && bookingData?.pickup && bookingData?.delivery && token && (!stops || stops.length===2)){
        try{
          const road=await roadRoute(bookingData.pickup,bookingData.delivery,authToken,controller.signal);
          if(!active)return;
          addRoad(road,'#ef5350');
          setJobMetrics({miles:road.distanceMiles,minutes:road.durationMinutes});
        }catch{if(active)setRouteError(s=>s||'Booked collection-to-delivery road route unavailable.');}
      }
      // Driver -> next stop is the live route: collection before loading,
      // delivery after collection. Never silently replace it with job mileage.
      if(position&&points.length>0&&points[0].stop.id===ordered[0]?.id){
        const next=points[0].point;
        if(next.lat===position.lat&&next.lon===position.lon)setPickupMetrics({miles:0,minutes:0});
        else try{
          const road=await roadRoute(position,next,authToken,controller.signal);
          if(!active)return;
          addRoad(road,"#2196f3");
          setPickupMetrics({miles:road.distanceMiles,minutes:road.durationMinutes});
        }catch{
          if(!active)return;
          setRouteError(s=>s||"Live road distance to the next stop unavailable.");
        }
      }
      // Real recorded GPS samples must remain visible above overlapping
      // calculated blue/red road routes, never hidden underneath them.
      for(const line of recordedLines)line.bringToFront();
      if(active)setRouteLoading(false);
    };
    void draw().catch(()=>{if(active){setRouteError("Route service unavailable.");setRouteLoading(false);}});
    return ()=>{active=false;controller.abort();};
  },[ordered,position,token,status,bookingData,afterCollection]);

  const nextLabel=ordered[0]?.kind==="PICKUP"?"collection":"delivery";
  const recordedCount=bookingData?.gps_trail?.length ?? 0;
  const liveDistance=pickupMetrics
    ?pickupMetrics.miles.toFixed(1)+" mi | "+Math.round(pickupMetrics.minutes)+" min"
    :position&&routeLoading?"Calculatingâ€¦":position?"Not available":"Waiting for GPS";
  const jobDistance=jobMetrics
    ?jobMetrics.miles.toFixed(1)+" mi | "+Math.round(jobMetrics.minutes)+" min"
    :routeLoading?"Calculatingâ€¦":"Not available";
  // A posted distance is never used as a verified road-route result.
  return <section className="xd-native-route" aria-label="Route">
    <header className="xd-native-route__header">
      <button className="xd-native-route__back" type="button" aria-label="Back" onClick={onBack}>
        <svg viewBox="0 0 24 24" fill="none" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m12 19-7-7 7-7M5 12h15" />
        </svg>
      </button>
      <h1>Route</h1>
    </header>
    <div className="xd-native-route__map-wrap">
      <div className="xd-native-route__map" ref={host} aria-label="Live driver and verified road route"/>
      <button type="button" className="xd-native-route__fit" aria-label="Fit entire route"
        onClick={()=>{if(bounds.current)map.current?.fitBounds(bounds.current,{padding:[38,38],maxZoom:12});}}>
        Fit route
      </button>
    </div>
    <section className="xd-native-route__sheet" aria-label="Route details">
      <div className="xd-native-route__status">
        <i className="xd-native-route__dot" data-active={Boolean(position)} aria-hidden="true"/>
        {LOCAL?"Simulated driver location":position?"Driver location active":gpsError||"Locating driver..."}
      </div>
      <div className="xd-native-route__metrics">
        <div className="xd-native-route__metric">
          <span><i aria-hidden="true"/> Driver to {nextLabel}</span>
          <strong>{liveDistance}</strong>
        </div>
        <div className="xd-native-route__metric">
          <span><i aria-hidden="true"/> {afterCollection && stops && stops.length>2?'Remaining deliveries':'Collection to delivery'}</span>
          <strong>{jobDistance}</strong>
        </div>
      </div>
      <ol className="xd-native-route__stops">
        {(stops?.length?stops:ordered).map((stop,index)=><li key={stop.id}>
          <span className="xd-native-route__step">{index+1}</span>
          <span><strong>{stop.kind==="PICKUP"?"Collection":"Delivery"}:</strong> {stop.address}{stop.completedAt?' (completed)':''}</span>
        </li>)}
      </ol>
      {bookingJobId&&<p className="xd-native-route__loading" role="status">
        <span style={{color:'#7c3aed',fontWeight:800}}>━━</span> Recorded GPS trail: {recordedCount>=2?recordedCount+' sampled positions':'Not enough recorded GPS points'}
        {bookingData?.truncated?' (most recent 750 samples)':''}. Historical lines show recorded points, not a verified turn-by-turn journey.
      </p>}
      {bookingError&&<p role="status" className="xd-native-route__warning">{bookingError}</p>}
      {routeLoading&&<p role="status" className="xd-native-route__loading">Calculating verified road routes...</p>}
      {routeError&&<p role="status" className="xd-native-route__warning">{routeError}</p>}
      {!routeError&&!routeLoading&&!jobMetrics&&!afterCollection&&Number.isFinite(distanceMiles)&&Boolean(distanceMiles)&&
        <p className="xd-native-route__loading">Posted distance (unverified): {distanceMiles!.toFixed(1)} mi
          {travelMinutes!==undefined?" / "+Math.round(travelMinutes)+" min":""}</p>}
    </section>
  </section>;
}