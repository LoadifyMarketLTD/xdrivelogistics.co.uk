"use client";
import DemoSharedBookings from "../try-xdrive-demo/components/DemoSharedBookings";
import {useState} from "react";
import Link from "next/link";
import NetworkTools from "../try-xdrive-demo/components/NetworkTools";
import DemoExchangeBoard from "../try-xdrive-demo/components/DemoExchangeBoard";
import DemoDriverTools from "../try-xdrive-demo/components/DemoDriverTools";
import "../try-xdrive-demo/demo.css";
import "../try-xdrive-demo/wide-layout.css";
const nav=["Dashboard","Alerts","My Quotes","Bookings","More","Network & Tools"];
export default function CompanyDriverDemo(){
const [tab,setTab]=useState(0),[saved,setSaved]=useState(false);
return <main className="demo-shell"><aside className="sidebar"><div className="brand">XDRIVE <em>LOGISTICS</em></div><div className="side-caption">COMPANY DRIVER</div>{nav.map((n,i)=><button className={tab===i?"active":""} key={n} onClick={()=>setTab(i)}><span>▸</span>{n}</button>)}</aside><div className="content"><header className="topbar"><div className="mobile-brand">XDRIVE <em>LOGISTICS</em></div><div className="top-actions"><Link href="/try-xdrive">All workspaces</Link></div></header><nav className="mobile-tabs">{nav.map((n,i)=><button className={tab===i?"active":""} key={n} onClick={()=>setTab(i)}>{n}</button>)}</nav><div className="page"><div className="page-head"><div><h1>{nav[tab]}</h1><p>Company-assigned transport and delivery actions, with fictional data.</p></div><button className="primary" onClick={()=>setTab(3)}>Open Booking</button></div>
{tab===0&&<><div className="metrics"><div><small>ASSIGNED BOOKINGS</small><b>1</b><span>From your company</span></div><div><small>ALERTS</small><b>2</b><span>Demo notifications</span></div><div><small>DELIVERED</small><b>0</b><span>With POD</span></div><div><small>AVAILABLE VEHICLE</small><b>1</b><span>DX26 VAN</span></div></div><div className="panel"><h2>Today's assignment</h2><div className="route"><div><small>COLLECTION · 10:00–12:00</small><strong>Birmingham B6</strong></div><span className="route-arrow">→</span><div><small>DELIVERY · ASAP</small><strong>Manchester M1</strong></div></div><div className="facts"><span>XDL-DEMO-1029</span><span>Luton Van</span><span>2 pallets · 450 kg</span><span>POD required</span></div><div className="actions"><button className="primary" onClick={()=>setTab(3)}>Booking details & actions</button></div></div></>}
{tab===1&&<DemoExchangeBoard role="Company Driver"/>}
{tab===1&&<div className="panel"><h2>Assigned job alerts</h2><p className="notice">New company assignment · XDL-DEMO-1029 · Birmingham B6 → Manchester M1</p><p className="notice">Dispatch update · Collection window 10:00–12:00</p><div className="actions"><button className="primary" onClick={()=>setTab(3)}>View assignment</button><button className="outline" onClick={()=>setSaved(!saved)}>{saved?"Saved for later":"Save alert"}</button></div></div>}
{tab===2&&<div className="panel"><h2>My Quotes</h2><p className="notice">Company Drivers do not submit carrier quotes independently. Carrier quotes are managed by your company, fleet manager or dispatcher.</p><button className="outline" onClick={()=>setTab(3)}>View assigned bookings</button></div>}
{tab===3&&<DemoSharedBookings role="Company Driver"/>}
{tab===5&&<NetworkTools role="Company Driver"/>}
{tab===4&&<DemoDriverTools role="Company Driver"/>}
</div></div></main>
}