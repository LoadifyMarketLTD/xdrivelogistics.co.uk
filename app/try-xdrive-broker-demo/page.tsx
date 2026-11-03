"use client";
import ApprovedSidebar from "../try-xdrive-demo/components/ApprovedSidebar";
import "../try-xdrive-demo/xdrive-design-system.css";

import DemoBookingOverview from "../try-xdrive-demo/components/DemoBookingOverview";
import DemoSharedBookings from "../try-xdrive-demo/components/DemoSharedBookings";
import {useState} from "react";
import {publishDemoLoad,useDemoLoads} from "../try-xdrive-demo/components/demoExchange";
import {useDemoQuotes} from "../try-xdrive-demo/components/DemoQuotes";
import DemoReceivedQuotes from "../try-xdrive-demo/components/DemoReceivedQuotes";
import DemoExchangeBoard from "../try-xdrive-demo/components/DemoExchangeBoard";
import NetworkTools from "../try-xdrive-demo/components/NetworkTools";
import PostLoadDemo from "../try-xdrive-demo/components/PostLoadDemo";
import "../try-xdrive-demo/demo.css";
import "../try-xdrive-demo/wide-layout.css";
import "./broker.css";
const nav=["Dashboard","Post Load","My Loads","Carrier Quotes","Awards","Bookings","Diary","POD Review","More","Network & Tools"];
export default function BrokerDemo(){

const [tab,setTab]=useState(0),[from,setFrom]=useState("Birmingham B6"),[to,setTo]=useState("Manchester M1"),[pallets,setPallets]=useState("2"),[weight,setWeight]=useState("450"),[vehicle,setVehicle]=useState("Luton Van"),[customer,setCustomer]=useState("Demo Retail Distribution Ltd"),[sell,setSell]=useState("260"),[published,setPublished]=useState(false);
const sharedLoads=useDemoLoads(),sharedQuotes=useDemoQuotes("received");

const route=<div className="route"><div><small>COLLECTION · TODAY 10:00–12:00</small><strong>{from}</strong></div><span className="route-arrow">→</span><div><small>DELIVERY · SAME DAY ASAP</small><strong>{to}</strong></div></div>;
const facts=<div className="facts"><span>🚚 {vehicle}</span><span>▦ {pallets} pallets</span><span>⚖ {weight} kg</span><span>↗ Tail-lift required</span><span>▤ Hard copy POD</span><span>£ 30 days EOM</span></div>;
return <main className="demo-shell broker-demo xd-approved-sidebar-shell"><ApprovedSidebar items={nav} activeIndex={tab} onSelect={setTab} /><div className="content"><header className="topbar"><div className="mobile-brand">XDRIVE <em>LOGISTICS</em></div><div className="top-actions"></div></header><nav className="mobile-tabs">{nav.map((n,i)=><button key={n} className={tab===i?"active":""} onClick={()=>setTab(i)}>{n}</button>)}</nav><div className="page"><div className="page-head">{tab!==2&&<h1>{nav[tab]}</h1>}</div>
{tab===0&&<><div className="metrics"><div><small>POSTED LOADS</small><b>{sharedLoads.length}</b><span>Broker transport requests</span></div><div><small>CARRIER QUOTES</small><b>{sharedQuotes.filter(q=>q.status==="Open").length}</b><span>Offers to review</span></div><div><small>AWARDED JOBS</small><b>{sharedLoads.filter(l=>l.status==="Awarded").length}</b><span>Carrier confirmed</span></div><div><small>PROOF OF DELIVERY</small><b>{sharedLoads.filter(l=>l.podReceived).length}</b><span>Evidence received</span></div></div><div className="panel"><div className="panel-title"><h2>Broker operations overview</h2><span>{sharedLoads[0]?.id||"NO SHARED LOADS"}</span></div><div className="broker-customer"><small>YOUR CUSTOMER</small><strong>{customer}</strong><span>Customer account · Fictional</span></div>{route}{facts}<div className="actions"><button className="primary" onClick={()=>setTab(published?3:1)}>{published?"Review carrier quotes":"Publish your first load"} →</button><button className="outline" onClick={()=>setTab(6)}>Operations diary</button></div></div><div className="panel"><h2>Broker transport lifecycle</h2><div className="steps">{["Post customer load","Compare carrier quotes","Award transport","Track booking","Review delivery POD"].map((x,i)=><button key={x} onClick={()=>setTab([1,3,4,5,7][i])}><b>{String(i+1).padStart(2,"0")}</b><span>{x}</span><span>→</span></button>)}</div></div></>}
{tab===1&&<PostLoadDemo role="Broker" from={from} to={to} vehicle={vehicle} pallets={pallets} weight={weight} customer={customer} sell={sell} onPublish={async(data)=>{await publishDemoLoad(data);setFrom(data.from);setTo(data.to);setVehicle(data.vehicle);setPallets(data.pallets);setWeight(data.weight);setCustomer(data.customer);setSell(data.sell);setPublished(true);setTab(2)}}/>}
{tab===2&&<DemoExchangeBoard role="Broker"/>}
{tab===3&&<DemoReceivedQuotes role="Broker"/>}
{tab===4&&<DemoBookingOverview view="awards"/>}
{tab===5&&<DemoSharedBookings role="Broker"/>}
{tab===6&&<DemoBookingOverview view="diary"/>}
{tab===7&&<DemoBookingOverview view="pod"/>}
{tab===8&&<div className="panel"><h2>Broker management tools</h2><div className="steps">{["Customer Accounts","Carrier Network","Messages","Customer Invoices","Carrier Costs","Margins & Reports","Event Log","Help & Support"].map((x,i)=><button key={x} onClick={()=>setTab([0,3,0,4,4,4,6,0][i])}><b>{String(i+1).padStart(2,"0")}</b><span>{x}</span><span>→</span></button>)}</div></div>}
{tab===9&&<NetworkTools role="Broker"/>}
</div></div></main>;
}
