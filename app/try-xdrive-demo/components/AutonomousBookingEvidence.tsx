"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import {getAutonomousSessionEpoch} from "../../../lib/try-xdrive-demo/authenticatedFetch";
type Evidence={id:string;jobId:string;phase:string;filename:string;mime:string;size:number;createdAt:string};
export default function AutonomousBookingEvidence({jobId,uploadPhase,onUpdated}:{
 jobId:string;uploadPhase?:"collection"|"delivery";onUpdated?:()=>void;
}){
 const [items,setItems]=useState<Evidence[]>([]),[files,setFiles]=useState<File[]>([]),[busy,setBusy]=useState(false),[notice,setNotice]=useState(""),[error,setError]=useState("");
 const version=useRef(0);
 const refresh=useCallback(async()=>{
  const request=++version.current,epoch=getAutonomousSessionEpoch();
  const current=()=>request===version.current&&epoch===getAutonomousSessionEpoch();
  try{
   const r=await fetch("/api/autonomous/v1/bookings/evidence?jobId="+encodeURIComponent(jobId),{credentials:"same-origin",cache:"no-store"});
   if(!r.ok)throw Error("Cannot read booking evidence without authorisation");
   const data=await r.json() as Evidence[];
   if(current()){setItems(data);setError("")}
  }catch(e){if(current()){setItems([]);setError(e instanceof Error?e.message:"Evidence unavailable")}}
 },[jobId]);
 useEffect(()=>{
  const onSession=()=>{
   version.current++;setItems([]);setFiles([]);setNotice("");setError("");
   void refresh();
  };
  void refresh();
  window.addEventListener("xdrive-demo-session-change",onSession);
  return()=>{
   // eslint-disable-next-line react-hooks/exhaustive-deps -- invalidate in-flight account requests during unmount
   version.current++;window.removeEventListener("xdrive-demo-session-change",onSession);
  };
 },[refresh]);
 const submit=async()=>{
  if(!files.length||!uploadPhase)return;
  setBusy(true);setError("");setNotice("");
  try{
   for(const file of files){
    if(file.size>4*1024*1024||file.size===0)throw Error("Each file must be between 1 byte and 4 MB");
    const body=new FormData();body.append("jobId",jobId);body.append("phase",uploadPhase);body.append("file",file,file.name);
    const r=await fetch("/api/autonomous/v1/bookings/evidence",{method:"POST",body,credentials:"same-origin"});
    const payload=await r.json() as {error?:string};if(!r.ok)throw Error(payload.error||"Evidence upload failed");
   }
   setNotice(files.length+" original evidence file(s) stored in the isolated local booking registry.");
   setFiles([]);await refresh();onUpdated?.();
  }catch(e){setError(e instanceof Error?e.message:"Evidence upload failed")}
  finally{setBusy(false)}
 };
 return <section className="panel" aria-label="Booking documents and evidence">
 <h3>Collection & Delivery Documents</h3>
 {uploadPhase&&<div className="form-grid">
  <label>Attach {uploadPhase==="collection"?"collection":"delivery / POD"} evidence (JPG, PNG, WebP, PDF)
   <input type="file" multiple accept="image/jpeg,image/png,image/webp,application/pdf" onChange={e=>setFiles(Array.from(e.target.files||[]))}/>
  </label>
  <button className="primary" disabled={busy||files.length===0} onClick={()=>void submit()}>{busy?"Uploading…":"Attach "+files.length+" file(s)"}</button>
 </div>}
 {notice&&<p role="status" className="notice">{notice}</p>}
 {error&&<p role="alert">{error}</p>}
 {items.length?items.map(item=><div className="notice" key={item.id}>
  <b>{item.phase==="collection"?"COLLECTION":"DELIVERY"}</b> · {item.filename} · {(item.size/1024).toFixed(1)} KB · {new Date(item.createdAt).toLocaleString("en-GB")}
  <a style={{marginLeft:12}} href={"/api/autonomous/v1/bookings/evidence/"+encodeURIComponent(item.id)} target="_blank" rel="noreferrer">View / Download</a>
 </div>):<p>No uploaded booking documents. No photographs, signatures or POD files are being represented as evidence.</p>}
 </section>;
}
