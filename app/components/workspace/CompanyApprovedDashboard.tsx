'use client';
import { useRouter } from 'next/navigation';
import { useCompanyWorkspaceData } from './useCompanyWorkspaceData';
import './xdrive-approved-demo-dashboard.css';

const routes = ['/admin','/admin/post-load','/admin/marketplace','/admin/exchange','/admin/won-work','/admin/fleet/vehicles','/admin/drivers','/admin/diary','/admin/invoices','/admin/operations-centre','/admin/marketplace/directory','/admin/live-availability','/admin/fleet/returns','/admin/freight-vision','/admin/messages','/admin/notifications','/admin/finance/reports'];
export default function CompanyApprovedDashboard() {
 const router=useRouter();
 const {jobs,drivers,vehicles,bids,invoices,loading,error,refresh}=useCompanyWorkspaceData();
 const go=(index:number)=>router.push(routes[index] || '/admin');
 const active=jobs.filter(j=>['in_progress','in transit','allocated','on_my_way_to_pickup','loaded'].includes(String(j.current_status||j.status).toLowerCase())).length;
 const completed=jobs.filter(j=>String(j.current_status||j.status).toLowerCase().includes('complet')).length;
 const awaiting=jobs.filter(j=>String(j.current_status||j.status).toLowerCase().includes('deliver') && !(j.pod_photos?.length||j.delivery_photos?.length||j.pod_generated_at)).length;
 const outstanding=invoices.filter(i=>!['paid','cancelled','void'].includes(String(i.payment_status||i.status).toLowerCase())).reduce((n,i)=>n+Number(i.amount||0),0);
 const actions=[{title:'Quotes to Review',count:bids.filter(b=>['pending','submitted','new'].includes(b.status.toLowerCase())).length,section:3},{title:'Unallocated Bookings',count:jobs.filter(j=>!j.assigned_driver_id&&String(j.status).toLowerCase().includes('award')).length,section:4},{title:'Awaiting POD',count:awaiting,section:7},{title:'Invoices Outstanding',count:invoices.filter(i=>!['paid','cancelled','void'].includes(String(i.payment_status||i.status).toLowerCase())).length,section:8}];
 const metrics=[{title:'Active Loads',n:jobs.length,section:2},{title:'In Progress',n:active,section:7},{title:'Drivers',n:drivers.length,section:6},{title:'Awaiting POD',n:awaiting,section:7},{title:'Outstanding',n:new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP'}).format(outstanding),section:8}];
 return <div className="demo-shell xdrive-approved-live-dashboard" style={{padding:24,minHeight:'70vh'}}>
  <div className="xd-dashboard">
   <div className="xd-dashboard-heading"><div><h1>Dashboard</h1><p>Company operations · Live company data</p></div><button type="button" onClick={()=>void refresh()} disabled={loading}>Refresh</button></div>
   {error&&<div role="alert" className="xd-dashboard-disclaimer">{error}</div>}
   {loading&&<p role="status">Loading company operations…</p>}
   <div className="xd-dashboard-kpis">{metrics.map((m,i)=><button type="button" key={m.title} className={'xd-kpi '+['orange','blue','green','amber','sky'][i]} onClick={()=>go(m.section)}><span className="xd-kpi-content"><strong>{m.title}</strong><b>{m.n}</b><small>View details</small></span></button>)}</div>
   <div className="xd-dashboard-primary">
    <div className="xd-dash-panel xd-today"><div className="xd-dash-panel-head"><h2>Today’s Operations ({jobs.length})</h2><button onClick={()=>go(7)}>View Diary</button></div>
     <div className="xd-dash-rows">{jobs.slice(0,8).map(j=><article className="xd-dash-job" key={j.id}><div className="xd-dash-job-main"><strong>{j.pickup_location||j.pickup_postcode||'Collection pending'} → {j.delivery_location||j.delivery_postcode||'Delivery pending'}</strong><small>Ref: {j.booking_reference||j.id} | {j.vehicle_type||'Vehicle not specified'} | {j.current_status||j.status}</small></div><button className="xd-dash-detail" onClick={()=>go(4)}>View Bookings</button></article>)}{!loading&&jobs.length===0&&<p className="xd-dashboard-disclaimer">No company loads available.</p>}</div>
    </div>
    <div className="xd-dash-panel xd-attention"><div className="xd-dash-panel-head"><h2>Action Required</h2></div>{actions.map(a=><button className="xd-action-row" key={a.title} onClick={()=>go(a.section)}><span>{a.title}</span><b>{a.count}</b><strong>›</strong></button>)}</div>
   </div>
   <div className="xd-dashboard-secondary"><div className="xd-dash-panel xd-fleet-overview"><div className="xd-dash-panel-head"><h2>Fleet & Drivers</h2><button onClick={()=>go(5)}>View Fleet</button></div><div className="xd-fleet-metrics"><div><small>Vehicles</small><strong>{vehicles.length}</strong></div><div><small>Drivers</small><strong>{drivers.length}</strong></div></div></div><div className="xd-dash-panel xd-overview"><div className="xd-dash-panel-head"><h2>Load Overview</h2></div><div className="xd-overview-metrics"><div><small>Loads</small><b>{jobs.length}</b></div><div><small>Quotes</small><b>{bids.length}</b></div><div><small>Completed</small><b>{completed}</b></div><div><small>Invoices</small><b>{invoices.length}</b></div></div></div></div>
  </div>
 </div>;
}
