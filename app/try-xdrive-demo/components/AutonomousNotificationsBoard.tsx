"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import {getAutonomousSessionEpoch} from "../../../lib/try-xdrive-demo/authenticatedFetch";
import "./demo-notifications.css";
type Item={
 id:string;jobId:string;type:"Jobs"|"Quotes"|"Bookings"|"Invoices";
 kind:string;title:string;createdAt:string;description:string;read:boolean
};
const categories=["All","Jobs","Quotes","Bookings","Invoices"] as const;
export default function AutonomousNotificationsBoard({onNavigate}:{onNavigate?:(page:number,ref?:string)=>void}){
 const [items,setItems]=useState<Item[]>([]),[category,setCategory]=useState<(typeof categories)[number]>("All"),
 [search,setSearch]=useState(""),[readOnly,setReadOnly]=useState("All"),[period,setPeriod]=useState("30"),
 [selected,setSelected]=useState<string|null>(null),[error,setError]=useState(""),[notice,setNotice]=useState(""),[busy,setBusy]=useState(false);
 const version=useRef(0);
 const refresh=useCallback(async()=>{
  const request=++version.current,epoch=getAutonomousSessionEpoch();
  const current=()=>request===version.current&&epoch===getAutonomousSessionEpoch();
  try{
   const response=await fetch("/api/autonomous/v1/notifications",{cache:"no-store",credentials:"same-origin"});
   if(!response.ok)throw Error(response.status===401?"Choose an isolated local test account":"Notification ledger unavailable");
   const results=await response.json() as Item[];
   if(current()){setItems(results);setError("")}
  }catch(e){if(current()){setItems([]);setError(e instanceof Error?e.message:"Notifications unavailable")}}
 },[]);
 useEffect(()=>{
  const onSession=()=>{
   version.current++;setItems([]);setSelected(null);setNotice("");setError("");
   void refresh();
  };
  void refresh();const ticker=setInterval(()=>void refresh(),7000);
  window.addEventListener("xdrive-demo-session-change",onSession);
  for(const event of ["xdrive-demo-loads-changed","xdrive-demo-booking-change","xdrive-demo-quote-change","xdrive-demo-invoice-change"])window.addEventListener(event,refresh);
  return()=>{
   // eslint-disable-next-line react-hooks/exhaustive-deps -- invalidate requests on unmount
   version.current++;clearInterval(ticker);
   window.removeEventListener("xdrive-demo-session-change",onSession);
   for(const event of ["xdrive-demo-loads-changed","xdrive-demo-booking-change","xdrive-demo-quote-change","xdrive-demo-invoice-change"])window.removeEventListener(event,refresh);
  };
 },[refresh]);
 const cutoff=period==="all"?0:Date.now()-Number(period)*86400000;
 const view=items.filter(item=>
  (category==="All"||category===item.type)&&
  (readOnly==="All"||item.read===(readOnly==="Read"))&&
  (!search||[item.title,item.jobId,item.description].join(" ").toLowerCase().includes(search.toLowerCase()))&&
  (!cutoff||new Date(item.createdAt).getTime()>=cutoff));
 const active=items.find(i=>i.id===selected);
 const mark=async(ids:string[])=>{
  if(!ids.length)return;
  setBusy(true);setError("");
  try{
   const r=await fetch("/api/autonomous/v1/notifications",{method:"PATCH",credentials:"same-origin",
    headers:{"Content-Type":"application/json"},body:JSON.stringify({ids})});
   const result=await r.json() as {error?:string};
   if(!r.ok)throw Error(result.error||"Could not mark notifications as read");
   setItems(old=>old.map(x=>ids.includes(x.id)?{...x,read:true}:x));
   setNotice(ids.length+" local notification(s) marked as read. No email or push was sent.");
  }catch(e){setError(e instanceof Error?e.message:"Notification update rejected")}
  finally{setBusy(false)}
 };
 const choose=(item:Item)=>{setSelected(item.id);if(!item.read)void mark([item.id])};
 const viewLinked=()=>{
  if(!active||!onNavigate)return;
  const tab=active.type==="Quotes"?3:active.type==="Invoices"?8:4;
  onNavigate(tab,active.jobId);
 };
 return <section className="xd-notify" aria-label="Actual autonomous ledger notifications">
  <header><h1>Notifications</h1><p>Events from your authorised local jobs only. No fictional email or POD alerts.</p></header>
  <div className="xd-notify-stats">
   {categories.map((name,i)=><button key={name} className="xd-notify-stat" onClick={()=>setCategory(name)}
    style={{borderLeftColor:["#f18b15","#2563eb","#16a34a","#0b2f6b","#8b5cf6"][i]}}>
    <span>{["▤","🚚","◇","▣","£"][i]}</span><div><b>{name==="All"?"All Notifications":name}</b><strong>{name==="All"?items.length:items.filter(x=>x.type===name).length}</strong></div>
   </button>)}
  </div>
  <nav className="xd-notify-tabs">{categories.map(c=><button key={c} className={category===c?"active":""} onClick={()=>setCategory(c)}>{c}</button>)}
   <button className="xd-notify-mark" disabled={busy||!items.some(x=>!x.read)} onClick={()=>void mark(items.filter(x=>!x.read).map(x=>x.id))}>Mark all read</button>
  </nav>
  <div className="xd-notify-layout">
   <aside className="xd-notify-filter"><h3>Filter Notifications</h3>
    <label>Search<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Job reference or event"/></label>
    <label>Read status<select value={readOnly} onChange={e=>setReadOnly(e.target.value)}><option>All</option><option>Unread</option><option>Read</option></select></label>
    <label>Period<select value={period} onChange={e=>setPeriod(e.target.value)}><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option><option value="all">All Time</option></select></label>
    <button onClick={()=>{setCategory("All");setSearch("");setReadOnly("All");setPeriod("30")}}>Clear Filters</button>
    <button onClick={()=>void refresh()}>Refresh</button>
   </aside>
   <section className="xd-notify-feed">
    <div className="xd-notify-feedhead"><b>{view.length} verified local event(s)</b></div>
    {error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
    {view.map(i=><button className={"xd-notify-event"+(selected===i.id?" selected":"")} key={i.id}
     style={{borderLeftColor:i.read?"#cbd5e1":"#f18b15"}} onClick={()=>choose(i)}>
     <span className="xd-notify-eventicon">{i.read?"✓":"●"}</span><span className="xd-notify-eventcopy">
      <strong>{i.title}</strong><small>{i.description}</small></span>
     <span className="xd-notify-eventright"><small>{new Date(i.createdAt).toLocaleString("en-GB")}</small></span>
    </button>)}
    {!view.length&&<p className="xd-notify-empty">No actual local events match these filters.</p>}
   </section>
   <section className="xd-notify-detail">
    {active?<><h2>{active.title}</h2><p>{active.description}</p>
     <p>Recorded: {new Date(active.createdAt).toLocaleString("en-GB")}</p>
     <p>Event: {active.kind}</p>
     <div className="xd-notify-detailactions">
      {onNavigate?<button onClick={viewLinked}>Open {active.type==="Quotes"?"Quotes":active.type==="Invoices"?"Invoices":"Bookings"}</button>:
       <p>Open your workspace Bookings tab to view the linked job.</p>}
      <button onClick={()=>setSelected(null)}>Close</button>
     </div>
    </>:<p className="xd-notify-empty">Select a ledger event to view it.</p>}
   </section>
  </div>
 </section>;
}
