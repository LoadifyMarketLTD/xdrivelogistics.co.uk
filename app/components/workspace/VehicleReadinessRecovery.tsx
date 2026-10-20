'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '../AuthContext';
import { supabase } from '../../../lib/supabaseClient';
import { WORKSPACE_READINESS_CHANGED } from '../../../lib/workspaceReadiness';

type Vehicle = {id:string;reg_plate:string|null;type:string|null;status:string;assigned_driver_id:string|null};
type Document = {id:string;vehicle_id:string;doc_type:string;status:string;expiry_date:string|null;rejection_reason:string|null};
type Snapshot = {companyId:string;driverId:string;canManageAssignment:boolean;vehicles:Vehicle[];documents:Document[]};
const field = {width:'100%',minHeight:40,padding:'9px 10px',border:'1px solid #c8d3e0',borderRadius:7,background:'#fff',color:'#111827',fontSize:14} as const;
const panel = {padding:20,border:'1px solid #d5deea',borderRadius:10,background:'#fff',minWidth:0,boxShadow:'0 1px 2px rgba(15,23,42,.04)'} as const;
const button = {padding:'10px 16px',border:0,borderRadius:7,background:'#0b2f6b',color:'#fff',fontWeight:800,fontSize:13,cursor:'pointer',display:'inline-flex',alignItems:'center',justifyContent:'center',gap:6} as const;
const quietButton = {...button,background:'#eef3f8',color:'#0b2f6b',border:'1px solid #c9d5e3'} as const;
const statusPill = {display:'inline-flex',alignItems:'center',minHeight:26,padding:'4px 9px',borderRadius:999,background:'#edf7ef',color:'#176b33',fontSize:12,fontWeight:800} as const;
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
 return <main style={{width:'100%',maxWidth:1320,margin:'0 auto',padding:'24px clamp(16px,3vw,36px) 32px',color:'#172033',display:'grid',gap:18}}>
  <header style={{display:'flex',flexWrap:'wrap',alignItems:'flex-end',justifyContent:'space-between',gap:14,paddingBottom:4}}>
   <div>
    <div style={{fontSize:11,fontWeight:900,letterSpacing:'.12em',color:'#1d5aa6',marginBottom:5}}>MY FLEET</div>
    <h1 style={{margin:'0 0 5px',fontSize:'clamp(24px,2.2vw,32px)',lineHeight:1.08,color:'#0b2142'}}>Vehicle readiness</h1>
    <p style={{margin:0,maxWidth:760,color:'#5f6b7b',fontSize:14}}>Manage the vehicle linked to your driver account and keep its required evidence current.</p>
   </div>
   {!loading&&snapshot&&<span style={assigned.length===1?statusPill:{...statusPill,background:'#fff4e5',color:'#965b00'}}>{assigned.length===1?'Vehicle ready':'Vehicle action required'}</span>}
  </header>
  {error&&<div role="alert" style={{...panel,color:'#9f1d1d',display:'flex',flexWrap:'wrap',justifyContent:'space-between',alignItems:'center',gap:12}}><span>{error}</span><button type="button" style={quietButton} disabled={working||loading} onClick={()=>void load()}>Retry check</button></div>}
  {message&&<div role="status" style={{...panel,borderColor:'#b9ddc3',background:'#f5fbf6',color:'#1d6332'}}>{message}</div>}
  {loading?<div role="status" style={panel}>Loading your vehicle requirements...</div>:snapshot&&<div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(300px,1fr))',gap:16,alignItems:'start'}}>
   <section id="vehicle-assignment" aria-label="Vehicle assignment" style={panel}>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,marginBottom:8}}>
     <div><div style={{fontSize:11,fontWeight:900,letterSpacing:'.08em',color:'#64748b'}}>VEHICLE</div><h2 style={{fontSize:20,margin:'2px 0 0',color:'#0b2142'}}>Assignment</h2></div>
     <span style={assigned.length===1?statusPill:{...statusPill,background:'#fff4e5',color:'#965b00'}}>{assigned.length===1?'Active':'Needs setup'}</span>
    </div>
    <p style={{margin:'8px 0 14px',color:'#5f6b7b'}}>{assigned.length===1?'Your active vehicle is linked to this driver account.':assigned.length===0?'No active vehicle is linked to this driver account yet.':'More than one active assignment needs attention.'}</p>
    {!snapshot.canManageAssignment&&<div style={{padding:12,borderRadius:8,background:'#f7f9fc',color:'#465366',fontSize:13}}>Your company administrator manages vehicle assignments. You can still upload documents for your assigned vehicle. <a href="/driver/support?reason=vehicle-assignment">Request assignment help</a>.</div>}
    {snapshot.canManageAssignment&&assigned.length===0&&<div style={{padding:16,border:'1px dashed #b7c5d8',borderRadius:9,background:'#f8fafc',marginBottom:14}}>
     <strong style={{display:'block',fontSize:15,color:'#0b2142',marginBottom:5}}>Add your first vehicle</strong>
     <span style={{display:'block',fontSize:13,color:'#667085',marginBottom:12}}>Registration, vehicle type, capacity and equipment are saved in My Fleet.</span>
     <a href="/driver/vehicles?action=add" style={{...button,textDecoration:'none'}}>Add vehicle</a>
    </div>}
    <div style={{display:'grid',gap:10}}>{snapshot.vehicles.map(v=><div key={v.id} style={{display:'flex',flexWrap:'wrap',alignItems:'center',gap:12,border:'1px solid #e3e8ef',borderRadius:8,padding:12,background:'#fbfcfe'}}>
     <span style={{flex:'1 1 220px',fontSize:13,color:'#5f6b7b'}}><strong style={{display:'block',fontSize:15,color:'#172033',marginBottom:2}}>{v.reg_plate||'Registration not supplied'}</strong>{v.type?.replaceAll('_',' ')||'Vehicle type not recorded'} · {v.status}<br/>{v.assigned_driver_id===snapshot.driverId?'Assigned to you':v.assigned_driver_id?'Assigned to another company driver':'Not assigned'}</span>
     {snapshot.canManageAssignment&&v.assigned_driver_id===snapshot.driverId&&<button style={quietButton} type="button" disabled={working} onClick={()=>void assign(v.id,'unassign')}>Remove assignment</button>}
     {snapshot.canManageAssignment&&!v.assigned_driver_id&&v.status==='active'&&<button style={button} type="button" disabled={working||assigned.length>0} onClick={()=>void assign(v.id,'assign')}>Assign to me</button>}
    </div>)}</div>
    {snapshot.canManageAssignment&&assigned.length>0&&<div style={{marginTop:14,fontSize:13}}><a href="/driver/vehicles?action=add">Manage vehicles in My Fleet</a></div>}
   </section>
   <section id="vehicle-document-upload" aria-label="Upload vehicle document" style={panel}>
    <div style={{fontSize:11,fontWeight:900,letterSpacing:'.08em',color:'#64748b'}}>COMPLIANCE</div>
    <h2 style={{fontSize:20,margin:'2px 0 6px',color:'#0b2142'}}>Vehicle documents</h2>
    <p style={{margin:'0 0 14px',color:'#5f6b7b',fontSize:14}}>Upload current MOT or insurance evidence for the active vehicle. Verification remains required.</p>
    {assigned.length===0?<div style={{padding:14,borderRadius:8,background:'#f8fafc',color:'#667085',fontSize:13}}>Add or assign your active vehicle first. The document form will unlock automatically.</div>:<div style={{display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:12}}>
     <label style={{gridColumn:'1 / -1',fontSize:13,fontWeight:700}}>Assigned vehicle<select style={field} value={vehicleId} onChange={e=>setVehicleId(e.target.value)}>{assigned.map(v=><option key={v.id} value={v.id}>{v.reg_plate||v.type||'Assigned vehicle'}</option>)}</select></label>
     <label style={{gridColumn:'1 / -1',fontSize:13,fontWeight:700}}>Document type<select style={field} value={docType} onChange={e=>setDocType(e.target.value)}><option value="mot">MOT</option><option value="insurance">Vehicle insurance</option></select></label>
     <label style={{fontSize:13,fontWeight:700}}>Issue date <span style={{fontWeight:500,color:'#7a8594'}}>(optional)</span><input style={field} type="date" value={issued} onChange={e=>setIssued(e.target.value)}/></label>
     <label style={{fontSize:13,fontWeight:700}}>Expiry date<input style={field} type="date" required value={expiry} onChange={e=>setExpiry(e.target.value)}/></label>
     <label style={{gridColumn:'1 / -1',fontSize:13,fontWeight:700}}>Document file<input id="vehicle-document-file" ref={fileInput} style={field} type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={e=>setFile(e.target.files?.[0]??null)}/></label>
     <button style={{...button,gridColumn:'1 / -1'}} type="button" disabled={working||!file||!expiry} onClick={()=>void submit()}>{working?'Saving...':'Submit for verification'}</button>
    </div>}
    {snapshot.documents.length>0&&<div style={{marginTop:18,paddingTop:14,borderTop:'1px solid #e5eaf0'}}><h3 style={{fontSize:14,margin:'0 0 8px'}}>Submitted evidence</h3>{snapshot.documents.map(d=><div key={d.id} style={{fontSize:13,padding:'7px 0',borderTop:'1px solid #f0f2f5'}}><strong>{d.doc_type.toUpperCase()}</strong> · {d.status}{d.expiry_date?' · expires '+d.expiry_date:''}{d.rejection_reason?' · '+d.rejection_reason:''}</div>)}</div>}
   </section>
  </div>}
  <div style={{display:'flex',flexWrap:'wrap',alignItems:'center',justifyContent:'space-between',gap:12,paddingTop:2,fontSize:13}}>
   <a href="/driver/loads">Back to Loads</a>
   <button type="button" style={quietButton} disabled={working||loading} onClick={()=>{void load();window.dispatchEvent(new Event(WORKSPACE_READINESS_CHANGED));}}>Re-check requirements</button>
  </div>
 </main>;
}
