"use client";
import ApprovedSidebar from "./components/ApprovedSidebar";
import "./xdrive-design-system.css";

import DemoBookingOverview from "./components/DemoBookingOverview";
import {useState} from "react";
import {publishDemoLoad,useDemoLoads} from "../try-xdrive-demo/components/demoExchange";
import DemoCompanyQuotes from "./components/DemoCompanyQuotes";
import DemoCompanyBookings from "./components/DemoCompanyBookings";
import DemoCompanyDashboard from "./components/DemoCompanyDashboard";
import DemoNetworkToolsBoard from "./components/DemoNetworkToolsBoard";
import PostLoadDemo from "../try-xdrive-demo/components/PostLoadDemo";
import Link from "next/link";
import "./demo.css";
import "../try-xdrive-demo/wide-layout.css";
import "./components/operations-demo.css";
import "./components/company-layout-stability.css";
const tabs=["Dashboard","Post Load","Quotes","Bookings","Tracking","Documents","Network & Tools"];
export default function Demo(){
const [,setPublished]=useState(false),[tab,setTab]=useState(0),[from,setFrom]=useState("Birmingham B6"),[to,setTo]=useState("Manchester M1"),[pallets,setPallets]=useState("2"),[weight,setWeight]=useState("450"),[vehicle,setVehicle]=useState("Luton Van");
const loads=useDemoLoads();
const companyOverviewJobs=loads.map(l=>({id:l.id,from:l.from,to:l.to,vehicle:l.vehicle,cargo:[l.pallets?l.pallets+" pallets":"",l.weight?l.weight+" kg":""].filter(Boolean).join(" · ")||"Cargo not recorded",company:l.customer||"Customer not recorded",status:l.podReceived?"Completed":l.status==="Awarded"?"In Progress":l.status,price:Number(l.quote||0),driver:l.assignedDriver||"",vehicleId:l.assignedVehicleId||"",stage:l.deliveryStage||0,pod:Boolean(l.podReceived)}));
return <main className="demo-shell ops-demo xd-approved-sidebar-shell"><ApprovedSidebar items={tabs} activeIndex={tab} onSelect={setTab} /><div className="content"><header className="topbar"><div className="mobile-brand">XDRIVE <em>LOGISTICS</em></div><div className="top-actions"><Link href="/">Back to website ↗</Link></div></header><nav className="mobile-tabs">{tabs.map((t,i)=><button key={t} className={tab===i?"active":""} onClick={()=>setTab(i)}>{t}</button>)}</nav><div className="page">
<div className="page-head">{![2,3,6].includes(tab)&&<h1>{tabs[tab]}</h1>}</div>

{tab===0&&<DemoCompanyDashboard suppressPreview workspaceLabel="Customer" jobs={companyOverviewJobs} fleet={[]} drivers={[]} go={i=>setTab(({2:2,3:2,4:3,5:6,6:6,7:4,8:5} as Record<number,number>)[i]??0)}/>}
{tab===1&&<PostLoadDemo role="Customer" from={from} to={to} vehicle={vehicle} pallets={pallets} weight={weight} onPublish={async(data)=>{await publishDemoLoad(data);setFrom(data.from);setTo(data.to);setVehicle(data.vehicle);setPallets(data.pallets);setWeight(data.weight);setPublished(true);setTab(2)}}/>}
{tab===2&&<DemoCompanyQuotes mode="all" allowAward/>}
{tab===3&&<DemoCompanyBookings role="Customer"/>}
{tab===4&&<DemoBookingOverview view="tracking"/>}
{tab===5&&<DemoBookingOverview view="documents"/>}
{tab===6&&<DemoNetworkToolsBoard audience="standard" onNavigate={i=>setTab(({4:3,10:6,11:6,12:6,16:6} as Record<number,number>)[i]??6)}/>}

</div></div></main>
}
