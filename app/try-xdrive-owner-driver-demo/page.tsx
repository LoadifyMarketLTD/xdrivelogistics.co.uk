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
import DemoBookingOverview from "../try-xdrive-demo/components/DemoBookingOverview";
import DemoNotifications from "../try-xdrive-demo/components/DemoNotifications";
import DemoDriverTools from "../try-xdrive-demo/components/DemoDriverTools";
import "../try-xdrive-demo/demo.css";
import "../try-xdrive-demo/wide-layout.css";
const nav=["Dashboard","Loads","My Quotes","Bookings","More","Network & Tools","Diary","Invoices","Directory","Live Availability","Return Journeys","Freight Vision","Messages","Notifications","Reports","My Fleet","Drivers & Vehicles"];
export default function OwnerDriverDemo(){
const [demoPosted,setDemoPosted]=useState(false),[postedRoute,setPostedRoute]=useState(""),[tab,setTab]=useState(0);
const sharedLoads=useDemoLoads(),{loads:exchangeLoads}=useExchangeLoads(),sharedQuotes=useDemoQuotes();const available=exchangeLoads.filter(l=>l.status==="Open"),bookings=sharedLoads.filter(l=>l.status==="Awarded"&&(l.driver==="Owner Driver"||l.driver==="Driver"));
return <main className="demo-shell xd-approved-sidebar-shell"><ApprovedSidebar items={nav} activeIndex={tab} onSelect={setTab} extra={{label:"Find Loads",onClick:()=>setTab(17)}} /><div className="content"><header className="topbar"><div className="mobile-brand">XDRIVE <em>OWNER DRIVER</em></div><div className="top-actions"></div></header><nav className="mobile-tabs">{nav.map((n,i)=><button key={n} className={tab===i?"active":""} onClick={()=>{setTab(i)}}>{n}</button>)}</nav><div className="page"><div className="page-head">{tab!==1&&<div><h1>{tab===18?"Post Load":tab===17?"Find Loads":nav[tab]}</h1></div>}</div>

{tab===0&&<>{demoPosted&&<div className="notice"> Sample load created: {postedRoute}. No live job was published.</div>}<div className="metrics"><div><small>AVAILABLE ALERTS</small><b>{available.length}</b><span>Matching loads</span></div><div><small>MY QUOTES</small><b>{sharedQuotes.filter(q=>(q.role==="Owner Driver"||q.role==="Driver")&&q.status==="Open").length}</b><span>Submitted quotes</span></div><div><small>ACTIVE BOOKINGS</small><b>{bookings.filter(l=>l.acceptanceStatus==="Accepted").length}</b><span>Accepted jobs</span></div><div><small>POD COMPLETED</small><b>{bookings.filter(l=>l.podReceived).length}</b><span>Delivery evidence</span></div></div><div className="panel"><div className="panel-title"><h2>Today's opportunity</h2><span>{available.length} AVAILABLE LOADS</span></div>{available[0]?<p>{available[0].from}  {available[0].to}  {available[0].vehicle}</p>:<p>No available loads in the shared exchange.</p>}<div className="actions"><button className="primary" onClick={()=>{setTab(1)}}>View load & quote </button><button className="outline" onClick={()=>setTab(3)}>My bookings</button></div></div><div className="panel"><h2>Driver workflow</h2><div className="steps">{["Find a load","Submit your quote","Accept a booking","Update collection & delivery","Upload POD"].map((x,i)=><button key={x} onClick={()=>setTab([1,2,3,3,3][i])}><b>{String(i+1).padStart(2,"0")}</b><span>{x}</span><span></span></button>)}</div></div></>}
{tab===1&&<DemoExchangeBoard role="Owner Driver"/>}
{tab===2&&<DemoMyQuotes role="Owner Driver"/>}
{tab===3&&<DemoSharedBookings role="Owner Driver"/>}
{tab===4&&<><DemoDriverTools role="Owner Driver"/><button className="primary" onClick={()=>setTab(18)}>Post a demo load</button></>}
{tab===5&&<NetworkTools role="Owner Driver"/>}
{tab===17&&<FindLoads/>}
{tab===6&&<DemoBookingOverview view="diary"/>}
{tab===7&&<div className="panel"><h2>Invoices & Earnings</h2><p>Invoices become available after completed delivery and POD. Settlement is directly between parties; no escrow.</p><button className="outline" onClick={()=>setTab(3)}>View completed bookings and invoices</button></div>}
{[8,9,10,11,12,14].includes(tab)&&<NetworkTools role="Owner Driver" initialView={nav[tab]} showTabs={false}/>}
{tab===13&&<DemoNotifications onNavigate={setTab}/>}
{tab===15&&<div className="panel"><h2>My Fleet</h2><p>Manage your own vehicle, availability and transport documents.</p><DemoDriverTools role="Owner Driver"/></div>}
{tab===16&&<div className="panel"><h2>Driver & Vehicle Documents</h2><p>Owner Driver compliance and vehicle records.</p><DemoDriverTools role="Owner Driver"/></div>}
{tab===18&&<><div className="actions"><button className="outline" onClick={()=>setTab(4)}> Back to More</button></div><PostLoadDemo role="Customer" from="Birmingham B6" to="Manchester M1" vehicle="Luton Van" pallets="2" weight="450" onPublish={async(data)=>{await publishDemoLoad(data);setPostedRoute(data.from+"  "+data.to);setDemoPosted(true);setTab(0)}}/></>}
</div></div></main>;
}
