"use client";
import {useState} from "react";
import {useDemoLoads} from "./demoExchange";
import {authenticatedDemoFetch} from "../../../lib/try-xdrive-demo/authenticatedFetch";
import {useDemoQuotes} from "./DemoQuotes";
import DemoLoadSummary from "./DemoLoadSummary";
import "./demo-received-quotes.css";
export default function DemoReceivedQuotes({role}:{role:"Broker"|"Customer"}){
 const loads=useDemoLoads(),quotes=useDemoQuotes("received"),[error,setError]=useState(""),[busy,setBusy]=useState(""),[expanded,setExpanded]=useState("");
 const available=loads.filter(l=>(l.status==="Open"||l.acceptanceStatus==="Rejected")).map(load=>({load,offers:quotes.filter(q=>q.loadId===load.id&&q.status==="Open"&&!load.awardHistory?.some(h=>h.quoteId===q.id))})).filter(x=>x.offers.length);
 const awarded=loads.filter(l=>l.status==="Awarded"&&quotes.some(q=>q.loadId===l.id));
 const award=async(id:string,quoteId:string)=>{setBusy(quoteId);setError("");try{const response=await authenticatedDemoFetch("/api/try-xdrive-demo/quotes/award",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({jobId:id,quoteId})});const payload=await response.json().catch(()=>({})) as {error?:string};if(!response.ok)throw new Error(payload.error||"Award transaction unavailable");window.dispatchEvent(new Event("xdrive-demo-loads-changed"));window.dispatchEvent(new Event("xdrive-demo-quote-change"));}catch(e){setError(e instanceof Error?e.message:"Award failed")}finally{setBusy("")}};
 return <section className="panel xd-received-quotes"><div className="panel-title"><h2>{role==="Broker"?"Carrier Quotes":"Quotes Received"}</h2><span>{available.reduce((n,x)=>n+x.offers.length,0)} AVAILABLE QUOTES</span></div>
 {error&&<p role="alert">{error}</p>}
 {available.length===0&&<p className="muted">No available quotes to award. New carrier and driver quotes appear here.</p>}
 {available.map(({load,offers})=><article className="xd-received-card" key={load.id}><DemoLoadSummary load={load} expanded/><div className="xd-offers">{offers.map(q=><div className="xd-offer-card" key={q.id}>
 <div className="xd-offer-row"><div className="xd-offer-identity"><div className="xd-offer-avatar" aria-hidden="true">?</div><div className="xd-offer-person"><strong>Member identity unavailable</strong><span>{q.role==="Driver"?"Owner Driver":q.role} · Member ID not recorded</span><small>Quote ref: {q.id.slice(-8)} · Demo record</small></div></div><div className="xd-offer-actions"><div className="xd-offer-price">£{q.amount.toFixed(2)}<small>Excl. VAT</small></div><button type="button" className="outline xd-offer-detail" aria-expanded={expanded===q.id} onClick={()=>setExpanded(expanded===q.id?"":q.id)}>{expanded===q.id?"Hide details":"View quote details"}</button><button className="primary" disabled={busy!==""} onClick={()=>award(load.id,q.id)}>{busy===q.id?"Awarding…":"Award quote"}</button></div></div>
 {expanded===q.id&&<div className="xd-offer-expanded"><strong>Quote information</strong><div>Submitted: {new Date(q.createdAt).toLocaleString("en-GB")}</div><div>Member: Not recorded in this demo quote</div><div>Vehicle: {q.vehicle||"Not provided by bidder"}</div><div>ETA to collection: {q.etaMinutes===undefined?"Not provided":q.etaMinutes+" minutes"}</div><div>Notes: {q.notes||"None"}</div><div>Feedback and verification: Not available for this demo record</div><p>Before using this flow for real jobs, the quote must be linked to the authenticated member profile. No identity or rating has been invented.</p></div>}
 </div>)}</div></article>)}
 {awarded.length>0&&<details className="xd-awarded-history"><summary>Previously awarded loads ({awarded.length})</summary>{awarded.map(load=><article className="xd-received-card" key={load.id}><DemoLoadSummary load={load}/><span className="xd-awarded-label">Awarded · View in Bookings</span></article>)}</details>}
 </section>
}