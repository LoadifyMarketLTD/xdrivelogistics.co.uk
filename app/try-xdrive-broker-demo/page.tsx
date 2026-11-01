"use client";
import "../try-xdrive-demo/xdrive-design-system.css";

import DemoBookingOverview from "../try-xdrive-demo/components/DemoBookingOverview";
import DemoReferenceBookingRecords from "../try-xdrive-demo/components/DemoReferenceBookingRecords";
import DemoReferenceBookings from "../try-xdrive-demo/components/DemoReferenceBookings";
import {useState} from "react";
import {publishDemoLoad,useDemoLoads} from "../try-xdrive-demo/components/demoExchange";
import {useDemoQuotes} from "../try-xdrive-demo/components/DemoQuotes";
import DemoCompanyQuotes from "../try-xdrive-demo/components/DemoCompanyQuotes";
import DemoExchangeBoard from "../try-xdrive-demo/components/DemoExchangeBoard";
import NetworkTools from "../try-xdrive-demo/components/NetworkTools";
import PostLoadDemo from "../try-xdrive-demo/components/PostLoadDemo";
import "../try-xdrive-demo/demo.css";
import "../try-xdrive-demo/wide-layout.css";
import "./broker.css";
import DemoWorkspaceKpis from "../try-xdrive-demo/components/DemoWorkspaceKpis";
import DemoReferenceDashboardExtras from "../try-xdrive-demo/components/DemoReferenceDashboardExtras";
import "../try-xdrive-demo/workspace-visual-parity.css";
import {DemoReferenceNavIcon,DemoReferenceTopbar,DemoReferenceCollapse} from "../try-xdrive-demo/components/DemoReferenceChrome";
import "../try-xdrive-demo/reference-workspace-shell.css";
import AutonomousSessionBar from "../try-xdrive-demo/components/AutonomousSessionBar";
const nav=["Dashboard","Post Load","My Loads","Carrier Quotes","Awards","Bookings","Diary","POD Review","More","Network & Tools"];
export default function BrokerDemo(){

const [sidebarCollapsed,setSidebarCollapsed]=useState(false);
const [tab,setTab]=useState(0),[from,setFrom]=useState("Birmingham B6"),[to,setTo]=useState("Manchester M1"),[pallets,setPallets]=useState("2"),[weight,setWeight]=useState("450"),[vehicle,setVehicle]=useState("Luton Van"),[customer,setCustomer]=useState("Demo Retail Distribution Ltd"),[sell,setSell]=useState("260"),[,setPublished]=useState(false);
const sharedLoads=useDemoLoads(),sharedQuotes=useDemoQuotes("received");
const [networkView,setNetworkView]=useState("Overview"),[moreNotice,setMoreNotice]=useState("");
const openNetwork=(view:string)=>{setNetworkView(view);setMoreNotice("");setTab(9)};

return <main className={"demo-shell xd-visual-parity broker-demo"+(tab!==1?" xd-reference-chrome":"")+(sidebarCollapsed&&tab!==1?" xd-reference-collapsed":"")}><aside className="sidebar"><div className="brand">XDRIVE <em>LOGISTICS</em></div><div className="side-caption">BROKER WORKSPACE</div>{nav.map((n,i)=><button key={n} className={tab===i?"active":""} onClick={()=>setTab(i)}>{tab!==1&&<DemoReferenceNavIcon label={n}/>}<span>{["▦","＋","↗","£","✓","▤","◷","▣","☰"][i]}</span>{n}</button>)}{tab!==1&&<DemoReferenceCollapse collapsed={sidebarCollapsed} onToggle={()=>setSidebarCollapsed(v=>!v)}/>}</aside><div className="content"><header className="topbar">{tab!==1?<DemoReferenceTopbar label="Broker DEMO" onNavigate={setTab} postLoadIndex={1}/>:<><div className="mobile-brand">XDRIVE <em>LOGISTICS</em></div><div className="top-actions"></div></>}</header>{process.env.NEXT_PUBLIC_XDRIVE_AUTONOMOUS_DEMO==="1"&&tab!==1&&<AutonomousSessionBar preferredPersona="broker-c"/>}<nav className="mobile-tabs">{nav.map((n,i)=><button key={n} className={tab===i?"active":""} onClick={()=>setTab(i)}>{n}</button>)}</nav><div className="page"><div className="page-head">{![2,3,4,5,6,7].includes(tab)&&<h1>{nav[tab]}</h1>}</div>
{tab===0&&<section className="xd-role-dashboard"><p className="xd-role-subtitle">Broker overview · Test environment</p><DemoWorkspaceKpis items={[{label:"Posted Loads",value:sharedLoads.length,sub:"Transport requests",icon:"▣",color:"orange",onClick:()=>setTab(2)},{label:"Carrier Quotes",value:sharedQuotes.filter(q=>q.status==="Open").length,sub:"Offers to review",icon:"£",color:"blue",onClick:()=>setTab(3)},{label:"Awarded Jobs",value:sharedLoads.filter(l=>l.status==="Awarded").length,sub:"Carrier confirmed",icon:"▤",color:"green",onClick:()=>setTab(4)},{label:"Proof of Delivery",value:sharedLoads.filter(l=>l.podReceived).length,sub:"Evidence received",icon:"▧",color:"amber",onClick:()=>setTab(7)},{label:"Open Loads",value:sharedLoads.filter(l=>l.status==="Open").length,sub:"Awaiting quotes",icon:"▥",color:"sky",onClick:()=>setTab(2)}]}/><DemoReferenceDashboardExtras role="Broker" route={{loads:2,bookings:5,diary:6,documents:7,network:9}} onNavigate={setTab}/></section>}
{tab===1&&<PostLoadDemo role="Broker" from={from} to={to} vehicle={vehicle} pallets={pallets} weight={weight} customer={customer} sell={sell} onPublish={async(data)=>{await publishDemoLoad(data);setFrom(data.from);setTo(data.to);setVehicle(data.vehicle);setPallets(data.pallets);setWeight(data.weight);setCustomer(data.customer);setSell(data.sell);setPublished(true);setTab(2)}}/>}
{tab===2&&<DemoExchangeBoard role="Broker"/>}
{tab===3&&<DemoCompanyQuotes audience="received"/>}
{tab===4&&<DemoReferenceBookingRecords view="awards" onBookings={()=>setTab(5)}/>}
{tab===5&&<DemoReferenceBookings role="Broker"/>}
{tab===6&&<DemoBookingOverview view="diary"/>}
{tab===7&&<DemoReferenceBookingRecords view="pod" onBookings={()=>setTab(5)}/>}
{tab===8&&<div className="panel"><h2>Broker management tools</h2>{moreNotice&&<p className="notice" role="status">{moreNotice}</p>}<div className="steps">{["Customer Accounts","Carrier Network","Messages","Customer Invoices","Carrier Costs","Margins & Reports","Event Log","Help & Support"].map((x,i)=><button key={x} onClick={()=>{if(i===6){setTab(6);return}if(i===7){setMoreNotice("Help and Support are not connected in this DEMO yet.");return}openNetwork(["Directory","Directory","Messages","Finance","Finance","Reports"][i])}}><b>{String(i+1).padStart(2,"0")}</b><span>{x}</span><span>→</span></button>)}</div></div>}
{tab===9&&<NetworkTools key={networkView} role="Broker" initialView={networkView} onDirectoryPostLoad={()=>setTab(1)} onOpenLoad={()=>setTab(2)}/>}
</div></div></main>;
}
