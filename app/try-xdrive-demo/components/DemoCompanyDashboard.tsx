"use client";
import {useMemo} from "react";
import {useCompany3150Live} from "./Company3150LiveData";


type Job={id:string;from:string;to:string;vehicle:string;cargo:string;company:string;status:string;price:number;driver:string;vehicleId:string;stage:number;pod:boolean};
type Fleet={id:string;reg:string;type:string;driver:string;area:string;status:string};
const demo=[
 {id:"XDR-10457",from:"BLACKBURN, BB1",to:"ERITH, DA8",vehicle:"Luton (Tail Lift)",cargo:"4 Pallets",status:"In Transit",driver:"John P.",vehicleId:"DX26 LTN",eta:"ETA ~14:30",date:"Fri 31 Oct"},
 {id:"XDR-10458",from:"PRESTON, PR1",to:"ST HELENS, WA11",vehicle:"7.5 Tonne",cargo:"6 Pallets",status:"Awaiting Driver",driver:"Unallocated",vehicleId:"—",eta:"Pickup 12:45",date:"Fri 31 Oct"},
 {id:"XDR-10459",from:"MANCHESTER, M1",to:"SHEFFIELD, S9",vehicle:"LWB Van",cargo:"12 Boxes",status:"POD Required",driver:"Mark R.",vehicleId:"DX24 FHD",eta:"Delivered 10:20",date:"Fri 31 Oct"}
];
export default function DemoCompanyDashboard({jobs,fleet,drivers,go}:{jobs:Job[];fleet:Fleet[];drivers:string[];go:(index:number)=>void}){
 const real=useCompany3150Live();
 const availableDrivers=real?real.data.drivers.filter(d=>(d.availability_status||"").toLowerCase()==="available").length:drivers.length;
 const outstanding=real?real.data.invoices.filter(i=>!["paid","cancelled","void"].includes((i.payment_status||i.status||"").toLowerCase())&&(i.currency||"GBP")==="GBP").reduce((n,i)=>n+Number(i.amount??0),0):0;
 const recentJobs=real?real.data.jobs.filter(j=>new Date(j.created_at).getTime()>=Date.now()-7*86400000):[];
 const completedJobs=real?real.data.jobs.filter(j=>["completed","delivered"].includes((j.current_status||j.status||"").toLowerCase())):[];
 const hasData=!!real||jobs.length>0;
 const today=new Date().toISOString().slice(0,10);
 const dashboardJobs=real?jobs.filter(j=>real.loads.some(l=>l.id===j.id&&l.pickupDate===today)):jobs;
 const active=jobs.filter(j=>j.status==="In Progress"||j.status==="Allocated").length;
 const pending=jobs.filter(j=>!j.driver&&j.status!=="Completed").length;
 const awaiting=jobs.filter(j=>j.status==="Completed"&&!j.pod).length;
 const rows=useMemo(()=>hasData?dashboardJobs.slice(0,5).map(j=>({id:j.id,from:j.from,to:j.to,vehicle:j.vehicle,cargo:j.cargo,status:j.pod?"Completed":!j.driver?"Awaiting Driver":j.status,driver:j.driver||"Unallocated",vehicleId:j.vehicleId||"—",eta:j.pod?"Delivered":j.stage>0?"In transit":"Pending",date:real?new Date((real.loads.find(l=>l.id===j.id)?.pickupDate||today)+"T12:00:00").toLocaleDateString("en-GB",{weekday:"short",day:"numeric",month:"short"}):"Today"})):demo,[hasData,dashboardJobs,real,today]);
 const kpis=[{label:"Active Loads",value:hasData?jobs.length:24,sub:real?"Company job records":hasData?"Shared transport records":"8 awaiting quotes",icon:"▣",color:"orange",go:2},{label:"In Progress",value:hasData?active:12,sub:hasData?"Bookings underway":"3 deliveries today",icon:"▤",color:"blue",go:7},{label:"Available Drivers",value:real?availableDrivers:hasData?drivers.length:8,sub:real?"Available company drivers":hasData?"Company drivers":"Out of 14 drivers",icon:"♟",color:"green",go:6},{label:"Awaiting POD",value:hasData?awaiting:3,sub:"Action required",icon:"▧",color:"amber",go:7},{label:"Outstanding",value:real?"£"+outstanding.toFixed(2):"£4,850",sub:real?"Unpaid GBP invoice records":"7 unpaid invoices · sample",icon:"£",color:"sky",go:8}];
 const actions=[{name:"Quotes to Review",n:real?real.quotes.filter(q=>q.status==="Open").length:hasData?0:2,go:3,color:"blue"},{name:"Unallocated Bookings",n:hasData?pending:1,go:4,color:"amber"},{name:"Awaiting POD",n:hasData?awaiting:1,go:7,color:"orange"},{name:"Overdue Deliveries",n:hasData?0:1,go:7,color:"red"}];
 return <section className="xd-dashboard">
  <div className="xd-dashboard-heading"><div><h1>Dashboard</h1><p>Company overview · {real?new Date().toLocaleDateString("en-GB",{weekday:"long",day:"numeric",month:"long",year:"numeric"}):"Saturday, 31 October 2026"}</p></div></div>
  <div className="xd-dashboard-kpis">{kpis.map(k=><button type="button" key={k.label} className={"xd-kpi "+k.color} onClick={()=>go(k.go)}><span className="xd-kpi-icon">{k.icon}</span><span className="xd-kpi-content"><strong>{k.label}</strong><b>{k.value}</b><small>{k.sub}</small></span></button>)}</div>
  <div className="xd-dashboard-primary">
   <div className="xd-dash-panel xd-today"><div className="xd-dash-panel-head"><h2>▤ &nbsp; Today’s Operations ({real?rows.length:hasData?rows.length:8})</h2><button onClick={()=>go(7)}>View Diary →</button></div><div className="xd-dash-rows">{real&&rows.length===0&&<p className="muted">No company jobs available.</p>}{rows.map((j,i)=><article className="xd-dash-job" key={j.id}><div className={"xd-dash-date "+(i===0?"intransit":i===1?"awaiting":"pod")}><b>{j.date.split(" ")[0]}</b><strong>{j.date.slice(4)}</strong><span>{j.status}</span></div><div className="xd-dash-job-main"><strong><span className="xd-blue-pin">●</span> {j.from} <span className="xd-route-arrow">→</span> <span className="xd-red-pin">●</span> {j.to}</strong><small>Ref: {j.id} | {j.vehicle} | {j.cargo} | {j.eta}</small></div><div className="xd-dash-assignee"><b>♙ {j.driver}</b><small>▤ {j.vehicleId}</small></div><button className="xd-dash-detail" onClick={()=>go(4)}>View Details</button></article>)}</div></div>
   <div className="xd-dash-panel xd-attention"><div className="xd-dash-panel-head"><h2><span className="xd-orange">⚠</span> &nbsp; Action Required ({actions.reduce((n,a)=>n+a.n,0)})</h2></div>{actions.map(a=><button className="xd-action-row" key={a.name} onClick={()=>go(a.go)}><span>{a.name}</span><b className={a.color}>{a.n}</b><strong>›</strong></button>)}</div>
  </div>
  <div className="xd-dashboard-secondary">
   <div className="xd-dash-panel xd-fleet-overview"><div className="xd-dash-panel-head"><h2>▤ &nbsp; Fleet & Drivers</h2><button onClick={()=>go(5)}>View Fleet →</button></div><div className="xd-fleet-metrics"><div><span>▤</span><small>Vehicles</small><strong>{real?fleet.length:hasData?fleet.length:14}</strong><b>{real?fleet.filter(v=>v.status==="Available").length:hasData?fleet.filter(v=>v.status==="Available").length:10} Available</b></div><div><span>♙</span><small>Drivers</small><strong>{real?drivers.length:hasData?drivers.length:14}</strong><b>{real?availableDrivers:hasData?drivers.length:8} Available</b></div></div></div>
   <div className="xd-dash-panel xd-activity"><div className="xd-dash-panel-head"><h2>◷ &nbsp; Recent Activity</h2><button onClick={()=>go(7)}>View All →</button></div>{(real?real.data.jobs.slice(0,4).map(j=>("Job "+j.id+" — "+j.status)):["Booking XDR-10456 completed – POD received","New quote received – BLACKBURN, BB1","Load XDR-10455 allocated to John P.","Invoice INV-003872 issued – £381.00"]).map((s,i)=><div className="xd-activity-row" key={s}><span className={i===0?"green":i===1?"blue":"orange"}>{["✓","+","▤","▧"][i]}</span><small>{s}</small><time>{real?new Date(real.data.jobs[i]?.created_at||Date.now()).toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"}):["10:24","09:57","09:21","08:46"][i]}</time></div>)}</div>
   <div className="xd-dash-panel xd-performance"><div className="xd-dash-panel-head"><h2>▥ &nbsp; Performance</h2></div><div className="xd-performance-inner"><div className="xd-ring"><b>{real?"—":"90%"}</b></div><div><strong>On-Time Delivery</strong><small>Last 30 Days</small><p>✓ Completed: {real?completedJobs.length:54}</p><p>◷ On Time: {real?"Not available":49}</p><p>◷ Late: {real?"Not available":5}</p></div></div></div>
   <div className="xd-dash-panel xd-overview"><div className="xd-dash-panel-head"><h2>▥ &nbsp; Load Overview <small>(Last 7 Days)</small></h2></div><div className="xd-overview-metrics">{(real?[{n:recentJobs.length,t:"Posted"},{n:new Set(real.data.bids.filter(b=>recentJobs.some(j=>j.id===b.job_id)).map(b=>b.job_id)).size,t:"Quoted"},{n:recentJobs.filter(j=>["awarded","allocated","assigned","in_progress","completed","delivered"].includes((j.status||"").toLowerCase())).length,t:"Booked"},{n:recentJobs.filter(j=>["completed","delivered"].includes((j.status||"").toLowerCase())).length,t:"Completed"}]:[{n:36,t:"Posted"},{n:28,t:"Quoted"},{n:20,t:"Booked"},{n:18,t:"Completed"}]).map(x=><div key={x.t}><small>{x.t}</small><b>{x.n}</b></div>)}</div></div>
  </div>
  {!real&&!hasData&&<p className="xd-dashboard-disclaimer">Illustrative workspace data. Figures and activity are samples, not live company transactions.</p>}
 </section>;
}
