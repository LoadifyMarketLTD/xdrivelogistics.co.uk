'use client';
import {useMemo,useState} from 'react';
import Link from 'next/link';
import { OperationalCard, StatusBadge } from './WorkspaceUI';
import { metricValue, unavailable, when } from './AdminDashboardShared';
import { deriveCompanyOperationalOverview, companyJobReference } from './companyOperationalOverview';
import { workspaceJobOperationalLabel } from '../../../lib/jobs/workspaceJobStage';
import { toCanonicalInvoiceDisplayStatus } from '../../../lib/invoiceStatus';
import type { WorkspaceDataState, WorkspaceDatasetKey, WorkspaceJob } from './useCompanyWorkspaceData';

type View='todayJobs'|'openLoads'|'active'|'pod'|'unallocated'|'overdue'|'quotesToReview'|'availableDrivers'|'receivables'|'recent';
const viewTitles:Record<View,string>={todayJobs:"Today's Operations",openLoads:'Active Loads',active:'In Progress',pod:'Awaiting POD',unallocated:'Unallocated Bookings',overdue:'Overdue Deliveries',quotesToReview:'Loads with Quotes to Review',availableDrivers:'Available Drivers',receivables:'Outstanding Receivables',recent:'Recently Updated Jobs'};
const date=(v:string|null|undefined)=>v?when(v):'Not scheduled';

