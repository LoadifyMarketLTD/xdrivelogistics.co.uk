import {useEffect,useState} from 'react';
import {geocode} from './RouteMap';
import type {LiveJob} from './liveApi';
const cache=new Map<string,{miles:number;minutes:number}>();
export default function BookingDistance({job}:{job:LiveJob}){
 const key=JSON.stringify(job.routeStops?.length?[...job.routeStops].sort((a,b)=>a.sequence-b.sequence).map(s=>s.address):[job.pickupAddress||job.from,job.deliveryAddress||job.to]);
 const [result,setResult]=useState<{miles:number;minutes:number}|null>(null);
 const [failed,setFailed]=useState(false);const [retry,setRetry]=useState(0);
 useEffect(()=>{let active=true;const c=new AbortController();setFailed(false);setResult(null);const cached=cache.get(key);if(cached){setResult(cached);return;}
 const timer=setTimeout(()=>c.abort(),20000);
 void (async()=>{try{const points=await Promise.all((JSON.parse(key) as string[]).map(address=>geocode(address)));if(points.length<2||points.some(p=>!p))throw Error('Addresses unavailable');if(!active)return;
 const res=await fetch('https://router.project-osrm.org/route/v1/driving/'+points.map(p=>p!.lon+','+p!.lat).join(';')+'?overview=false',{signal:c.signal});if(!res.ok)throw Error('Routing unavailable');
 const r=(await res.json()).routes?.[0];if(!r||!Number.isFinite(r.distance)||!Number.isFinite(r.duration))throw Error('Invalid route');const value={miles:r.distance/1609.344,minutes:Math.round(r.duration/60)};cache.set(key,value);if(active)setResult(value);
 }catch{if(active)setFailed(true);}finally{clearTimeout(timer);}})();return()=>{active=false;clearTimeout(timer);c.abort();};},[key,retry]);
 return <><div className="rv-fact"><span>Distance</span><strong>{result?result.miles.toFixed(2)+' miles':failed?'Route unavailable':'Calculating road distance...'}</strong></div><div className="rv-fact"><span>Estimated journey duration</span><strong>{result?result.minutes+' min':failed?'Unavailable':'Calculating...'}</strong></div>{failed&&<button className="rv-outline" onClick={()=>setRetry(n=>n+1)}>Retry route calculation</button>}</>;
}
