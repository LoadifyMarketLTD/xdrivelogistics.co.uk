"use client";
import "../try-xdrive-demo/xdrive-design-system.css";

import DemoReferenceBookings from "../try-xdrive-demo/components/DemoReferenceBookings";
import {useDemoBookings} from "../try-xdrive-demo/components/demoExchange";
import {useState} from "react";
import NetworkTools from "../try-xdrive-demo/components/NetworkTools";
import DemoExchangeBoard from "../try-xdrive-demo/components/DemoExchangeBoard";
import AutonomousCompanyDriverAssignments from "../try-xdrive-demo/components/AutonomousCompanyDriverAssignments";
import DemoMyQuotes from "../try-xdrive-demo/components/DemoQuotes";
import DemoDriverTools from "../try-xdrive-demo/components/DemoDriverTools";
import "../try-xdrive-demo/demo.css";
import "../try-xdrive-demo/wide-layout.css";
import DemoWorkspaceKpis from "../try-xdrive-demo/components/DemoWorkspaceKpis";
import DemoReferenceDashboardExtras from "../try-xdrive-demo/components/DemoReferenceDashboardExtras";
import "../try-xdrive-demo/workspace-visual-parity.css";
import {DemoReferenceNavIcon,DemoReferenceTopbar,DemoReferenceCollapse} from "../try-xdrive-demo/components/DemoReferenceChrome";
import "../try-xdrive-demo/reference-workspace-shell.css";
import AutonomousSessionBar from "../try-xdrive-demo/components/AutonomousSessionBar";
const nav=["Dashboard","Loads","My Quotes","Bookings","More","Network & Tools"];
export default function CompanyDriverDemo(){
const [sidebarCollapsed,setSidebarCollapsed]=useState(false);
const [tab,setTab]=useState(0),[saved,setSaved]=useState(false);
const [bookingFocus,setBookingFocus]=useState<{ref:string;seq:number}|null>(null);
const openBooking=(ref:string)=>{setBookingFocus(previous=>({ref,seq:(previous?.seq||0)+1}));setTab(3)};
const {loads:assignedBookings}=useDemoBookings();
const autonomous=process.env.NEXT_PUBLIC_XDRIVE_AUTONOMOUS_DEMO==="1";
const pendingPOD=assignedBookings.filter(l=>l.operationalStatus==="delivered"&&!l.podReceived).length;
return <main className={"demo-shell xd-visual-parity xd-reference-chrome"+(sidebarCollapsed?" xd-reference-collapsed":"")}><aside className="sidebar"><div className="brand">XDRIVE <em>LOGISTICS</em></div><div className="side-caption">COMPANY DRIVER</div>{nav.map((n,i)=><button className={tab===i?"active":""} key={n} onClick={()=>setTab(i)}><DemoReferenceNavIcon label={n}/><span>▸</span>{n}</button>)}<DemoReferenceCollapse collapsed={sidebarCollapsed} onToggle={()=>setSidebarCollapsed(v=>!v)}/></aside><div className="content"><header className="topbar"><DemoReferenceTopbar label="Company Driver" onNavigate={setTab}/></header>{process.env.NEXT_PUBLIC_XDRIVE_AUTONOMOUS_DEMO==="1"&&<AutonomousSessionBar preferredPersona="company-driver-b"/>}<nav className="mobile-tabs">{nav.map((n,i)=><button className={tab===i?"active":""} key={n} onClick={()=>setTab(i)}>{n}</button>)}</nav><div className="page"><div className="page-head">{tab!==1&&tab!==2&&tab!==3&&<div><h1>{nav[tab]}</h1><p>{autonomous?"Company-assigned jobs from the isolated operational ledger.":"Company-assigned transport and delivery actions, with XDrive Logistics."}</p></div>}</div>
{tab===0&&<section className="xd-role-dashboard"><DemoWorkspaceKpis items={[{label:"Assigned Bookings",value:autonomous?assignedBookings.length:1,sub:"From your company",icon:"▣",color:"orange",onClick:()=>setTab(3)},{label:"Alerts",value:autonomous?pendingPOD:2,sub:autonomous?"Pending delivery evidence":"Demo notifications",icon:"▤",color:"blue",onClick:()=>setTab(1)},{label:"Delivered",value:assignedBookings.filter(l=>l.podReceived).length,sub:"With POD",icon:"▧",color:"green",onClick:()=>setTab(3)},{label:"Assigned Vehicle",value:autonomous?new Set(assignedBookings.map(l=>l.assignedVehicleId).filter(Boolean)).size:1,sub:autonomous?"Recorded allocations":"DX26 VAN",icon:"♟",color:"amber",onClick:()=>setTab(3)},{label:"POD Required",value:autonomous?pendingPOD:1,sub:autonomous?"Delivered, waiting POD":"Sample assignment",icon:"▥",color:"sky",onClick:()=>setTab(3)}]}/><DemoReferenceDashboardExtras role="Company Driver" route={{loads:1,bookings:3,diary:3,documents:3,network:5}} onNavigate={setTab}/></section>}
{tab===1&&(autonomous?<AutonomousCompanyDriverAssignments mode="loads" onOpenBooking={openBooking}/>:<DemoExchangeBoard role="Company Driver"/>)} 
{tab===1&&!autonomous&&<div className="panel"><h2>Assigned job alerts</h2><p className="notice">New company assignment · XDL-DEMO-1029 · Birmingham B6 → Manchester M1</p><p className="notice">Dispatch update · Collection window 10:00–12:00</p><div className="actions"><button className="primary" onClick={()=>setTab(3)}>View assignment</button><button className="outline" onClick={()=>setSaved(!saved)}>{saved?"Saved for later":"Save alert"}</button></div></div>}
{tab===2&&(autonomous?<AutonomousCompanyDriverAssignments mode="quotes" onOpenBooking={openBooking}/>:<DemoMyQuotes role="Company Driver"/>)} 
{tab===3&&<DemoReferenceBookings role="Company Driver" focus={bookingFocus}/>} 
{tab===5&&<NetworkTools role="Company Driver" onOpenLoad={()=>setTab(1)}/>}
{tab===4&&<DemoDriverTools role="Company Driver"/>}
</div></div></main>
}