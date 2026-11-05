"use client";
import ApprovedSidebar from "./ApprovedSidebar";
import {Menu} from 'lucide-react';
import MasterLogoutButton from "./MasterLogoutButton";
import {MASTER_WORKSPACE_TABS,masterWorkspaceCan,type MasterWorkspaceRole} from "./MasterWorkspacePolicy";
import "../xdrive-design-system.css";

import {useEffect,useState,type ReactNode} from "react";
import {useRouter} from "next/navigation";
import MasterOperationalSection from "./MasterOperationalSection";
import {MemberDirectoryPage} from "../../components/workspace/MemberDirectoryPage";
import {useMasterPreviewIsolation} from "./MasterPreviewIsolation";
import {useCompany3150Live} from "./Company3150LiveData";
import DemoNetworkToolsBoard from "./DemoNetworkToolsBoard";
import DemoCompanyQuotes from "./DemoCompanyQuotes";
import DemoFreightVision from "./DemoFreightVision";
import DemoReportsBoard from "./DemoReportsBoard";
import DemoMessagesBoard from "./DemoMessagesBoard";
import DemoReturnJourneys from "./DemoReturnJourneys";
import DemoLiveAvailability from "./DemoLiveAvailability";
import DemoInvoicesBoard from "./DemoInvoicesBoard";

import {publishDemoLoad,useDemoLoads} from "./demoExchange";
import DemoExchangeBoard from "./DemoExchangeBoard";
import DemoNotifications from "./DemoNotifications";
import Link from "next/link";
import PostLoadDemo from "./PostLoadDemo";
import LoadPostingForm from "../../components/workspace/LoadPostingForm";
import NetworkTools from "./NetworkTools";
import DemoFleetBoard from "./DemoFleetBoard";
import DemoDriversBoard from "./DemoDriversBoard";
import DemoBookingOverview from "./DemoBookingOverview";
import DemoCompanyBookings from "./DemoCompanyBookings";
import DemoCompanyDashboard from "./DemoCompanyDashboard";
import "../demo.css";
import "../wide-layout.css";
import "./operations-demo.css";
import "./company-sidebar-compact.css";
import "./company-layout-stability.css";
import "./mobile-master-navigation.css";

