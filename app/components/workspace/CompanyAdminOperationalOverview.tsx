'use client';
import {useMemo,useState,type ReactNode} from 'react';
import Link from 'next/link';
import CompanyDashboardKpis from './CompanyDashboardKpis';
import CompanyDashboardPanel from './CompanyDashboardPanel';
import CompanyDashboardActions from './CompanyDashboardActions';
import CompanyDashboardLoadOverview from './CompanyDashboardLoadOverview';
import './company-admin-dashboard-3118.css';
import { StatusBadge } from './WorkspaceUI';
import { metricValue, unavailable, when } from './AdminDashboardShared';
import { deriveCompanyOperationalOverview, companyJobReference } from './companyOperationalOverview';
import { workspaceJobOperationalLabel } from '../../../lib/jobs/workspaceJobStage';
import { toCanonicalInvoiceDisplayStatus } from '../../../lib/invoiceStatus';
import type { WorkspaceDataState, WorkspaceDatasetKey, WorkspaceJob } from './useCompanyWorkspaceData';

type View='todayJobs'|'openLoads'|'active'|'pod'|'unallocated'|'overdue'|'quotesToReview'|'availableDrivers'|'receivables'|'recent';
const viewTitles:Record<View,string>={todayJobs:"Today's Operations",openLoads:'Active Loads',active:'In Progress',pod:'Awaiting POD',unallocated:'Unallocated Bookings',overdue:'Overdue Deliveries',quotesToReview:'Loads with Quotes to Review',availableDrivers:'Available Drivers',receivables:'Outstanding Receivables',recent:'Recently Updated Jobs'};
const date=(v:string|null|undefined)=>v?when(v):'Not scheduled';

