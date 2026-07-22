'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import PodDocumentsPage from '../components/workspace/PodDocumentsPage';
import { useCompanyWorkspaceData } from '../components/workspace/useCompanyWorkspaceData';
import { ActionButton, DataTable, EmptyState, KpiCard, KpiGrid, PageFrame, PageHeader, Panel, StatusBadge } from '../components/workspace/WorkspaceUI';
import { currentStatus, invoiceStatus, isInvoiceOverdue, lifecycleLabel, money, routeLabel } from './BrokerDashboardView';

export function BrokerPodPage(){return <PodDocumentsPage mode="broker"/>}

export function BrokerInvoicesPage({type}:{type:'customer'|'carrier'}){
 const data=useCompanyWorkspaceData(); const router=useRouter();
 const rows=data.invoices.filter((invoice)=>type==='customer'?invoice.company_id===data.companyId:invoice.buyer_company_id===data.companyId);
 const counts=useMemo(()=>({paid:rows.filter((invoice)=>invoiceStatus(invoice)==='paid').length,unpaid:rows.filter((invoice)=>invoiceStatus(invoice)!=='paid').length,overdue:rows.filter(isInvoiceOverdue).length}),[rows]);
 return <PageFrame><PageHeader eyebrow="Broker finance" title={type==='customer'?'Customer Invoices':'Carrier Costs'} description={type==='customer'?'Persisted customer invoices linked to broker-managed jobs.':'Persisted carrier invoices and agreed transport costs payable by the broker.'}/><KpiGrid><KpiCard label="Paid" value={counts.paid} tone="green"/><KpiCard label="Unpaid" value={counts.unpaid} tone="orange"/><KpiCard label="Overdue" value={counts.overdue} tone="red"/></KpiGrid><Panel title={type==='customer'?'Customer invoice register':'Carrier cost register'}><DataTable columns={['Invoice','Job','Counterparty','Amount','Due','Payment status','Action']} rows={rows.map((invoice)=>{const job=invoice.job_id?data.jobs.find((item)=>item.id===invoice.job_id):undefined;return [invoice.invoice_number??invoice.id.slice(0,8),job?<span key="job"><strong style={{display:'block'}}>{job.id.slice(0,8).toUpperCase()}</strong><small>{routeLabel(job)}</small></span>:invoice.job_id?.slice(0,8).toUpperCase()??'—',invoice.client_name??(type==='customer'?'Customer':'Carrier'),money(Number(invoice.amount??0)),invoice.due_date?new Date(invoice.due_date).toLocaleDateString('en-GB'):'Not set',<StatusBadge key="status" value={isInvoiceOverdue(invoice)?'Overdue':lifecycleLabel(invoiceStatus(invoice))} tone={isInvoiceOverdue(invoice)?'red':undefined}/>,invoice.job_id?<ActionButton key="action" tone="secondary" onClick={()=>router.push(`/broker/jobs?job=${invoice.job_id}`)}>Open job</ActionButton>:'—'];})} empty={<EmptyState title={type==='customer'?'No customer invoices':'No carrier costs'}/>} /></Panel></PageFrame>;
}

export function BrokerMarginsPage(){
 const data=useCompanyWorkspaceData();
 const rows=data.jobs.map((job)=>{const accepted=data.bids.find((bid)=>bid.job_id===job.id&&bid.status==='accepted');const revenue=Number(job.budget_amount??0);const hasCost=Boolean(accepted&&(accepted.bid_price_gbp!=null||accepted.amount!=null));const cost=hasCost?Number(accepted?.bid_price_gbp??accepted?.amount??0):null;const margin=cost==null?null:revenue-cost;const pct=margin!=null&&revenue>0?(margin/revenue)*100:null;return{job,revenue,cost,margin,pct};});
 const complete=rows.filter((row)=>row.cost!=null);
 return <PageFrame><PageHeader eyebrow="Broker finance" title="Margin / Profit" description="Margin is shown only where both persisted customer revenue and an accepted carrier cost exist."/><KpiGrid><KpiCard label="Priced jobs" value={complete.length} tone="blue"/><KpiCard label="Customer revenue" value={money(complete.reduce((sum,row)=>sum+row.revenue,0))}/><KpiCard label="Carrier cost" value={money(complete.reduce((sum,row)=>sum+(row.cost??0),0))} tone="orange"/><KpiCard label="Gross profit" value={money(complete.reduce((sum,row)=>sum+(row.margin??0),0))} tone="green"/></KpiGrid><Panel title="Job margin register"><DataTable columns={['Load','Customer','Lifecycle','Revenue','Carrier cost','Gross profit','Margin']} rows={rows.map(({job,revenue,cost,margin,pct})=>[job.id.slice(0,8).toUpperCase(),job.client_name??'Customer',<StatusBadge key="status" value={lifecycleLabel(currentStatus(job))}/>,money(revenue),cost==null?'Not available':money(cost),margin==null?'Not available':money(margin),pct==null?'Not available':`${pct.toFixed(1)}%`])} empty={<EmptyState title="No broker-managed jobs"/>}/></Panel></PageFrame>;
}
