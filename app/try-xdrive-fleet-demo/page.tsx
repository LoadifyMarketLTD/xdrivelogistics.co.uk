"use client";
import ApprovedSidebar from "../try-xdrive-demo/components/ApprovedSidebar";
import "../try-xdrive-demo/xdrive-design-system.css";

import {authenticatedDemoFetch} from "../../lib/try-xdrive-demo/authenticatedFetch";
import DemoBookingOverview from "../try-xdrive-demo/components/DemoBookingOverview";
import {useEffect,useRef,useState} from "react";
import {publishDemoLoad,useDemoLoads} from "../try-xdrive-demo/components/demoExchange";
import DemoCompanyQuotes from "../try-xdrive-demo/components/DemoCompanyQuotes";
import DemoCompanyBookings from "../try-xdrive-demo/components/DemoCompanyBookings";
import DemoCompanyDashboard from "../try-xdrive-demo/components/DemoCompanyDashboard";
import DemoNetworkToolsBoard from "../try-xdrive-demo/components/DemoNetworkToolsBoard";
import DemoExchangeBoard from "../try-xdrive-demo/components/DemoExchangeBoard";
import PostLoadDemo from "../try-xdrive-demo/components/PostLoadDemo";
import DemoFleetBoard from "../try-xdrive-demo/components/DemoFleetBoard";
import DemoMoreTools from "../try-xdrive-demo/components/DemoMoreTools";
import DemoLiveAvailability from "../try-xdrive-demo/components/DemoLiveAvailability";
import "../try-xdrive-demo/demo.css";
import "../try-xdrive-demo/wide-layout.css";
import "../try-xdrive-demo/components/operations-demo.css";
import "../try-xdrive-demo/components/company-layout-stability.css";

import "./fleet.css";
const nav=["Dashboard","My Fleet","Live Availability","Loads","Quotes","Bookings","Diary","More","Network & Tools","Post Load"];
const initial=[{id:"XD-V101",reg:"DX26 VAN",vehicle:"Luton Van · Tail-lift",driver:"Alex Carter",status:"Available",location:"Birmingham B6"},{id:"XD-V102",reg:"DX25 LTN",vehicle:"Luton Van",driver:"Jamie Taylor",status:"On Job",location:"Coventry CV1"},{id:"XD-V103",reg:"DX24 LWB",vehicle:"Large Van",driver:"Morgan Lee",status:"Available",location:"Leicester LE1"}];
const loads=[{id:"XDL-DEMO-1029",from:"Birmingham B6",to:"Manchester M1",cargo:"2 pallets · 450 kg",vehicle:"Luton Van · Tail-lift",company:"Sample Freight Broker Ltd",price:195},{id:"XDL-DEMO-1030",from:"Coventry CV1",to:"Nottingham NG1",cargo:"1 pallet · 180 kg",vehicle:"Large Van",company:"Demo Distribution Ltd",price:145}];
export default function FleetDemo(){
const [_demoPosted,setDemoPosted]=useState(false),[_postedRoute,setPostedRoute]=useState(""),[tab,setTab]=useState(0),[vehicles,setVehicles]=useState(initial),[job,setJob]=useState(0),[selected,setSelected]=useState("XD-V101"),[quote,setQuote]=useState("195"),[quoted,setQuoted]=useState(false),[awarded,setAwarded]=useState(false),[_pod]=useState(false),[filter,setFilter]=useState("All");
const sharedLoads=useDemoLoads();
const [drivers,setDrivers]=useState(["Alex Carter","Jamie Taylor","Morgan Lee"]);const fleetLoaded=useRef(false);
useEffect(()=>{authenticatedDemoFetch("/api/try-xdrive-demo/fleet").then(r=>{if(!r.ok)throw Error("Fleet unavailable");return r.json()}).then(d=>{setVehicles(d.vehicles);setDrivers(d.drivers);fleetLoaded.current=true}).catch(console.error)},[]);
useEffect(()=>{if(!fleetLoaded.current)return;authenticatedDemoFetch("/api/try-xdrive-demo/fleet",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({vehicles,drivers})}).then(r=>{if(!r.ok)throw Error("Fleet save failed")}).catch(console.error)},[vehicles,drivers]);
const l=loads[job],_assigned=vehicles.find(v=>v.id===selected)||vehicles[0];
const legacyUiEnabled=process.env.NEXT_PUBLIC_DEMO_LEGACY_UI==="enabled";
 const route=<div className="route"><div><small>COLLECTION · TODAY 10:00–12:00</small><strong>{l.from}</strong></div><span className="route-arrow">→</span><div><small>DELIVERY · SAME DAY ASAP</small><strong>{l.to}</strong></div></div>;