type Role=MasterWorkspaceRole;
const DRIVER_LIVE_ROUTES: readonly string[]=[
 '/driver','/driver/post-load','/driver/loads','/driver/quotes',
 '/driver/jobs','/driver/vehicles','/driver/drivers','/driver/history',
 '/driver/finance','/driver/network','/driver/directory','/driver/availability/live',
 '/driver/returns','/driver/freight-vision','/driver/messages','/driver/notifications',
 '/driver/reports','/driver/documents','/driver/settings',
] as const;
type Job={id:string;from:string;to:string;vehicle:string;cargo:string;company:string;status:string;price:number;driver:string;vehicleId:string;stage:number;pod:boolean};
const initial:Job[]=[];
const fleet:{id:string;reg:string;type:string;driver:string;area:string}[]=[];
export default function OperationsDemo({role,authenticated=false,dashboard,initialTab=0}:{role:Role;authenticated?:boolean;dashboard?:ReactNode;initialTab?:number}){
const router=useRouter();
const [mobileMenuOpen,setMobileMenuOpen]=useState(false);
const live=useCompany3150Live();
const preview=useMasterPreviewIsolation();
const isDispatch=false;
const realOperational=authenticated&&(role==="Customer"||role==="Driver"||role==="Company Driver"||role==="Employee Driver");
const can=(action:Parameters<typeof masterWorkspaceCan>[1])=>masterWorkspaceCan(role,action);
const isLiveDriverWorkspace=authenticated&&['Owner Driver','Driver','Company Driver'].includes(role);
const sharedLoads=useDemoLoads(isLiveDriverWorkspace);
const sharedJobs:Job[]=sharedLoads.map(l=>({id:l.id,from:l.from,to:l.to,vehicle:l.vehicle,cargo:`${l.pallets||"0"} pallets Ã‚Â· ${l.weight||"0"} kg`,company:l.customer||"Company not recorded",status:l.podReceived?"Completed":l.status==="Awarded"?"In Progress":l.status,price:l.quote||0,driver:l.assignedDriver||"",vehicleId:l.assignedVehicleId||"",stage:l.deliveryStage||0,pod:Boolean(l.podReceived)}));
const nav=[...MASTER_WORKSPACE_TABS,...(isLiveDriverWorkspace?['Documents','Settings']:[])];
const [companyDrivers,setCompanyDrivers]=useState<string[]>([]),[companyFleet,setCompanyFleet]=useState<{id:string;reg:string;vehicle:string;driver:string;status:string;location:string}[]>(role==="Company / Carrier"?fleet.map(v=>({id:v.id,reg:v.reg,vehicle:v.type,driver:v.driver,status:"Available",location:v.area})):[]),[tab,setTab]=useState(initialTab),[,setJobs]=useState<Job[]>(initial),[,setSelected]=useState(""),[filter,setFilter]=useState("All"),[search,setSearch]=useState("");
useEffect(()=>{setTab(initialTab);setMobileMenuOpen(false);},[initialTab]);
useEffect(()=>{if(!mobileMenuOpen)return;const close=(event:KeyboardEvent)=>{if(event.key==='Escape')setMobileMenuOpen(false);};const previousOverflow=document.body.style.overflow;document.body.style.overflow='hidden';window.addEventListener('keydown',close);return()=>{window.removeEventListener('keydown',close);document.body.style.overflow=previousOverflow;};},[mobileMenuOpen]);
const realDrivers=live?live.data.drivers.map(d=>d.display_name||"Unnamed driver"):companyDrivers;
const realFleet=live?live.data.vehicles.map(v=>({id:v.id,reg:v.reg_plate||"Not recorded",vehicle:v.type||"Not recorded",driver:live.data.drivers.find(d=>d.id===v.assigned_driver_id)?.display_name||"Unassigned",status:"Not verified",location:"Not recorded"})):companyFleet;
const show=(i:number)=>{
 if(isLiveDriverWorkspace){router.push(DRIVER_LIVE_ROUTES[i]??'/driver');return;}
 // Authenticated Master navigation must open operational routes, not demo card datasets.
 if(authenticated && i===0){
   router.push(role==='Customer'?'/customer':role==='Broker'?'/broker':'/admin');
   return;
 }
 if(authenticated && i===1){
   router.push(role==='Customer'?'/customer/post-load':role==='Broker'?'/broker/post-load':'/admin/post-load');
   return;
 }
 if(authenticated && i===2){
   router.push(role==='Customer'?'/customer/loads':role==='Broker'?'/broker/loads':'/admin/marketplace');
   return;
 }
 if(authenticated && i===3){
   router.push(role==='Customer'?'/customer/quotes':role==='Broker'?'/broker/bids':'/admin/exchange');
   return;
 }
 if(authenticated && i===4){
   router.push(role==='Customer'?'/customer/bookings':role==='Broker'?'/broker/jobs':'/admin/won-work');
   return;
 }
 if(authenticated && i===5){
   router.push(role==='Customer'?'/customer/fleet':role==='Broker'?'/broker/fleet':'/admin/vehicles');
   return;
 }
 if(authenticated && i===6){
   router.push(role==='Customer'?'/customer/drivers':role==='Broker'?'/broker/drivers':'/admin/drivers');
   return;
 }
 if(authenticated && i===7){
   router.push(role==='Customer'?'/customer/diary':role==='Broker'?'/broker/diary':'/admin/diary');
   return;
 }
 if(authenticated && i===8){
   router.push(role==='Customer'?'/customer/invoices':role==='Broker'?'/broker/finance':'/admin/finance');
   return;
 }
 if(authenticated && i===9){
   router.push(role==='Customer'?'/customer/network':role==='Broker'?'/broker/carrier-network':'/admin/marketplace/directory');
   return;
 }
 if(authenticated && i===10){
   router.push(role==='Customer'?'/customer/directory':role==='Broker'?'/broker/directory':'/admin/marketplace/directory');
   return;
 }
 if(authenticated && i===11){
   router.push(role==='Customer'?'/customer/live-availability':role==='Broker'?'/broker/live-availability':'/admin/live-availability');
   return;
 }
 if(authenticated && i===12){
   router.push(role==='Customer'?'/customer/returns':role==='Broker'?'/broker/returns':'/admin/fleet/returns');
   return;
 }
 if(authenticated && i===13){
   router.push(role==='Customer'?'/customer/freight-vision':role==='Broker'?'/broker/freight-vision':'/admin/freight-vision');
   return;
 }
 if(authenticated && i===14){
   router.push(role==='Customer'?'/customer/messages':role==='Broker'?'/broker/messages':'/admin/messages');
   return;
 }
 if(authenticated && i===15){
   router.push(role==='Customer'?'/customer/notifications':role==='Broker'?'/broker/notifications':'/admin/notifications');
   return;
 }
 if(authenticated && i===16){
   router.push(role==='Customer'?'/customer/reports':role==='Broker'?'/broker/reports':'/admin/reports');
   return;
 }
 setTab(i);
};
const list=(items:Job[],actions=true)=><div className="ops-job-list">{items.map(j=><article className="ops-job" key={j.id}><div className="ops-job-top"><strong>{j.company}</strong><small>{j.id} Ã‚Â· {j.status}</small></div><div className="ops-route"><div><small>COLLECTION</small><b>{j.from}</b></div><span>Ã¢â€ â€™</span><div><small>DELIVERY</small><b>{j.to}</b></div></div><div className="facts"><span>{j.vehicle}</span><span>{j.cargo}</span><span>30 days EOM</span><span>POD {j.pod?"received":"required"}</span></div><div className="ops-job-bottom"><small>{j.driver?j.driver+" Ã‚Â· "+j.vehicleId:"Unallocated"} Ã‚Â· Ã‚Â£{j.price}</small>{actions&&<button className="outline" onClick={()=>{setSelected(j.id);show(isDispatch?2:4)}}>View & manage Ã¢â€ â€™</button>}</div></article>)}</div>;
return <main className="demo-shell ops-demo xd-approved-sidebar-shell"><button type="button" className={'xd-mobile-sidebar-backdrop'+(mobileMenuOpen?' is-open':'')} aria-label="Close workspace navigation" tabIndex={mobileMenuOpen?0:-1} onClick={()=>setMobileMenuOpen(false)} /><ApprovedSidebar items={nav} activeIndex={tab} onSelect={show} mobileOpen={mobileMenuOpen} onMobileClose={()=>setMobileMenuOpen(false)} footerAction={authenticated ? <MasterLogoutButton /> : null} /><div className="content"><header className="topbar"><button type="button" className="xd-mobile-nav-toggle" aria-label="Open workspace menu" aria-controls="xdrive-master-mobile-navigation" aria-expanded={mobileMenuOpen} onClick={()=>setMobileMenuOpen(true)}><Menu size={21} aria-hidden="true"/> Menu</button><div className="mobile-brand">XDRIVE <em>LOGISTICS</em></div><div className="top-actions">{!live&&!authenticated&&<><Link href="/try-xdrive">All workspaces</Link><Link href={isDispatch?"/try-xdrive-company-demo":"/try-xdrive-dispatcher-demo"}>{isDispatch?"Company Demo":"Dispatcher Demo"}</Link></>}{authenticated&&<MasterLogoutButton/>}</div></header><div className="page">
{dashboard&&tab===initialTab?dashboard:<>
{realOperational&&tab===initialTab&&<DemoCompanyDashboard workspaceLabel={role} suppressPreview jobs={sharedJobs} fleet={realFleet.map(v=>({...v,type:v.vehicle,area:v.location}))} drivers={realDrivers} go={show}/>}
{realOperational&&tab!==initialTab&&tab===1&&<section>{can("postLoad")?<LoadPostingForm mode="customer"/>:<p role="status">Posting loads is restricted for this role.</p>}</section>}
{realOperational&&tab!==initialTab&&tab===2&&<DemoExchangeBoard role={role==="Employee Driver"?"Company Driver":role}/>}
{realOperational&&tab!==initialTab&&tab===4&&<DemoCompanyBookings role={role}/>}
{realOperational&&tab!==initialTab&&tab===5&&<DemoFleetBoard vehicles={realFleet} setVehicles={setCompanyFleet} drivers={realDrivers} setDrivers={setCompanyDrivers} readOnly={!can("manageFleet")}/>}
{realOperational&&tab!==initialTab&&tab===6&&<DemoDriversBoard drivers={realDrivers} vehicles={realFleet} onFleet={()=>can("manageDrivers")?window.location.assign("/admin/drivers"):show(6)}/>}
{realOperational&&tab!==initialTab&&tab===7&&<DemoBookingOverview view="diary"/>}
{realOperational&&tab!==initialTab&&tab===10&&<MemberDirectoryPage/>}
{realOperational&&tab!==initialTab&&tab===15&&<DemoNotifications onNavigate={show}/>}
{realOperational&&tab!==initialTab&&tab===3&&<DemoCompanyQuotes mode={can("award")?"received":"sent"} allowAward={false}/>}
{realOperational&&tab!==initialTab&&tab===8&&<DemoInvoicesBoard jobs={sharedJobs} readOnly={!can("invoice")}/>}
{realOperational&&tab!==initialTab&&tab===9&&<DemoNetworkToolsBoard audience={can("manageCompany")?"company":can("quote")||can("postLoad")||can("award")?"standard":"driver"} onNavigate={show}/>}
{realOperational&&tab!==initialTab&&tab===14&&<DemoMessagesBoard jobs={sharedJobs} onBooking={()=>show(4)}/>}
{realOperational&&tab!==initialTab&&tab===11&&<DemoLiveAvailability/>}
{realOperational&&tab!==initialTab&&tab===12&&<DemoReturnJourneys/>}
{realOperational&&tab!==initialTab&&tab===13&&<DemoFreightVision onLoads={()=>show(2)}/>}
{realOperational&&tab!==initialTab&&tab===16&&<DemoReportsBoard jobs={sharedJobs} drivers={realDrivers} vehicles={realFleet}/>}
{!realOperational&&<>
{!isDispatch&&tab===10&&(preview?<MasterOperationalSection role={role} tab="Directory" preview/>:live?<MemberDirectoryPage/>:<NetworkTools role="Company" initialView="Directory" showTabs={false}/>)}
{!isDispatch&&tab===11&&(<DemoLiveAvailability/>)}
{!isDispatch&&tab===12&&<DemoReturnJourneys/>}
{!isDispatch&&tab===13&&<DemoFreightVision onLoads={()=>show(2)}/>}
{!isDispatch&&tab===14&&(preview?<MasterOperationalSection role={role} tab="Messages" preview/>:<DemoMessagesBoard jobs={sharedJobs} onBooking={()=>show(4)}/>)}
{!isDispatch&&tab===16&&<DemoReportsBoard jobs={sharedJobs} drivers={realDrivers} vehicles={realFleet}/>}

{!isDispatch&&tab===15&&<DemoNotifications onNavigate={show}/>}
{tab===0&&<DemoCompanyDashboard workspaceLabel={role} suppressPreview={role!=="Company / Carrier"} jobs={sharedJobs} fleet={realFleet.map(v=>({...v,type:v.vehicle,area:v.location}))} drivers={realDrivers} go={show}/>}
{!isDispatch&&tab===1&&<div>{!can("postLoad")&&<p role="status">Posting loads is restricted for this role.</p>}{!preview&&(authenticated||live)&&can("postLoad")?<LoadPostingForm mode={role==="Customer"?"customer":role==="Broker"?"broker":role==="Owner Driver"?"owner":"admin"}/>:<fieldset disabled={preview||!can("postLoad")} style={{border:0,padding:0,margin:0,minWidth:0}}><PostLoadDemo liveMode={!!live} role={role==="Broker"?"Broker":"Customer"} from={live?"":"Birmingham B6"} to={live?"":"Manchester M1"} vehicle={live?"":"Luton Van"} pallets={live?"":"2"} weight={live?"":"450"} onPublish={async data=>{if(live){window.location.assign(role==="Broker"?"/broker/post-load":"/admin/post-load");return;}const published=await publishDemoLoad(data);const id=published.id;const j:Job={id,from:data.from,to:data.to,vehicle:data.vehicle,cargo:data.pallets+" items Ã‚Â· "+data.weight+" kg",company:"Your demo company",status:"Open",price:0,driver:"",vehicleId:"",stage:0,pod:false};setJobs(x=>[j,...x]);setSelected(id);show(2)}}/></fieldset>}</div>}
{!isDispatch&&tab===2&&<DemoExchangeBoard role={role==="Company / Carrier"?"Carrier":role==="Employee Driver"?"Company Driver":role}/> }
{isDispatch&&tab===1&&((authenticated||live)&&!preview?(can("postLoad")?<LoadPostingForm mode="admin"/>:<p role="status">Posting loads is restricted for this role.</p>):<DemoExchangeBoard role="Dispatcher"/>)}
{isDispatch&&tab===1&&(!(authenticated||live)||preview)&&<div className="panel"><div className="panel-title"><h2>{isDispatch?"Dispatch Board":"Load Exchange"}</h2><span>{sharedJobs.length} SHARED LOADS</span></div><div className="ops-filters"><input aria-label="Search jobs" placeholder="Search route, ID or company" value={search} onChange={e=>setSearch(e.target.value)}/><select aria-label="Filter job status" value={filter} onChange={e=>setFilter(e.target.value)}>{["All","Open","Allocated","In Progress","Completed"].map(x=><option key={x}>{x}</option>)}</select></div>{list(sharedJobs.filter(j=>(filter==="All"||j.status===filter)&&(j.id+j.from+j.to+j.company).toLowerCase().includes(search.toLowerCase())))}</div>}
{((!isDispatch&&tab===4)||(isDispatch&&tab===2))&&<DemoCompanyBookings role={role}/>}
{!isDispatch&&tab===3&&<DemoCompanyQuotes mode={can("award")?"all":"sent"} allowAward={can("award")}/>}
{!isDispatch&&tab===5&&<DemoFleetBoard vehicles={realFleet} setVehicles={setCompanyFleet} drivers={realDrivers} setDrivers={setCompanyDrivers} suppressPreview={role!=="Company / Carrier"} readOnly={!live||!can("manageFleet")}/>}
{!isDispatch&&tab===6&&<DemoDriversBoard drivers={realDrivers} vehicles={realFleet} onFleet={()=>can("manageDrivers")?(live?window.location.assign("/admin/drivers"):show(5)):show(6)} suppressPreview={role!=="Company / Carrier"}/>}
{isDispatch&&tab===5&&<DemoMessagesBoard jobs={sharedJobs} onBooking={()=>show(2)}/>}
{((!isDispatch&&tab===7)||(isDispatch&&tab===4))&&<DemoBookingOverview view="diary"/>}
{!isDispatch&&tab===8&&<DemoInvoicesBoard jobs={sharedJobs} readOnly={!can("invoice")}/>}
{isDispatch&&tab===6&&<DemoReportsBoard jobs={sharedJobs} drivers={companyDrivers} vehicles={companyFleet}/>}
{!isDispatch&&tab===9&&(preview?<MasterOperationalSection role={role} tab="Network & Tools" preview/>:<DemoNetworkToolsBoard onNavigate={show} audience={can("manageCompany")?"company":can("quote")||can("postLoad")||can("award")?"standard":"driver"}/>) }
{isDispatch&&tab===7&&<DemoNetworkToolsBoard audience="standard" onNavigate={i=>show(({4:2,10:7,11:7,12:7,16:6} as Record<number,number>)[i]??7)}/>}
</>}
</>}</div></div></main>
}




