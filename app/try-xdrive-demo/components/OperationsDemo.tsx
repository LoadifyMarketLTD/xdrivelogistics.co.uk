"use client";
import ApprovedSidebar from "./ApprovedSidebar";
import "../xdrive-design-system.css";

import {useState} from "react";
import {publishDemoLoad,useDemoLoads} from "./demoExchange";
import DemoExchangeBoard from "./DemoExchangeBoard";
import DemoNotifications from "./DemoNotifications";
import Link from "next/link";
import PostLoadDemo from "./PostLoadDemo";
import NetworkTools from "./NetworkTools";
import DemoCompanyQuotes from "./DemoCompanyQuotes";
import DemoFreightVision from "./DemoFreightVision";
import DemoLiveAvailability from "./DemoLiveAvailability";
import DemoReturnJourneys from "./DemoReturnJourneys";
import DemoMessagesBoard from "./DemoMessagesBoard";
import DemoReportsBoard from "./DemoReportsBoard";
import DemoNetworkToolsBoard from "./DemoNetworkToolsBoard";
import DemoFleetBoard from "./DemoFleetBoard";
import DemoDriversBoard from "./DemoDriversBoard";
import DemoBookingOverview from "./DemoBookingOverview";
import DemoCompanyBookings from "./DemoCompanyBookings";
import DemoCompanyDashboard from "./DemoCompanyDashboard";
import "../demo.css";
import "../wide-layout.css";
import "./operations-demo.css";
import "./company-sidebar-compact.css";
import "./company-layout-stability.css";

