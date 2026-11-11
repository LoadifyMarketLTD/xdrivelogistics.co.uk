'use client';

import { useEffect, useMemo, useState } from 'react';
import { useCompanyWorkspaceData } from './useCompanyWorkspaceData';
import { classifyWorkspaceJobStage } from '../../../lib/jobs/workspaceJobStage';
import { AlertBanner } from './WorkspaceUI';
import {readRouteAuthAccessToken} from '../../../lib/routeAuthCookie';
import '../../try-xdrive-demo/components/demo-reports-board.css';

type ReportTab = 'Overview' | 'Loads' | 'Quotes' | 'Bookings' | 'Invoices';
type VerifiedFinanceInvoice={id:string;job_id:string|null;invoice_number:string|null;status:string;amount:number;currency:string;invoice_date:string|null};
const sectionTabs: ReportTab[] = ['Overview','Loads','Quotes','Bookings','Invoices'];
const labelDate = (value: string | null) => value ? new Date(value).toLocaleDateString('en-GB') : 'Not supplied';

export default function MemberOperationalReports({ role,includeDriverFinance=false }: { role:'carrier'|'customer'|'broker';includeDriverFinance?:boolean }) {
  const data = useCompanyWorkspaceData();
  const [section,setSection] = useState<ReportTab>('Overview');
  const [period,setPeriod] = useState('30');
  const [driverFinance,setDriverFinance]=useState<VerifiedFinanceInvoice[]|null>(null);
  const [driverFinancePartial,setDriverFinancePartial]=useState(true);
  useEffect(()=>{
    if(!includeDriverFinance||!data.companyId){setDriverFinance(null);return;}
    let active=true;
    const load=async()=>{
      const token=readRouteAuthAccessToken();
      if(!token)return;
      try{
        const response=await fetch('/api/driver/finance/invoices?view=receivables&limit=500',{headers:{Authorization:`Bearer ${token}`},cache:'no-store'});
        if(!response.ok)return;
        const body=await response.json() as {rows?:VerifiedFinanceInvoice[];invoiceSummary?:{total?:number}};
        if(active&&Array.isArray(body.rows)&&body.rows.length===body.invoiceSummary?.total){
          setDriverFinance(body.rows);setDriverFinancePartial(false);
        }
      }catch{/* Unverified data stays unavailable; no fabricated totals. */}
    };
    setDriverFinance(null);setDriverFinancePartial(true);void load();
    return()=>{active=false;};
  },[includeDriverFinance,data.companyId]);
  const cutoff = useMemo(() => period === 'all' ? null : Date.now() - Number(period)*86_400_000, [period]);

  const jobs = useMemo(() => data.jobs.filter((job) => !cutoff || (Date.parse(job.created_at) >= cutoff)), [data.jobs,cutoff]);
  const jobIds = useMemo(() => new Set(jobs.map((job) => job.id)),[jobs]);
  const bids = useMemo(() => data.bids.filter((bid) => jobIds.has(bid.job_id)),[data.bids,jobIds]);
  const invoices = useMemo(() => {
    if(includeDriverFinance && driverFinance)return driverFinance.filter(invoice=>!cutoff || (invoice.invoice_date!=null && Date.parse(invoice.invoice_date)>=cutoff));
    return data.invoices.filter((invoice) => invoice.job_id && jobIds.has(invoice.job_id));
  },[includeDriverFinance,driverFinance,cutoff,data.invoices,jobIds]);

  const verified = (key:'jobs'|'bids'|'invoices') => data.companyId != null && data.datasets[key].availability === 'available'
    && !data.datasets[key].partialData && !data.datasets[key].limitedData && !data.error && !data.loading;
  const jobsVerified = verified('jobs');
  const bidsVerified = verified('bids');
  const invoicesVerified = includeDriverFinance ? driverFinance!==null && !driverFinancePartial : verified('invoices');
  const assigned = jobs.filter((job) => ['awarded','allocated','in_progress','completed'].includes(classifyWorkspaceJobStage(job)));
  const completed = jobs.filter((job) => classifyWorkspaceJobStage(job)==='completed');
  const open = jobs.filter((job) => classifyWorkspaceJobStage(job)==='open');
  const cancelled = jobs.filter((job) => classifyWorkspaceJobStage(job)==='cancelled');
  const invoiceCurrencySet = new Set(invoices.map((invoice) => invoice.currency || 'GBP'));
  const totalBilled = invoicesVerified && invoiceCurrencySet.size===1
    ? invoices.reduce((sum,invoice) => sum + Number(invoice.amount ?? 0),0) : null;
  const invoiceCurrency = [...invoiceCurrencySet][0] || 'GBP';
  const money = (amount:number|null) => {
    if(amount===null)return 'Unavailable';
    try{return new Intl.NumberFormat('en-GB',{style:'currency',currency:invoiceCurrency}).format(amount);}
    catch{return 'Unavailable';}
  };
  const metrics = [
    ['Total Loads',jobsVerified?jobs.length:'Unavailable','#f97316'],
    ['Quotes',jobsVerified&&bidsVerified?bids.length:'Unavailable','#176de5'],
    ['Bookings',jobsVerified?assigned.length:'Unavailable','#16a34a'],
    ['Completed',jobsVerified?completed.length:'Unavailable','#176de5'],
    ['Issued Invoices',invoicesVerified?invoices.filter((invoice)=>!['draft','pending','void','cancelled'].includes(invoice.status.toLowerCase())).length:'Unavailable','#f59e0b'],
    ['Recorded Invoice Value',money(totalBilled),'#176de5'],
  ] as const;
  const statusRows = [
    ['Open',open.length],['Awarded/Active',assigned.length],['Completed',completed.length],['Cancelled',cancelled.length]
  ] as const;
  const title = section === 'Loads' ? 'Load records' : section === 'Quotes' ? 'Quotation records' : section === 'Bookings' ? 'Booking records' : 'Invoice records';

  return <section className="xd-reports" data-source="verified-company-workspace">
    <header className="xd-reports-head">
      <div><h1>Reports</h1><p>{includeDriverFinance?'Owner Driver':role==='broker'?'Broker':role==='customer'?'Customer':'Company / Carrier'} · verified company records</p></div>
      <div className="xd-reports-actions">
        <label>Reporting period <select aria-label="Reporting period" value={period} onChange={(event)=>setPeriod(event.target.value)}>
          <option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option><option value="all">All available records</option>
        </select></label>
        <button type="button" onClick={()=>void data.refresh()} disabled={data.loading}>Refresh</button>
      </div>
    </header>
    {data.error ? <AlertBanner tone="danger">{data.error}</AlertBanner> : null}
    {(data.loading || !jobsVerified || !bidsVerified || !invoicesVerified) &&
      <AlertBanner tone="warning">Some reporting datasets are loading, unavailable or partial. Unverified totals are not presented as zero. Historical results depend on accessible records.</AlertBanner>}
    <div className="xd-reports-metrics">
      {metrics.map(([name,value,color])=><article key={name} style={{borderLeftColor:color}}><div><b>{name}</b><strong>{value}</strong><small>Recorded company data</small></div></article>)}
    </div>
    <nav className="xd-reports-tabs" aria-label="Report categories">
      {sectionTabs.map((tab)=><button key={tab} type="button" className={section===tab?'active':''} onClick={()=>setSection(tab)}>{tab}</button>)}
    </nav>
    {section==='Overview'?<div className="xd-reports-grid">
      <article className="xd-reports-panel"><h2>Job activity</h2>{jobsVerified
        ? <div className="xd-reports-bars">{statusRows.map(([name,count])=><div key={name}><span>{name}</span><div><i style={{width:(jobs.length ? count/jobs.length*100 : 0)+'%'}}/></div><b>{count}</b></div>)}</div>
        : <p>Verified job activity unavailable.</p>}</article>
      <article className="xd-reports-panel"><h2>Billing evidence</h2>
        <p>Issued invoice records: {invoicesVerified?invoices.filter((invoice)=>!['draft','pending','void','cancelled'].includes(invoice.status.toLowerCase())).length:'Unavailable'}</p>
        <p>Gross recorded invoice value: {money(totalBilled)}</p>
        <small>No indicative VAT or invented revenue figures are included. Refer to Invoices for exact commercial status.</small>
      </article>
      <article className="xd-reports-panel"><h2>Report quality</h2>
        <p>Jobs: {jobsVerified?'Verified':'Unavailable / Partial'}</p>
        <p>Quotes: {bidsVerified?'Verified':'Unavailable / Partial'}</p>
        <p>Invoices: {invoicesVerified?'Verified':'Unavailable / Partial'}</p>
      </article>
    </div>:
    <div className="xd-reports-panel xd-reports-detail"><h2>{title}</h2>
      <div style={{overflowX:'auto'}}><table><thead><tr>
        {(section==='Invoices'?['Invoice','Job','Status','Amount','Issued']:section==='Quotes'?['Quote','Job','Status','Amount','Date']:['Job','Route','Status','Vehicle','Date']).map((column)=><th key={column}>{column}</th>)}
      </tr></thead><tbody>
        {section==='Invoices'&&invoicesVerified&&invoices.map((invoice)=><tr key={invoice.id}>
          <td>{invoice.invoice_number||invoice.id.slice(0,8)}</td><td>{invoice.job_id?.slice(0,8)||'Not linked'}</td><td>{invoice.status}</td>
          <td>{invoice.currency===invoiceCurrency||!invoice.currency?money(Number(invoice.amount??0)):'Mixed currency'}</td><td>{labelDate(invoice.invoice_date||null)}</td></tr>)}
        {section==='Quotes'&&bidsVerified&&bids.map((bid)=><tr key={bid.id}>
          <td>{bid.id.slice(0,8)}</td><td>{bid.job_id.slice(0,8)}</td><td>{bid.status}</td><td>{bid.bid_price_gbp??bid.amount??'Not supplied'}</td><td>{labelDate(bid.created_at)}</td></tr>)}
        {(section==='Loads'||section==='Bookings')&&jobsVerified&&jobs.filter((job)=>section==='Loads'||['awarded','allocated','in_progress','completed'].includes(classifyWorkspaceJobStage(job))).map((job)=><tr key={job.id}>
          <td>XDL-{job.id.slice(0,8).toUpperCase()}</td><td>{job.pickup_location||job.pickup_postcode||'Not supplied'} → {job.delivery_location||job.delivery_postcode||'Not supplied'}</td>
          <td>{job.current_status||job.status}</td><td>{job.vehicle_type||'Not supplied'}</td><td>{labelDate(job.created_at)}</td>
        </tr>)}
      </tbody></table></div>
    </div>}
    <footer className="xd-reports-footnote">Values are limited to verified company-accessible records. No cross-company totals, estimated rates or artificial VAT calculations.</footer>
  </section>;
}
