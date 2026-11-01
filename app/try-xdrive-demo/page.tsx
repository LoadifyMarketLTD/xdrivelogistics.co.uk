"use client";
import "./xdrive-design-system.css";

import DemoReferenceBookingRecords from "./components/DemoReferenceBookingRecords";
import DemoReferenceBookings from "./components/DemoReferenceBookings";
import {useState} from "react";
import {publishDemoLoad,useDemoLoads} from "../try-xdrive-demo/components/demoExchange";
import {useDemoQuotes} from "../try-xdrive-demo/components/DemoQuotes";
import DemoCompanyQuotes from "./components/DemoCompanyQuotes";
import NetworkTools from "../try-xdrive-demo/components/NetworkTools";
import PostLoadDemo from "../try-xdrive-demo/components/PostLoadDemo";
import Link from "next/link";
import "./demo.css";
import "../try-xdrive-demo/wide-layout.css";
import DemoWorkspaceKpis from "./components/DemoWorkspaceKpis";
import DemoReferenceDashboardExtras from "./components/DemoReferenceDashboardExtras";
import "./workspace-visual-parity.css";
import {DemoReferenceNavIcon,DemoReferenceTopbar,DemoReferenceCollapse} from "./components/DemoReferenceChrome";
import "./reference-workspace-shell.css";
import AutonomousSessionBar from "./components/AutonomousSessionBar";
const tabs=["Dashboard","Post Load","Quotes","Bookings","Tracking","Documents","Network & Tools"];
export default function Demo(){
const [sidebarCollapsed,setSidebarCollapsed]=useState(false);
const [,setPublished]=useState(false),[tab,setTab]=useState(0),[from,setFrom]=useState("Birmingham B6"),[to,setTo]=useState("Manchester M1"),[pallets,setPallets]=useState("2"),[weight,setWeight]=useState("450"),[vehicle,setVehicle]=useState("Luton Van");
const loads=useDemoLoads(),sharedQuotes=useDemoQuotes("received"),openLoads=loads.filter(l=>l.status==="Open"),awardedLoads=loads.filter(l=>l.status==="Awarded");
return <main className={"demo-shell xd-visual-parity"+(tab!==1?" xd-reference-chrome":"")+(sidebarCollapsed&&tab!==1?" xd-reference-collapsed":"")}><aside className="sidebar"><div className="brand">XDRIVE <em>LOGISTICS</em></div><div className="side-caption">CUSTOMER WORKSPACE</div>{tabs.map((t,i)=><button key={t} className={tab===i?"active":""} onClick={()=>setTab(i)}>{tab!==1&&<DemoReferenceNavIcon label={t}/>}<span>{["▦","＋","£","▤","◎","▣"][i]}</span>{t}</button>)}{tab!==1&&<DemoReferenceCollapse collapsed={sidebarCollapsed} onToggle={()=>setSidebarCollapsed(v=>!v)}/>}</aside><div className="content"><header className="topbar">{tab!==1?<DemoReferenceTopbar label="Customer DEMO" onNavigate={setTab} postLoadIndex={1}/>:<><div className="mobile-brand">XDRIVE <em>LOGISTICS</em></div><div className="top-actions"><Link href="/">Back to website ↗</Link></div></>}</header>{process.env.NEXT_PUBLIC_XDRIVE_AUTONOMOUS_DEMO==="1"&&tab!==1&&<AutonomousSessionBar preferredPersona="customer-a"/>}<nav className="mobile-tabs">{tabs.map((t,i)=><button key={t} className={tab===i?"active":""} onClick={()=>setTab(i)}>{t}</button>)}</nav><div className="page">
<div className="page-head">{![2,3,4,5].includes(tab)&&<h1>{tabs[tab]}</h1>}</div>

{tab===0&&<section className="xd-role-dashboard"><p className="xd-role-subtitle">Customer overview · Test environment</p><DemoWorkspaceKpis items={[{label:"Active Loads",value:openLoads.length,sub:"Transport requests",icon:"▣",color:"orange",onClick:()=>setTab(1)},{label:"Quotes Received",value:sharedQuotes.filter(q=>q.status==="Open").length,sub:"Available to compare",icon:"£",color:"blue",onClick:()=>setTab(2)},{label:"Awarded Bookings",value:awardedLoads.length,sub:"Carrier confirmed",icon:"▤",color:"green",onClick:()=>setTab(3)},{label:"Deliveries Completed",value:loads.filter(l=>l.podReceived).length,sub:"Proof of delivery",icon:"▧",color:"amber",onClick:()=>setTab(5)},{label:"Total Requests",value:loads.length,sub:"Transport history",icon:"▥",color:"sky",onClick:()=>setTab(4)}]}/><DemoReferenceDashboardExtras role="Customer" route={{loads:4,bookings:3,diary:4,documents:5,network:6}} onNavigate={setTab}/></section>}
{tab===1&&<PostLoadDemo role="Customer" from={from} to={to} vehicle={vehicle} pallets={pallets} weight={weight} onPublish={async(data)=>{await publishDemoLoad(data);setFrom(data.from);setTo(data.to);setVehicle(data.vehicle);setPallets(data.pallets);setWeight(data.weight);setPublished(true);setTab(2)}}/>}
{tab===2&&<DemoCompanyQuotes audience="received"/>}
{tab===3&&<DemoReferenceBookings role="Customer"/>}
{tab===4&&<DemoReferenceBookingRecords view="tracking" onBookings={()=>setTab(3)}/>}
{tab===5&&<DemoReferenceBookingRecords view="documents" onBookings={()=>setTab(3)}/>}
{tab===6&&<NetworkTools role="Customer" onDirectoryPostLoad={()=>setTab(1)}/>}

</div></div></main>
}
