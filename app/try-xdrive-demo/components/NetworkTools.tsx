"use client";
import {useMemo,useState} from "react";
import DemoMessagesBoard from "./DemoMessagesBoard";
import DemoNotifications from "./DemoNotifications";
import DemoReportsBoard from "./DemoReportsBoard";
import DemoInvoicesBoard from "./DemoInvoicesBoard";
import DemoOwnerDriverNetworkOverview from "./DemoOwnerDriverNetworkOverview";
import {useDemoLoads} from "./demoExchange";
import {useDemoQuotes} from "./DemoQuotes";
import DemoMemberDirectory from "./DemoMemberDirectory";
import DemoReturnJourneys from "./DemoReturnJourneys";
import DemoLiveAvailability from "./DemoLiveAvailability";
import "../network.css";
type Role="Customer"|"Driver"|"Fleet"|"Broker"|"Company"|"Dispatcher"|"Company Driver";
export default function NetworkTools({role,initialView="Overview",showTabs=true,onDirectoryMessage,onDirectoryPostLoad,onOpenLoad,onOwnerQuotes,onOwnerBookings}:{role:Role;initialView?:string;showTabs?:boolean;onDirectoryMessage?:(target:{name:string;kind:"Companies"|"Drivers";id:string})=>void;onDirectoryPostLoad?:()=>void;onOpenLoad?:(id:string)=>void;onOwnerQuotes?:()=>void;onOwnerBookings?:()=>void}){
const sharedLoads=useDemoLoads(),sharedQuotes=useDemoQuotes();
const [view,setView]=useState(initialView);
const reportJobs=useMemo(()=>sharedLoads.map(l=>({id:l.id,from:l.from,to:l.to,vehicle:l.vehicle,cargo:(l.pallets||"0")+" pallets",company:l.customer||"Not recorded",status:l.podReceived?"Completed":l.status,price:Number(l.quote)||0,driver:l.assignedDriver||"",vehicleId:l.assignedVehicleId||"",stage:l.deliveryStage||0,pod:Boolean(l.podReceived)})),[sharedLoads]);
const views=role==="Company Driver"?["Overview","Directory","Live Availability","Return Journeys","Messages","Notifications"]:role==="Dispatcher"?["Overview","Directory","Live Availability","Return Journeys","Messages","Notifications","Reports"]:["Overview","Directory","Live Availability","Return Journeys","Messages","Notifications","Finance","Reports"];
return <div className="network">{showTabs&&<div className="panel"><div className="network-tabs">{views.map(v=><button key={v} className={view===v?"selected":""} onClick={()=>setView(v)}>{v}</button>)}</div></div>}
{view==="Overview"&&role==="Driver"&&<DemoOwnerDriverNetworkOverview onSelect={setView} onOpenLoads={()=>onOpenLoad?.("")} onOpenQuotes={()=>onOwnerQuotes?.()} onOpenBookings={()=>onOwnerBookings?.()}/>}
{view==="Overview"&&role!=="Driver"&&<><div className="metrics"><div><small>DEMO JOBS</small><b>{sharedLoads.length}</b><span>Shared demo Exchange</span></div><div><small>NEW OFFERS</small><b>{sharedQuotes.filter(q=>q.status==="Open").length}</b><span>Open shared quotes</span></div><div><small>ACTIVE VEHICLES</small><b>{0}</b><span>GPS availability not connected</span></div><div><small>POD RECEIVED</small><b>{sharedLoads.filter(l=>l.podReceived).length}</b><span>Shared booking POD records</span></div></div><div className="panel"><h2>Live operations snapshot</h2><div className="network-table">{sharedLoads.map(a=><div className="network-job" key={a.id}><div><small>{a.id}</small><strong>{a.from} → {a.to}</strong><span>{a.assignedDriver||"Not assigned"}</span></div><div><span className="network-status">{a.status}</span><small>{a.acceptanceStatus||"Not awarded"}</small></div><div className="network-progress"><span style={{width:((a.deliveryStage||0)/7*100)+"%"}}/></div></div>)}</div></div><div className="network-shortcuts">{views.slice(1).map(v=><button key={v} onClick={()=>setView(v)}>{v} <span>→</span></button>)}</div></>}
{view==="Directory"&&<DemoMemberDirectory onMessage={onDirectoryMessage} onPostLoad={onDirectoryPostLoad}/>}
{view==="Live Availability"&&<DemoLiveAvailability/>}
{view==="Return Journeys"&&<DemoReturnJourneys onPostReturn={onDirectoryPostLoad} onOpenLoad={onOpenLoad}/>}
{view==="Messages"&&<DemoMessagesBoard jobs={[]} onBooking={()=>setView("Overview")} storageScope={"network-"+role.toLowerCase().replaceAll(" ","-")}/>}
{view==="Notifications"&&<DemoNotifications/>}
{view==="Finance"&&<section className="xd-network-invoices"><p className="notice">Invoice records are illustrative unless sourced from completed DEMO bookings with POD. No invoices or payments are issued from this page.</p><DemoInvoicesBoard jobs={reportJobs}/></section>}
{view==="Freight Vision"&&<div className="panel"><div className="panel-title"><h2>Freight Vision</h2><span>SHARED STAGING BOOKINGS</span></div><p className="muted">Booking visibility from the shared DEMO exchange. GPS and ETA are not yet connected.</p><div className="network-table">{sharedLoads.length===0&&<p>No transport available.</p>}{sharedLoads.map(l=><div className="network-job" key={l.id}><div><small>{l.id}</small><strong>{l.from} - {l.to}</strong><span>{l.assignedDriver||"Not allocated"}</span></div><div><span className="network-status">{l.status}</span><small>{l.acceptanceStatus||"Not awarded"}</small></div></div>)}</div></div>}
{view==="Reports"&&<DemoReportsBoard jobs={reportJobs} drivers={[]} vehicles={[]} roleName={role}/>} 
</div>}
