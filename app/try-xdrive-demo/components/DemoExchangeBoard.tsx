"use client";
import {useMemo,useState} from "react";
import {useDemoLoads,useExchangeLoads} from "./demoExchange";
import type {DemoLoad} from "./demoExchange";
import {submitDemoQuote} from "./DemoQuotes";
import DemoTransportDetails from "./DemoTransportDetails";
import DemoQuotePanel from "./DemoQuotePanel";
import XDriveLoadCard from "./XDriveLoadCard";
import "./xdrive-unified-board.css";

type Role="Driver"|"Company Driver"|"Fleet"|"Broker"|"Customer"|"Carrier"|"Dispatcher";
const routes=[
["Blackburn, BB1","Erith, DA8","Luton (Tail Lift)","4","1200","General Freight","14 Days (From Invoice)","Skyhaul Logistics Ltd","Same Day"],
["Preston, PR1","St Helens, WA11","7.5 Tonne","6","2400","Palletised","End of Calendar Month","Baron Logistics Ltd","Next Day"],
["Manchester, M1","Sheffield, S9","LWB Van","12","300","General Freight","30 Days","F&R Distribution Ltd","On Demand"],
["Birmingham, B1","Coventry, CV1","Luton Van","3","850","Palletised","30 Days EOM","Midlands Cargo Ltd","Same Day"],
["Leeds, LS1","Liverpool, L1","7.5 Tonne","8","3200","General Freight","14 Days","Northern Express Ltd","Next Day"],
["London, E16","Bristol, BS1","LWB Van","2","450","Boxes","30 Days","Thames Freight Ltd","On Demand"]
];
const fixtures:DemoLoad[]=Array.from({length:56},(_,i)=>{const r=routes[i%routes.length];return {id:"XDR-"+String(10457+i),from:r[0],to:r[1],vehicle:r[2],pallets:r[3],weight:r[4],packaging:r[5],paymentTerms:r[6],customer:r[7],service:r[8],pickupDate:new Date(Date.UTC(2026,9,31+i%12)).toISOString().slice(0,10),deliveryMode:"ASAP",postedAt:new Date(Date.UTC(2026,9,30)).toISOString(),status:"Open",sell:"",readOnly:true}});

