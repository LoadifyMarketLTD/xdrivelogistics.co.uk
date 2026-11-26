import {useEffect,useState} from 'react';
import type {LiveJob} from './liveApi';
type Props={token:string|null;jobs:LiveJob[];onClose:()=>void;visible:boolean};
const activeStatuses=new Set(['ON_WAY_TO_PICKUP','ON_SITE_PICKUP','LOADED','ON_WAY_TO_DELIVERY','ON_SITE_DELIVERY']);
export default function GpsTracking({token,jobs,onClose,visible}:Props){
 const [permission,setPermission]=useState('Not requested');
 const [lastSent,setLastSent]=useState<Record<string,string>>({});
 const [lastError,setLastError]=useState<Record<string,string>>({});
 const [retry,setRetry]=useState(0);
 const [sending,setSending]=useState(false);
 const active=jobs.filter(j=>activeStatuses.has(j.status)&&!j.acceptanceRequired);
 const activeKey=JSON.stringify([...new Set(active.map(j=>j.id))].sort());
 useEffect(()=>{
  if(!token)return;
  if(!navigator.geolocation){setPermission('Unavailable');return;}
  const ids=JSON.parse(activeKey) as string[];
  let live=true;let pending=false;let controller:AbortController|undefined;
  const attempts=new Map<string,number>();const successes=new Map<string,number>();
  const send=async(p:GeolocationPosition)=>{
   if(!live||pending||Date.now()-p.timestamp>30000)return;
   setPermission('Allowed');
   const now=Date.now();
   const due=ids.filter(id=>now-(successes.get(id)??0)>=120000&&now-(attempts.get(id)??0)>=30000);
   if(!due.length)return;
   pending=true;setSending(true);
   controller=new AbortController();const signal=controller.signal;
   const timeout=setTimeout(()=>controller?.abort(),12000);
   try{await Promise.all(due.map(async id=>{
    attempts.set(id,now);
    try{
     const r=await fetch('/api/driver/location',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({job_id:id,lat:p.coords.latitude,lng:p.coords.longitude,heading:p.coords.heading??undefined,speed_mph:p.coords.speed==null?undefined:Math.max(0,p.coords.speed*2.236936)}),signal,cache:'no-store'});
     const data=await r.json().catch(()=>({}));if(!r.ok||data.ok!==true)throw Error(typeof data.error==='string'?data.error:'Tracking server HTTP '+r.status);
     if(live){successes.set(id,Date.now());setLastSent(prev=>({...prev,[id]:new Date().toISOString()}));setLastError(prev=>({...prev,[id]:''}));}
    }catch(e){if(live)setLastError(prev=>({...prev,[id]:e instanceof Error?e.message:'Location transmission failed'}));}
   }));}finally{clearTimeout(timeout);pending=false;if(live)setSending(false);}
  };
  const fail=(e:GeolocationPositionError)=>{if(live)setPermission(e.code===1?'Denied':'Unavailable');};
  const options={enableHighAccuracy:true,maximumAge:10000,timeout:15000};
  const watch=navigator.geolocation.watchPosition(p=>void send(p),fail,options);
  const refresh=()=>{if(live&&document.visibilityState==='visible')navigator.geolocation.getCurrentPosition(p=>void send(p),fail,options);};
  refresh();
  const timer=setInterval(refresh,15000);
  document.addEventListener('visibilitychange',refresh);window.addEventListener('online',refresh);
  return()=>{live=false;controller?.abort();navigator.geolocation.clearWatch(watch);clearInterval(timer);document.removeEventListener('visibilitychange',refresh);window.removeEventListener('online',refresh);};
 },[token,activeKey,retry]);
 useEffect(()=>{setLastSent({});setLastError({});setSending(false);},[token]);
 return <section className="rv-card rv-gps-panel" style={{display:visible?undefined:"none"}}><button className="rv-back" onClick={onClose}>Back to booking</button><h2>GPS &amp; Tracking</h2>
 <p>Location is requested automatically after sign-in. Only authorised active bookings receive location updates.</p>
 <p><strong>GPS:</strong> {permission}</p>
 {permission!=='Allowed'&&<button type="button" className="rv-primary rv-wide" onClick={()=>setRetry(v=>v+1)}>Enable location / Retry</button>}
 <p><strong>Publishing:</strong> {sending?'Sending position...':active.length?'Automatic':'No transport in progress'}</p>
 {active.map(j=><div key={j.id}><strong>{j.yourRef||'XDL-'+j.id.slice(0,8).toUpperCase()}</strong><p>{j.from} to {j.to}</p><p>Last successful update: {lastSent[j.id]?new Date(lastSent[j.id]).toLocaleString('en-GB'):'None'}</p>{lastError[j.id]&&<p className="rv-error" role="alert">{lastError[j.id]}</p>}</div>)}
 <small>Updates are attempted every 2 minutes while the app is running. Sharing stops for completed bookings or at sign-out. Android may suspend browser location in the background.</small>
 </section>
}
