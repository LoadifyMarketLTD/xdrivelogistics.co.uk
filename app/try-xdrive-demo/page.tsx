"use client";
import "./xdrive-design-system.css";

import DemoBookingOverview from "./components/DemoBookingOverview";
import DemoSharedBookings from "../try-xdrive-demo/components/DemoSharedBookings";
import {useState} from "react";
import {publishDemoLoad,useDemoLoads} from "../try-xdrive-demo/components/demoExchange";
import {useDemoQuotes} from "../try-xdrive-demo/components/DemoQuotes";
import DemoReceivedQuotes from "../try-xdrive-demo/components/DemoReceivedQuotes";
import NetworkTools from "../try-xdrive-demo/components/NetworkTools";
import PostLoadDemo from "../try-xdrive-demo/components/PostLoadDemo";
import Link from "next/link";
import "./demo.css";
import "../try-xdrive-demo/wide-layout.css";
const tabs=["Dashboard","Post Load","Quotes","Bookings","Tracking","Documents","Network & Tools"];
export default function Demo(){
const [,setPublished]=useState(false),[tab,setTab]=useState(0),[from,setFrom]=useState(""),[to,setTo]=useState(""),[pallets,setPallets]=useState(""),[weight,setWeight]=useState(""),[vehicle,setVehicle]=useState("");
const loads=useDemoLoads(),sharedQuotes=useDemoQuotes("received"),openLoads=loads.filter(l=>l.status==="Open"),awardedLoads=loads.filter(l=>l.status==="Awarded"),latest=loads[0];
return <main className="demo-shell"><aside className="sidebar"><div className="brand">XDRIVE <em>LOGISTICS</em></div><div className="side-caption">CUSTOMER WORKSPACE</div>{tabs.map((t,i)=><button key={t} className={tab===i?"active":""} onClick={()=>setTab(i)}><span>{["▦","＋","£","▤","◎","▣"][i]}</span>{t}</button>)}</aside><div className="content"><header className="topbar"><div className="mobile-brand">XDRIVE <em>LOGISTICS</em></div><div className="top-actions"><Link href="/">Back to website ↗</Link></div></header><nav className="mobile-tabs">{tabs.map((t,i)=><button key={t} className={tab===i?"active":""} onClick={()=>setTab(i)}>{t}</button>)}</nav><div className="page">
<div className="page-head">{tab!==2&&<h1>{tabs[tab]}</h1>}</div>

{tab===0&&<><div className="metrics"><div><small>ACTIVE LOADS</small><b>{openLoads.length}</b><span>Transport requests</span></div><div><small>QUOTES RECEIVED</small><b>{sharedQuotes.filter(q=>q.status==="Open").length}</b><span>Available to compare</span></div><div><small>AWARDED BOOKINGS</small><b>{awardedLoads.length}</b><span>Carrier confirmed</span></div><div><small>DELIVERIES COMPLETED</small><b>{loads.filter(l=>l.podReceived).length}</b><span>With POD</span></div></div><div className="panel"><div className="panel-title"><h2>Your transport overview</h2><span>{latest?.id||"NO LOADS"}</span></div>{latest?<><div className="route"><div><small>COLLECTION · {latest.pickupDate||"Not specified"} {latest.pickupStart||""}{latest.pickupEnd?"–"+latest.pickupEnd:""}</small><strong>{latest.from}</strong></div><span className="route-arrow">→</span><div><small>DELIVERY · {latest.deliveryMode==="ASAP"?"ASAP":latest.deliveryDate||"Not specified"}</small><strong>{latest.to}</strong></div></div><div className="facts"><span>{latest.vehicle}</span><span>{latest.pallets} items</span><span>{latest.weight} kg</span><span>{latest.packaging||"Packaging not specified"}</span><span>{latest.paymentTerms||"Payment terms not supplied"}</span></div></>:<p>No loads available.</p>}<div className="actions"><button className="primary" onClick={()=>setTab(openLoads.length?2:1)}>{openLoads.length?"View shared loads":"Create your first load"} →</button><button className="outline" onClick={()=>setTab(4)}>View tracking</button></div></div><div className="panel"><h2>How XDrive works</h2><div className="steps">{["Publish your load","Compare carrier offers","Award your booking","Follow collection & delivery","Receive Proof of Delivery"].map((s,i)=><button key={s} onClick={()=>setTab([1,2,3,4,5][i])}><b>{String(i+1).padStart(2,"0")}</b><span>{s}</span><span>→</span></button>)}</div></div></>}
{tab===1&&<PostLoadDemo role="Customer" from={from} to={to} vehicle={vehicle} pallets={pallets} weight={weight} onPublish={async(data)=>{await publishDemoLoad(data);setFrom(data.from);setTo(data.to);setVehicle(data.vehicle);setPallets(data.pallets);setWeight(data.weight);setPublished(true);setTab(2)}}/>}
{tab===2&&<DemoReceivedQuotes role="Customer"/>}
{tab===3&&<DemoSharedBookings role="Customer"/>}
{tab===4&&<DemoBookingOverview view="tracking"/>}
{tab===5&&<DemoBookingOverview view="documents"/>}
{tab===6&&<NetworkTools role="Customer"/>}

</div></div></main>
}