export default function CompanyAdminOperationalOverview({data,reporting,payables,reports,feedback,activity,compliance}:{data:WorkspaceDataState;reporting?:ReactNode;payables?:ReactNode;reports?:ReactNode;feedback?:ReactNode;activity?:ReactNode;compliance?:ReactNode}){
  const overview=useMemo(()=>deriveCompanyOperationalOverview(data),[data]);
  const [view,setView]=useState<View>('todayJobs');
  const [page,setPage]=useState(0);
  const select=(next:View)=>{setView(next);setPage(0)};
  const number=(keys:WorkspaceDatasetKey[],n:number)=>data.loading?'Loading':!data.companyId?'Unavailable':metricValue(data,keys,()=>n);
  const jobViews:View[]=['todayJobs','openLoads','active','pod','unallocated','overdue','quotesToReview','recent'];
  const keys:WorkspaceDatasetKey[]=view==='availableDrivers'?['drivers','jobs']:view==='receivables'?['invoices']:view==='quotesToReview'?['jobs','bids']:['jobs'];
  const available=!data.loading&&!unavailable(data,keys)&&Boolean(data.companyId);
  const rows=jobViews.includes(view)?overview[view as keyof Pick<typeof overview,'todayJobs'|'openLoads'|'active'|'pod'|'unallocated'|'overdue'|'quotesToReview'|'recent'>]:[];
  const driverMap=new Map(data.drivers.map(d=>[d.id,d.display_name||d.email||'Driver']));
  const vehicleMap=new Map(data.vehicles.map(v=>[v.id,v.reg_plate||v.type||'Vehicle']));
  const kpis:[View,WorkspaceDatasetKey[],number][]=[['openLoads',['jobs'],overview.openLoads.length],['active',['jobs'],overview.active.length],['availableDrivers',['drivers','jobs'],overview.availableDrivers.length],['pod',['jobs'],overview.pod.length],['receivables',['invoices'],overview.receivables.length]];
  const actionItems:[View,WorkspaceDatasetKey[],number][]=[['quotesToReview',['jobs','bids'],overview.quotesToReview.length],['unallocated',['jobs'],overview.unallocated.length],['pod',['jobs'],overview.pod.length],['overdue',['jobs'],overview.overdue.length]];
  const total=view==='availableDrivers'?overview.availableDrivers.length:view==='receivables'?overview.receivables.length:rows.length;
  const safePage=Math.min(page,Math.max(0,Math.ceil(total/8)-1));
  const start=safePage*8;
  const jobRow=(job:WorkspaceJob)=><article className="company-admin-ops-row" key={job.id}><div><strong>{companyJobReference(job)}</strong><small>{job.pickup_location||job.pickup_postcode||'Collection not set'} → {job.delivery_location||job.delivery_postcode||'Delivery not set'}</small><small>Collection: {date(job.pickup_datetime)} · Delivery: {date(job.delivery_datetime)}</small></div><div><StatusBadge value={workspaceJobOperationalLabel(job)}/><small>{job.assigned_driver_id?(driverMap.get(job.assigned_driver_id)||'Assigned driver'):'Unallocated'} · {job.vehicle_id?(vehicleMap.get(job.vehicle_id)||'Assigned vehicle'):job.vehicle_id===null?'No vehicle':'Vehicle ID not supplied'}</small></div><Link className="company-admin-ops-detail" href={view==='openLoads'||view==='quotesToReview'?'/admin/jobs/'+encodeURIComponent(job.id):'/admin/diary?job='+encodeURIComponent(job.id)} prefetch={false}>View Details</Link></article>;
  const icons=["\u25a3","\u25b6","\u263b","\u25a4","\u00a3"];
  const colors=["orange","blue","green","amber","sky"];
  return <section className="company-admin-3118-surface" aria-label="Company operational overview"><section className="xd-dashboard">
    <div className="xd-dashboard-heading"><div><h1>Dashboard</h1><p>Company / Carrier overview · {new Date().toLocaleDateString("en-GB",{timeZone:"Europe/London",weekday:"long",day:"numeric",month:"long",year:"numeric"})}</p></div></div>
    <CompanyDashboardKpis metrics={kpis.map(([key,source,n],i)=>({label:key==="receivables"?"Outstanding":viewTitles[key],value:number(source,n),sub:["Company job records","Bookings underway","Available company drivers","Action required","Unpaid invoice records"][i],icon:icons[i],color:colors[i],selected:view===key,onSelect:()=>select(key)}))}/>
    <div className="xd-dashboard-primary"><CompanyDashboardPanel panel="xd-today" icon="\u25a3" title={view==='todayJobs'?<>Today’s Operations ({available?total:'Unavailable'})</>:viewTitles[view]} action={<>{view!=="todayJobs"&&<button type="button" onClick={()=>select("todayJobs")}>Today’s Operations</button>}<Link href="/admin/diary" prefetch={false}>View Diary →</Link></>}><div className="xd-dash-rows">
        {!available?<p role="status">{data.loading?'Loading company records…':'Data unavailable or incomplete. No verified total can be shown.'}</p>: total===0?<p role="status">No matching records.</p>:<>
          {rows.slice(start,start+8).map(jobRow)}
          {view==='availableDrivers'&&overview.availableDrivers.slice(start,start+8).map(d=><article key={d.id} className="company-admin-ops-row"><div><strong>{d.display_name||d.email||'Driver'}</strong><small>{d.phone||'No phone recorded'}</small></div><StatusBadge value="Available"/></article>)}
          {view==='receivables'&&overview.receivables.slice(start,start+8).map(i=><article key={i.id} className="company-admin-ops-row"><div><strong>{i.invoice_number||i.id}</strong><small>{i.client_name||'Customer'} · Due {date(i.due_date)}</small></div><StatusBadge value={toCanonicalInvoiceDisplayStatus(i.status,i.due_date,i.payment_status)}/><Link className="company-admin-ops-detail" href={'/admin/invoices/'+encodeURIComponent(i.id)} prefetch={false}>View invoice</Link></article>)}
          {total>8&&<div className="company-admin-ops-pagination"><button type="button" disabled={safePage===0} onClick={()=>setPage(safePage-1)}>Previous</button><span>{start+1}–{Math.min(total,start+8)} of {total}</span><button type="button" disabled={start+8>=total} onClick={()=>setPage(safePage+1)}>Next</button></div>}
        </>}
    </div></CompanyDashboardPanel>
    <CompanyDashboardActions actions={actionItems.map(([key,source,n],i)=>({label:viewTitles[key],value:number(source,n),color:["blue","amber","orange","red"][i],selected:view===key,onSelect:()=>select(key)}))} total={actionItems.every(([,source])=>!data.loading&&!unavailable(data,source))?actionItems.reduce((sum,[,,n])=>sum+n,0):undefined}/></div>
    <div className="xd-dashboard-secondary">
    <CompanyDashboardPanel panel="xd-fleet-overview" icon="\u25a3" title="Fleet & Drivers" action={<Link href="/admin/fleet/vehicles" prefetch={false}>View Fleet →</Link>}><div className="xd-fleet-metrics"><div><span aria-hidden="true">\u25a3</span><small>Vehicles</small><strong>{number(["vehicles"],overview.vehicles.length)}</strong><b>Registered vehicles</b></div><div><span aria-hidden="true">\u263b</span><small>Drivers</small><strong>{number(["drivers"],overview.drivers.length)}</strong><b><button type="button" onClick={()=>select("availableDrivers")}>{number(["drivers","jobs"],overview.availableDrivers.length)} Available</button></b></div></div>{compliance}</CompanyDashboardPanel>
    <CompanyDashboardPanel panel="xd-activity" icon="\u25a4" title="Recent Activity" action={<Link href="/admin/event-log" prefetch={false}>Event Log →</Link>}>
      {!data.loading&&!unavailable(data,["jobs"])?overview.recent.slice(0,4).map(job=><div key={job.id} className="xd-activity-row"><span aria-hidden="true">\u25a4</span><small><Link href={"/admin/jobs/"+encodeURIComponent(job.id)} prefetch={false}>{companyJobReference(job)}</Link> ? {workspaceJobOperationalLabel(job)}</small><time>{date(job.updated_at)}</time></div>):<p>Job activity unavailable.</p>}
      {!data.loading&&!unavailable(data,["jobs"])&&!overview.recent.length&&<p>No job updates.</p>}<button type="button" className="company-admin-ops-detail" onClick={()=>select("recent")}>View updated jobs</button>{activity}</CompanyDashboardPanel>
    <CompanyDashboardPanel panel="xd-performance" icon="\u25a3" title="Performance"><div className="xd-performance-inner"><div className="xd-ring" style={{background:"#edf2f7"}}><b>—</b></div><div><strong>On-Time Delivery</strong><small>Verified delivery timing required</small><p>On Time: Not measured</p><p>Late: Not measured</p></div></div>{feedback}</CompanyDashboardPanel>
    <CompanyDashboardLoadOverview description="Own loads created in the last 7 days; current lifecycle and quote presence" metrics={Object.entries(overview.loadOverview).map(([label,n])=>({label:label[0].toUpperCase()+label.slice(1),value:number(label==="quoted"?["jobs","bids"]:["jobs"],n)}))}/>
    </div><div className="xd-dashboard-commercial" aria-label="Commercial reporting">{reporting}{payables}{reports}</div></section></section>;
}
