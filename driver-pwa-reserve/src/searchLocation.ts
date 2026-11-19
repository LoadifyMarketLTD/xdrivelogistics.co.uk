import type {SearchFilters,SearchLoad,Point} from './loadSearchFilters';
import {matchesLoad} from './loadSearchFilters';
const api=import.meta.env.PROD?'/api':'/xdrive-api';
const asPoint=(r:Record<string,unknown>):Point=>{if(r.latitude==null||r.longitude==null)throw Error('Location coordinates unavailable.');const lat=Number(r.latitude),lng=Number(r.longitude);if(!Number.isFinite(lat)||!Number.isFinite(lng)||Math.abs(lat)>90||Math.abs(lng)>180)throw Error('Invalid location coordinates.');return {lat,lng};};
async function lookup(path:string,token:string,signal:AbortSignal):Promise<Point>{
 const r=await fetch(api+path,{headers:{Authorization:'Bearer '+token},cache:'no-store',signal:AbortSignal.any([signal,AbortSignal.timeout(10000)])});
 const data=await r.json().catch(()=>({}));if(!r.ok)throw Error(data.error||'Location lookup unavailable.');return asPoint(data);
}
function gps(signal:AbortSignal):Promise<Point>{
 return new Promise((resolve,reject)=>{if(!navigator.geolocation){reject(Error('GPS is unavailable on this device.'));return;}if(signal.aborted){reject(new DOMException('Cancelled','AbortError'));return;}navigator.geolocation.getCurrentPosition(p=>signal.aborted?reject(new DOMException('Cancelled','AbortError')):resolve({lat:p.coords.latitude,lng:p.coords.longitude}),e=>reject(Error(e.code===1?'Allow location permission or choose a postcode.':'Current location could not be verified. Choose a postcode or try again.')),{enableHighAccuracy:false,maximumAge:15000,timeout:12000});});
}
const postcode=(v:string)=>'/location/postcode-area?q='+encodeURIComponent(v.trim());
async function roadDistance(origin:Point,code:string,token:string,signal:AbortSignal):Promise<number>{
 const path='/driver/marketplace/search-road-distance?outcode='+encodeURIComponent(code.trim().toUpperCase());
 const response=await fetch(api+path,{headers:{Authorization:'Bearer '+token,'X-XDrive-Search-Origin':JSON.stringify(origin)},cache:'no-store',signal:AbortSignal.any([signal,AbortSignal.timeout(30000)])});
 const data=await response.json().catch(()=>({}));
 if(!response.ok)throw Error(data.error||'Road distance unavailable.');
 const n=data.distanceMiles;
 if(typeof n!=='number'||!Number.isFinite(n)||n<0||!['mapbox_driving','google_directions','osrm_driving'].includes(data.source)||data.precision!=='public_outcode')throw Error('Road distance could not be verified.');
 return n;
}
export async function searchAvailableLoads(jobs:SearchLoad[],f:SearchFilters,token:string,signal:AbortSignal){
 const origin=f.mode==='current'?await gps(signal):f.mode==='vehicle'?await lookup('/driver/marketplace/search-origin',token,signal):await lookup(postcode(f.location),token,signal);
 const destination=f.destinationRadius?await lookup(postcode(f.destination),token,signal):null;
 const candidates=jobs.filter(j=>matchesLoad(j,f));
 const pickupCodes=[...new Set(candidates.map(j=>j.fromOutcode).filter((x):x is string=>Boolean(x)))];
 const deliveryCodes=destination?[...new Set(candidates.map(j=>j.toOutcode).filter((x):x is string=>Boolean(x)))]:[];
 const tasks=[...pickupCodes.map(code=>({code,point:origin,key:'p:'+code})),...deliveryCodes.map(code=>({code,point:destination!,key:'d:'+code}))];
 const distances=new Map<string,number>();let next=0;
 async function worker(){while(next<tasks.length&&!signal.aborted){const t=tasks[next++];try{distances.set(t.key,await roadDistance(t.point,t.code,token,signal));}catch{if(signal.aborted)throw new DOMException('Cancelled','AbortError');}}}
 await Promise.all(Array.from({length:Math.min(5,tasks.length)},worker));
 if(signal.aborted)throw new DOMException('Cancelled','AbortError');
 const ids=new Set<string>();const pickupRoadMiles:Record<string,number>={};let unknown=0;
 for(const j of candidates){const p=distances.get('p:'+j.fromOutcode);const end=destination?distances.get('d:'+j.toOutcode):undefined;if(p===undefined||(destination&&end===undefined)){unknown++;continue;}if(p<=Number(f.radius)&&(!destination||end!<=Number(f.destinationRadius))){ids.add(j.id);pickupRoadMiles[j.id]=p;}}
 return {ids,unknown,pickupRoadMiles};
}