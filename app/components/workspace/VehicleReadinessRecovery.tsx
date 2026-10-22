'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '../AuthContext';
import { supabase } from '../../../lib/supabaseClient';
import { WORKSPACE_READINESS_CHANGED } from '../../../lib/workspaceReadiness';
import { VehicleRegisterShell } from './VehicleRegisterShell';

type Vehicle = {id:string;reg_plate:string|null;type:string|null;status:string;assigned_driver_id:string|null};
type Document = {id:string;vehicle_id:string;doc_type:string;status:string;expiry_date:string|null;rejection_reason:string|null};
type Snapshot = {companyId:string;driverId:string;canManageAssignment:boolean;vehicles:Vehicle[];documents:Document[]};
const field = {width:'100%',minHeight:40,padding:'9px 10px',border:'1px solid #c8d3e0',borderRadius:7,background:'#fff',color:'#111827',fontSize:14} as const;
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
 return <VehicleRegisterShell
  title="Vehicle readiness"
  subtitle="Manage the vehicle linked to your driver account and keep its required evidence current."
  actions={<>
    {!loading&&snapshot&&<span style={assigned.length===1?statusPill:{...statusPill,background:'#fff4e5',color:'#965b00'}}>{assigned.length===1?'Vehicle ready':'Vehicle action required'}</span>}
    <button type="button" disabled={working||loading} onClick={()=>{void load();window.dispatchEvent(new Event(WORKSPACE_READINESS_CHANGED));}}>Re-check</button>
  </>}
 >
  {error&&<div role="alert" className="xdrive-alert-banner" style={{marginBottom:8,background:'#fef2f2',border:'1px solid #fca5a5',color:'#9f1d1d'}}>{error}</div>}
  {message&&<div role="status" className="xdrive-alert-banner" style={{marginBottom:8,background:'#f0fdf4',border:'1px solid #bbf7d0',color:'#166534'}}>{message}</div>}
  {loading?<section className="carrier-register-results"><div className="carrier-register-empty" style={{padding:'3rem',textAlign:'center'}}>Loading your vehicle requirements...</div></section>:snapshot&&<>
   <section id="vehicle-assignment" aria-label="Vehicle assignment" className="carrier-register-results" style={{marginBottom:8}}>
    <div className="carrier-register-results__header" style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:10}}>
     <div><strong>Vehicle assignment</strong><div style={{color:'#64748b',fontSize:12}}>{assigned.length===1?'Your active vehicle is linked to this driver account.':assigned.length===0?'No active vehicle is linked to this driver account yet.':'More than one active assignment needs attention.'}</div></div>
     <span style={assigned.length===1?statusPill:{...statusPill,background:'#fff4e5',color:'#965b00'}}>{assigned.length===1?'Active':'Needs setup'}</span>
    </div>
    <div style={{padding:10}}>
     {!snapshot.canManageAssignment&&<div style={{padding:10,border:'1px solid #e2e8f0',background:'#f8fafc',fontSize:12}}>Your company administrator manages vehicle assignments. You can still upload documents for your assigned vehicle. <a href="/driver/support?reason=vehicle-assignment">Request assignment help</a>.</div>}
     {snapshot.canManageAssignment&&assigned.length===0&&<div style={{padding:14,border:'1px dashed #b7c5d8',background:'#f8fafc'}}>
      <strong style={{display:'block',marginBottom:4}}>Add your first vehicle</strong>
      <span style={{display:'block',fontSize:12,color:'#64748b',marginBottom:10}}>Registration, vehicle type, capacity and equipment are saved in My Vehicle.</span>
      <a href="/driver/vehicles?action=add" className="carrier-register-action" style={{display:'inline-flex',textDecoration:'none'}}>+ Add Vehicle</a>
     </div>}
     {snapshot.vehicles.length>0&&<div className="carrier-register-table-wrap" style={{marginTop:10}}><table className="carrier-register-table"><thead><tr><th>Registration</th><th>Type</th><th>Status</th><th>Assignment</th><th>Action</th></tr></thead><tbody>
      {snapshot.vehicles.map(v=><tr key={v.id}><td><strong>{v.reg_plate||'Not supplied'}</strong></td><td>{v.type?.replaceAll('_',' ')||'Not recorded'}</td><td>{v.status}</td><td>{v.assigned_driver_id===snapshot.driverId?'Assigned to you':v.assigned_driver_id?'Assigned to another company driver':'Not assigned'}</td><td>{snapshot.canManageAssignment&&v.assigned_driver_id===snapshot.driverId?<button type="button" disabled={working} onClick={()=>void assign(v.id,'unassign')}>Remove assignment</button>:snapshot.canManageAssignment&&!v.assigned_driver_id&&v.status==='active'?<button type="button" disabled={working||assigned.length>0} onClick={()=>void assign(v.id,'assign')}>Assign to me</button>:'-'}</td></tr>)}
     </tbody></table></div>}
     {snapshot.canManageAssignment&&assigned.length>0&&<div style={{marginTop:10,fontSize:12}}><a href="/driver/vehicles?action=add">Manage vehicles in My Vehicle</a></div>}
    </div>
   </section>

   <section id="vehicle-document-upload" aria-label="Upload vehicle document" className="carrier-register-results">
    <div className="carrier-register-results__header"><strong>Vehicle documents</strong><div style={{color:'#64748b',fontSize:12}}>Upload current MOT or insurance evidence for the active vehicle. Verification remains required.</div></div>
    <div style={{padding:10}}>
     {assigned.length===0?<div className="carrier-register-empty" style={{padding:'2rem',textAlign:'center'}}>Add or assign your active vehicle first. The document form will unlock automatically.</div>:<div style={{display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:8}}>
      <label style={{gridColumn:'1 / -1',fontSize:11,fontWeight:700,color:'#64748b'}}>Assigned vehicle<select style={field} value={vehicleId} onChange={e=>setVehicleId(e.target.value)}>{assigned.map(v=><option key={v.id} value={v.id}>{v.reg_plate||v.type||'Assigned vehicle'}</option>)}</select></label>
      <label style={{gridColumn:'1 / -1',fontSize:11,fontWeight:700,color:'#64748b'}}>Document type<select style={field} value={docType} onChange={e=>setDocType(e.target.value)}><option value="mot">MOT</option><option value="insurance">Vehicle insurance</option></select></label>
      <label style={{fontSize:11,fontWeight:700,color:'#64748b'}}>Issue date (optional)<input style={field} type="date" value={issued} onChange={e=>setIssued(e.target.value)}/></label>
      <label style={{fontSize:11,fontWeight:700,color:'#64748b'}}>Expiry date<input style={field} type="date" required value={expiry} onChange={e=>setExpiry(e.target.value)}/></label>
      <label style={{gridColumn:'1 / -1',fontSize:11,fontWeight:700,color:'#64748b'}}>Document file<input id="vehicle-document-file" ref={fileInput} style={field} type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={e=>setFile(e.target.files?.[0]??null)}/></label>
      <button className="carrier-register-action" style={{gridColumn:'1 / -1'}} type="button" disabled={working||!file||!expiry} onClick={()=>void submit()}>{working?'Saving...':'Submit for verification'}</button>
     </div>}
     {snapshot.documents.length>0&&<div style={{marginTop:12}}><div className="carrier-register-table-wrap"><table className="carrier-register-table"><thead><tr><th>Document</th><th>Status</th><th>Expiry</th><th>Note</th></tr></thead><tbody>{snapshot.documents.map(d=><tr key={d.id}><td>{d.doc_type.toUpperCase()}</td><td>{d.status}</td><td>{d.expiry_date||'-'}</td><td>{d.rejection_reason||'-'}</td></tr>)}</tbody></table></div></div>}
    </div>
   </section>
  </>}
  <div style={{marginTop:8,fontSize:12}}><a href="/driver/loads">Back to Loads</a></div>
 </VehicleRegisterShell>;
}
