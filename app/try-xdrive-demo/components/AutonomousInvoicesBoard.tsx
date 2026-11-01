"use client";
import {useEffect,useMemo,useState} from "react";
import {FileSpreadsheet,FileText,RefreshCw,ShieldCheck} from "lucide-react";
import {getAutonomousSessionEpoch} from "../../../lib/try-xdrive-demo/authenticatedFetch";
import "./demo-invoices-board.css";
type Invoice={id:string;jobId:string;status:"draft"|"issued"|"sent"|"paid"|"cancelled";amountExVat:number;vatRate:number;amountIncludingVat:number;createdAt:string;buyerCompany:string;carrierCompany:string};
const tabs=["All Invoices","Draft","Issued","Sent","Paid","Overdue","Cancelled"] as const;
const format=(n:number)=>n.toLocaleString("en-GB",{style:"currency",currency:"GBP"});
function date(iso:string){return new Date(iso).toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"})}
function csvCell(raw:unknown){return '"'+String(raw??"").replaceAll('"','""')+'"'}
export default function AutonomousInvoicesBoard(){
 const [invoices,setInvoices]=useState<Invoice[]>([]);
 const [tab,setTab]=useState<string>("All Invoices"),[search,setSearch]=useState(""),[range,setRange]=useState("Last 90 Days");
 const [sort,setSort]=useState("Newest"),[selected,setSelected]=useState<string|null>(null);
 const [error,setError]=useState(""),[notice,setNotice]=useState(""),[actorCompany,setActorCompany]=useState(""),[busy,setBusy]=useState("");
 useEffect(()=>{
  let active=true,version=0;
  const current=(request:number,epoch:number)=>active&&request===version&&epoch===getAutonomousSessionEpoch();
  const refresh=async()=>{
   const request=++version,epoch=getAutonomousSessionEpoch();
   try{
    const r=await fetch("/api/autonomous/v1/invoices",{credentials:"same-origin",cache:"no-store"});
    if(!r.ok)throw Error(r.status===401?"Choose a local test company first":"Invoice ledger unavailable");
    const list=await r.json() as Invoice[];
    if(current(request,epoch)){setInvoices(Array.isArray(list)?list:[]);setError("")}
   }catch(e){if(current(request,epoch)){setInvoices([]);setError(e instanceof Error?e.message:"Invoices unavailable")}}
  };
  const syncActor=async()=>{
   const epoch=getAutonomousSessionEpoch();
   try{
    const response=await fetch("/api/autonomous/v1/session",{cache:"no-store",credentials:"same-origin"});
    if(!response.ok)return;
    const data=await response.json() as {actor?:{companyId:string}};
    if(active&&epoch===getAutonomousSessionEpoch())setActorCompany(data.actor?.companyId||"");
   }catch{if(active&&epoch===getAutonomousSessionEpoch())setActorCompany("")}
  };
  void refresh();void syncActor();
  const interval=setInterval(()=>void refresh(),5000);
  const onSession=()=>{
   version++;setInvoices([]);setActorCompany("");setSelected(null);setNotice("");setError("");
   void refresh();void syncActor();
  };
  window.addEventListener("xdrive-demo-session-change",onSession);
  window.addEventListener("xdrive-demo-booking-change",refresh);
  return()=>{active=false;version++;clearInterval(interval);
   window.removeEventListener("xdrive-demo-session-change",onSession);
   window.removeEventListener("xdrive-demo-booking-change",refresh)};

 },[]);
 const filtered=useMemo(()=>{
  const now=Date.now(),windowDays=range==="All Dates"?Infinity:range==="Last 30 Days"?30:90;
  const rows=invoices.filter(x=>(tab==="All Invoices"||x.status.toLowerCase()===tab.toLowerCase())
   &&(!search||[x.id,x.jobId,x.buyerCompany,x.carrierCompany].join(" ").toLowerCase().includes(search.toLowerCase()))
   &&(windowDays===Infinity||now-new Date(x.createdAt).getTime()<=windowDays*86400000));
  return rows.sort((a,b)=>sort==="Amount (Highest)"?b.amountExVat-a.amountExVat:sort==="Amount (Lowest)"?a.amountExVat-b.amountExVat:
    sort==="Oldest"?a.createdAt.localeCompare(b.createdAt):b.createdAt.localeCompare(a.createdAt));
 },[invoices,tab,search,range,sort]);
 const amount=invoices.reduce((n,x)=>n+x.amountExVat,0),paid=invoices.filter(x=>x.status==="paid"),outstanding=invoices.filter(x=>["issued","sent"].includes(x.status));
 const recordStatus=async(invoice:Invoice,status:"issued"|"sent"|"paid")=>{
  setBusy(invoice.id);setError("");setNotice("");
  try{
   const r=await fetch("/api/autonomous/v1/invoices",{method:"PATCH",credentials:"same-origin",
    headers:{"Content-Type":"application/json"},body:JSON.stringify({id:invoice.id,status})});
   const result=await r.json() as {error?:string};
   if(!r.ok)throw Error(result.error||"Invoice status rejected");
   setInvoices(old=>old.map(x=>x.id===invoice.id?{...x,status}:x));
   setNotice("Local invoice tracking updated: "+status.toUpperCase()+". No real invoice, payment or email has been performed.");
   window.dispatchEvent(new Event("xdrive-demo-invoice-change"));
  }catch(e){setError(e instanceof Error?e.message:"Could not update invoice")}
  finally{setBusy("")}
 };
 const exportCsv=()=>{
  const rows=[["Invoice","Job","Created","Buyer","Carrier","Amount Ex VAT","VAT Rate","Status"],...filtered.map(x=>[x.id,x.jobId,x.createdAt,x.buyerCompany,x.carrierCompany,x.amountExVat,x.vatRate,x.status])];
  const text=rows.map(row=>row.map(csvCell).join(",")).join("\r\n");
  const url=URL.createObjectURL(new Blob(["\uFEFF",text],{type:"text/csv;charset=utf-8"}));
  const a=document.createElement("a");a.href=url;a.download="xdrive-new-autonomous-invoices.csv";a.click();URL.revokeObjectURL(url);
 };
 return <section className="xd-invoices">
  <p className="xd-invoices-sub">New autonomous invoice register · LOCAL TEST only · Created from completed bookings with POD</p>
  <div className="xd-invoices-kpis">
   {[
    ["Total Invoices",String(invoices.length),"Recorded draft/issued invoices"],
    ["Invoiced Value",format(amount),"Ex. VAT · local ledger"],
    ["Paid",String(paid.length),format(paid.reduce((n,x)=>n+x.amountExVat,0))],
    ["Outstanding",String(outstanding.length),format(outstanding.reduce((n,x)=>n+x.amountExVat,0))],
    ["Overdue","—","Payment due dates not implemented"]
   ].map(([name,value,sub],i)=><div key={name} className="xd-invoices-kpi" style={{borderLeftColor:["#f97316","#2563eb","#16a34a","#f59e0b","#dc2626"][i]}}>
     <span className="xd-invoices-kpi-icon">{["▤","£","✓","◷","!"][i]}</span><div><small>{name}</small><strong>{value}</strong><span>{sub}</span></div></div>)}
  </div>
  <nav className="xd-invoices-nav">{tabs.map(t=><button className={tab===t?"active":""} key={t} onClick={()=>setTab(t)}>{t} <small>{t==="All Invoices"?invoices.length:invoices.filter(x=>x.status.toLowerCase()===t.toLowerCase()).length}</small></button>)}
   <button className="xd-invoices-new" onClick={()=>setNotice("Invoice drafts are created only after a recorded POD. No invoice is automatically issued or emailed.")}>+ Create Invoice</button>
  </nav>
  <div className="xd-invoices-body">
   <aside className="xd-invoices-sidebar"><h3>Find Invoices</h3><div className="xd-invoices-sidebar-inner">
    <label>Invoice or booking reference<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Reference number"/></label>
    <label>Status<select value={tab} onChange={e=>setTab(e.target.value)}>{tabs.map(t=><option key={t}>{t}</option>)}</select></label>
    <label>Date Range<select value={range} onChange={e=>setRange(e.target.value)}><option>Last 90 Days</option><option>Last 30 Days</option><option>All Dates</option></select></label>
    <button className="xd-invoices-clear" onClick={()=>{setSearch("");setTab("All Invoices");setRange("Last 90 Days")}}><RefreshCw size={15}/> Clear Filters</button>
   </div></aside>
   <div className="xd-invoices-results">
    <div className="xd-invoices-tools"><strong>{filtered.length} verified local invoice(s)</strong>
     <label>Sort by: <select value={sort} onChange={e=>setSort(e.target.value)}>{["Newest","Oldest","Amount (Highest)","Amount (Lowest)"].map(x=><option key={x}>{x}</option>)}</select></label>
     <button onClick={exportCsv}><FileSpreadsheet size={16}/> Export CSV</button>
    </div>
    {error&&<p role="alert">{error}</p>}
    <div className="xd-invoices-list">
     {filtered.map(invoice=><article className="xd-invoices-card" key={invoice.id}>
      <div><strong><FileText size={17}/> {invoice.id}</strong><small>Created: {date(invoice.createdAt)}</small><span className="xd-invoices-status draft">{invoice.status.toUpperCase()}</span></div>
      <div><strong>Local Test Booking</strong><small>Job: {invoice.jobId}</small></div>
      <div><strong>Recipient: {invoice.buyerCompany}</strong><small>Carrier: {invoice.carrierCompany}</small></div>
      <div className="xd-invoices-amount"><small>Amount ex. VAT</small><strong>{format(invoice.amountExVat)}</strong></div>
      <button onClick={()=>setSelected(selected===invoice.id?null:invoice.id)}>{selected===invoice.id?"Close":"View Invoice"}</button>
      {selected===invoice.id&&<div className="xd-invoices-detail">
       <strong><ShieldCheck size={16}/> Local invoice tracking · {invoice.status.toUpperCase()}</strong>
       <p>Amount excluding VAT: {format(invoice.amountExVat)}. VAT: {invoice.vatRate*100}%. Total including VAT: {format(invoice.amountIncludingVat)}.</p>
       <p>Status is a local manual bookkeeping record only. No real PDF, email, payment transfer or tax filing has been made. A formal legal invoice PDF is not yet available.</p>
       {actorCompany===invoice.carrierCompany&&<div className="actions">
        {invoice.status==="draft"&&<button disabled={Boolean(busy)} onClick={()=>void recordStatus(invoice,"issued")}>Record Issued · Local Test</button>}
        {invoice.status==="issued"&&<button disabled={Boolean(busy)} onClick={()=>void recordStatus(invoice,"sent")}>Record Sent · Manual Confirmation</button>}
        {(invoice.status==="issued"||invoice.status==="sent")&&<button disabled={Boolean(busy)} onClick={()=>void recordStatus(invoice,"paid")}>Record Paid · Manual Confirmation</button>}
        {invoice.status==="paid"&&<span>Payment marked confirmed by carrier · local ledger only</span>}
       </div>}
      </div>}
     </article>)}
     {!filtered.length&&<p className="xd-invoices-empty">No actual local invoices match the filters. A confirmed delivery and POD are required before a draft is created.</p>}
    </div>
   </div>
  </div>
  {error&&<p role="alert">{error}</p>}
  {notice&&<p role="status" className="xd-invoices-disclaimer">{notice}</p>}
  <p className="xd-invoices-disclaimer">Independent XDrive DEMO ledger · Never Invoice Pro · No payment, email, billing or tax filing has been performed.</p>
 </section>;
}