export default function CompanyAdminOperationalOverview({data}:{data:WorkspaceDataState}){
  const overview=useMemo(()=>deriveCompanyOperationalOverview(data),[data]);
  const [view,setView]=useState<View>('todayJobs');
  const [page,setPage]=useState(0);
  const select=(next:View)=>{setView(next);setPage(0)};
  const number=(keys:WorkspaceDatasetKey[],n:number)=>data.loading?'Loading':!data.companyId?'Unavailable':metricValue(data,keys,()=>n);
  const jobViews:View[]=['todayJobs','openLoads','active','pod','unallocated','overdue','quotesToReview','recent'];
  const keys:WorkspaceDatasetKey[]=view==='availableDrivers'?['drivers']:view==='receivables'?['invoices']:view==='quotesToReview'?['jobs','bids']:['jobs'];
  const available=!data.loading&&!unavailable(data,keys)&&Boolean(data.companyId);
  const rows=jobViews.includes(view)?overview[view as keyof Pick<typeof overview,'todayJobs'|'openLoads'|'active'|'pod'|'unallocated'|'overdue'|'quotesToReview'|'recent'>]:[];
  const driverMap=new Map(data.drivers.map(d=>[d.id,d.display_name||d.email||'Driver']));
  const vehicleMap=new Map(data.vehicles.map(v=>[v.id,v.reg_plate||v.type||'Vehicle']));
  const kpis:[View,WorkspaceDatasetKey[],number][]=[['openLoads',['jobs'],overview.openLoads.length],['active',['jobs'],overview.active.length],['availableDrivers',['drivers'],overview.availableDrivers.length],['pod',['jobs'],overview.pod.length],['receivables',['invoices'],overview.receivables.length]];
  const actionItems:[View,WorkspaceDatasetKey[],number][]=[['quotesToReview',['jobs','bids'],overview.quotesToReview.length],['unallocated',['jobs'],overview.unallocated.length],['pod',['jobs'],overview.pod.length],['overdue',['jobs'],overview.overdue.length]];
  const total=view==='availableDrivers'?overview.availableDrivers.length:view==='receivables'?overview.receivables.length:rows.length;
  const safePage=Math.min(page,Math.max(0,Math.ceil(total/8)-1));
  const start=safePage*8;
  const jobRow=(job:WorkspaceJob)=><article className="company-admin-ops-row" key={job.id}><div><strong>{companyJobReference(job)}</strong><small>{job.pickup_location||job.pickup_postcode||'Collection not set'} → {job.delivery_location||job.delivery_postcode||'Delivery not set'}</small><small>Collection: {date(job.pickup_datetime)} · Delivery: {date(job.delivery_datetime)}</small></div><div><StatusBadge value={workspaceJobOperationalLabel(job)}/><small>{job.assigned_driver_id?(driverMap.get(job.assigned_driver_id)||'Assigned driver'):'Unallocated'} · {job.vehicle_id?(vehicleMap.get(job.vehicle_id)||'Assigned vehicle'):job.vehicle_id===null?'No vehicle':'Vehicle ID not supplied'}</small></div><Link className="company-admin-ops-detail" href={view==='openLoads'||view==='quotesToReview'?'/admin/jobs/'+encodeURIComponent(job.id):'/admin/diary?job='+encodeURIComponent(job.id)} prefetch={false}>View Details</Link></article>;
  return <section className="company-admin-ops" aria-label="Company operational overview">
    <OperationalCard title="Company Operations" subtitle="Current company records. Select a metric to inspect its underlying queue." >
      <div className="company-admin-ops-kpis">{kpis.map(([key,source,n])=><button key={key} type="button" className="company-admin-ops-kpi" aria-pressed={view===key} onClick={()=>select(key)}><span>{viewTitles[key]}</span><strong>{number(source,n)}</strong><small>View records</small></button>)}</div>
    </OperationalCard>
    <div className="company-admin-ops-grid">
      <OperationalCard title={viewTitles[view]} actions={<button type="button" className="company-admin-ops-detail" onClick={()=>select('todayJobs')}>Today's Operations</button>}>
        {!available?<p role="status">{data.loading?'Loading company records…':'Data unavailable or incomplete. No verified total can be shown.'}</p>: total===0?<p role="status">No matching records.</p>:<>
          {rows.slice(start,start+8).map(jobRow)}
          {view==='availableDrivers'&&overview.availableDrivers.slice(start,start+8).map(d=><article key={d.id} className="company-admin-ops-row"><div><strong>{d.display_name||d.email||'Driver'}</strong><small>{d.phone||'No phone recorded'}</small></div><StatusBadge value="Available"/></article>)}
          {view==='receivables'&&overview.receivables.slice(start,start+8).map(i=><article key={i.id} className="company-admin-ops-row"><div><strong>{i.invoice_number||i.id}</strong><small>{i.client_name||'Customer'} · Due {date(i.due_date)}</small></div><StatusBadge value={toCanonicalInvoiceDisplayStatus(i.status,i.due_date,i.payment_status)}/><Link className="company-admin-ops-detail" href={'/admin/invoices/'+encodeURIComponent(i.id)} prefetch={false}>View invoice</Link></article>)}
          {total>8&&<div className="company-admin-ops-pagination"><button type="button" disabled={safePage===0} onClick={()=>setPage(safePage-1)}>Previous</button><span>{start+1}–{Math.min(total,start+8)} of {total}</span><button type="button" disabled={start+8>=total} onClick={()=>setPage(safePage+1)}>Next</button></div>}
        </>}
      </OperationalCard>
      <OperationalCard title="Action Required" subtitle="Review company-owned or assigned records">
        <div className="company-admin-ops-actions">{actionItems.map(([key,source,n])=><button key={key} type="button" aria-pressed={view===key} onClick={()=>select(key)}><span>{viewTitles[key]}</span><strong>{number(source,n)}</strong></button>)}</div>
      </OperationalCard>
      <OperationalCard title="Fleet & Drivers" actions={<Link className="company-admin-ops-detail" href="/admin/fleet/vehicles" prefetch={false}>View Fleet</Link>}>
        <div className="company-admin-ops-facts"><span>Registered vehicles <strong>{number(['vehicles'],overview.vehicles.length)}</strong></span><span>Registered drivers <strong>{number(['drivers'],overview.drivers.length)}</strong></span><button type="button" onClick={()=>select('availableDrivers')}>Available drivers <strong>{number(['drivers'],overview.availableDrivers.length)}</strong></button></div>
      </OperationalCard>
      <OperationalCard title="Recent Activity" subtitle="Latest job updates (not a complete audit log)" actions={<Link className="company-admin-ops-detail" href="/admin/event-log" prefetch={false}>Event Log</Link>}>
        {!data.loading&&!unavailable(data,['jobs'])?overview.recent.slice(0,4).map(job=><div key={job.id} className="company-admin-ops-activity"><Link href={'/admin/jobs/'+encodeURIComponent(job.id)} prefetch={false}>{companyJobReference(job)}</Link><small>{workspaceJobOperationalLabel(job)} · {date(job.updated_at)}</small></div>):<p>Job activity unavailable.</p>}
        {!data.loading&&!unavailable(data,['jobs'])&&!overview.recent.length&&<p>No job updates.</p>}
        <button type="button" className="company-admin-ops-detail" onClick={()=>select('recent')}>View updated jobs</button>
      </OperationalCard>
      <OperationalCard title="Load Overview" subtitle="Own loads created in the last 7 days; current lifecycle and quote presence">
        <div className="company-admin-ops-facts">{Object.entries(overview.loadOverview).map(([label,n])=><span key={label}>{label[0].toUpperCase()+label.slice(1)} <strong>{number(label==='quoted'?['jobs','bids']:['jobs'],n)}</strong></span>)}</div>
      </OperationalCard>
    </div>
  </section>
}
