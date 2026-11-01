"use client";
import "../try-xdrive-demo/xdrive-design-system.css";

import {authenticatedDemoFetch} from "../../lib/try-xdrive-demo/authenticatedFetch";
import DemoBookingOverview from "../try-xdrive-demo/components/DemoBookingOverview";
import DemoReferenceBookings from "../try-xdrive-demo/components/DemoReferenceBookings";
import {useEffect,useRef,useState} from "react";
import {publishDemoLoad,useDemoLoads} from "../try-xdrive-demo/components/demoExchange";
import DemoMyQuotes,{useDemoQuotes} from "../try-xdrive-demo/components/DemoQuotes";
import DemoExchangeBoard from "../try-xdrive-demo/components/DemoExchangeBoard";
import NetworkTools from "../try-xdrive-demo/components/NetworkTools";
import PostLoadDemo from "../try-xdrive-demo/components/PostLoadDemo";
import DemoReferenceFleet from "../try-xdrive-demo/components/DemoReferenceFleet";
import DemoReferenceFleetAvailability from "../try-xdrive-demo/components/DemoReferenceFleetAvailability";
import AutonomousNetworkAvailability from "../try-xdrive-demo/components/AutonomousNetworkAvailability";
import DemoMoreTools from "../try-xdrive-demo/components/DemoMoreTools";
import "../try-xdrive-demo/demo.css";
import "../try-xdrive-demo/wide-layout.css";
import "./fleet.css";
import DemoWorkspaceKpis from "../try-xdrive-demo/components/DemoWorkspaceKpis";
import DemoReferenceDashboardExtras from "../try-xdrive-demo/components/DemoReferenceDashboardExtras";
import "../try-xdrive-demo/workspace-visual-parity.css";
import {DemoReferenceNavIcon,DemoReferenceTopbar,DemoReferenceCollapse} from "../try-xdrive-demo/components/DemoReferenceChrome";
import "../try-xdrive-demo/reference-workspace-shell.css";
import AutonomousSessionBar from "../try-xdrive-demo/components/AutonomousSessionBar";
const nav=["Dashboard","My Fleet","Live Availability","Loads","Quotes","Bookings","Diary","More","Network & Tools","Post Load"];
const initial=[{id:"XD-V101",reg:"DX26 VAN",vehicle:"Luton Van · Tail-lift",driver:"Alex Carter",status:"Available",location:"Birmingham B6"},{id:"XD-V102",reg:"DX25 LTN",vehicle:"Luton Van",driver:"Jamie Taylor",status:"On Job",location:"Coventry CV1"},{id:"XD-V103",reg:"DX24 LWB",vehicle:"Large Van",driver:"Morgan Lee",status:"Available",location:"Leicester LE1"}];
const loads=[{id:"XDL-DEMO-1029",from:"Birmingham B6",to:"Manchester M1",cargo:"2 pallets · 450 kg",vehicle:"Luton Van · Tail-lift",company:"Sample Freight Broker Ltd",price:195},{id:"XDL-DEMO-1030",from:"Coventry CV1",to:"Nottingham NG1",cargo:"1 pallet · 180 kg",vehicle:"Large Van",company:"Demo Distribution Ltd",price:145}];
export default function FleetDemo(){
const [sidebarCollapsed,setSidebarCollapsed]=useState(false);
const [demoPosted,setDemoPosted]=useState(false),[postedRoute,setPostedRoute]=useState(""),[tab,setTab]=useState(0),[vehicles,setVehicles]=useState(()=>process.env.NEXT_PUBLIC_XDRIVE_AUTONOMOUS_DEMO==="1"?[]:initial),[job,setJob]=useState(0),[selected,setSelected]=useState("XD-V101"),[quote,setQuote]=useState("195"),[quoted,setQuoted]=useState(false),[awarded,setAwarded]=useState(false),[_pod]=useState(false),[filter,setFilter]=useState("All");
const sharedLoads=useDemoLoads(),sharedQuotes=useDemoQuotes();
const [fleetAuthNotice,setFleetAuthNotice]=useState("");const [drivers,setDrivers]=useState<string[]>(()=>process.env.NEXT_PUBLIC_XDRIVE_AUTONOMOUS_DEMO==="1"?[]:["Alex Carter","Jamie Taylor","Morgan Lee"]);const fleetLoaded=useRef(false);
useEffect(()=>{
 let mounted=true,sequence=0;
 const load=async()=>{
  const current=++sequence;fleetLoaded.current=false;
  if(process.env.NEXT_PUBLIC_XDRIVE_AUTONOMOUS_DEMO==="1"&&mounted){setVehicles([]);setDrivers([])}
  try{
   const response=await authenticatedDemoFetch("/api/try-xdrive-demo/fleet");
   if(!response.ok)throw Error("Fleet register unavailable");
   const data=await response.json() as {vehicles:typeof initial;drivers:string[]};
   if(!mounted||current!==sequence)return;
   setFleetAuthNotice("");setVehicles(data.vehicles);setDrivers(data.drivers);fleetLoaded.current=true;
  }catch{if(mounted&&current===sequence)setFleetAuthNotice("Fleet register unavailable until a local test account is selected. No changes have been saved.")}
 };
 void load();
 window.addEventListener("xdrive-demo-session-change",load);
 return()=>{mounted=false;sequence++;window.removeEventListener("xdrive-demo-session-change",load)};
},[]);
useEffect(()=>{if(!fleetLoaded.current)return;authenticatedDemoFetch("/api/try-xdrive-demo/fleet",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({vehicles,drivers})}).then(r=>{if(!r.ok)throw Error("Fleet save failed")}).catch(()=>setFleetAuthNotice("Fleet changes could not be saved. Check the DEMO session before relying on these records."))},[vehicles,drivers]);
const l=loads[job],_assigned=vehicles.find(v=>v.id===selected)||vehicles[0];
const legacyUiEnabled=process.env.NEXT_PUBLIC_XDRIVE_AUTONOMOUS_DEMO!=="1"&&process.env.NEXT_PUBLIC_DEMO_LEGACY_UI==="enabled";
 const route=<div className="route"><div><small>COLLECTION · TODAY 10:00–12:00</small><strong>{l.from}</strong></div><span className="route-arrow">→</span><div><small>DELIVERY · SAME DAY ASAP</small><strong>{l.to}</strong></div></div>;
