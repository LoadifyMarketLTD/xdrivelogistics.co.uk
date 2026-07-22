'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useCompanyWorkspaceData, type WorkspaceBid, type WorkspaceInvoice, type WorkspaceJob } from '../components/workspace/useCompanyWorkspaceData';
import { ActionButton, AlertBanner, DataTable, EmptyState, KpiCard, KpiGrid, PageFrame, PageHeader, Panel, QuickActions, StatusBadge, TwoColumn, workspaceTheme } from '../components/workspace/WorkspaceUI';

export const lifecycleStages = ['posted','quoted','awarded','allocated','accepted','on_my_way_to_pickup','on_site_pickup','loaded','on_my_way_to_delivery','on_site_delivery','delivered'];
export const lifecycleLabel = (value: string | null | undefined) => String(value ?? 'unknown').toLowerCase().replace(/[_-]+/g,' ').replace(/\b\w/g,(c)=>c.toUpperCase());
export const currentStatus = (job: WorkspaceJob) => String(job.current_status ?? job.status ?? 'draft').toLowerCase();
export const routeLabel = (job: WorkspaceJob) => `${job.pickup_postcode ?? job.pickup_location ?? 'Pickup'} → ${job.delivery_postcode ?? job.delivery_location ?? 'Delivery'}`;
export const when = (value: string | null | undefined) => value ? new Date(value).toLocaleString('en-GB',{dateStyle:'medium',timeStyle:'short'}) : 'Not set';
export const money = (value: number) => new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP'}).format(value);
export const quotePrice = (bid: WorkspaceBid) => Number(bid.bid_price_gbp ?? bid.amount ?? 0);
export const submittedQuotes = (bids: WorkspaceBid[], jobId: string) => bids.filter((bid)=>bid.job_id===jobId && bid.status==='submitted');
export const stageIndex = (job: WorkspaceJob) => { const status=currentStatus(job); const mapped=status==='on_my_way'?'on_my_way_to_pickup':status==='collected'||status==='in_transit'?'loaded':status==='completed'?'delivered':status; return Math.max(lifecycleStages.indexOf(mapped),0); };
export const isAwardedPending = (job: WorkspaceJob) => Boolean(job.awarded_carrier_company_id) && ['awarded','allocated'].includes(currentStatus(job));
export const isActiveDelivery = (job: WorkspaceJob) => { const i=stageIndex(job); return i>=lifecycleStages.indexOf('accepted') && i<lifecycleStages.indexOf('delivered'); };
export const isOverdue = (job: WorkspaceJob) => Boolean(isActiveDelivery(job) && job.delivery_datetime && new Date(job.delivery_datetime).getTime()<Date.now());
export const invoiceStatus = (invoice: WorkspaceInvoice) => String(invoice.payment_status ?? invoice.status ?? 'unknown').toLowerCase();
export const isInvoiceOverdue = (invoice: WorkspaceInvoice) => invoiceStatus(invoice)!=='paid' && Boolean(invoice.due_date && new Date(invoice.due_date).getTime()<Date.now());
export const latestLocation = (job: WorkspaceJob, locations: ReturnType<typeof useCompanyWorkspaceData>['locations']) => job.assigned_driver_id ? locations.find((item)=>item.driver_id===job.assigned_driver_id) : undefined;

const issueTokens=['incident','waiting','cancel','failed','dispute','exception'];
const issueStatus=(job:WorkspaceJob)=>issueTokens.some((token)=>currentStatus(job).includes(token));
const hoursUntil=(value:string|null|undefined)=>value?(new Date(value).getTime()-Date.now())/3600000:null;

