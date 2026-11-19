'use client';
import {useEffect,useState} from 'react';
import {readRouteAuthHeader} from '../../../lib/routeAuthCookie';
import {ActionButton,AlertBanner,EmptyState} from '../../components/workspace/WorkspaceUI';
import {safeOwnerDocumentUrl} from './ownerDocumentPresentation';
type DocumentRecord={id:string;name:string;type:string;createdAt:string|null;url:string|null};
export default function OwnerJobDocuments({jobId}:{jobId:string}){
 const [records,setRecords]=useState<DocumentRecord[]>([]);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 const [revision,setRevision]=useState(0);
 useEffect(()=>{
  const controller=new AbortController();
  setLoading(true);setError('');setRecords([]);
  void (async()=>{try{
   const auth=await readRouteAuthHeader();if(!auth)throw Error('Your session has expired. Sign in again.');
   const response=await fetch('/api/driver/jobs/'+encodeURIComponent(jobId)+'/documents',{headers:{Authorization:auth},cache:'no-store',signal:controller.signal});
   const payload=await response.json().catch(()=>null) as {documents?:DocumentRecord[];error?:string}|null;
   if(!response.ok||!Array.isArray(payload?.documents))throw Error(payload?.error||'Documents could not be verified.');
   if(!controller.signal.aborted)setRecords(payload.documents);
  }catch(cause){if(!controller.signal.aborted)setError(cause instanceof Error?cause.message:'Documents could not be loaded.');}
  finally{if(!controller.signal.aborted)setLoading(false);}})();
  return ()=>controller.abort();
 },[jobId,revision]);
 return <section aria-label="Booking documents" style={{display:'grid',gap:10}}>
  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:10,flexWrap:'wrap'}}><strong>{loading?'Checking document register':error?'Document register unavailable':records.length+' documents'}</strong><ActionButton tone="secondary" disabled={loading} onClick={()=>setRevision(x=>x+1)}>Refresh document links</ActionButton></div>
  {loading?<p role="status">Loading verified documents...</p>:error?<AlertBanner tone="warning">{error}</AlertBanner>:!records.length?<EmptyState compact title="No job documents attached"/>:
   <div className="driver-diary-document-list" style={{display:'grid',gap:8}}>{records.map(doc=>{const url=safeOwnerDocumentUrl(doc.url);const date=doc.createdAt?new Date(doc.createdAt):null;return <article key={doc.id} className="driver-diary-document-row" style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,flexWrap:'wrap',padding:12,border:'1px solid #cbd5e1',borderRadius:6,background:'#fff'}}><div style={{display:'grid',gap:4,minWidth:0,overflowWrap:'anywhere'}}><strong>{doc.name}</strong><small>{doc.type.replace(/_/g,' ')} · {date&&!Number.isNaN(date.getTime())?date.toLocaleString('en-GB'):'Date not recorded'}</small></div>{url?<a href={url} target="_blank" rel="noopener noreferrer" aria-label={'Open '+doc.name}>Open document</a>:<span role="status">Secure file unavailable</span>}</article>})}</div>}
  <small>Only authorised, job-linked documents are opened. Refresh links if they expire.</small>
 </section>;
}