export default function DemoExchangeBoard({role}:{role:Role}){
 const canQuote=["Driver","Fleet","Carrier","Broker"].includes(role);
 const live=useDemoLoads(),exchange=useExchangeLoads();
 
 const [tab,setTab]=useState("All Loads"),[from,setFrom]=useState(""),[to,setTo]=useState(""),[radius,setRadius]=useState("10"),[vehicle,setVehicle]=useState(""),[service,setService]=useState(""),[date,setDate]=useState(""),[same,setSame]=useState(false),[next,setNext]=useState(false),[sort,setSort]=useState("new"),[page,setPage]=useState(1),[map,setMap]=useState(false),[selected,_setSelected]=useState<string|null>(null),[details,setDetails]=useState<string|null>(null),[quoteLoad,setQuoteLoad]=useState<string|null>(null),[amount,setAmount]=useState(""),[_notice,setNotice]=useState("");
 const actual=canQuote?exchange.loads:live;
 const preview=actual.length===0;
 const loads=preview?fixtures:actual;
 const shown=useMemo(()=>loads.filter(x=>{
  if(tab==="My Loads"&&preview)return Number(x.id.slice(-2))>7; if(tab==="My Loads"&&!preview&&!live.some(j=>j.id===x.id))return false; if(from&&!x.from.toLowerCase().includes(from.toLowerCase()))return false;
  if(to&&!x.to.toLowerCase().includes(to.toLowerCase()))return false;
  if(vehicle&&!x.vehicle.toLowerCase().includes(vehicle.toLowerCase()))return false;
  if(service&&!String(x.service||"").toLowerCase().includes(service.toLowerCase()))return false;
  if(date&&x.pickupDate!==date)return false;
  const tag=String(x.service||"").toLowerCase();
  if(tab==="Same Day"&&!tag.includes("same"))return false;
  if(tab==="Next Day"&&!tag.includes("next"))return false;
  if(tab==="On Demand"&&!tag.includes("demand"))return false;
  if(same&&!tag.includes("same"))return false;
  if(next&&!tag.includes("next"))return false;
  return true;
 }).sort((a,b)=>sort==="old"?a.postedAt.localeCompare(b.postedAt):b.postedAt.localeCompare(a.postedAt)),[loads,live,preview,from,to,vehicle,service,date,tab,same,next,sort]);
 const pageCount=Math.max(1,Math.ceil(shown.length/10)); const visible=shown.slice((Math.min(page,pageCount)-1)*10,Math.min(page,pageCount)*10); const reset=()=>{setFrom("");setTo("");setRadius("10");setVehicle("");setService("");setDate("");setSame(false);setNext(false);setTab("All Loads")};
 return <section className="xd-board">
  <header className="xd-board-head"><h1>Loads</h1><nav className="xd-board-tabs">{["All Loads","On Demand","Same Day","Next Day","My Loads"].map(t=><button key={t} className={tab===t?"active":""} onClick={()=>setTab(t)}>{t}<b>{t==="All Loads"?loads.length:t==="My Loads"?preview?7:live.length:loads.filter(x=>String(x.service||"").toLowerCase().includes(t.toLowerCase())).length}</b></button>)}<div className="xd-board-sort"><label>Sort by: <select value={sort} onChange={e=>setSort(e.target.value)}><option value="new">Date Posted (Newest)</option><option value="old">Date Posted (Oldest)</option></select></label><button aria-label="List view" className={!map?"active":""} onClick={()=>setMap(false)}>â˜·</button><button aria-label="Map view" className={map?"active":""} onClick={()=>setMap(true)}>â–§</button></div></nav></header>
  <div className="xd-board-layout"><aside className="xd-board-filters"><h2>Find Loads</h2><div className="xd-filter-fields">
  <label>From (Town/Postcode)<input placeholder="e.g. BB1 or Blackburn" value={from} onChange={e=>setFrom(e.target.value)}/></label>
  <label>To (Town/Postcode)<input placeholder="e.g. DA8 or Erith" value={to} onChange={e=>setTo(e.target.value)}/></label>
  <label>Radius<select value={radius} onChange={e=>setRadius(e.target.value)}>{["5","10","20","30","50","100"].map(v=><option key={v} value={v}>{v} mile</option>)}</select></label>
  <label>Vehicle<select value={vehicle} onChange={e=>setVehicle(e.target.value)}><option value="">Any Vehicle</option>{["Luton","7.5 Tonne","LWB Van"].map(v=><option key={v}>{v}</option>)}</select></label>
  <label>Service<select value={service} onChange={e=>setService(e.target.value)}><option value="">Any Service</option>{["Same Day","Next Day","On Demand"].map(v=><option key={v}>{v}</option>)}</select></label>
  <label>Date<input type="date" value={date} onChange={e=>setDate(e.target.value)}/></label>
  <label className="xd-check"><input type="checkbox" checked={same} onChange={e=>setSame(e.target.checked)}/> Same Day</label><label className="xd-check"><input type="checkbox" checked={next} onChange={e=>setNext(e.target.checked)}/> Next Day</label>
  <button className="xd-clear" onClick={reset}>â†» Clear Filters</button><button className="xd-search-button" onClick={()=>setNotice(shown.length+" loads match your filters")}>âŒ• Search Loads</button></div></aside>
  <main className="xd-board-results">
  
  
  {canQuote&&quoteLoad&&(()=>{const x=loads.find(l=>l.id===quoteLoad);return x?<DemoQuotePanel load={x} role={role} preview={preview} onClose={()=>setQuoteLoad(null)}/>:null})()}
  {details&&(()=>{const x=loads.find(l=>l.id===details);return x?<DemoTransportDetails title={x.id} subtitle={x.from+" â†’ "+x.to} status={x.status} onClose={()=>setDetails(null)} sections={[
  {title:"Load & Posting Company",fields:[{label:"Load Reference",value:x.id},{label:"Posted By",value:x.customer},{label:"Member ID",value:preview?"Demo account":x.customer},{label:"Service",value:x.service}]},
  {title:"Collection Details",fields:[{label:"Collection Town / Outcode",value:x.from},{label:"Collection Date",value:x.pickupDate},{label:"Collection Window",value:[x.pickupStart,x.pickupEnd].filter(Boolean).join(" - ")},{label:"Full Address & Contact",value:"Visible only to authorised parties after award"}]},
  {title:"Delivery Details",fields:[{label:"Delivery Town / Outcode",value:x.to},{label:"Delivery Date",value:x.deliveryDate||x.deliveryMode},{label:"Delivery Time",value:x.deliveryTime},{label:"Full Address & Contact",value:"Visible only to authorised parties after award"}]},
  {title:"Vehicle & Cargo",fields:[{label:"Vehicle Type",value:x.vehicle},{label:"Packaging / Pallets",value:x.pallets+" "+(x.packaging||"Pallets")},{label:"Weight",value:x.weight?x.weight+" kg":undefined},{label:"Dimensions",value:x.dimensions},{label:"Body Type",value:x.body},{label:"Handling Requirements",value:x.notes}]},
  {title:"Terms & Documents",fields:[{label:"Payment Terms",value:x.paymentTerms},{label:"Hard Copy POD",value:x.hardPod===undefined?"Not specified":x.hardPod?"Required":"Not required"},{label:"Special Instructions",value:x.notes},{label:"POD Status",value:x.podReceived?"Received":"Pending"}]}
  ]}/>:null})()}  {map?<div className="xd-map-placeholder"><strong>Map view</strong><p>Map data is not available in this visual preview. Switch to list view to browse loads.</p></div>:visible.map(x=>{const active=selected===x.id;return <XDriveLoadCard key={x.id} data={{id:x.id,from:x.from,to:x.to,date:x.pickupDate||"2026-10-31",status:x.service||"On Demand",vehicle:x.vehicle,cargo:String(x.pallets||"-")+" "+(x.packaging==="Boxes"?"Boxes":"Pallets"),weight:String(x.weight||"-")+" kg",packaging:x.packaging||"General Freight",paymentTerms:x.paymentTerms,collection:x.pickupDate,delivery:x.deliveryDate||x.deliveryMode||"ASAP",company:x.customer,memberId:preview?"DEMO-"+x.id.slice(-4):x.id.slice(0,8)}} onDetails={()=>setDetails(x.id)} actions={<button className="quote" onClick={()=>{if(canQuote)setQuoteLoad(x.id);else setDetails(x.id);setNotice("")}}>{canQuote?"Quote Now":"View Load"}</button>} extra={active?<div className="xd-card-expanded"><strong>Load details</strong><p>Pickup: {x.from} Â· Delivery: {x.to} Â· Vehicle: {x.vehicle} Â· Payment: {x.paymentTerms}</p>{!preview&&canQuote&&<div className="xd-inline-quote"><label>Quote (GBP excl. VAT) <input type="number" min="1" value={amount} onChange={e=>setAmount(e.target.value)}/></label><button disabled={!(Number(amount)>0)} onClick={()=>submitDemoQuote(x.id,role,Number(amount)).then(()=>setNotice("Quote submitted")).catch(e=>setNotice(e.message))}>Submit Quote</button></div>}{preview&&<p>Preview only - no booking or quote has been submitted.</p>}</div>:undefined}/>})}
  {!map&&pageCount>1&&<nav className="xd-board-pagination" aria-label="Load pages"><button disabled={page<=1} onClick={()=>setPage(v=>v-1)}>Previous</button><span>Page {Math.min(page,pageCount)} of {pageCount}</span><button disabled={page>=pageCount} onClick={()=>setPage(v=>v+1)}>Next</button></nav>}\n  </main></div></section>;
}

