"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import {getAutonomousSessionEpoch} from "../../../lib/try-xdrive-demo/authenticatedFetch";
type Message={id:string;jobId:string;from:string;senderName:string;text:string;createdAt:string;own:boolean};
/** Isolated, persisted message exchange accessible only to booking participants. */
export default function AutonomousBookingMessages({jobId}:{jobId:string}){
 const [messages,setMessages]=useState<Message[]>([]),[draft,setDraft]=useState(""),[error,setError]=useState(""),[notice,setNotice]=useState(""),[busy,setBusy]=useState(false);
 const version=useRef(0);
 const refresh=useCallback(async()=>{
  const request=++version.current,epoch=getAutonomousSessionEpoch();
  const current=()=>request===version.current&&epoch===getAutonomousSessionEpoch();
  try{
   const r=await fetch("/api/autonomous/v1/bookings/messages?jobId="+encodeURIComponent(jobId),{credentials:"same-origin",cache:"no-store"});
   if(!r.ok)throw Error(r.status===403?"Only the buyer, awarded carrier and allocated driver may read this conversation":"Booking conversation unavailable");
   const rows=await r.json() as Message[];
   if(current()){setMessages(rows);setError("")}
  }catch(e){if(current()){setMessages([]);setError(e instanceof Error?e.message:"Conversation unavailable")}}
 },[jobId]);
 useEffect(()=>{
  const clear=()=>{version.current++;setMessages([]);setDraft("");setNotice("");setError("");void refresh()};
  void refresh();const interval=setInterval(()=>void refresh(),4500);
  window.addEventListener("xdrive-demo-session-change",clear);
  return()=>{
   // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional invalidation of pending requests
   version.current++;clearInterval(interval);window.removeEventListener("xdrive-demo-session-change",clear);
  };
 },[refresh]);
 const send=async()=>{
  if(!draft.trim())return;
  setBusy(true);setError("");setNotice("");
  const text=draft.trim();
  try{
   const r=await fetch("/api/autonomous/v1/bookings/messages",{method:"POST",credentials:"same-origin",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({jobId,text,clientToken:crypto.randomUUID()})});
   const result=await r.json() as {error?:string};
   if(!r.ok)throw Error(result.error||"Message rejected");
   setDraft("");setNotice("Message saved to this booking's isolated ledger. No external email or SMS was sent.");
   await refresh();
  }catch(e){setError(e instanceof Error?e.message:"Unable to send message")}
  finally{setBusy(false)}
 };
 return <section className="panel" aria-label={"Booking messages for "+jobId}>
  <h3>Booking Messages · {jobId}</h3>
  <p className="notice">Private to the buyer, awarded carrier and allocated driver. Stored only in the isolated test ledger; not delivered by external email, SMS or push.</p>
  {error&&<p role="alert">{error}</p>}
  <div aria-live="polite" style={{display:"grid",gap:7,maxHeight:260,overflowY:"auto",border:"1px solid #dce4ee",borderRadius:8,padding:10}}>
   {!messages.length&&!error&&<p>No messages have been recorded for this booking.</p>}
   {messages.map(m=><article key={m.id} style={{padding:8,borderRadius:7,background:m.own?"#edf7ec":"#f4f6f8",maxWidth:"100%"}}>
    <strong>{m.senderName} {m.own?"· Me":""}</strong><small style={{marginLeft:9}}>{new Date(m.createdAt).toLocaleString("en-GB")}</small>
    <p style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere"}}>{m.text}</p>
   </article>)}
  </div>
  <label style={{display:"grid",gap:6,marginTop:12}}>New booking message
   <textarea value={draft} maxLength={2000} onChange={e=>setDraft(e.target.value)} rows={3} placeholder="Write a message to the assigned booking participants"/>
  </label>
  <div style={{display:"flex",gap:10,alignItems:"center",marginTop:8}}>
   <button type="button" className="primary" disabled={busy||!draft.trim()||Boolean(error)} onClick={()=>void send()}>{busy?"Saving…":"Save Booking Message"}</button>
   <button type="button" disabled={busy} onClick={()=>void refresh()}>Refresh</button>
  </div>
  {notice&&<p role="status">{notice}</p>}
 </section>;
}
