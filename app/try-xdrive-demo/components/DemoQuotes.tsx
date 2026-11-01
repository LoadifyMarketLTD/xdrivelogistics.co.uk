"use client";
import {useEffect,useMemo,useState} from "react";
import {useDemoLoads} from "./demoExchange";
import {authenticatedDemoFetch,getAutonomousSessionEpoch} from "../../../lib/try-xdrive-demo/authenticatedFetch";
import XDriveLoadCard from "./XDriveLoadCard";
import "./demo-quotes-board.css";

type Quote={id:string;loadId:string;role:string;amount:number;vehicle?:string;etaMinutes?:number;notes?:string;createdAt:string;status:"Open"|"Withdrawn"|"Accepted"|"Rejected";route?:{from:string;to:string;vehicle:string}|null};
export function useDemoQuotes(view:"mine"|"received"="mine"){
 const [quotes,setQuotes]=useState<Quote[]>([]);
 useEffect(()=>{
  let mounted=true,version=0;
  const refresh=async()=>{
   const request=++version,epoch=getAutonomousSessionEpoch();
   try{
    const r=await authenticatedDemoFetch("/api/try-xdrive-demo/quotes"+(view==="received"?"?view=received":""),{cache:"no-store"});
    if(!r.ok)throw Error("Quotes unavailable");
    const data=await r.json() as unknown;
    if(mounted&&request===version&&epoch===getAutonomousSessionEpoch())setQuotes(Array.isArray(data)?data:[]);
   }catch{
    if(mounted&&request===version&&epoch===getAutonomousSessionEpoch())setQuotes([]);
   }
  };
  void refresh();
  const timer=setInterval(()=>void refresh(),3500);
  const onSession=()=>{if(mounted)setQuotes([]);void refresh()};
  window.addEventListener("xdrive-demo-quote-change",refresh);
  window.addEventListener("xdrive-demo-session-change",onSession);
  return()=>{mounted=false;version++;clearInterval(timer);window.removeEventListener("xdrive-demo-quote-change",refresh);window.removeEventListener("xdrive-demo-session-change",onSession)};
 },[view]);
 return quotes;
}
export async function submitDemoQuote(loadId:string,role:string,amount:number,details?:{vehicle?:string;etaMinutes?:number;etaLabel?:string;notes?:string}){const r=await authenticatedDemoFetch("/api/try-xdrive-demo/quotes",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({loadId,role,amount,...details})});if(!r.ok)throw Error((await r.json()).error||"Quote failed");window.dispatchEvent(new Event("xdrive-demo-quote-change"))}
export async function withdrawDemoQuote(id:string){const r=await authenticatedDemoFetch("/api/try-xdrive-demo/quotes",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({id,status:"Withdrawn"})});if(!r.ok)throw Error("Could not withdraw quote");window.dispatchEvent(new Event("xdrive-demo-quote-change"))}
export default function DemoMyQuotes({role:_role="Driver",onFindLoads}:{role?:string;onFindLoads?:()=>void}){
 const quotes=useDemoQuotes(),loads=useDemoLoads(),[error,setError]=useState(""),[tab,setTab]=useState("All"),[search,setSearch]=useState(""),[sort,setSort]=useState("Newest First"),[selected,setSelected]=useState<Quote|null>(null);
 const data=useMemo(()=>quotes.filter(q=>(tab==="All"||q.status===tab)&&(!search||[q.id,q.loadId,q.route?.from,q.route?.to,loads.find(l=>l.id===q.loadId)?.from,loads.find(l=>l.id===q.loadId)?.to].join(" ").toLowerCase().includes(search.toLowerCase()))).sort((a,b)=>sort==="Price (Highest)"?b.amount-a.amount:sort==="Price (Lowest)"?a.amount-b.amount:new Date(b.createdAt).getTime()-new Date(a.createdAt).getTime()),[quotes,loads,tab,search,sort]);
 const counts=(s:string)=>s==="All"?quotes.length:quotes.filter(q=>q.status===s).length;
 return <section className="xd-quotes-page">
  <header className="xd-quotes-heading"><h1>{onFindLoads?"My Quotes":"Quotes"}</h1><p>Manage your submitted freight quotations and their status</p></header>
  <nav className="xd-quotes-tabs">{["All","Open","Accepted","Rejected","Withdrawn"].map(s=><button key={s} className={tab===s?"active":""} onClick={()=>setTab(s)}>{s} <b>{counts(s)}</b></button>)}</nav>
  <div className="xd-quotes-stats">{[{name:"Total Quotes",value:quotes.length,tone:"orange"},{name:"Open Quotes",value:counts("Open"),tone:"blue"},{name:"Accepted",value:counts("Accepted"),tone:"green"},{name:"Rejected",value:counts("Rejected"),tone:"red"},{name:"Withdrawn",value:counts("Withdrawn"),tone:"gray"}].map(s=><div key={s.name} className={"xd-quotes-stat "+s.tone}><small>{s.name}</small><strong>{s.value}</strong></div>)}</div>
  <div className="xd-quotes-layout"><aside className="xd-quotes-filter"><h3>Find Quotes</h3><label>Search route / reference<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="e.g. BB1, DA8 or XDR-10457"/></label><label>Status<select value={tab} onChange={e=>setTab(e.target.value)}>{["All","Open","Accepted","Rejected","Withdrawn"].map(s=><option key={s}>{s}</option>)}</select></label><button onClick={()=>{setSearch("");setTab("All")}}>↻ Clear Filters</button><button className="xd-quotes-find" onClick={()=>setSelected(null)}>⌕ Search Quotes</button></aside>
   <div className="xd-quotes-results"><div className="xd-quotes-toolbar"><h3>My Quotes <span>({data.length})</span></h3><label>Sort by: <select value={sort} onChange={e=>setSort(e.target.value)}><option>Newest First</option><option>Price (Highest)</option><option>Price (Lowest)</option></select></label></div>
    {data.length===0&&<div className="xd-quotes-empty"><strong>{quotes.length?"No quotes match these filters":"No submitted quotes yet"}</strong><p>{quotes.length?"Change your filters to see other quotes.":"Submit a quote from Loads to see it here. Only actual submitted quotes are displayed."}</p>{onFindLoads&&<button type="button" className="xd-quotes-find" onClick={onFindLoads}>Find Loads →</button>}</div>}
    {data.map(q=>{const l=loads.find(x=>x.id===q.loadId);const from=l?.from||q.route?.from||"Collection location";const to=l?.to||q.route?.to||"Delivery location";return <XDriveLoadCard key={q.id} data={{id:q.loadId,from,to,date:(l?.pickupDate||q.createdAt.slice(0,10)),status:q.status,vehicle:q.vehicle||l?.vehicle||q.route?.vehicle||"Vehicle TBC",cargo:l?.pallets?String(l.pallets)+" Pallets":"Cargo in details",weight:l?.weight?String(l.weight)+" kg":"Weight in details",packaging:l?.packaging||"Freight",paymentTerms:l?.paymentTerms||"See load details",collection:l?.pickupDate,delivery:l?.deliveryDate,company:l?.customer}} onDetails={()=>setSelected(q)} actions={<button className="quote" onClick={()=>setSelected(q)}>View Quote</button>} extra={<div className="xd-quotes-price"><strong>£{q.amount.toFixed(2)}</strong><small>{q.etaMinutes===undefined?"ETA not specified":q.etaMinutes+" min to collection"}</small>{q.status==="Open"&&<button onClick={()=>withdrawDemoQuote(q.id).catch(e=>setError(e.message))}>Cancel Quote</button>}</div>}/>})}
   </div>
  </div>
  {selected&&<div className="xd-quotes-overlay" onClick={()=>setSelected(null)}><section className="xd-quotes-modal" onClick={e=>e.stopPropagation()}><header><h2>Quote Details — {selected.loadId}</h2><button onClick={()=>setSelected(null)} aria-label="Close">✕</button></header><div><p><b>Route:</b> {loads.find(l=>l.id===selected.loadId)?.from||selected.route?.from||"See load"} → {loads.find(l=>l.id===selected.loadId)?.to||selected.route?.to||"See load"}</p><p><b>Quote amount:</b> £{selected.amount.toFixed(2)}</p><p><b>Status:</b> {selected.status}</p><p><b>Vehicle:</b> {selected.vehicle||"Not specified"}</p><p><b>ETA to collection:</b> {selected.etaMinutes===undefined?"Not supplied":selected.etaMinutes+" minutes"}</p><p><b>Notes:</b> {selected.notes||"No notes supplied"}</p><p><b>Submitted:</b> {new Date(selected.createdAt).toLocaleString("en-GB")}</p>{selected.status==="Open"&&<button className="xd-quotes-find" onClick={()=>withdrawDemoQuote(selected.id).then(()=>setSelected(null)).catch(e=>setError(e.message))}>Cancel Quote</button>}</div></section></div>}
  {error&&<p role="alert">{error}</p>}
 </section>
}


