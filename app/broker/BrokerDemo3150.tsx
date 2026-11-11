"use client";
import ApprovedSidebar from "../try-xdrive-demo/components/ApprovedSidebar";
import "../try-xdrive-demo/xdrive-design-system.css";

import DemoBookingOverview from "../try-xdrive-demo/components/DemoBookingOverview";
import {useState} from "react";
import {publishDemoLoad,useDemoLoads} from "../try-xdrive-demo/components/demoExchange";
import DemoCompanyQuotes from "../try-xdrive-demo/components/DemoCompanyQuotes";
import DemoCompanyBookings from "../try-xdrive-demo/components/DemoCompanyBookings";
import DemoCompanyDashboard from "../try-xdrive-demo/components/DemoCompanyDashboard";
import DemoNetworkToolsBoard from "../try-xdrive-demo/components/DemoNetworkToolsBoard";
import DemoExchangeBoard from "../try-xdrive-demo/components/DemoExchangeBoard";
import PostLoadDemo from "../try-xdrive-demo/components/PostLoadDemo";
import "../try-xdrive-demo/demo.css";
import "../try-xdrive-demo/wide-layout.css";
import "../try-xdrive-demo/components/operations-demo.css";
import "../try-xdrive-demo/components/company-layout-stability.css";

import "./broker-demo-3150.css";
import {useCompany3150Live} from "../try-xdrive-demo/components/Company3150LiveData";
const nav=["Dashboard","Post Load","My Loads","Carrier Quotes","Awards","Bookings","Diary","POD Review","More","Network & Tools"];
export default function BrokerDemo3150(){
const real=useCompany3150Live();

const [tab,setTab]=useState(0),[from,setFrom]=useState("Birmingham B6"),[to,setTo]=useState("Manchester M1"),[pallets,setPallets]=useState("2"),[weight,setWeight]=useState("450"),[vehicle,setVehicle]=useState("Luton Van"),[customer,setCustomer]=useState("Demo Retail Distribution Ltd"),[sell,setSell]=useState("260"),[_published,setPublished]=useState(false);
const sharedLoads=useDemoLoads();

const companyOverviewJobs=sharedLoads.map(l=>({id:l.id,from:l.from,to:l.to,vehicle:l.vehicle,cargo:[l.pallets?l.pallets+" pallets":"",l.weight?l.weight+" kg":""].filter(Boolean).join(" · ")||"Cargo not recorded",company:l.customer||"Customer not recorded",status:l.podReceived?"Completed":l.status==="Awarded"?"In Progress":l.status,price:Number(l.quote||0),driver:l.assignedDriver||"",vehicleId:l.assignedVehicleId||"",stage:l.deliveryStage||0,pod:Boolean(l.podReceived)}));
return <main className="demo-shell ops-demo broker-demo xd-approved-sidebar-shell"><ApprovedSidebar items={nav} activeIndex={tab} onSelect={setTab} /><div className="content"><header className="topbar"><div className="mobile-brand">XDRIVE <em>LOGISTICS</em></div><div className="top-actions"></div></header><nav className="mobile-tabs">{nav.map((n,i)=><button key={n} className={tab===i?"active":""} onClick={()=>setTab(i)}>{n}</button>)}</nav><div className="page"><div className="page-head">{![2,3,5,9].includes(tab)&&<h1>{nav[tab]}</h1>}</div>
{tab===0&&<DemoCompanyDashboard suppressPreview workspaceLabel="Broker" jobs={companyOverviewJobs} fleet={[]} drivers={[]} go={i=>setTab(({2:2,3:3,4:5,5:9,6:9,7:6,8:9} as Record<number,number>)[i]??0)}/>}
{tab===1&&<PostLoadDemo liveMode={!!real} role="Broker" from={real?"":from} to={real?"":to} vehicle={real?"":vehicle} pallets={real?"":pallets} weight={real?"":weight} customer={real?"":customer} sell={real?"":sell} onPublish={async(data)=>{if(real){window.location.assign("/broker/post-load");return;}await publishDemoLoad(data);setFrom(data.from);setTo(data.to);setVehicle(data.vehicle);setPallets(data.pallets);setWeight(data.weight);setCustomer(data.customer);setSell(data.sell);setPublished(true);setTab(2)}}/>}
{tab===2&&<DemoExchangeBoard role="Broker"/>}
{tab===3&&<DemoCompanyQuotes mode="all" allowAward/>}
{tab===4&&<DemoBookingOverview view="awards"/>}
{tab===5&&<DemoCompanyBookings role="Broker"/>}
{tab===6&&<DemoBookingOverview view="diary"/>}
{tab===7&&<DemoBookingOverview view="pod"/>}
{tab===8&&<div className="panel"><h2>Broker management tools</h2><div className="steps">{["Customer Accounts","Carrier Network","Messages","Customer Invoices","Carrier Costs","Margins & Reports","Event Log","Help & Support"].map((x,i)=><button key={x} onClick={()=>setTab([0,3,0,4,4,4,6,0][i])}><b>{String(i+1).padStart(2,"0")}</b><span>{x}</span><span>→</span></button>)}</div></div>}
{tab===9&&<DemoNetworkToolsBoard audience="standard" onNavigate={i=>setTab(({4:5,10:9,11:9,12:9,16:9} as Record<number,number>)[i]??9)}/>}
</div></div></main>;
}
