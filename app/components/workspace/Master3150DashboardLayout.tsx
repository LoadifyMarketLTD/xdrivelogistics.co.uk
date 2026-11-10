'use client';
import type {WorkspaceDataState, WorkspaceJob} from './useCompanyWorkspaceData';
import {classifyWorkspaceJobStage} from '../../../lib/jobs/workspaceJobStage';

const dateLabel=(value:string|null|undefined)=>{
 if(!value)return 'Not scheduled';
 const date=new Date(value);
 return Number.isNaN(date.getTime())?'Not scheduled':date.toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'});
};
const hasPOD=(job:WorkspaceJob)=>Boolean(job.pod_generated===true||job.pod_generated_at);
const stage=(job:WorkspaceJob)=>classifyWorkspaceJobStage(job);
const location=(first:string|null|undefined,second:string|null|undefined)=>first||second||'Location not recorded';
const money=(n:number)=>new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP'}).format(n);

export default function Master3150DashboardLayout({data,workspaceLabel,go,onOpenJob}:{
 data:WorkspaceDataState;workspaceLabel:string;go:(tab:number)=>void;onOpenJob:(id:string)=>void;
}){
 const today=new Date().toISOString().slice(0,10);
 const jobs=data.jobs;
 const completed=jobs.filter(job=>stage(job)==='completed');
 const inProgress=jobs.filter(job=>stage(job)==='in_progress');
 const awaitingPOD=completed.filter(job=>!hasPOD(job));
 const pendingAllocation=jobs.filter(job=>stage(job)==='awarded'&&!job.assigned_driver_id);
 const availableDrivers=data.drivers.filter(d=>(d.availability_status||'').toLowerCase()==='available').length;
 const invoicesReady=data.datasets.invoices.availability==='available'&&!data.datasets.invoices.partialData&&!data.datasets.invoices.limitedData;
 const outstanding=invoicesReady?data.invoices.filter(i=>!['paid','cancelled','void'].includes((i.payment_status||i.status||'').toLowerCase())&&(i.currency||'GBP')==='GBP').reduce((n,i)=>n+Number(i.amount??0),0):null;
 const scheduledToday=jobs.filter(job=>job.pickup_datetime?.slice(0,10)===today).slice(0,5);
 const overdue=jobs.filter(job=>!['completed','cancelled','expired'].includes(stage(job))&&Boolean(job.delivery_datetime&&new Date(job.delivery_datetime).getTime()<Date.now()));
 const quotesToReview=data.bids.filter(b=>b.status==='submitted'&&jobs.some(job=>job.id===b.job_id&&job.company_id===data.companyId));
 const recent=jobs.filter(j=>new Date(j.created_at).getTime()>=Date.now()-7*86400000);
 const cards=[
  {label:'Active Loads',value:jobs.filter(j=>!['completed','cancelled','expired'].includes(stage(j))).length,sub:'Open company records',tone:'orange',tab:2},
  {label:'In Progress',value:inProgress.length,sub:'Bookings underway',tone:'blue',tab:7},
  {label:'Available Drivers',value:availableDrivers,sub:'Verified availability',tone:'green',tab:6},
  {label:'Awaiting POD',value:awaitingPOD.length,sub:'Evidence required',tone:'amber',tab:7},
  {label:'Outstanding',value:outstanding===null?'Unavailable':money(outstanding),sub:outstanding===null?'Invoice dataset incomplete':'Unpaid GBP invoices',tone:'sky',tab:8},
 ];
 const actions=[
  {name:'Quotes to Review',count:quotesToReview.length,tab:3,tone:'blue'},
  {name:'Unallocated Bookings',count:pendingAllocation.length,tab:4,tone:'amber'},
  {name:'Awaiting POD',count:awaitingPOD.length,tab:7,tone:'orange'},
  {name:'Overdue Deliveries',count:overdue.length,tab:7,tone:'red'},
 ];
 return <section className="xd-dashboard" data-master-reference="3150" aria-label="Production operations dashboard">
  <div className="xd-dashboard-heading"><div><h1>Dashboard</h1><p>{workspaceLabel} overview · {new Date().toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</p>{data.partialData&&<p role="status">Some operational datasets are incomplete; totals may be partial.</p>}</div></div>
  <div className="xd-dashboard-kpis">{cards.map(card=><button type="button" key={card.label} className={'xd-kpi '+card.tone} onClick={()=>go(card.tab)}>
   <span className="xd-kpi-content"><strong>{card.label}</strong><b>{card.value}</b><small>{card.sub}</small></span>
  </button>)}</div>
  <div className="xd-dashboard-primary">
   <div className="xd-dash-panel xd-today"><div className="xd-dash-panel-head"><h2>Today's Operations ({scheduledToday.length})</h2><button onClick={()=>go(7)}>View Diary</button></div>
    <div className="xd-dash-rows">{scheduledToday.length===0?<p className="muted">No company jobs scheduled today.</p>:scheduledToday.map((j,i)=><article className="xd-dash-job" key={j.id}>
     <div className={'xd-dash-date '+(stage(j)==='in_progress'?'intransit':'awaiting')}><b>{dateLabel(j.pickup_datetime)}</b><span>{stage(j)}</span></div>
     <div className="xd-dash-job-main"><strong>{location(j.pickup_location,j.pickup_postcode)} → {location(j.delivery_location,j.delivery_postcode)}</strong>
      <small>Ref: {j.id.slice(0,8).toUpperCase()} | {(j.requested_vehicle_label||j.vehicle_type||'Vehicle not recorded').replaceAll('_',' ')} | {j.pallets??'—'} pallets</small></div>
     <div className="xd-dash-assignee"><b>{j.assigned_driver_id?'Driver assigned':'Unallocated'}</b><small>{hasPOD(j)?'POD received':'POD pending'}</small></div>
     <button className="xd-dash-detail" onClick={()=>onOpenJob(j.id)}>View Details</button>
    </article>)}</div>
   </div>
   <div className="xd-dash-panel xd-attention"><div className="xd-dash-panel-head"><h2>Action Required ({actions.reduce((n,a)=>n+a.count,0)})</h2></div>
    {actions.map(a=><button className="xd-action-row" key={a.name} onClick={()=>go(a.tab)}><span>{a.name}</span><b className={a.tone}>{a.count}</b></button>)}
   </div>
  </div>
  <div className="xd-dashboard-secondary">
   <div className="xd-dash-panel xd-fleet-overview"><div className="xd-dash-panel-head"><h2>Fleet & Drivers</h2><button onClick={()=>go(5)}>View Fleet</button></div><div className="xd-fleet-metrics">
    <div><small>Vehicles</small><strong>{data.vehicles.length}</strong><b>Company records</b></div>
    <div><small>Drivers</small><strong>{data.drivers.length}</strong><b>{availableDrivers} available</b></div>
   </div></div>
   <div className="xd-dash-panel xd-activity"><div className="xd-dash-panel-head"><h2>Recent Activity</h2><button onClick={()=>go(7)}>View All</button></div>
    {jobs.slice(0,4).map(j=><button className="xd-activity-row" key={j.id} onClick={()=>onOpenJob(j.id)}><small>{j.id.slice(0,8).toUpperCase()} · {stage(j)}</small><time>{dateLabel(j.created_at)}</time></button>)}
    {!jobs.length&&<p className="muted">No recorded activity.</p>}
   </div>
   <div className="xd-dash-panel xd-performance"><div className="xd-dash-panel-head"><h2>Performance</h2></div><div className="xd-performance-inner">
    <div><strong>Recorded completions</strong><p>Completed: {completed.length}</p><p>With POD: {completed.filter(hasPOD).length}</p><p>On-time rate: Not available</p></div>
   </div></div>
   <div className="xd-dash-panel xd-overview"><div className="xd-dash-panel-head"><h2>Load Overview <small>(Last 7 Days)</small></h2></div><div className="xd-overview-metrics">
    {[{n:recent.length,t:'Posted'},{n:new Set(data.bids.filter(b=>recent.some(j=>j.id===b.job_id)).map(b=>b.job_id)).size,t:'Quoted'},
     {n:recent.filter(j=>['awarded','allocated','in_progress','completed'].includes(stage(j))).length,t:'Booked'},
     {n:recent.filter(j=>stage(j)==='completed').length,t:'Completed'}].map(x=><div key={x.t}><small>{x.t}</small><b>{x.n}</b></div>)}
   </div></div>
  </div>
 </section>;
}
