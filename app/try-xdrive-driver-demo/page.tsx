"use client";
import "../try-xdrive-demo/xdrive-design-system.css";

import DemoReferenceBookings from "../try-xdrive-demo/components/DemoReferenceBookings";
import {useState} from "react";
import {publishDemoLoad,useDemoLoads,useDemoBookings,useExchangeLoads} from "../try-xdrive-demo/components/demoExchange";
import DemoExchangeBoard from "../try-xdrive-demo/components/DemoExchangeBoard";
import OwnerDriverAlerts from "../try-xdrive-demo/components/OwnerDriverAlerts";
import DemoOwnerDriverMore from "../try-xdrive-demo/components/DemoOwnerDriverMore";
import {useDemoQuotes} from "../try-xdrive-demo/components/DemoQuotes";
import DemoMyQuotes from "../try-xdrive-demo/components/DemoQuotes";
import NetworkTools from "../try-xdrive-demo/components/NetworkTools";
import PostLoadDemo from "../try-xdrive-demo/components/PostLoadDemo";
import "../try-xdrive-demo/components/owner-driver-page.css";
import "../try-xdrive-demo/demo.css";
import "../try-xdrive-demo/wide-layout.css";
import DemoWorkspaceKpis from "../try-xdrive-demo/components/DemoWorkspaceKpis";
import DemoReferenceDashboardExtras from "../try-xdrive-demo/components/DemoReferenceDashboardExtras";
import "../try-xdrive-demo/workspace-visual-parity.css";
import {DemoReferenceNavIcon,DemoReferenceTopbar,DemoReferenceCollapse} from "../try-xdrive-demo/components/DemoReferenceChrome";
import "../try-xdrive-demo/reference-workspace-shell.css";
import AutonomousSessionBar from "../try-xdrive-demo/components/AutonomousSessionBar";
const nav=["Dashboard","Loads","My Quotes","Bookings","More","Network & Tools"];
export default function DriverDemo(){
const [sidebarCollapsed,setSidebarCollapsed]=useState(false);
const [demoPosted,setDemoPosted]=useState(false),[postedRoute,setPostedRoute]=useState(""),[tab,setTab]=useState(0),[networkView,setNetworkView]=useState("Overview"),[findFocus,setFindFocus]=useState<{ref:string;action:"details"|"quote";seq:number}|null>(null);
const openNetwork=(view:string)=>{setNetworkView(view);setTab(5)};
const sharedLoads=useDemoLoads(),{loads:exchangeLoads}=useExchangeLoads(),sharedQuotes=useDemoQuotes(),{loads:assignedBookings}=useDemoBookings();
const autonomous=process.env.NEXT_PUBLIC_XDRIVE_AUTONOMOUS_DEMO==="1";
const available=exchangeLoads.filter(l=>l.status==="Open");
const bookings=autonomous?assignedBookings:sharedLoads.filter(l=>l.status==="Awarded"&&l.driver==="Driver");
return <main className={"demo-shell xd-visual-parity"+(tab!==7?" xd-reference-chrome":"")+(sidebarCollapsed&&tab!==7?" xd-reference-collapsed":"")}><aside className="sidebar"><div className="brand">XDRIVE <em>LOGISTICS</em></div><div className="side-caption">DRIVER WORKSPACE</div>{nav.map((n,i)=><button key={n} className={tab===i?"active":""} onClick={()=>{setTab(i)}}>{tab!==7&&<DemoReferenceNavIcon label={n}/>}<span>{["▦","◉","£","▤","☰"][i]}</span>{n}</button>)}<button type="button" className={"sidebar-find-loads"+(tab===6?" active":"")} aria-current={tab===6?"page":undefined} onClick={()=>setTab(6)}>Find Loads →</button>{tab!==7&&<DemoReferenceCollapse collapsed={sidebarCollapsed} onToggle={()=>setSidebarCollapsed(v=>!v)}/>}</aside><div className="content"><header className="topbar">{tab!==7?<DemoReferenceTopbar label="Owner Driver DEMO" onNavigate={setTab} postLoadIndex={7}/>:<><div className="mobile-brand">XDRIVE <em>LOGISTICS</em></div><div className="top-actions"></div></>}</header>{process.env.NEXT_PUBLIC_XDRIVE_AUTONOMOUS_DEMO==="1"&&tab!==7&&<AutonomousSessionBar preferredPersona="owner-driver-d"/>}<nav className="mobile-tabs">{nav.map((n,i)=><button key={n} className={tab===i?"active":""} onClick={()=>{setTab(i)}}>{n}</button>)}<button className={tab===6?"active":""} onClick={()=>setTab(6)}>Find Loads</button></nav><div className="page"><div className="page-head">{![1,2,3,4,6].includes(tab)&&<div><h1>{tab===7?"Post Load":tab===6?"Find Loads":nav[tab]}</h1></div>}</div>

{tab===0&&<section className="xd-role-dashboard">{demoPosted&&<div className="notice">{autonomous?"Local independent Exchange load published: ":"Sample load created: "}{postedRoute}{autonomous?". Saved in the isolated ledger.":". No live job was published."}</div>}<p className="xd-role-subtitle">Owner Driver overview · Test environment</p><DemoWorkspaceKpis items={[{label:autonomous?"Exchange Loads":"Available Alerts",value:available.length,sub:autonomous?"Open local marketplace":"Matching loads",icon:"▣",color:"orange",onClick:()=>setTab(autonomous?6:1)},{label:"My Quotes",value:sharedQuotes.filter(q=>q.status==="Open"&&(autonomous||q.role==="Driver")).length,sub:"Submitted quotes",icon:"£",color:"blue",onClick:()=>setTab(2)},{label:"Active Bookings",value:bookings.filter(l=>autonomous?Boolean(!l.podReceived&&l.operationalStatus!=="pending_acceptance"):l.acceptanceStatus==="Accepted").length,sub:"Accepted jobs",icon:"▤",color:"green",onClick:()=>setTab(3)},{label:"POD Completed",value:bookings.filter(l=>l.podReceived).length,sub:"Delivery evidence",icon:"▧",color:"amber",onClick:()=>setTab(3)},{label:"Assigned Jobs",value:bookings.length,sub:"Driver assignments",icon:"▥",color:"sky",onClick:()=>setTab(3)}]}/><DemoReferenceDashboardExtras role="Owner Driver" route={{loads:1,bookings:3,diary:3,documents:3,network:5}} onNavigate={setTab}/></section>}
{tab===1&&(process.env.NEXT_PUBLIC_XDRIVE_AUTONOMOUS_DEMO==="1"?<OwnerDriverAlerts onFindLoads={()=>setTab(6)} onFocusLoad={(ref,action)=>{setFindFocus(s=>({ref,action,seq:(s?.seq||0)+1}));setTab(6)}}/>:<DemoExchangeBoard role="Driver"/>)} 
{tab===2&&<DemoMyQuotes role="Driver" onFindLoads={()=>setTab(6)}/>}
{tab===3&&<DemoReferenceBookings role="Driver"/>}
{tab===4&&<DemoOwnerDriverMore onNetwork={openNetwork} onLoads={()=>setTab(6)} onQuotes={()=>setTab(2)} onBookings={()=>setTab(3)} onPostLoad={()=>setTab(7)}/>}
{tab===5&&<NetworkTools key={networkView} role="Driver" initialView={networkView} onDirectoryPostLoad={()=>setTab(7)} onOpenLoad={()=>setTab(1)}/>}
{tab===6&&<DemoExchangeBoard role="Driver" variant="find" focus={findFocus}/>} 
{tab===7&&<><div className="actions"><button className="outline" onClick={()=>setTab(4)}>← Back to More</button></div><PostLoadDemo role="Customer" from="Birmingham B6" to="Manchester M1" vehicle="Luton Van" pallets="2" weight="450" onPublish={async(data)=>{await publishDemoLoad(data);setPostedRoute(data.from+" → "+data.to);setDemoPosted(true);setTab(0)}}/></>}
</div></div></main>;
}