type Attention={job:WorkspaceJob;reason:string;tone:'red'|'orange'|'purple'|'blue';priority:number;route:string};
const attentionFor=(job:WorkspaceJob,bids:WorkspaceBid[],invoices:WorkspaceInvoice[]):Attention|null=>{
 const status=currentStatus(job); const quotes=submittedQuotes(bids,job.id); const pickup=hoursUntil(job.pickup_datetime); const linked=invoices.filter((invoice)=>invoice.job_id===job.id);
 if(status.includes('failed')) return {job,reason:'Failed delivery requires action',tone:'red',priority:100,route:'/broker/jobs'};
 if(status.includes('incident')||status.includes('exception')) return {job,reason:'Operational exception requires review',tone:'red',priority:95,route:'/broker/jobs'};
 if(status.includes('dispute')) return {job,reason:'Dispute requires review',tone:'red',priority:92,route:'/broker/disputes'};
 if(status.includes('cancel')) return {job,reason:'Cancellation requires review',tone:'red',priority:90,route:'/broker/jobs'};
 if(status.includes('waiting')) return {job,reason:'Waiting time requires review',tone:'orange',priority:88,route:'/broker/jobs'};
 if(isOverdue(job)) return {job,reason:'Delivery ETA overdue',tone:'red',priority:85,route:'/broker/jobs'};
 if(['posted','quoted'].includes(status)&&quotes.length===0&&pickup!==null&&pickup<=24) return {job,reason:pickup<0?'Pickup passed without quotes':'Pickup approaching without quotes',tone:pickup<0?'red':'orange',priority:80,route:'/broker/loads'};
 if(['posted','quoted'].includes(status)&&quotes.length>0&&!job.awarded_carrier_company_id) return {job,reason:'Quotes awaiting decision',tone:'purple',priority:75,route:'/broker/compare-quotes'};
 if(isAwardedPending(job)&&!job.assigned_driver_id) return {job,reason:'Carrier allocation incomplete',tone:'orange',priority:70,route:'/broker/awards'};
 if(['delivered','completed'].includes(status)&&(job.delivery_photos?.length??0)===0) return {job,reason:'POD missing after delivery',tone:'orange',priority:65,route:'/broker/pod-review'};
 if(linked.some((invoice)=>isInvoiceOverdue(invoice))) return {job,reason:'Customer invoice overdue',tone:'red',priority:60,route:'/broker/customer-invoices'};
 if(linked.some((invoice)=>invoiceStatus(invoice)!=='paid')) return {job,reason:'Customer invoice requires action',tone:'blue',priority:55,route:'/broker/customer-invoices'};
 return null;
};

