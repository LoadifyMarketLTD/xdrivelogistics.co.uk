"use client";
import ApprovedSidebar from "../try-xdrive-demo/components/ApprovedSidebar";
import "../try-xdrive-demo/xdrive-design-system.css";

import DemoSharedBookings from "../try-xdrive-demo/components/DemoSharedBookings";
import {useState} from "react";
import {publishDemoLoad,useDemoLoads,useExchangeLoads} from "../try-xdrive-demo/components/demoExchange";
import DemoExchangeBoard from "../try-xdrive-demo/components/DemoExchangeBoard";
import FindLoads from "../try-xdrive-demo/components/FindLoads";
import {useDemoQuotes} from "../try-xdrive-demo/components/DemoQuotes";
import DemoMyQuotes from "../try-xdrive-demo/components/DemoQuotes";
import NetworkTools from "../try-xdrive-demo/components/NetworkTools";
import PostLoadDemo from "../try-xdrive-demo/components/PostLoadDemo";
import DemoDriverTools from "../try-xdrive-demo/components/DemoDriverTools";
import "../try-xdrive-demo/demo.css";
import "../try-xdrive-demo/wide-layout.css";
const nav=["Dashboard","Alerts","My Quotes","Bookings","More","Network & Tools"];
export default function DriverDemo(){
const [demoPosted,setDemoPosted]=useState(false),[postedRoute,setPostedRoute]=useState(""),[tab,setTab]=useState(0);
const sharedLoads=useDemoLoads(),{loads:exchangeLoads}=useExchangeLoads(),sharedQuotes=useDemoQuotes();const available=exchangeLoads.filter(l=>l.status==="Open"),bookings=sharedLoads.filter(l=>l.status==="Awarded"&&l.driver==="Driver");
return <main className="demo-shell xd-approved-sidebar-shell"><ApprovedSidebar items={nav} activeIndex={tab} onSelect={setTab} extra={{label:"Find Loads",onClick:()=>setTab(6)}} /><div className="content"><header className="topbar"><div className="mobile-brand">XDRIVE <em>LOGISTICS</em></div><div className="top-actions"></div></header><nav className="mobile-tabs">{nav.map((n,i)=><button key={n} className={tab===i?"active":""} onClick={()=>{setTab(i)}}>{n}</button>)}</nav><div className="page"><div className="page-head">{tab!==1&&<div><h1>{tab===7?"Post Load":nav[tab]}</h1></div>}</div>

{tab===0&&<>{demoPosted&&<div className="notice">✓ Sample load created: {postedRoute}. No live job was published.</div>}<div className="metrics"><div><small>AVAILABLE ALERTS</small><b>{available.length}</b><span>Matching loads</span></div><div><small>MY QUOTES</small><b>{sharedQuotes.filter(q=>q.role==="Driver"&&q.status==="Open").length}</b><span>Submitted quotes</span></div><div><small>ACTIVE BOOKINGS</small><b>{bookings.filter(l=>l.acceptanceStatus==="Accepted").length}</b><span>Accepted jobs</span></div><div><small>POD COMPLETED</small><b>{bookings.filter(l=>l.podReceived).length}</b><span>Delivery evidence</span></div></div><div className="panel"><div className="panel-title"><h2>Today's opportunity</h2><span>{available.length} AVAILABLE LOADS</span></div>{available[0]?<p>{available[0].from} → {available[0].to} · {available[0].vehicle}</p>:<p>No available loads in the shared exchange.</p>}<div className="actions"><button className="primary" onClick={()=>{setTab(1)}}>View load & quote →</button><button className="outline" onClick={()=>setTab(3)}>My bookings</button></div></div><div className="panel"><h2>Driver workflow</h2><div className="steps">{["Find a load","Submit your quote","Accept a booking","Update collection & delivery","Upload POD"].map((x,i)=><button key={x} onClick={()=>setTab([1,2,3,3,3][i])}><b>{String(i+1).padStart(2,"0")}</b><span>{x}</span><span>→</span></button>)}</div></div></>}
{tab===1&&<DemoExchangeBoard role="Driver"/>}
{tab===2&&<DemoMyQuotes/>}
{tab===3&&<DemoSharedBookings role="Driver"/>}
{tab===4&&<><DemoDriverTools role="Owner Driver"/><button className="primary" onClick={()=>setTab(7)}>Post a demo load</button></>}
{tab===5&&<NetworkTools role="Driver"/>}
{tab===6&&<FindLoads/>}
{tab===7&&<><div className="actions"><button className="outline" onClick={()=>setTab(4)}>← Back to More</button></div><PostLoadDemo role="Customer" from="Birmingham B6" to="Manchester M1" vehicle="Luton Van" pallets="2" weight="450" onPublish={async(data)=>{await publishDemoLoad(data);setPostedRoute(data.from+" → "+data.to);setDemoPosted(true);setTab(0)}}/></>}
</div></div></main>;
}
