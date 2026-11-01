"use client";
import "../xdrive-design-system.css";

import {useEffect,useState} from "react";
import {publishDemoLoad,useDemoLoads,useDemoBookings} from "./demoExchange";
import type {DemoLoad} from "./demoExchange";
import DemoExchangeBoard from "./DemoExchangeBoard";
import DemoCompanyQuotes from "./DemoCompanyQuotes";
import {useDemoQuotes} from "./DemoQuotes";
import DemoNotifications from "./DemoNotifications";
import DemoMessagesBoard from "./DemoMessagesBoard";
import DemoFreightVision from "./DemoFreightVision";
import DemoReportsBoard from "./DemoReportsBoard";
import DemoReferenceLiveJobs from "./DemoReferenceLiveJobs";
import DemoInvoicesBoard from "./DemoInvoicesBoard";
import Link from "next/link";
import PostLoadDemo from "./PostLoadDemo";
import NetworkTools from "./NetworkTools";
import DemoNetworkToolsBoard from "./DemoNetworkToolsBoard";
import AutonomousSessionBar from "./AutonomousSessionBar";
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
import {DemoReferenceNavIcon,DemoReferenceTopbar,DemoReferenceCollapse} from "./DemoReferenceChrome";
import "../reference-workspace-shell.css";

type Role="Carrier / Company"|"Dispatcher";
type Job={id:string;from:string;to:string;vehicle:string;cargo:string;company:string;status:string;price:number;driver:string;vehicleId:string;stage:number;pod:boolean;pickupDate?:string;postedAt?:string};
const initial:Job[]=[
{id:"XDL-DEMO-1029",from:"Birmingham B6",to:"Manchester M1",vehicle:"Luton Van",cargo:"2 pallets  -  450 kg",company:"Demo Retail Distribution Ltd",status:"In Progress",price:195,driver:"Alex Carter",vehicleId:"XD-V101",stage:4,pod:false},
{id:"XDL-DEMO-1030",from:"Coventry CV1",to:"Leicester LE1",vehicle:"Large Van",cargo:"1 pallet  -  180 kg",company:"Sample Freight Broker Ltd",status:"Open",price:145,driver:"",vehicleId:"",stage:0,pod:false},
{id:"XDL-DEMO-1028",from:"Derby DE1",to:"Nottingham NG1",vehicle:"Luton Van",cargo:"3 pallets  -  600 kg",company:"Demo Warehouse Ltd",status:"Completed",price:240,driver:"Morgan Lee",vehicleId:"XD-V103",stage:8,pod:true}];
const fleet=[{id:"XD-V101",reg:"DX26 VAN",type:"Luton Van  -  Tail-lift",driver:"Alex Carter",area:"Birmingham B6"},{id:"XD-V102",reg:"DX25 LTN",type:"Luton Van",driver:"Jamie Taylor",area:"Coventry CV1"},{id:"XD-V103",reg:"DX24 LWB",type:"Large Van",driver:"Morgan Lee",area:"Leicester LE1"}];
export default function OperationsDemo({role}:{role:Role}){
const isDispatch=role==="Dispatcher";
const [sidebarCollapsed,setSidebarCollapsed]=useState(false);
const ownLoads=useDemoLoads(),{loads:companyBookings}=useDemoBookings(),receivedQuotes=useDemoQuotes("received");
const sharedLoads:DemoLoad[]=[...ownLoads,...companyBookings.filter(l=>!ownLoads.some(x=>x.id===l.id))];
const sharedJobs:Job[]=sharedLoads.map(l=>({id:l.id,from:l.from,to:l.to,vehicle:l.vehicle,cargo:`${l.pallets||"0"} pallets  -  ${l.weight||"0"} kg`,company:l.customer||"Demo customer",
 status:l.podReceived?"Completed":l.operationalStatus==="pending_acceptance"?"Pending Acceptance":l.operationalStatus==="accepted"?"Pending Allocation":
 l.operationalStatus==="allocated"?"Allocated":l.operationalStatus==="delivered"?"Awaiting POD":l.operationalStatus&&["on_way_pickup","on_site_pickup","loaded","on_way_delivery","on_site_delivery"].includes(l.operationalStatus)?"In Progress":l.status,
 price:l.quote||0,driver:l.assignedDriver||"",vehicleId:l.assignedVehicleId||"",stage:l.deliveryStage||0,pod:Boolean(l.podReceived),pickupDate:l.pickupDate,postedAt:l.postedAt}));
const nav=isDispatch?["Dashboard","Dispatch Board","Allocations","Live Jobs","Diary","Messages","Reports","Network & Tools"]:["Dashboard","Post Load","Loads","Quotes","Bookings","My Fleet","Drivers","Diary","Invoices","Network & Tools","Directory","Live Availability","Return Journeys","Freight Vision","Messages","Notifications","Reports"];
const [companyDrivers,setCompanyDrivers]=useState<string[]>(()=>process.env.NEXT_PUBLIC_XDRIVE_AUTONOMOUS_DEMO==="1"?[]:["Alex Carter","Jamie Taylor","Morgan Lee"]),[companyFleet,setCompanyFleet]=useState<({id:string;reg:string;vehicle:string;driver:string;status:string;location:string})[]>(()=>process.env.NEXT_PUBLIC_XDRIVE_AUTONOMOUS_DEMO==="1"?[]:fleet.map(v=>({id:v.id,reg:v.reg,vehicle:v.type,driver:v.driver,status:"Available",location:v.area}))),[tab,setTab]=useState(0),[_jobs,setJobs]=useState<Job[]>(initial),[_selected,setSelected]=useState(initial[0].id),[filter,setFilter]=useState("All"),[search,setSearch]=useState("");
const [directoryTarget,setDirectoryTarget]=useState<{id:string;name:string;kind:"Companies"|"Drivers";requestId:number}|null>(null);
const [navFocus,setNavFocus]=useState<{page:number;ref:string;action:"details"|"quote";seq:number}|null>(null);
useEffect(()=>{
 if(process.env.NEXT_PUBLIC_XDRIVE_AUTONOMOUS_DEMO!=="1")return;
 let mounted=true;
 const refresh=async()=>{
  if(mounted){setCompanyDrivers([]);setCompanyFleet([])}
  try{
   const response=await fetch("/api/autonomous/v1/fleet",{credentials:"same-origin",cache:"no-store"});
   if(!response.ok)throw Error("Local fleet session unavailable");
   const data=await response.json() as {drivers:{id:string;name:string}[];vehicles:{id:string;label:string;type:string;status:string}[]};
   if(mounted){
    setCompanyDrivers(data.drivers.map(x=>x.name));
    setCompanyFleet(data.vehicles.map(x=>({id:x.id,reg:x.label,vehicle:x.type,driver:"",status:x.status==="available"?"Available":"On Job",location:"No GPS location"})));
   }
  }catch{if(mounted){setCompanyDrivers([]);setCompanyFleet([])}}
 };
 void refresh();
 window.addEventListener("xdrive-demo-session-change",refresh);
 return()=>{mounted=false;window.removeEventListener("xdrive-demo-session-change",refresh)};
},[]);

const show=(i:number,ref?:string)=>{setTab(i);setNavFocus(previous=>ref?{page:i,ref,action:"details",seq:(previous?.seq||0)+1}:null)};
const showLoad=(ref?:string,action:"details"|"quote"="details")=>{const page=isDispatch?1:2;setTab(page);setNavFocus(previous=>ref?{page,ref,action,seq:(previous?.seq||0)+1}:null)};
const messageMember=(target:{id:string;name:string;kind:"Companies"|"Drivers"})=>{setDirectoryTarget({...target,requestId:Date.now()});show(14)};
const list=(items:Job[],actions=true)=><div className="ops-job-list">{items.map(j=><article className="ops-job" key={j.id}><div className="ops-job-top"><strong>{j.company}</strong><small>{j.id}  -  {j.status}</small></div><div className="ops-route"><div><small>COLLECTION</small><b>{j.from}</b></div><span>â†’</span><div><small>DELIVERY</small><b>{j.to}</b></div></div><div className="facts"><span>{j.vehicle}</span><span>{j.cargo}</span><span>30 days EOM</span><span>POD {j.pod?"received":"required"}</span></div><div className="ops-job-bottom"><small>{j.driver?j.driver+"  -  "+j.vehicleId:"Unallocated"}  -  Â£{j.price} sample</small>{actions&&<button className="outline" onClick={()=>{setSelected(j.id);show(isDispatch?2:4)}}>View & manage â†’</button>}</div></article>)}</div>;
return <main className={isDispatch?"demo-shell ops-demo xd-reference-chrome"+(sidebarCollapsed?" xd-reference-collapsed":""):"demo-shell ops-demo"}><aside className="sidebar"><div className="brand">XDRIVE <em>LOGISTICS</em></div>{nav.map((n,i)=><button key={n} className={tab===i?"active":""} onClick={()=>show(i)}>{isDispatch&&<DemoReferenceNavIcon label={n}/>}{n}</button>)}{isDispatch&&<DemoReferenceCollapse collapsed={sidebarCollapsed} onToggle={()=>setSidebarCollapsed(v=>!v)}/>}</aside><div className="content"><header className="topbar">{isDispatch?<DemoReferenceTopbar label="Dispatcher" onNavigate={show}/>:<><div className="mobile-brand">XDRIVE <em>LOGISTICS</em></div><div className="top-actions"><Link href="/try-xdrive">All workspaces</Link><Link href={isDispatch?"/try-xdrive-company-demo":"/try-xdrive-dispatcher-demo"}>{isDispatch?"Company Demo":"Dispatcher Demo"}</Link></div></>}</header>{process.env.NEXT_PUBLIC_XDRIVE_AUTONOMOUS_DEMO==="1"&&<AutonomousSessionBar preferredPersona={isDispatch?"dispatcher-b":"buyer-a"}/>}<nav className="mobile-tabs">{nav.map((n,i)=><button key={n} className={tab===i?"active":""} onClick={()=>show(i)}>{n}</button>)}</nav><div className="page"><div className="page-head">{!((tab===0)||(!isDispatch&&(tab===2||tab===4||tab===5||tab===6||tab===7||tab===15))||(isDispatch&&(tab===1||tab===2||tab===3||tab===4||tab===5||tab===6)))&&<h1>{nav[tab]}</h1>}</div>
{!isDispatch&&tab>=10&&tab!==13&&tab!==14&&tab!==15&&tab!==16&&<NetworkTools key={nav[tab]} role="Company" initialView={tab===13?"Freight Vision":nav[tab]} showTabs={false} onDirectoryMessage={messageMember} onDirectoryPostLoad={()=>show(1)} onOpenLoad={id=>showLoad(id)}/>}
{!isDispatch&&tab===13&&<DemoFreightVision onLoads={showLoad}/>}
{!isDispatch&&tab===14&&<DemoMessagesBoard jobs={sharedJobs} onBooking={()=>show(4)} targetRecipient={directoryTarget}/>}
{!isDispatch&&tab===15&&<DemoNotifications onNavigate={show}/>}
{!isDispatch&&tab===16&&<DemoReportsBoard jobs={sharedJobs} drivers={companyDrivers} vehicles={companyFleet} onNavigate={show}/>}
{tab===0&&<DemoCompanyDashboard jobs={sharedJobs} receivedQuoteCount={receivedQuotes.filter(q=>q.status==="Open").length} fleet={companyFleet.map(v=>({id:v.id,reg:v.reg,type:v.vehicle,driver:v.driver,area:v.location,status:v.status}))} drivers={companyDrivers} workspace={isDispatch?"Dispatcher":"Company"} go={isDispatch?(index=>show(({2:1,3:1,4:2,5:2,6:2,7:4,8:6} as Record<number,number>)[index]??0)):show}/>}
{!isDispatch&&tab===1&&<PostLoadDemo role="Customer" from="Birmingham B6" to="Manchester M1" vehicle="Luton Van" pallets="2" weight="450" onPublish={async data=>{const published=await publishDemoLoad(data);const id=published.id;const j:Job={id,from:data.from,to:data.to,vehicle:data.vehicle,cargo:data.pallets+" items  -  "+data.weight+" kg",company:"Your demo company",status:"Open",price:0,driver:"",vehicleId:"",stage:0,pod:false};setJobs(x=>[j,...x]);setSelected(id);show(2)}}/>}
{!isDispatch&&tab===2&&<DemoExchangeBoard role="Carrier" focus={navFocus?.page===2?navFocus:null}/>}
{isDispatch&&tab===1&&<DemoExchangeBoard role="Dispatcher" focus={navFocus?.page===1?navFocus:null}/>}
{isDispatch&&tab===1&&<div className="panel"><div className="panel-title"><h2>{isDispatch?"Dispatch Board":"Load Exchange"}</h2><span>{sharedJobs.length} SHARED LOADS</span></div><div className="ops-filters"><input aria-label="Search jobs" placeholder="Search route, ID or company" value={search} onChange={e=>setSearch(e.target.value)}/><select aria-label="Filter job status" value={filter} onChange={e=>setFilter(e.target.value)}>{["All","Open","Allocated","In Progress","Completed"].map(x=><option key={x}>{x}</option>)}</select></div>{list(sharedJobs.filter(j=>(filter==="All"||j.status===filter)&&(j.id+j.from+j.to+j.company).toLowerCase().includes(search.toLowerCase())))}</div>}
{((!isDispatch&&tab===4)||(isDispatch&&tab===2))&&<DemoCompanyBookings role={role} focus={navFocus?.page===(isDispatch?2:4)?navFocus:null}/>}
{!isDispatch&&tab===3&&<DemoCompanyQuotes focus={navFocus?.page===3?navFocus:null}/>}
{!isDispatch&&tab===5&&<DemoFleetBoard vehicles={companyFleet} setVehicles={setCompanyFleet} drivers={companyDrivers} setDrivers={setCompanyDrivers}/>}
{!isDispatch&&tab===6&&<DemoDriversBoard drivers={companyDrivers} vehicles={companyFleet} onFleet={()=>show(5)} onAddDriver={name=>setCompanyDrivers(prev=>prev.includes(name)?prev:[...prev,name])}/>}
{isDispatch&&tab===3&&<DemoReferenceLiveJobs jobs={sharedJobs} onAllocations={()=>show(2)} onDiary={()=>show(4)}/>}
{isDispatch&&tab===5&&<DemoMessagesBoard jobs={sharedJobs} onBooking={()=>show(2)} storageScope="dispatcher"/>}
{((!isDispatch&&tab===7)||(isDispatch&&tab===4))&&<DemoBookingOverview view="diary" focus={navFocus?.page===(isDispatch?4:7)?navFocus:null}/>}
{!isDispatch&&tab===8&&<DemoInvoicesBoard jobs={sharedJobs}/>}
{isDispatch&&tab===6&&<DemoReportsBoard jobs={sharedJobs} drivers={companyDrivers} vehicles={companyFleet} roleName="Dispatcher"/>}
{isDispatch&&tab===7&&<NetworkTools role="Dispatcher" onOpenLoad={id=>showLoad(id)}/>}
{!isDispatch&&tab===9&&<DemoNetworkToolsBoard onNavigate={show}/>}
</div></div></main>
}