export function BrokerDashboard(){
 const router=useRouter(); const data=useCompanyWorkspaceData();
 const attention=useMemo(()=>data.jobs.map((job)=>attentionFor(job,data.bids,data.invoices)).filter((item):item is Attention=>Boolean(item)).sort((a,b)=>b.priority-a.priority).slice(0,12),[data.jobs,data.bids,data.invoices]);
 const metrics=useMemo(()=>{
  const open=data.jobs.filter((job)=>['posted','quoted'].includes(currentStatus(job))).length;
  const awaitingDecision=data.jobs.filter((job)=>submittedQuotes(data.bids,job.id).length>0&&!job.awarded_carrier_company_id).length;
  const customerInvoices=data.invoices.filter((invoice)=>invoice.company_id===data.companyId);
  return {open,attention:attention.length,quotes:data.bids.filter((bid)=>bid.status==='submitted').length,awaitingDecision,awarded:data.jobs.filter(isAwardedPending).length,active:data.jobs.filter(isActiveDelivery).length,exceptions:data.jobs.filter((job)=>isOverdue(job)||issueStatus(job)).length,pod:data.jobs.filter((job)=>['delivered','completed'].includes(currentStatus(job))&&(job.delivery_photos?.length??0)===0).length,unpaid:customerInvoices.filter((invoice)=>invoiceStatus(invoice)!=='paid').length,overdue:customerInvoices.filter(isInvoiceOverdue).length};
 },[data,attention.length]);
 return <PageFrame><PageHeader eyebrow="Broker commercial desk" title="Broker Dashboard" description="Review customer loads, compare real carrier quotes and control awarded transport through delivery, POD and invoicing." actions={<><ActionButton tone="warning" onClick={()=>router.push('/broker/post-load')}>Post Load</ActionButton><ActionButton tone="secondary" onClick={()=>router.push('/broker/compare-quotes')}>Compare Quotes</ActionButton></>}/>{data.error&&<AlertBanner>{data.error}</AlertBanner>}
 <KpiGrid><KpiCard label="Open customer loads" value={metrics.open} tone="blue" onClick={()=>router.push('/broker/loads')}/><KpiCard label="Awaiting broker action" value={metrics.attention} tone="orange"/><KpiCard label="Quotes received" value={metrics.quotes} tone="purple" onClick={()=>router.push('/broker/bids')}/><KpiCard label="Awaiting decision" value={metrics.awaitingDecision} tone="orange" onClick={()=>router.push('/broker/compare-quotes')}/><KpiCard label="Awarded, not started" value={metrics.awarded} tone="navy" onClick={()=>router.push('/broker/awards')}/><KpiCard label="Active deliveries" value={metrics.active} tone="green" onClick={()=>router.push('/broker/jobs')}/><KpiCard label="Delayed / exceptions" value={metrics.exceptions} tone="red" onClick={()=>router.push('/broker/jobs')}/><KpiCard label="POD awaiting review" value={metrics.pod} tone="orange" onClick={()=>router.push('/broker/pod-review')}/><KpiCard label="Unpaid invoices" value={metrics.unpaid} detail={metrics.overdue?`${metrics.overdue} overdue`:undefined} tone={metrics.overdue?'red':'orange'} onClick={()=>router.push('/broker/customer-invoices')}/></KpiGrid>
 <TwoColumn><Panel title="Action required" description="Only loads, deliveries, POD or invoices requiring broker intervention are shown."><DataTable columns={['Reason','Customer load','Pickup / ETA','Lifecycle','Action']} rows={attention.map((item)=>[<StatusBadge key="reason" value={item.reason} tone={item.tone}/>,<span key="load"><strong style={{display:'block'}}>{routeLabel(item.job)}</strong><small style={{color:workspaceTheme.muted}}>{item.job.client_name??'Customer'}</small></span>,<span key="time"><strong style={{display:'block'}}>{when(item.job.pickup_datetime)}</strong><small style={{color:workspaceTheme.muted}}>ETA {when(item.job.delivery_datetime)}</small></span>,<StatusBadge key="status" value={lifecycleLabel(currentStatus(item.job))}/>,<ActionButton key="action" tone="secondary" onClick={()=>router.push(`${item.route}?job=${item.job.id}`)}>Review</ActionButton>])} empty={<EmptyState title="No broker action required" description="Healthy active jobs remain available in Active Jobs."/>}/></Panel>
 <div style={{display:'grid',gap:'0.8rem'}}><Panel title="Quick actions"><QuickActions actions={[{label:'Review customer loads',description:`${metrics.open} open`,onClick:()=>router.push('/broker/loads')},{label:'Compare carrier quotes',description:`${metrics.awaitingDecision} awaiting decision`,onClick:()=>router.push('/broker/compare-quotes')},{label:'Monitor active deliveries',description:`${metrics.active} active`,onClick:()=>router.push('/broker/jobs')},{label:'Review POD',description:`${metrics.pod} awaiting review`,onClick:()=>router.push('/broker/pod-review')},{label:'Open customer invoices',description:`${metrics.unpaid} unpaid`,onClick:()=>router.push('/broker/customer-invoices')},{label:'Open notifications',onClick:()=>router.push('/broker/notifications')},{label:'Broker settings',onClick:()=>router.push('/broker/settings')}]}/></Panel><Panel title="Recent activity" description="Latest persisted job update timestamps.">{data.jobs.slice(0,6).map((job)=><button key={job.id} onClick={()=>router.push(`/broker/loads?job=${job.id}`)} style={{width:'100%',display:'flex',justifyContent:'space-between',gap:'0.6rem',alignItems:'center',border:`1px solid ${workspaceTheme.border}`,borderRadius:'8px',padding:'0.55rem 0.62rem',background:workspaceTheme.surfaceSoft,cursor:'pointer',marginBottom:'0.35rem',textAlign:'left'}}><span><strong style={{display:'block'}}>{routeLabel(job)}</strong><small style={{color:workspaceTheme.muted}}>{when(job.updated_at)}</small></span><StatusBadge value={lifecycleLabel(currentStatus(job))}/></button>)}{!data.jobs.length&&<EmptyState title="No recent broker activity"/>}</Panel></div></TwoColumn></PageFrame>;
}
