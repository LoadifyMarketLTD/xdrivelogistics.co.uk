import {useEffect,useRef,useState} from 'react';
import type {LiveJob} from './liveApi';
type Props={token:string|null;jobs:LiveJob[];onClose:()=>void;visible:boolean};
const activeStatuses=new Set(['ALLOCATED','ON_WAY_TO_PICKUP','ON_SITE_PICKUP','LOADED','ON_WAY_TO_DELIVERY','ON_SITE_DELIVERY']);
export default function GpsTracking({token,jobs,onClose,visible}:Props){
 const [enabled,setEnabled]=useState(()=>localStorage.getItem('xdrive-next-gps-enabled')==='yes');
 const [permission,setPermission]=useState('Not requested');
 const [lastSent,setLastSent]=useState<string|null>(null);
 const [lastError,setLastError]=useState('');
 const [sending,setSending]=useState(false);
 const [selected,setSelected]=useState(()=>localStorage.getItem('xdrive-next-gps-job')||'');
 useEffect(()=>{localStorage.setItem('xdrive-next-gps-enabled',enabled?'yes':'no')},[enabled]);
 useEffect(()=>{if(selected)localStorage.setItem('xdrive-next-gps-job',selected)},[selected]);
 const pending=useRef(false);
 const jobsActive=jobs.filter(j=>activeStatuses.has(j.status));
 const job=jobsActive.find(j=>j.id===selected)??(jobsActive.length===1?jobsActive[0]:null);
 const activeId=job?.id??null;
 useEffect(()=>{if(!enabled||!token||!activeId||!navigator.geolocation)return;
  let live=true;let watch:number|undefined;let timer:ReturnType<typeof setInterval>|undefined;
  let latest:GeolocationPosition|null=null;let lastAttempt=0;let lastSuccessfulAttempt=0;
  const send=async(p:GeolocationPosition)=>{if(!live||pending.current)return;const now=Date.now();if(now-lastSuccessfulAttempt<290000||now-lastAttempt<30000)return;lastAttempt=now;pending.current=true;setSending(true);
   try{const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),12000);
    try{const r=await fetch('/api/driver/location',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({job_id:activeId,lat:p.coords.latitude,lng:p.coords.longitude,heading:p.coords.heading??undefined,speed_mph:p.coords.speed==null?undefined:Math.max(0,p.coords.speed*2.236936)}),signal:controller.signal,cache:'no-store'});
     const data=await r.json().catch(()=>({}));if(!r.ok)throw Error(typeof data.error==='string'?data.error:'Tracking server HTTP '+r.status);
     if(live){lastSuccessfulAttempt=Date.now();setLastSent(new Date().toISOString());setLastError('');setPermission('Allowed');}
    }finally{clearTimeout(timeout)}
   }catch(e){if(live)setLastError(e instanceof Error?e.message:'Location transmission failed');}finally{pending.current=false;if(live)setSending(false)}
  };
  watch=navigator.geolocation.watchPosition(p=>{latest=p;setPermission('Allowed');void send(p)},e=>{if(live){setPermission(e.code===1?'Denied':'Unavailable');setLastError(e.message)}},{enableHighAccuracy:true,maximumAge:10000,timeout:15000});
  timer=setInterval(()=>{if(!live)return;if(latest&&Date.now()-latest.timestamp<300000){void send(latest)}else navigator.geolocation.getCurrentPosition(p=>{latest=p;void send(p)},e=>setLastError(e.message),{enableHighAccuracy:true,maximumAge:10000,timeout:15000})},30000);
  const onResume=()=>{if(document.visibilityState==='visible')navigator.geolocation.getCurrentPosition(p=>{latest=p;void send(p)},()=>{},{enableHighAccuracy:true,maximumAge:10000,timeout:15000})};document.addEventListener('visibilitychange',onResume);
  return()=>{document.removeEventListener('visibilitychange',onResume);live=false;if(watch!==undefined)navigator.geolocation.clearWatch(watch);if(timer)clearInterval(timer)};
 },[enabled,token,activeId]);
 const canStart=Boolean(token&&activeId&&navigator.geolocation);
 return <section className="rv-card rv-gps-panel" style={{display:visible?undefined:"none"}}><button className="rv-back" onClick={onClose}>Back to menu</button><h2>GPS &amp; Tracking</h2>
 <p>Share your location with the authorised customer for your active booking. Updates are attempted every 5 minutes while the app is running.</p>
 <label className="rv-field"><span>Active booking</span><select value={job?.id??''} onChange={e=>{setSelected(e.target.value);setLastSent(null)}}>{jobsActive.length!==1&&<option value="">Select a booking</option>}{jobsActive.map(j=><option key={j.id} value={j.id}>{j.yourRef||j.id} - {j.from} to {j.to}</option>)}</select></label>
 <p><strong>GPS:</strong> {permission}</p><p><strong>Publishing:</strong> {enabled?(sending?'Sending position...':lastSent?'Active':'Waiting for first successful update'):'Off'}</p><p><strong>Last successful update:</strong> {lastSent?new Date(lastSent).toLocaleString('en-GB'):'None'}</p>
 {lastError&&<p className="rv-error" role="alert">{lastError}</p>}
 {!activeId&&<p>No eligible active booking is currently loaded. Tracking is not started.</p>}
 <button type="button" className={enabled?'rv-outline rv-wide':'rv-primary rv-wide'} disabled={!enabled&&!canStart} onClick={()=>{setEnabled(v=>!v);setLastError('')}}>{enabled?'Stop GPS Tracking':'Start GPS Tracking'}</button>
 <small>Tracking stops when you press Stop, sign out, or the booking is no longer active. Android may suspend browser location updates in the background or when the screen is locked. A successful update must be confirmed above.</small>
 </section>
}
