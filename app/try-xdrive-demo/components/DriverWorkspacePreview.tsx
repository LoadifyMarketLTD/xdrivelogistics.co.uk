"use client";
import {useState} from "react";
import ApprovedSidebar from "./ApprovedSidebar";
import "../xdrive-design-system.css";
import "../demo.css";
import "../wide-layout.css";
import "./operations-demo.css";
import "./company-sidebar-compact.css";
import "./company-layout-stability.css";
const nav=["Dashboard","Bookings","Diary","Documents","Availability","Messages","Notifications","Profile","More"];
const descriptions:Record<string,string>={
Bookings:"Only jobs explicitly allocated to this employee by their employer belong here. Acceptance, collection, delivery and POD must use authenticated booking APIs.",
Diary:"Only the employee's allocated upcoming, active and completed jobs should appear in the diary.",
Documents:"Personal driving licence, Right to Work, training and compliance documents. Employer fleet and other drivers' documents are excluded.",
Availability:"The employee can communicate their own working availability to the employer. They cannot advertise company vehicles as an independent carrier.",
Messages:"Only conversations with the employing company and authorized job contacts should be shown.",
Notifications:"Only notifications addressed to this driver, including job allocation and status changes, belong here.",
Profile:"Personal details and employer association. Company billing, membership administration and fleet management are excluded.",
More:"Driver-specific settings, support and event history. No load publishing, quote submission, carrier invoicing or fleet allocation."
};
export default function DriverWorkspacePreview({role}:{role:"Company Driver"|"Employee Driver"}){
const [tab,setTab]=useState(0);const section=nav[tab];
return <main className="demo-shell ops-demo xd-approved-sidebar-shell"><ApprovedSidebar items={nav} activeIndex={tab} onSelect={setTab}/><div className="content"><header className="topbar"><div className="mobile-brand">XDRIVE <em>{role.toUpperCase()}</em></div></header><nav className="mobile-tabs">{nav.map((name,index)=><button key={name} className={tab===index?"active":""} onClick={()=>setTab(index)}>{name}</button>)}</nav><div className="page"><div className="page-head"><h1>{section}</h1></div>
{tab===0?<><div className="panel"><h2>{role} Dashboard</h2><p>Employee workspace for assigned jobs and delivery execution. Employer controls allocation, customer quotes, fleet and invoices.</p><div className="actions"><button className="primary" onClick={()=>setTab(1)}>Assigned bookings</button><button className="outline" onClick={()=>setTab(3)}>My documents</button></div></div><div className="panel"><h2>Booking workflow</h2><p>Assigned job → Accept or Decline → On my way → On site → Loaded → Delivery → POD.</p><p className="notice">No authenticated employee bookings are loaded in this visual preview. Shared DEMO jobs are deliberately excluded to prevent showing another driver's jobs.</p></div></>:<div className="panel"><h2>{section}</h2><p>{descriptions[section]}</p><p className="notice">This section is not connected to the employee-scoped backend. No fictional records or operational actions are presented as live.</p>{tab===1&&<button className="outline" onClick={()=>setTab(2)}>Open diary</button>}{tab===2&&<button className="outline" onClick={()=>setTab(1)}>Open bookings</button>}</div>}
</div></div></main>;
}
