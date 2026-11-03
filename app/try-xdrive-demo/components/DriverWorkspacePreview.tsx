"use client";
import {useState} from "react";
import ApprovedSidebar from "./ApprovedSidebar";
import DemoSharedBookings from "./DemoSharedBookings";
import DemoDriverTools from "./DemoDriverTools";
import DemoBookingOverview from "./DemoBookingOverview";
import DemoNotifications from "./DemoNotifications";
import NetworkTools from "./NetworkTools";
import "../xdrive-design-system.css";
import "../demo.css";
import "../wide-layout.css";
import "./operations-demo.css";
import "./company-sidebar-compact.css";
import "./company-layout-stability.css";
const nav=["Dashboard","Bookings","Diary","Documents","Availability","Messages","Notifications","Directory","More"];
export default function DriverWorkspacePreview({role}:{role:"Company Driver"|"Employee Driver"}){
const [tab,setTab]=useState(0);
return <main className="demo-shell ops-demo xd-approved-sidebar-shell"><ApprovedSidebar items={nav} activeIndex={tab} onSelect={setTab}/><div className="content"><header className="topbar"><div className="mobile-brand">XDRIVE <em>{role.toUpperCase()}</em></div></header><nav className="mobile-tabs">{nav.map((name,index)=><button key={name} className={tab===index?"active":""} onClick={()=>setTab(index)}>{name}</button>)}</nav><div className="page"><div className="page-head"><h1>{nav[tab]}</h1></div>
{tab===0&&<><div className="panel"><h2>{role} Dashboard</h2><p>Assigned bookings, collection and delivery updates, and proof of delivery. Load posting, carrier quotes and invoicing are managed by the employing company.</p><div className="actions"><button className="primary" onClick={()=>setTab(1)}>View assigned bookings</button><button className="outline" onClick={()=>setTab(3)}>Driver documents</button></div></div><DemoSharedBookings role="Company Driver"/></>}
{tab===1&&<DemoSharedBookings role="Company Driver"/>}
{tab===2&&<DemoBookingOverview view="diary"/>}
{tab===3&&<DemoBookingOverview view="documents"/>}
{tab===4&&<DemoDriverTools role="Company Driver"/>}
{tab===5&&<NetworkTools role="Driver" initialView="Messages" showTabs={false}/>}
{tab===6&&<DemoNotifications onNavigate={setTab}/>}
{tab===7&&<NetworkTools role="Driver" initialView="Directory" showTabs={false}/>}
{tab===8&&<DemoDriverTools role="Company Driver"/>}
</div></div></main>;
}
