'use client';
import { useEffect, useState } from 'react';
import { getAccessToken } from '../../admin/_lib/getAccessToken';
import type { LoadDetailSection } from '../../../lib/loadPostingDetails';
import './master-job-detail.css';
import JobLiveTrackingPanel from '../tracking/JobLiveTrackingPanel';

type Evidence = {pickupPhotos?: string[]; deliveryPhotos?: string[]; signature?:string; recipientName?:string; timestamp?:string};
export type MasterJob = {
  id:string; jobRef:string; ownerCompanyId:string|null; assignedDriverId:string|null;
  client:{name:string;email:string;phone:string};
  pickup:{location:string;date:string;time:string};
  delivery:{location:string;date:string;time:string};
  cargo:{type:string;quantity:number;notes:string};
  distanceMiles:number|null; loadDetailSections:LoadDetailSection[];
  status:string;createdAt:string;updatedAt:string;
  statusHistory?:Array<{status:string;timestamp:string}>;pod?:Evidence;
};
type Props={
  job:MasterJob;driverName:string;saveMessage:string;exchangeVisibility:string|null;
  publishingExchange:boolean;canManage:boolean;
  onBack:()=>void;onEdit:()=>void;onInvoice:()=>void;onDelete:()=>void;onExchange:()=>void;
};
const display=(s:unknown)=>{const value=String(s??'').trim();return !value||['unknown','n/a','not specified'].includes(value.toLowerCase())?'Not recorded':value;};
const dt=(s:string)=>{if(!s)return 'Not recorded';const d=new Date(s);return Number.isNaN(d.getTime())?s:d.toLocaleDateString('en-GB');};
const statusLabel=(s:string)=>s.replace(/_/g,' ').replace(/\b\w/g,x=>x.toUpperCase());
function EvidenceImages({paths,jobId,label}:{paths:string[];jobId:string;label:string}){
  const [urls,setUrls]=useState<Record<string,string>>({});
  const [failed,setFailed]=useState<string[]>([]);
  const pathsKey=JSON.stringify(paths);
  useEffect(()=>{
    const currentPaths=JSON.parse(pathsKey) as string[];
    let active=true;
    setUrls({});setFailed([]);
    if(currentPaths.length===0)return;
    void (async()=>{
      const {accessToken}=await getAccessToken();
      if(!accessToken){if(active)setFailed(currentPaths);return;}
      const results=await Promise.all(currentPaths.map(async path=>{
        try{
          if(path.startsWith('data:image/'))return [path,path] as const;
          const response=await fetch('/api/pod/signed-url?'+new URLSearchParams({jobId,path}),{headers:{Authorization:'Bearer '+accessToken},cache:'no-store'});
          if(!response.ok)return [path,''] as const;
          const json=await response.json() as {signedUrl?:string};
          return [path,json.signedUrl||''] as const;
        }catch{return [path,''] as const;}
      }));
      if(active){setUrls(Object.fromEntries(results.filter(x=>x[1])));setFailed(results.filter(x=>!x[1]).map(x=>x[0]));}
    })();
    return ()=>{active=false};
  },[jobId,pathsKey]);
  if(!paths.length)return <p className="mjd-empty">No {label.toLowerCase()} stored.</p>;
  return <div className="mjd-photos">{paths.map((path,i)=><div className="mjd-photo" key={path+i}>{urls[path]?<a href={urls[path]} target="_blank" rel="noreferrer"><img src={urls[path]} alt={label+' '+(i+1)}/></a>:<div className="mjd-photo-unavailable">{failed.includes(path)?'Image not available':'Loading image…'}</div>}</div>)}</div>;
}
export default function MasterJobDetailView({job,driverName,saveMessage,exchangeVisibility,publishingExchange,canManage,onBack,onEdit,onInvoice,onDelete,onExchange}:Props){
 const [tab,setTab]=useState<'overview'|'timeline'|'tracking'|'pod'>('overview');
 const delivered=['delivered','completed'].includes(job.status.toLowerCase());
 const canPublish=canManage&&!delivered;
 const photos=job.pod;
 return <main className="mjd-shell">
   <header className="mjd-heading">
    <div><p className="mjd-eyebrow">XDRIVE LOGISTICS / OPERATIONS / LOAD DETAILS</p><h1>Job Details <span className="mjd-status">{statusLabel(job.status)}</span></h1><p className="mjd-reference">Ref: {job.jobRef} · Created {dt(job.createdAt)} · Updated {dt(job.updatedAt)}</p></div>
    <button className="mjd-button mjd-quiet" onClick={onBack}>Back to Jobs</button>
   </header>
   <section className="mjd-toolbar" aria-label="Job actions">
    {canManage&&<button className="mjd-button mjd-primary" onClick={onEdit}>Edit Job</button>}
    {delivered&&<button className="mjd-button mjd-primary" onClick={onInvoice}>Generate Invoice</button>}
    {canPublish&&<button className="mjd-button mjd-orange" disabled={publishingExchange} onClick={onExchange}>{publishingExchange?'Updating…':exchangeVisibility==='exchange'?'Unpublish from Exchange':'Publish to Exchange'}</button>}
    {canManage&&!delivered&&<button className="mjd-button mjd-danger" onClick={onDelete}>Delete Job</button>}
   </section>
   {saveMessage&&<p className="mjd-notice" role="status">{saveMessage}</p>}
   <nav className="mjd-tabs" aria-label="Job information">
    {([['overview','Load Details'],['timeline','Status History'],['tracking','Live Tracking'],['pod','POD & Documents']] as const).map(([key,label])=><button type="button" key={key} onClick={()=>setTab(key)} className={tab===key?'active':''} aria-current={tab===key?'page':undefined}>{label}</button>)}
   </nav>
   {tab==='overview'&&<>
    <section className="mjd-route">
     <article className="mjd-card"><h2>Collection</h2><strong>{display(job.pickup.location)}</strong><dl><div><dt>Date</dt><dd>{dt(job.pickup.date)}</dd></div><div><dt>Time</dt><dd>{display(job.pickup.time)}</dd></div></dl></article>
     <article className="mjd-card"><h2>Delivery</h2><strong>{display(job.delivery.location)}</strong><dl><div><dt>Date</dt><dd>{dt(job.delivery.date)}</dd></div><div><dt>Time</dt><dd>{display(job.delivery.time)}</dd></div></dl></article>
    </section>
    <section className="mjd-grid">
     <article className="mjd-card"><h2>Freight & Vehicle</h2><dl><div><dt>Cargo</dt><dd>{display(job.cargo.type)}</dd></div><div><dt>Items</dt><dd>{job.cargo.quantity}</dd></div><div><dt>Distance</dt><dd>{job.distanceMiles==null?'Not recorded':job.distanceMiles+' miles'}</dd></div><div><dt>Notes</dt><dd>{display(job.cargo.notes)}</dd></div></dl></article>
     <article className="mjd-card"><h2>Allocation & Customer</h2><dl><div><dt>Assigned driver</dt><dd>{driverName}</dd></div><div><dt>Customer</dt><dd>{display(job.client.name)}</dd></div><div><dt>Email</dt><dd>{display(job.client.email)}</dd></div><div><dt>Telephone</dt><dd>{display(job.client.phone)}</dd></div></dl></article>
    </section>
    {job.loadDetailSections.map(section=><section className="mjd-card mjd-detail" key={section.title}><h2>{section.title}</h2><dl>{section.items.map(item=><div key={item.label}><dt>{item.label}</dt><dd>{display(item.value)}</dd></div>)}</dl></section>)}
   </>}
   {tab==='tracking'&&<section className="mjd-card">{job.assignedDriverId ? <JobLiveTrackingPanel jobId={job.id}/> : <p className="mjd-empty">Tracking starts after a driver is assigned.</p>}</section>}
   {tab==='timeline'&&<section className="mjd-card"><h2>Operational Status History</h2>{job.statusHistory?.length?<ol className="mjd-timeline">{[...job.statusHistory].sort((a,b)=>new Date(a.timestamp).getTime()-new Date(b.timestamp).getTime()).map((event,i)=><li key={i}><strong>{statusLabel(event.status)}</strong><time>{new Date(event.timestamp).toLocaleString('en-GB')}</time></li>)}</ol>:<p className="mjd-empty">No status events recorded.</p>}</section>}
   {tab==='pod'&&<section className="mjd-card mjd-pod"><h2>Proof of Delivery</h2>{photos?<>
    <h3>Collection evidence</h3><EvidenceImages paths={photos.pickupPhotos||[]} jobId={job.id} label="Collection photo"/>
    <h3>Delivery evidence</h3><EvidenceImages paths={photos.deliveryPhotos||[]} jobId={job.id} label="Delivery photo"/>
    <div className="mjd-pod-info"><div><span>Received by</span><strong>{display(photos.recipientName)}</strong></div><div><span>Recorded</span><strong>{photos.timestamp?new Date(photos.timestamp).toLocaleString('en-GB'):'Not recorded'}</strong></div></div>
    <h3>Recipient signature</h3>{photos.signature?.startsWith('data:image/')?<img className="mjd-signature" src={photos.signature} alt="Recipient signature"/>:<p className="mjd-empty">{photos.signature?'Signature evidence recorded; inline preview unavailable.':'No signature recorded.'}</p>}
    </>:<p className="mjd-empty">No POD evidence recorded for this job.</p>}</section>}
 </main>;
}
