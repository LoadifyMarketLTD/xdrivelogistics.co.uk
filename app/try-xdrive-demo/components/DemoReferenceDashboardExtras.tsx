"use client";
import {CalendarClock,CheckCircle2,ClipboardList,FileText,Truck} from "lucide-react";
import {useDemoBookings,useDemoLoads} from "./demoExchange";
import "./reference-dashboard-extras.css";

type RouteMap={loads:number;bookings:number;diary:number;documents?:number;network:number};
const textTime=(s:string)=>{const d=new Date(s);return Number.isNaN(d.getTime())?"":d.toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"})};
export default function DemoReferenceDashboardExtras({role,route,onNavigate,vehicleCount=0,driverCount=0}:{role:string;route:RouteMap;onNavigate:(index:number)=>void;vehicleCount?:number;driverCount?:number}){
 const loads=useDemoLoads();
 const booking=useDemoBookings().loads;
 const completed=booking.filter(x=>x.podReceived).length;
 const active=booking.filter(x=>!x.podReceived&&(x.deliveryStage||0)>0).length;
 const pending=booking.filter(x=>!x.assignedDriver&&!x.podReceived).length;
 const awaiting=booking.filter(x=>!x.podReceived&&(x.deliveryStage||0)>=6).length;
 const recent=loads.slice(0,4);
 return <div className="xd-ref-dash-extras">
  <div className="xd-ref-primary">
   <article className="xd-dash-panel xd-ref-today">
    <div className="xd-dash-panel-head"><h2><ClipboardList size={17}/> Today’s Operations ({recent.length})</h2><button type="button" onClick={()=>onNavigate(route.diary)}>{role.includes("Driver")?"View Bookings →":"View Diary →"}</button></div>
    {recent.length?<div className="xd-dash-rows">{recent.slice(0,3).map(x=><article key={x.id} className="xd-ref-job-row">
      <span className="xd-ref-job-date"><strong>{x.pickupDate?.slice(0,10)||"TBC"}</strong><small>{x.podReceived?"Completed":x.status}</small></span>
      <span className="xd-ref-job-route"><b>{x.from} → {x.to}</b><small>{x.id} | {x.vehicle} | {x.pallets||"0"} pallets</small></span>
      <span className="xd-ref-job-driver"><b>{x.assignedDriver||"Unallocated"}</b><small>{x.assignedVehicleId||"Vehicle pending"}</small></span>
      <button type="button" onClick={()=>onNavigate(route.bookings)}>View Details</button>
    </article>)}</div>:<div className="xd-ref-today-empty"><Truck size={25}/><strong>No active transport in this session</strong><p>Posted and awarded jobs will appear here when available. No sample transactions have been invented.</p><button type="button" onClick={()=>onNavigate(route.loads)}>View transport →</button></div>}
   </article>
   <article className="xd-dash-panel xd-ref-actions">
    <div className="xd-dash-panel-head"><h2><CalendarClock size={17}/> Action Required ({pending+awaiting})</h2></div>
    {[
    {title:"Unallocated Bookings",count:pending,color:"amber",dest:route.bookings},
    {title:"Awaiting POD",count:awaiting,color:"orange",dest:route.documents??route.bookings},
    {title:"In Progress",count:active,color:"blue",dest:route.diary},
    {title:"Open Transport Requests",count:loads.filter(x=>x.status==="Open").length,color:"green",dest:route.loads}
    ].map(x=><button type="button" className="xd-ref-action-row" key={x.title} onClick={()=>onNavigate(x.dest)}><span>{x.title}</span><b className={x.color}>{x.count}</b><strong>›</strong></button>)}
   </article>
  </div>
  <article className="xd-dash-panel xd-ref-summary">
   <div className="xd-dash-panel-head"><h2><Truck size={17}/> Operations Overview</h2><button onClick={()=>onNavigate(route.bookings)}>View Bookings →</button></div>
   <div className="xd-ref-overview-stats">
    <button onClick={()=>onNavigate(route.loads)}><Truck size={24}/><span><small>Loads</small><strong>{loads.length}</strong><b>Transport requests</b></span></button>
    <button onClick={()=>onNavigate(route.bookings)}><ClipboardList size={24}/><span><small>Bookings</small><strong>{booking.length}</strong><b>Confirmed jobs</b></span></button>
    <button onClick={()=>onNavigate(route.diary)}><CalendarClock size={24}/><span><small>In Progress</small><strong>{active}</strong><b>Delivery milestones</b></span></button>
    <button onClick={()=>onNavigate(route.documents??route.bookings)}><FileText size={24}/><span><small>POD</small><strong>{completed}</strong><b>Verified received</b></span></button>
   </div>
  </article>
  <article className="xd-dash-panel xd-ref-activity">
   <div className="xd-dash-panel-head"><h2><CalendarClock size={17}/> Recent Activity</h2><button onClick={()=>onNavigate(route.loads)}>View All →</button></div>
   {recent.length?recent.map((x,i)=><button key={x.id} className="xd-ref-activity-row" onClick={()=>onNavigate(route.loads)}>
    <span className={i%2?"blue":"orange"}>{x.podReceived?<CheckCircle2 size={13}/>:<Truck size={13}/>}</span>
    <small><b>{x.id}</b> · {x.from} → {x.to}</small><time>{textTime(x.postedAt)||"—"}</time>
   </button>):<div className="xd-ref-empty">No recent transport activity in this session.</div>}
  </article>
  <article className="xd-dash-panel xd-ref-performance">
   <div className="xd-dash-panel-head"><h2><CheckCircle2 size={17}/> Performance</h2></div>
   <div className="xd-ref-performance-content">
    <div className="xd-ref-performance-circle">{booking.length?Math.round(completed/booking.length*100)+"%":"—"}</div>
    <div><strong>Delivery progress</strong><small>{role} DEMO</small>
     <p>Completed with POD: <b>{completed}</b></p>
     <p>Awaiting POD: <b>{awaiting}</b></p>
     <p>On-time delivery: <b>Not verified</b></p>
    </div>
   </div>
  </article>
  <article className="xd-dash-panel xd-ref-overview">
   <div className="xd-dash-panel-head"><h2><ClipboardList size={17}/> Operations Summary</h2><button onClick={()=>onNavigate(route.network)}>Network & Tools →</button></div>
   <div className="xd-ref-overview-counters">
    <div><small>Posted</small><strong>{loads.length}</strong></div>
    <div><small>Confirmed</small><strong>{booking.length}</strong></div>
    <div><small>Unallocated</small><strong>{pending}</strong></div>
    <div><small>POD Received</small><strong>{completed}</strong></div>
    {(vehicleCount>0||driverCount>0)&&<div><small>Vehicles / Drivers</small><strong>{vehicleCount} / {driverCount}</strong></div>}
   </div>
  </article>
 </div>;
}