type Role="Carrier / Company"|"Dispatcher";
type Job={id:string;from:string;to:string;vehicle:string;cargo:string;company:string;status:string;price:number;driver:string;vehicleId:string;stage:number;pod:boolean};
const initial:Job[]=[
{id:"XDL-DEMO-1029",from:"Birmingham B6",to:"Manchester M1",vehicle:"Luton Van",cargo:"2 pallets Ã‚Â· 450 kg",company:"Demo Retail Distribution Ltd",status:"In Progress",price:195,driver:"Alex Carter",vehicleId:"XD-V101",stage:4,pod:false},
{id:"XDL-DEMO-1030",from:"Coventry CV1",to:"Leicester LE1",vehicle:"Large Van",cargo:"1 pallet Ã‚Â· 180 kg",company:"Sample Freight Broker Ltd",status:"Open",price:145,driver:"",vehicleId:"",stage:0,pod:false},
{id:"XDL-DEMO-1028",from:"Derby DE1",to:"Nottingham NG1",vehicle:"Luton Van",cargo:"3 pallets Ã‚Â· 600 kg",company:"Demo Warehouse Ltd",status:"Completed",price:240,driver:"Morgan Lee",vehicleId:"XD-V103",stage:8,pod:true}];
const fleet=[{id:"XD-V101",reg:"DX26 VAN",type:"Luton Van Ã‚Â· Tail-lift",driver:"Alex Carter",area:"Birmingham B6"},{id:"XD-V102",reg:"DX25 LTN",type:"Luton Van",driver:"Jamie Taylor",area:"Coventry CV1"},{id:"XD-V103",reg:"DX24 LWB",type:"Large Van",driver:"Morgan Lee",area:"Leicester LE1"}];
export default function OperationsDemo({role}:{role:Role}){
const isDispatch=role==="Dispatcher";
const sharedLoads=useDemoLoads();
const sharedJobs:Job[]=sharedLoads.map(l=>({id:l.id,from:l.from,to:l.to,vehicle:l.vehicle,cargo:`${l.pallets||"0"} pallets Ã‚Â· ${l.weight||"0"} kg`,company:l.customer||"Demo customer",status:l.podReceived?"Completed":l.status==="Awarded"?"In Progress":l.status,price:l.quote||0,driver:l.assignedDriver||"",vehicleId:l.assignedVehicleId||"",stage:l.deliveryStage||0,pod:Boolean(l.podReceived)}));
const nav=isDispatch?["Dashboard","Dispatch Board","Allocations","Live Jobs","Diary","Messages","Reports","Network & Tools"]:["Dashboard","Post Load","Loads","Quotes","Bookings","My Fleet","Drivers","Diary","Invoices","Network & Tools","Directory","Live Availability","Return Journeys","Freight Vision","Messages","Notifications","Reports"];
const [companyDrivers,setCompanyDrivers]=useState(["Alex Carter","Jamie Taylor","Morgan Lee"]),[companyFleet,setCompanyFleet]=useState(fleet.map(v=>({id:v.id,reg:v.reg,vehicle:v.type,driver:v.driver,status:"Available",location:v.area}))),[tab,setTab]=useState(0),[jobs,setJobs]=useState<Job[]>(initial),[selected,setSelected]=useState(initial[0].id),[filter,setFilter]=useState("All"),[notes,setNotes]=useState(""),[incidents,setIncidents]=useState<string[]>([]),[paid,setPaid]=useState<string[]>([]),[search,setSearch]=useState("");
const job=sharedJobs.find(j=>j.id===selected)||jobs.find(j=>j.id===selected)||jobs[0];
const show=(i:number)=>setTab(i);
const list=(items:Job[],actions=true)=><div className="ops-job-list">{items.map(j=><article className="ops-job" key={j.id}><div className="ops-job-top"><strong>{j.company}</strong><small>{j.id} Ã‚Â· {j.status}</small></div><div className="ops-route"><div><small>COLLECTION</small><b>{j.from}</b></div><span>Ã¢â€ â€™</span><div><small>DELIVERY</small><b>{j.to}</b></div></div><div className="facts"><span>{j.vehicle}</span><span>{j.cargo}</span><span>30 days EOM</span><span>POD {j.pod?"received":"required"}</span></div><div className="ops-job-bottom"><small>{j.driver?j.driver+" Ã‚Â· "+j.vehicleId:"Unallocated"} Ã‚Â· Ã‚Â£{j.price} sample</small>{actions&&<button className="outline" onClick={()=>{setSelected(j.id);show(isDispatch?2:4)}}>View & manage Ã¢â€ â€™</button>}</div></article>)}</div>;
return <main className="demo-shell ops-demo xd-approved-sidebar-shell"><ApprovedSidebar items={nav} activeIndex={tab} onSelect={show} /><div className="content"><header className="topbar"><div className="mobile-brand">XDRIVE <em>LOGISTICS</em></div><div className="top-actions"><Link href="/try-xdrive">All workspaces</Link><Link href={isDispatch?"/try-xdrive-company-demo":"/try-xdrive-dispatcher-demo"}>{isDispatch?"Company Demo":"Dispatcher Demo"}</Link></div></header><nav className="mobile-tabs">{nav.map((n,i)=><button key={n} className={tab===i?"active":""} onClick={()=>show(i)}>{n}</button>)}</nav><div className="page"><div className="page-head">{!((tab===0)||(!isDispatch&&(tab===2||tab===4||tab===5||tab===6||tab===7||tab===15))||(isDispatch&&(tab===1||tab===2||tab===4)))&&<h1>{nav[tab]}</h1>}</div>
{!isDispatch&&tab===10&&<NetworkTools role="Company" initialView="Directory" showTabs={false}/>}
{!isDispatch&&tab===11&&<DemoLiveAvailability/>}
{!isDispatch&&tab===12&&<DemoReturnJourneys/>}
{!isDispatch&&tab===13&&<DemoFreightVision onLoads={()=>show(2)}/>}
{!isDispatch&&tab===14&&<DemoMessagesBoard jobs={sharedJobs} onBooking={()=>show(4)}/>}
{!isDispatch&&tab===16&&<DemoReportsBoard jobs={sharedJobs} drivers={companyDrivers} vehicles={companyFleet}/> }
{!isDispatch&&tab===15&&<DemoNotifications onNavigate={show}/>}
{tab===0&&<DemoCompanyDashboard jobs={sharedJobs} fleet={companyFleet.map(v=>({...v,type:v.vehicle,area:v.location}))} drivers={companyDrivers} go={show}/>}
{!isDispatch&&tab===1&&<PostLoadDemo role="Customer" from="Birmingham B6" to="Manchester M1" vehicle="Luton Van" pallets="2" weight="450" onPublish={async data=>{const published=await publishDemoLoad(data);const id=published.id;const j:Job={id,from:data.from,to:data.to,vehicle:data.vehicle,cargo:data.pallets+" items Ã‚Â· "+data.weight+" kg",company:"Your demo company",status:"Open",price:0,driver:"",vehicleId:"",stage:0,pod:false};setJobs(x=>[j,...x]);setSelected(id);show(2)}}/>}
{!isDispatch&&tab===2&&<DemoExchangeBoard role="Carrier"/>}
{isDispatch&&tab===1&&<DemoExchangeBoard role="Dispatcher"/>}
{isDispatch&&tab===1&&<div className="panel"><div className="panel-title"><h2>{isDispatch?"Dispatch Board":"Load Exchange"}</h2><span>{sharedJobs.length} SHARED LOADS</span></div><div className="ops-filters"><input aria-label="Search jobs" placeholder="Search route, ID or company" value={search} onChange={e=>setSearch(e.target.value)}/><select aria-label="Filter job status" value={filter} onChange={e=>setFilter(e.target.value)}>{["All","Open","Allocated","In Progress","Completed"].map(x=><option key={x}>{x}</option>)}</select></div>{list(sharedJobs.filter(j=>(filter==="All"||j.status===filter)&&(j.id+j.from+j.to+j.company).toLowerCase().includes(search.toLowerCase())))}</div>}
{((!isDispatch&&tab===4)||(isDispatch&&tab===2))&&<DemoCompanyBookings role={role}/>}
{!isDispatch&&tab===3&&<><DemoCompanyQuotes/><button className="primary" onClick={()=>show(2)}>Find loads and submit quote</button></>}
{!isDispatch&&tab===5&&<DemoFleetBoard vehicles={companyFleet} setVehicles={setCompanyFleet} drivers={companyDrivers} setDrivers={setCompanyDrivers}/>}
{!isDispatch&&tab===6&&<DemoDriversBoard drivers={companyDrivers} vehicles={companyFleet} onFleet={()=>show(5)}/>}
{isDispatch&&tab===5&&<div className="panel"><h2>Dispatcher Messages</h2><p className="muted">Record a sample dispatch note linked to the selected job.</p><label className="ops-field">Booking<select value={selected} onChange={e=>setSelected(e.target.value)}>{sharedJobs.map(j=><option key={j.id} value={j.id}>{j.id}</option>)}</select></label><label className="ops-field">Message<textarea value={notes} onChange={e=>setNotes(e.target.value)}/></label><button className="primary" disabled={!notes.trim()} onClick={()=>{setIncidents(x=>[...x,"Message Ã‚Â· "+job.id+": "+notes]);setNotes("")}}>Save sample message</button>{incidents.map((x,i)=><p className="notice" key={i}>{x}</p>)}</div>}
{((!isDispatch&&tab===7)||(isDispatch&&tab===4))&&<DemoBookingOverview view="diary"/>}
{!isDispatch&&tab===8&&<div className="panel"><div className="panel-title"><h2>Invoices & Earnings</h2><span>DIRECT SETTLEMENT Ã‚Â· NO ESCROW</span></div>{sharedJobs.filter(j=>j.pod).map(j=><div className="ops-invoice" key={j.id}><div><strong>INV-{j.id}</strong><small>{j.from} Ã¢â€ â€™ {j.to} Ã‚Â· POD received</small></div><strong>Ã‚Â£{j.price.toFixed(2)} + VAT</strong><span>{paid.includes(j.id)?"Paid (demo)":"Outstanding"}</span><button className="outline" onClick={()=>setPaid(x=>x.includes(j.id)?x.filter(a=>a!==j.id):[...x,j.id])}>Toggle payment status</button></div>)}<p className="notice">Invoices are available only after POD. Payment status is fictional; payment is directly between parties.</p></div>}
{isDispatch&&tab===6&&<div className="panel"><h2>Dispatch Reports</h2><div className="metrics"><div><small>JOBS</small><b>{sharedJobs.length}</b><span>Shared demo</span></div><div><small>ALLOCATED</small><b>{sharedJobs.filter(j=>j.driver).length}</b><span>With drivers</span></div><div><small>POD</small><b>{sharedJobs.filter(j=>j.pod).length}</b><span>Received</span></div><div><small>INCIDENTS</small><b>{incidents.length}</b><span>Local notes</span></div></div></div>}
{isDispatch&&tab===7&&<NetworkTools role="Dispatcher"/>}{!isDispatch&&tab===9&&<DemoNetworkToolsBoard onNavigate={show}/>}
</div></div></main>
}






