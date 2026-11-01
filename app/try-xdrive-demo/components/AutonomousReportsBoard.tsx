"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import {getAutonomousSessionEpoch} from "../../../lib/try-xdrive-demo/authenticatedFetch";
import "./demo-reports-board.css";
type Load={id:string;from:string;to:string;vehicle:string;status:string;operationalStatus?:string;postedAt:string;podReceived?:boolean;assignedDriver?:string;quote?:number};
type Quote={id:string;loadId:string;amount:number;status:string;createdAt:string};
type Invoice={id:string;jobId:string;amountExVat:number;status:string;createdAt:string};
type Fleet={drivers:{id:string;name:string}[];vehicles:{id:string;label:string}[]};
const categories=["Overview","Loads","Quotes","Bookings","Invoices","Drivers","Vehicles"];
const money=(n:number)=>n.toLocaleString("en-GB",{style:"currency",currency:"GBP"});
const escapeCsv=(v:unknown)=>{const raw=String(v??"");const safe=/^[=+@\-\t\r]/.test(raw)?"'"+raw:raw;return '"'+safe.replaceAll('"','""')+'"'};
export default function AutonomousReportsBoard(){
 const [loads,setLoads]=useState<Load[]>([]),[quotes,setQuotes]=useState<Quote[]>([]),[invoices,setInvoices]=useState<Invoice[]>([]),[fleet,setFleet]=useState<Fleet>({drivers:[],vehicles:[]});
 const [period,setPeriod]=useState("30"),[section,setSection]=useState("Overview"),[search,setSearch]=useState(""),[error,setError]=useState(""),[busy,setBusy]=useState(false);
 const version=useRef(0);
 const refresh=useCallback(async()=>{
  const request=++version.current,epoch=getAutonomousSessionEpoch();
  const current=()=>request===version.current&&epoch===getAutonomousSessionEpoch();
  setBusy(true);
  try{
   const requests=["loads","loads?view=bookings","quotes","quotes?view=received","invoices","fleet"].map(path=>fetch("/api/autonomous/v1/"+path,{credentials:"same-origin",cache:"no-store"}));
   const responses=await Promise.all(requests);
   if(responses.some(r=>!r.ok))throw Error("Select a valid isolated local workspace; operational reports require an authenticated local ledger");
   const [owned,booked,mine,received,inv,fl]=await Promise.all(responses.map(r=>r.json())) as [Load[],Load[],Quote[],Quote[],Invoice[],Fleet];
   if(!current())return;
   setLoads([...new Map([...owned,...booked].map(x=>[x.id,x])).values()]);
   setQuotes([...new Map([...mine,...received].map(x=>[x.id,x])).values()]);
   setInvoices(inv);setFleet(fl);setError("");
  }catch(e){
   if(current()){setLoads([]);setQuotes([]);setInvoices([]);setFleet({drivers:[],vehicles:[]});setError(e instanceof Error?e.message:"Report unavailable")}
  }finally{if(current())setBusy(false)}
 },[]);
 useEffect(()=>{
  void refresh();
  const other=["xdrive-demo-loads-changed","xdrive-demo-quote-change","xdrive-demo-booking-change","xdrive-demo-invoice-change"];
  const onSession=()=>{
   version.current++;setLoads([]);setQuotes([]);setInvoices([]);setFleet({drivers:[],vehicles:[]});
   setError("");setSearch("");void refresh();
  };
  window.addEventListener("xdrive-demo-session-change",onSession);
  for(const e of other)window.addEventListener(e,refresh);
  return()=>{
   // eslint-disable-next-line react-hooks/exhaustive-deps -- reject stale report results after unmount
   version.current++;
   window.removeEventListener("xdrive-demo-session-change",onSession);
   for(const e of other)window.removeEventListener(e,refresh);
  };
 },[refresh]);
 const since=period==="all"?0:Date.now()-Number(period)*86400000;
 const dateOk=(iso:string)=>since===0||Boolean(iso&&new Date(iso).getTime()>=since);
 const l=loads.filter(j=>dateOk(j.postedAt));
 const q=quotes.filter(j=>dateOk(j.createdAt));
 const inv=invoices.filter(j=>dateOk(j.createdAt));
 const booked=l.filter(j=>Boolean(j.assignedDriver)||["pending_acceptance","accepted","allocated","completed"].includes(j.operationalStatus||""));
 const completed=l.filter(j=>j.podReceived),issued=inv.filter(j=>["issued","sent","paid"].includes(j.status)),paid=inv.filter(j=>j.status==="paid");
 const columns:Record<string,{head:string[];rows:(string|number)[][]}>={
  Loads:{head:["Job","Collection","Delivery","Status"],rows:l.map(j=>[j.id,j.from,j.to,j.operationalStatus||j.status])},
  Quotes:{head:["Quote","Job","Amount Ex VAT","Status"],rows:q.map(j=>[j.id,j.loadId,j.amount,j.status])},
  Bookings:{head:["Job","Collection","Delivery","Status"],rows:booked.map(j=>[j.id,j.from,j.to,j.operationalStatus||j.status])},
  Invoices:{head:["Invoice","Job","Amount Ex VAT","Status"],rows:inv.map(j=>[j.id,j.jobId,j.amountExVat,j.status])},
  Drivers:{head:["Driver ID","Name"],rows:fleet.drivers.map(d=>[d.id,d.name])},
  Vehicles:{head:["Vehicle ID","Registration"],rows:fleet.vehicles.map(v=>[v.id,v.label])},
 };
 const selected=columns[section];
 const rows=selected?.rows.filter(r=>!search||r.join(" ").toLowerCase().includes(search.toLowerCase()))||[];
 const csv=()=>{
  const data=selected||columns.Loads;
  const lines=[data.head,...rows].map(r=>r.map(escapeCsv).join(",")).join("\r\n");
  const url=URL.createObjectURL(new Blob(["\uFEFF",lines],{type:"text/csv;charset=utf-8"}));
  const a=document.createElement("a");a.href=url;a.download="xdrive-autonomous-"+section.toLowerCase()+".csv";a.click();
  setTimeout(()=>URL.revokeObjectURL(url),800);
 };
 const kpis=[["Loads",l.length],["Quotes",q.length],["Bookings",booked.length],["Completed with POD",completed.length],["Invoiced · Issued",money(issued.reduce((n,i)=>n+i.amountExVat,0))],["Paid · Recorded",money(paid.reduce((n,i)=>n+i.amountExVat,0))]];
 return <section className="xd-reports" aria-label="Autonomous XDrive operational reports">
  <header className="xd-reports-head"><h1>Reports · Verified Local Ledger</h1>
   <div className="xd-reports-actions"><label>Period<select aria-label="Reporting period" value={period} onChange={e=>setPeriod(e.target.value)}><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option><option value="all">All available records</option></select></label>
   <button onClick={()=>void refresh()} disabled={busy}>{busy?"Refreshing…":"Refresh"}</button><button onClick={csv}>Export CSV</button></div>
  </header>
  {error&&<p role="alert">{error}</p>}
  <p className="notice">All metrics are derived from this account's ledger records, not sample figures. Historical SLA, overdue invoices and live GPS performance are not inferred.</p>
  <div className="xd-reports-metrics">{kpis.map(([name,value],i)=><article key={name} style={{borderLeftColor:["#f97316","#2563eb","#16a34a","#1d57d8","#f59e0b","#16a34a"][i]}}><span>▤</span><div><b>{name}</b><strong>{value}</strong><small>Current selected period</small></div></article>)}</div>
  <nav className="xd-reports-tabs">{categories.map(c=><button key={c} className={section===c?"active":""} onClick={()=>{setSection(c);setSearch("")}}>{c}</button>)}</nav>
  {section==="Overview"?<div className="xd-reports-grid">
   <article className="xd-reports-panel"><h2>Operational Completion</h2><p>Jobs with delivered POD: {completed.length} / {l.length}</p><p>Awaiting POD: {l.filter(j=>j.operationalStatus==="delivered"&&!j.podReceived).length}</p><p>Allocated or underway: {l.filter(j=>["allocated","on_way_pickup","on_site_pickup","loaded","on_way_delivery","on_site_delivery"].includes(j.operationalStatus||"")).length}</p></article>
   <article className="xd-reports-panel"><h2>Financial Register</h2><p>Invoice drafts: {inv.filter(i=>i.status==="draft").length}</p><p>Issued / Sent: {inv.filter(i=>["issued","sent"].includes(i.status)).length}</p><p>Marked paid: {paid.length} · {money(paid.reduce((n,i)=>n+i.amountExVat,0))}</p><small>Marked paid is a manual local bookkeeping action, not a verified bank transfer.</small></article>
   <article className="xd-reports-panel"><h2>Fleet Register</h2><p>Company drivers: {fleet.drivers.length}</p><p>Company vehicles: {fleet.vehicles.length}</p><p>On-time performance: Not measured</p></article>
  </div>:<div className="xd-reports-panel">
   <label>Search this report<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="ID, route or status"/></label>
   <p>{rows.length} records</p><table><thead><tr>{selected?.head.map(h=><th key={h}>{h}</th>)}</tr></thead>
   <tbody>{rows.map((r,i)=><tr key={i}>{r.map((v,j)=><td key={j}>{v}</td>)}</tr>)}</tbody></table>
   {!rows.length&&<p>No actual records match your report filters.</p>}
  </div>}
  <footer className="xd-reports-footnote">LOCAL TEST · data per authorised account and period · not external financial reporting</footer>
 </section>;
}