const facts=<div className="facts"><span>🚚 {l.vehicle}</span><span>▦ {l.cargo}</span><span>▤ 30 days EOM</span><span>✓ POD required</span></div>;
const goto=(i:number)=>setTab(i);
const companyOverviewJobs=sharedLoads.map(l=>({id:l.id,from:l.from,to:l.to,vehicle:l.vehicle,cargo:[l.pallets?l.pallets+" pallets":"",l.weight?l.weight+" kg":""].filter(Boolean).join(" · ")||"Cargo not recorded",company:l.customer||"Customer not recorded",status:l.podReceived?"Completed":l.status==="Awarded"?"In Progress":l.status,price:Number(l.quote||0),driver:l.assignedDriver||"",vehicleId:l.assignedVehicleId||"",stage:l.deliveryStage||0,pod:Boolean(l.podReceived)}));
return <main className="demo-shell ops-demo fleet-demo xd-approved-sidebar-shell"><ApprovedSidebar items={nav} activeIndex={tab} onSelect={goto} /><div className="content"><header className="topbar"><div className="mobile-brand">XDRIVE <em>LOGISTICS</em></div><div className="top-actions"></div></header><nav className="mobile-tabs">{nav.map((n,i)=><button key={n} className={tab===i?"active":""} onClick={()=>goto(i)}>{n}</button>)}</nav><div className="page"><div className="page-head">{![1,2,3,4,5,6,8].includes(tab)&&<h1>{nav[tab]}</h1>}</div>
{tab===0&&<DemoCompanyDashboard suppressPreview workspaceLabel="Fleet" jobs={companyOverviewJobs} fleet={vehicles.map(v=>({id:v.id,reg:v.reg,type:v.vehicle,driver:v.driver,area:v.location,status:v.status}))} drivers={drivers} go={i=>goto(({2:3,3:4,4:5,5:1,6:1,7:6,8:8} as Record<number,number>)[i]??0)}/>}
{tab===1&&<DemoFleetBoard suppressPreview vehicles={vehicles} setVehicles={setVehicles} drivers={drivers} setDrivers={setDrivers}/>}
{tab===2&&<DemoLiveAvailability/>}

{tab===3&&<DemoExchangeBoard role="Fleet"/>}
{legacyUiEnabled&&<><div className="panel"><div className="panel-title"><h2>Find loads for your fleet</h2><span>2 DEMO LOADS</span></div><div className="facts">{["All","Luton Van","Large Van"].map(x=><button key={x} className={filter===x?"primary":"outline"} onClick={()=>setFilter(x)}>{x}</button>)}</div></div>{loads.map((item,i)=>filter!=="All"&&!item.vehicle.includes(filter)?null:<div className="panel" key={item.id}><div className="panel-title"><h2>{item.company}</h2><span>{item.id}</span></div><div className="route"><div><small>COLLECTION</small><strong>{item.from}</strong></div><span className="route-arrow">→</span><div><small>DELIVERY</small><strong>{item.to}</strong></div></div><div className="facts"><span>{item.vehicle}</span><span>{item.cargo}</span><span>Payment: 30 days EOM</span><span>Hard copy POD</span></div><div className="actions"><button className="primary" onClick={()=>{setJob(i);setQuote(String(item.price));goto(4)}}>Quote Now →</button><button className="outline" onClick={()=>{setJob(i);goto(4)}}>View Details</button></div></div>)}</>}
{legacyUiEnabled&&<div className="panel"><div className="panel-title"><h2>Quotes</h2><span>{quoted?"OPEN · DEMO QUOTE":"PREPARE QUOTE"}</span></div>{route}{facts}<div className="carrier-summary"><div><small>CUSTOMER</small><h3>{l.company}</h3><p>{l.id} · Quote using your fleet</p></div><div className="offer-price">£{quote}</div></div><div className="form-grid"><label>Your quote (£)<input type="number" min="1" value={quote} onChange={e=>setQuote(e.target.value)}/></label><label>Assign suitable vehicle<select value={selected} onChange={e=>setSelected(e.target.value)}>{vehicles.map(v=><option key={v.id} value={v.id}>{v.reg} · {v.driver}</option>)}</select></label><label>Will collect within<select><option>30 minutes</option><option>45 minutes</option><option>60 minutes</option><option>90 minutes</option></select></label></div><div className="notice">Quote is fictional. It will not be submitted to a customer or carrier.</div><div className="actions"><button className="primary" disabled={!Number(quote)||Number(quote)<=0} onClick={()=>setQuoted(true)}>{quoted?"✓ Quote submitted":"Submit Quote"}</button>{quoted&&<button className="outline" onClick={()=>{setAwarded(true);goto(5)}}>Simulate award & book →</button>}{quoted&&!awarded&&<button className="outline" onClick={()=>setQuoted(false)}>Cancel Quote</button>}</div></div>}
{tab===4&&<DemoCompanyQuotes mode="sent" allowAward={false}/>}
{tab===5&&<DemoCompanyBookings role="Fleet"/>}
{tab===6&&<DemoBookingOverview view="diary"/>}
{tab===7&&<DemoMoreTools role="Fleet"/>}
{tab===8&&<DemoNetworkToolsBoard audience="standard" onNavigate={i=>goto(({4:5,10:8,11:2,12:8,16:8} as Record<number,number>)[i]??8)}/>}
{tab===9&&<><PostLoadDemo role="Customer" from="Birmingham B6" to="Manchester M1" vehicle="Luton Van" pallets="2" weight="450" onPublish={(data)=>{publishDemoLoad(data);setPostedRoute(data.from+" → "+data.to);setDemoPosted(true);goto(0)}}/></>}
</div></div></main>;
}