const facts=<div className="facts"><span>🚚 {l.vehicle}</span><span>▦ {l.cargo}</span><span>▤ 30 days EOM</span><span>✓ POD required</span></div>;
const goto=(i:number)=>setTab(i);
return <main className={"demo-shell xd-visual-parity fleet-XDrive Logistics"+(tab!==9?" xd-reference-chrome":"")+(sidebarCollapsed&&tab!==9?" xd-reference-collapsed":"")}><aside className="sidebar"><div className="brand">XDRIVE <em>LOGISTICS</em></div><div className="side-caption">FLEET WORKSPACE</div>{nav.map((n,i)=><button key={n} className={tab===i?"active":""} onClick={()=>goto(i)}>{tab!==9&&<DemoReferenceNavIcon label={n}/>}<span>{["▦","▤","◎","↗","£","▣","◷","☰"][i]}</span>{n}</button>)}{tab!==9&&<DemoReferenceCollapse collapsed={sidebarCollapsed} onToggle={()=>setSidebarCollapsed(v=>!v)}/>}</aside><div className="content"><header className="topbar">{tab!==9?<DemoReferenceTopbar label="Fleet" onNavigate={goto} postLoadIndex={9}/>:<><div className="mobile-brand">XDRIVE <em>LOGISTICS</em></div><div className="top-actions"></div></>}</header>{process.env.NEXT_PUBLIC_XDRIVE_AUTONOMOUS_DEMO==="1"&&tab!==9&&<AutonomousSessionBar preferredPersona="fleet-b"/>}<nav className="mobile-tabs">{nav.map((n,i)=><button key={n} className={tab===i?"active":""} onClick={()=>goto(i)}>{n}</button>)}</nav><div className="page"><div className="page-head">{![1,2,3,4,5,6].includes(tab)&&<h1>{nav[tab]}</h1>}</div>
{tab===0&&<section className="xd-role-dashboard">{demoPosted&&<div className="notice">✓ Load created: {postedRoute}. This exists only in this demonstration.</div>}<p className="xd-role-subtitle">Fleet overview · XDrive Logistics</p><DemoWorkspaceKpis items={[{label:"Fleet Vehicles",value:vehicles.length,sub:"Registered vehicles",icon:"▣",color:"orange",onClick:()=>goto(1)},{label:"Available",value:vehicles.filter(v=>v.status==="Available").length,sub:"Ready to assign",icon:"♟",color:"green",onClick:()=>goto(2)},{label:"Quotes Submitted",value:sharedQuotes.filter(q=>q.role==="Fleet"&&q.status==="Open").length,sub:"Open demo quotes",icon:"£",color:"blue",onClick:()=>goto(4)},{label:"Active Bookings",value:sharedLoads.filter(x=>x.status==="Awarded"&&x.driver==="Fleet").length,sub:"Managed transport",icon:"▤",color:"amber",onClick:()=>goto(5)},{label:"Fleet Drivers",value:drivers.length,sub:"Registered drivers",icon:"♙",color:"sky",onClick:()=>goto(1)}]}/><DemoReferenceDashboardExtras role="Fleet" route={{loads:3,bookings:5,diary:6,documents:5,network:8}} onNavigate={goto} vehicleCount={vehicles.length} driverCount={drivers.length}/></section>}
{tab===1&&<DemoReferenceFleet vehicles={vehicles} setVehicles={setVehicles} drivers={drivers} setDrivers={setDrivers} authNotice={fleetAuthNotice}/>}
{tab===2&&(process.env.NEXT_PUBLIC_XDRIVE_AUTONOMOUS_DEMO==="1"?<AutonomousNetworkAvailability allowShare/>:<DemoReferenceFleetAvailability vehicles={vehicles} onOpenLoads={()=>goto(3)}/>)} 
{tab===3&&<DemoExchangeBoard role="Fleet"/>}
{legacyUiEnabled&&<><div className="panel"><div className="panel-title"><h2>Find loads for your fleet</h2><span>2 DEMO LOADS</span></div><div className="facts">{["All","Luton Van","Large Van"].map(x=><button key={x} className={filter===x?"primary":"outline"} onClick={()=>setFilter(x)}>{x}</button>)}</div></div>{loads.map((item,i)=>filter!=="All"&&!item.vehicle.includes(filter)?null:<div className="panel" key={item.id}><div className="panel-title"><h2>{item.company}</h2><span>{item.id}</span></div><div className="route"><div><small>COLLECTION</small><strong>{item.from}</strong></div><span className="route-arrow">→</span><div><small>DELIVERY</small><strong>{item.to}</strong></div></div><div className="facts"><span>{item.vehicle}</span><span>{item.cargo}</span><span>Payment: 30 days EOM</span><span>Hard copy POD</span></div><div className="actions"><button className="primary" onClick={()=>{setJob(i);setQuote(String(item.price));goto(4)}}>Quote Now →</button><button className="outline" onClick={()=>{setJob(i);goto(4)}}>View Details</button></div></div>)}</>}
{legacyUiEnabled&&<div className="panel"><div className="panel-title"><h2>Quotes</h2><span>{quoted?"OPEN · DEMO QUOTE":"PREPARE QUOTE"}</span></div>{route}{facts}<div className="carrier-summary"><div><small>CUSTOMER</small><h3>{l.company}</h3><p>{l.id} · Quote using your fleet</p></div><div className="offer-price">£{quote}</div></div><div className="form-grid"><label>Your quote (£)<input type="number" min="1" value={quote} onChange={e=>setQuote(e.target.value)}/></label><label>Assign suitable vehicle<select value={selected} onChange={e=>setSelected(e.target.value)}>{vehicles.map(v=><option key={v.id} value={v.id}>{v.reg} · {v.driver}</option>)}</select></label><label>Will collect within<select><option>30 minutes</option><option>45 minutes</option><option>60 minutes</option><option>90 minutes</option></select></label></div><div className="notice">Quote is fictional. It will not be submitted to a customer or carrier.</div><div className="actions"><button className="primary" disabled={!Number(quote)||Number(quote)<=0} onClick={()=>setQuoted(true)}>{quoted?"✓ Quote submitted":"Submit Quote"}</button>{quoted&&<button className="outline" onClick={()=>{setAwarded(true);goto(5)}}>Simulate award & book →</button>}{quoted&&!awarded&&<button className="outline" onClick={()=>setQuoted(false)}>Cancel Quote</button>}</div></div>}
{tab===4&&<DemoMyQuotes role="Fleet"/>}
{tab===5&&<DemoReferenceBookings role="Fleet"/>}
{tab===6&&<DemoBookingOverview view="diary"/>}
{tab===7&&<DemoMoreTools role="Fleet"/>}
{tab===8&&<NetworkTools role="Fleet" onDirectoryPostLoad={()=>goto(9)} onOpenLoad={()=>goto(3)}/>}
{tab===9&&<><PostLoadDemo role="Customer" from="Birmingham B6" to="Manchester M1" vehicle="Luton Van" pallets="2" weight="450" onPublish={(data)=>{publishDemoLoad(data);setPostedRoute(data.from+" → "+data.to);setDemoPosted(true);goto(0)}}/></>}
</div></div></main>;
}
