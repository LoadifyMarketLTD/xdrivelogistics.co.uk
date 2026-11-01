'use client';
import {useRouter} from 'next/navigation';
import {useCompanyWorkspaceData} from './useCompanyWorkspaceData';
import './xdrive-approved-demo-dashboard.css';

type Surface='customer'|'broker'|'fleet'|'dispatcher'|'driver'|'company-driver'|'owner-driver';
const links:Record<Surface,{jobs:string;quotes:string;bookings:string;fleet:string;drivers:string;diary:string;invoices:string}>={
 customer:{jobs:'/customer/loads',quotes:'/customer/quotes',bookings:'/customer/bookings',fleet:'/customer',drivers:'/customer',diary:'/customer/diary',invoices:'/customer/invoices'},
 broker:{jobs:'/broker/loads',quotes:'/broker/quotes',bookings:'/broker/bookings',fleet:'/broker',drivers:'/broker',diary:'/broker/diary',invoices:'/broker/invoices'},
 fleet:{jobs:'/admin/fleet/jobs',quotes:'/admin/exchange',bookings:'/admin/won-work',fleet:'/admin/fleet/vehicles',drivers:'/admin/fleet/resources',diary:'/admin/diary',invoices:'/admin/invoices'},
 dispatcher:{jobs:'/admin/marketplace',quotes:'/admin/exchange',bookings:'/admin/won-work',fleet:'/admin/fleet/vehicles',drivers:'/admin/drivers',diary:'/admin/diary',invoices:'/admin/invoices'},
 driver:{jobs:'/driver/loads',quotes:'/driver/quotes',bookings:'/driver/bookings',fleet:'/driver',drivers:'/driver',diary:'/driver/diary',invoices:'/driver/invoices'},
 'company-driver':{jobs:'/driver/loads',quotes:'/driver/quotes',bookings:'/driver/bookings',fleet:'/driver',drivers:'/driver',diary:'/driver/diary',invoices:'/driver/invoices'},
 'owner-driver':{jobs:'/driver/loads',quotes:'/driver/quotes',bookings:'/driver/bookings',fleet:'/driver',drivers:'/driver',diary:'/driver/diary',invoices:'/driver/invoices'}
};
export default function ApprovedRoleDashboard({surface}:{surface:Surface}){
 const router=useRouter();
 const {jobs,bids,invoices,drivers,vehicles,loading,error,refresh}=useCompanyWorkspaceData();
 const path=links[surface];
 const active=jobs.filter(j=>!['completed','cancelled','expired'].includes(String(j.current_status||j.status).toLowerCase())).length;
 const completed=jobs.filter(j=>String(j.current_status||j.status).toLowerCase().includes('complet')).length;
 const money=new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP'}).format(invoices.filter(i=>!['paid','cancelled'].includes(String(i.payment_status||i.status).toLowerCase())).reduce((n,i)=>n+Number(i.amount||0),0));
 const tiles=[['Loads',jobs.length,path.jobs],['Active',active,path.bookings],['Quotes',bids.length,path.quotes],['Completed',completed,path.diary],['Outstanding',money,path.invoices]] as const;
 const title=surface==='company-driver'?'Company Driver':surface==='owner-driver'?'Owner Driver':surface.charAt(0).toUpperCase()+surface.slice(1);
 return <main className="demo-shell xdrive-approved-live-dashboard" style={{padding:'24px',minHeight:'70vh'}}><div className="xd-dashboard"><div className="xd-dashboard-heading"><div><h1>Dashboard</h1><p>{title} operations · Live account data</p></div><button type="button" onClick={()=>void refresh()} disabled={loading}>Refresh</button></div>
 {error&&<p role="alert" className="xd-dashboard-disclaimer">{error}</p>}{loading&&<p role="status">Loading live operations…</p>}
 <div className="xd-dashboard-kpis">{tiles.map(([label,value,href],i)=><button type="button" key={label} className={'xd-kpi '+['orange','blue','green','amber','sky'][i]} onClick={()=>router.push(href)}><span className="xd-kpi-content"><strong>{label}</strong><b>{value}</b><small>View details</small></span></button>)}</div>
 <div className="xd-dashboard-primary"><section className="xd-dash-panel xd-today"><div className="xd-dash-panel-head"><h2>Operations ({jobs.length})</h2><button onClick={()=>router.push(path.jobs)}>View Loads</button></div><div className="xd-dash-rows">{jobs.slice(0,8).map(j=><article key={j.id} className="xd-dash-job"><div className="xd-dash-job-main"><strong>{j.pickup_postcode||'Collection not specified'} → {j.delivery_postcode||'Delivery not specified'}</strong><small>Ref: {j.booking_reference||j.id} | {j.vehicle_type||'Vehicle not specified'} | {j.current_status||j.status}</small></div><button className="xd-dash-detail" onClick={()=>router.push(path.bookings)}>View Details</button></article>)}{!loading&&jobs.length===0&&<p className="xd-dashboard-disclaimer">No transport records available.</p>}</div></section><section className="xd-dash-panel xd-attention"><div className="xd-dash-panel-head"><h2>Quick Actions</h2></div>{[['Find Loads',path.jobs],['Quotes',path.quotes],['Bookings',path.bookings],['Diary',path.diary],['Invoices',path.invoices]].map(([label,href])=><button key={label} className="xd-action-row" onClick={()=>router.push(href)}><span>{label}</span><strong>›</strong></button>)}</section></div>
 <div className="xd-dashboard-secondary"><section className="xd-dash-panel xd-fleet-overview"><div className="xd-dash-panel-head"><h2>Fleet & Drivers</h2><button onClick={()=>router.push(path.fleet)}>View Fleet</button></div><div className="xd-fleet-metrics"><div><small>Vehicles</small><strong>{vehicles.length}</strong></div><div><small>Drivers</small><strong>{drivers.length}</strong></div></div></section><section className="xd-dash-panel xd-overview"><div className="xd-dash-panel-head"><h2>Overview</h2></div><div className="xd-overview-metrics">{[['Loads',jobs.length],['Quotes',bids.length],['Completed',completed],['Invoices',invoices.length]].map(([label,value])=><div key={label}><small>{label}</small><b>{value}</b></div>)}</div></section></div>
 </div></main>;
}
