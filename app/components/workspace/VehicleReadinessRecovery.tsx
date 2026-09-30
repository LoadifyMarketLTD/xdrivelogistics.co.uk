'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '../AuthContext';
import { supabase } from '../../../lib/supabaseClient';
import { WORKSPACE_READINESS_CHANGED } from '../../../lib/workspaceReadiness';

type Vehicle = {id:string;reg_plate:string|null;type:string|null;status:string;assigned_driver_id:string|null};
type Document = {id:string;vehicle_id:string;doc_type:string;status:string;expiry_date:string|null;rejection_reason:string|null};
type Snapshot = {companyId:string;driverId:string;canManageAssignment:boolean;vehicles:Vehicle[];documents:Document[]};
const field = {width:'100%',padding:'9px 10px',border:'1px solid #cbd5e1',borderRadius:6,background:'#fff',color:'#1a1f2b'} as const;
const panel = {padding:16,border:'1px solid #d7e0ea',borderRadius:8,background:'#fff',minWidth:0} as const;
const button = {padding:'9px 14px',border:0,borderRadius:6,background:'#0b2f6b',color:'#fff',fontWeight:700,cursor:'pointer'} as const;
export default function VehicleReadinessRecovery(){
 const {user}=useAuth();
 const params=useSearchParams();
 const requestedDocument=params.get('document');
 const [snapshot,setSnapshot]=useState<Snapshot|null>(null);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 const [message,setMessage]=useState('');
 const [vehicleId,setVehicleId]=useState('');
 const [docType,setDocType]=useState(requestedDocument==='insurance'?'insurance':'mot');
 const [expiry,setExpiry]=useState('');
 const [issued,setIssued]=useState('');
 const [file,setFile]=useState<File|null>(null);
 const [working,setWorking]=useState(false);
 const busy=useRef(false);
 const fileInput=useRef<HTMLInputElement>(null);
 const endpoint='/api/driver/vehicle-readiness'+(user?.companyId?'?companyId='+encodeURIComponent(user.companyId):'');
 const token=async()=>{const {data}=await supabase.auth.getSession();if(!data.session?.access_token) throw Error('Your session has expired. Sign in again.');return data.session.access_token;};
 const load=useCallback(async()=>{
   setLoading(true);setError('');
   try{
    const response=await fetch(endpoint,{headers:{Authorization:'Bearer '+await token()},cache:'no-store',signal:AbortSignal.timeout(20000)});
    const result=await response.json();
    if(!response.ok)throw Error(result.error||'Vehicle recovery could not be loaded.');
    if(!Array.isArray(result.vehicles)||!Array.isArray(result.documents)||!result.driverId)throw Error('Vehicle recovery returned an incomplete response.');
    setSnapshot(result);
    const assigned=result.vehicles.filter((v:Vehicle)=>v.status==='active'&&v.assigned_driver_id===result.driverId);
    setVehicleId(previous=>assigned.some((v:Vehicle)=>v.id===previous)?previous:assigned[0]?.id??'');
   }catch(reason){setError(reason instanceof Error?reason.message:'Vehicle recovery could not be loaded.');setSnapshot(null);}
   finally{setLoading(false);}
 },[endpoint]);
 useEffect(()=>{void load();},[load]);
 useEffect(()=>{
   if(loading||!snapshot)return;
   if(requestedDocument==='mot'||requestedDocument==='insurance'){
    setDocType(requestedDocument);
    document.getElementById('vehicle-document-upload')?.scrollIntoView({block:'center'});
    fileInput.current?.focus({preventScroll:true});
   }else if(params.get('section')==='assignment')document.getElementById('vehicle-assignment')?.scrollIntoView({block:'start'});
 },[loading,snapshot,requestedDocument,params]);
 async function submit(){
  if(busy.current)return;
  if(!file||!vehicleId||!expiry){setError('Choose the assigned vehicle, document file and current expiry date.');return;}
  if(file.size===0||file.size>10*1024*1024){setError('Choose a non-empty file up to 10 MB.');return;}
  busy.current=true;setWorking(true);setError('');setMessage('');
  try{
   const data=new FormData();data.set('file',file);data.set('vehicleId',vehicleId);data.set('docType',docType);data.set('issuedDate',issued);data.set('expiryDate',expiry);
   const response=await fetch(endpoint,{method:'POST',headers:{Authorization:'Bearer '+await token()},body:data,signal:AbortSignal.timeout(60000)});
   const result=await response.json();if(!response.ok)throw Error(result.error||'Document upload failed.');
   setMessage('Document submitted. Pending verification: uploading does not remove the commercial restriction until approval.');
   setFile(null);if(fileInput.current)fileInput.current.value='';await load();window.dispatchEvent(new Event(WORKSPACE_READINESS_CHANGED));
  }catch(reason){setError(reason instanceof Error?reason.message:'Document upload failed.');}finally{busy.current=false;setWorking(false);}
 }
 async function assign(id:string,action:'assign'|'unassign'){
  if(busy.current)return;
  if(action==='unassign'&&!window.confirm('Remove this vehicle assignment? Existing job and quote commitments must be resolved first.'))return;
  busy.current=true;setWorking(true);setError('');setMessage('');
  try{
   const response=await fetch(endpoint,{method:'PATCH',headers:{Authorization:'Bearer '+await token(),'Content-Type':'application/json'},body:JSON.stringify({vehicleId:id,action}),signal:AbortSignal.timeout(20000)});
   const result=await response.json();if(!response.ok)throw Error(result.error||'Assignment could not be saved.');
   setMessage(result.message);await load();window.dispatchEvent(new Event(WORKSPACE_READINESS_CHANGED));
  }catch(reason){setError(reason instanceof Error?reason.message:'Assignment could not be saved.');}finally{busy.current=false;setWorking(false);}
 }
 const assigned=snapshot?.vehicles.filter(v=>v.assigned_driver_id===snapshot.driverId&&v.status==='active')??[];
 return <main style={{maxWidth:960,margin:'0 auto',padding:16,color:'#1a1f2b',display:'grid',gap:14}}>
  <header><h1 style={{margin:'0 0 6px',fontSize:24,color:'#0b2f6b'}}>Vehicle readiness</h1><p style={{margin:0}}>Resolve the exact vehicle assignment or document restriction. No job is posted or quoted here.</p></header>
  {error&&<div role="alert" style={{...panel,color:'#b91c1c'}}>{error} <button type="button" style={button} disabled={working||loading} onClick={()=>void load()}>Retry check</button></div>}
  {message&&<div role="status" style={panel}>{message}</div>}
  {loading?<p role="status">Loading your vehicle requirements...</p>:snapshot&&<>
   <section id="vehicle-assignment" aria-label="Vehicle assignment" style={panel}>
    <h2 style={{fontSize:18,marginTop:0}}>Vehicle assignment</h2>
    <p>{assigned.length===1?'One active vehicle is assigned to you.':assigned.length===0?'No active vehicle is assigned to you.':'More than one active assignment needs attention.'}</p>
    {!snapshot.canManageAssignment&&<p>Your company administrator manages vehicle assignments. You can upload documents for your assigned vehicle below. <a href="/driver/support?reason=vehicle-assignment">Ask for company assignment help</a></p>}
    <div style={{display:'grid',gap:8}}>{snapshot.vehicles.map(v=><div key={v.id} style={{display:'flex',flexWrap:'wrap',alignItems:'center',gap:10,borderTop:'1px solid #e5e7eb',paddingTop:8}}>
     <span style={{flex:'1 1 240px'}}><strong>{v.reg_plate||'Registration not supplied'}</strong> - {v.type?.replaceAll('_',' ')} - {v.status}<br/>{v.assigned_driver_id===snapshot.driverId?'Assigned to you':v.assigned_driver_id?'Assigned to another company driver':'Not assigned'}</span>
     {snapshot.canManageAssignment&&v.assigned_driver_id===snapshot.driverId&&<button style={button} type="button" disabled={working} onClick={()=>void assign(v.id,'unassign')}>Remove assignment</button>}
     {snapshot.canManageAssignment&&!v.assigned_driver_id&&v.status==='active'&&<button style={button} type="button" disabled={working||assigned.length>0} onClick={()=>void assign(v.id,'assign')}>Assign to me</button>}
    </div>)}</div>
    {snapshot.canManageAssignment&&<p><a href="/driver/vehicles?action=add" target="_blank" rel="noopener noreferrer">Add a company vehicle</a></p>}
   </section>
   <section id="vehicle-document-upload" aria-label="Upload vehicle document" style={panel}>
    <h2 style={{fontSize:18,marginTop:0}}>Upload vehicle document</h2>
    <p>Select the exact vehicle and the missing or expired document. Verification is required after upload.</p>
    {assigned.length===0?<p>Resolve the active vehicle assignment above before uploading its evidence.</p>:<div style={{display:'grid',gap:12}}>
     <label>Assigned vehicle<select style={field} value={vehicleId} onChange={e=>setVehicleId(e.target.value)}>{assigned.map(v=><option key={v.id} value={v.id}>{v.reg_plate||v.type||'Assigned vehicle'}</option>)}</select></label>
     <label>Document type<select style={field} value={docType} onChange={e=>setDocType(e.target.value)}><option value="mot">MOT</option><option value="insurance">Vehicle insurance</option></select></label>
     <label>Issue date (optional)<input style={field} type="date" value={issued} onChange={e=>setIssued(e.target.value)}/></label>
     <label>Expiry date<input style={field} type="date" required value={expiry} onChange={e=>setExpiry(e.target.value)}/></label>
     <label>Document file<input id="vehicle-document-file" ref={fileInput} style={field} type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={e=>setFile(e.target.files?.[0]??null)}/></label>
     <button style={button} type="button" disabled={working||!file||!expiry} onClick={()=>void submit()}>{working?'Saving...':'Submit vehicle document for verification'}</button>
    </div>}
    {snapshot.documents.length>0&&<div style={{marginTop:16}}><h3>Submitted vehicle evidence</h3>{snapshot.documents.map(d=><p key={d.id}><strong>{d.doc_type.toUpperCase()}</strong> - {d.status}{d.expiry_date?' - expires '+d.expiry_date:''}{d.rejection_reason?' - '+d.rejection_reason:''}</p>)}</div>}
   </section>
  </>}
  <p><a href="/driver/loads">Back to Loads</a> - <button type="button" style={button} disabled={working||loading} onClick={()=>{void load();window.dispatchEvent(new Event(WORKSPACE_READINESS_CHANGED));}}>Re-check requirements</button></p>
 </main>;
}
