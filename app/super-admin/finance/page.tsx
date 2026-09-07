'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import ProtectedRoute from '@/app/components/ProtectedRoute';
import { getAuthHeader } from '@/app/super-admin/_lib/getAuthHeader';
import {
  SuperAdminMetricCard, SuperAdminMetricGrid, SuperAdminNotice, SuperAdminPage,
  SuperAdminPageHeader, SuperAdminSectionCard, SuperAdminUnavailableState,
} from '@/app/super-admin/_components/SuperAdminEnterprisePrimitives';

const REQUEST_TIMEOUT_MS = 12_000;
type WeeklyEarning = { date: string; amount: number };
type RevenueSummary = { totalRevenue:number; totalInvoiced:number; paymentStatusRate:number; paidInvoices:number; totalInvoices:number; unpaidAmount:number; todayRevenue:number; pendingInvoices:number; weeklyEarnings:WeeklyEarning[] };
type InvoiceSummary = { total:number; draft:number; sent:number; overdue:number; paid:number; disputed:number; cancelled:number; totalAmount:number; paidAmount:number; unpaidAmount:number };
type PaymentsSummary = { total:number; totalAmount:number };
type FeesSummary = { totalVatCollected:number; totalNetRevenue:number; paidInvoices:number; totalInvoices:number };
type FinanceSnapshot = { refreshedAt:string; currency:string; revenue:RevenueSummary; invoices:InvoiceSummary; payments:PaymentsSummary; fees:FeesSummary };

const numeric = (value: unknown) => typeof value === 'number' && Number.isFinite(value);
const isFinanceSnapshot = (value: unknown): value is FinanceSnapshot => {
  if (!value || typeof value !== 'object') return false;
  const row=value as Record<string,unknown>, revenue=row.revenue as Record<string,unknown>|undefined, invoices=row.invoices as Record<string,unknown>|undefined;
  const payments=row.payments as Record<string,unknown>|undefined, fees=row.fees as Record<string,unknown>|undefined;
  return Boolean(typeof row.refreshedAt==='string' && typeof row.currency==='string' && revenue && invoices && payments && fees
    && ['totalRevenue','totalInvoiced','paymentStatusRate','paidInvoices','totalInvoices','unpaidAmount','todayRevenue','pendingInvoices'].every((key)=>numeric(revenue[key]))
    && Array.isArray(revenue.weeklyEarnings) && revenue.weeklyEarnings.every((item)=>item&&typeof item==='object'&&typeof (item as Record<string,unknown>).date==='string'&&numeric((item as Record<string,unknown>).amount))
    && ['total','draft','sent','overdue','paid','disputed','cancelled','totalAmount','paidAmount','unpaidAmount'].every((key)=>numeric(invoices[key]))
    && ['total','totalAmount'].every((key)=>numeric(payments[key])) && ['totalVatCollected','totalNetRevenue','paidInvoices','totalInvoices'].every((key)=>numeric(fees[key])));
};
export default function FinanceOverviewPage() {
  const [snapshot,setSnapshot]=useState<FinanceSnapshot|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState<string|null>(null);
  const generationRef=useRef(0);
  const load=useCallback(async()=>{
    const generation=++generationRef.current; setLoading(true); setError(null); setSnapshot(null);
    const controller=new AbortController(); const timeout=window.setTimeout(()=>controller.abort(),REQUEST_TIMEOUT_MS);
    try {
      const auth=await getAuthHeader(); if(generation!==generationRef.current)return;
      if(!auth){setError('No active Platform Owner session.');return;}
      const response=await fetch('/api/super-admin/finance/summary',{headers:{Authorization:auth},signal:controller.signal,cache:'no-store'});
      const body=await response.json().catch(()=>({})); if(generation!==generationRef.current)return;
      if(!response.ok){setError((body as {error?:string}).error??`Finance summary unavailable (${response.status}).`);return;}
      if(!isFinanceSnapshot(body)){setError('Finance service returned an incomplete snapshot. No monetary values were inferred.');return;}
      setSnapshot(body);
    } catch(err) { if(generation!==generationRef.current)return; setError(err instanceof DOMException&&err.name==='AbortError'?'Finance summary timed out. No stale values are being shown.':'Finance overview could not be loaded.'); }
    finally { window.clearTimeout(timeout); if(generation===generationRef.current)setLoading(false); }
  },[]);
  useEffect(()=>{void load(); return()=>{generationRef.current+=1;};},[load]);

  const money=(value:number)=>{const currency=snapshot?.currency; if(!currency)return 'Unavailable'; try{return new Intl.NumberFormat('en-GB',{style:'currency',currency,minimumFractionDigits:2,maximumFractionDigits:2}).format(value);}catch{return `${currency} ${value.toFixed(2)}`;}};
  const weekly=snapshot?.revenue.weeklyEarnings??[];
  const links=[['/super-admin/finance/control','Trade Control'],['/super-admin/finance/invoices','Invoices'],['/super-admin/finance/payments','Payments'],['/super-admin/finance/revenue','Revenue'],['/super-admin/finance/fees','Financial Breakdown']];
  return <ProtectedRoute allowedRoles={['owner']}><SuperAdminPage>
    <SuperAdminPageHeader eyebrow="Finance" title="Finance Overview" description="Verified platform invoice and settlement intelligence. Missing expense, profit or client-ranking datasets remain explicitly unavailable." meta={snapshot ? <>Verified snapshot {new Date(snapshot.refreshedAt).toLocaleString('en-GB')} · {snapshot.currency}</> : undefined} actions={<button className="sa-button" type="button" onClick={()=>void load()} disabled={loading}>{loading?'Loading…':'Refresh'}</button>} />
    {error ? <SuperAdminUnavailableState title="Finance overview unavailable" description={error} /> : null}
    {!error ? <>
      <SuperAdminMetricGrid>
        <SuperAdminMetricCard label="Today's recorded settlements" value={loading||!snapshot?'—':money(snapshot.revenue.todayRevenue)} tone="success" />
        <SuperAdminMetricCard label="Outstanding exposure" value={loading||!snapshot?'—':money(snapshot.revenue.unpaidAmount)} note={snapshot ? `${snapshot.revenue.pendingInvoices} invoices` : undefined} tone="warning" />
        <SuperAdminMetricCard label="Issued invoice value" value={loading||!snapshot?'—':money(snapshot.revenue.totalInvoiced)} tone="info" />
        <SuperAdminMetricCard label="Recorded paid value" value={loading||!snapshot?'—':money(snapshot.revenue.totalRevenue)} note={snapshot ? `${snapshot.revenue.paidInvoices}/${snapshot.revenue.totalInvoices} paid` : undefined} tone="success" />
        <SuperAdminMetricCard label="Expenses" value="Unavailable" note="No authoritative platform expense ledger" tone="unavailable" />
        <SuperAdminMetricCard label="Profit" value="Unavailable" note="Cannot infer profit without expenses" tone="unavailable" />
      </SuperAdminMetricGrid>
      <SuperAdminSectionCard title="Settlement activity · last 7 days" description="Actual payment-history amounts only; no synthetic trend or forecast.">
        {loading ? <div>Loading verified settlement history…</div> : weekly.length===0 ? <SuperAdminNotice tone="unavailable">No settlement history is available for this period.</SuperAdminNotice> : <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(120px,1fr))',gap:12}}>{weekly.map((item)=><div key={item.date} style={{padding:12,border:'1px solid #d9e1ea',borderRadius:8}}><strong>{money(item.amount)}</strong><div style={{marginTop:6,fontSize:12,color:'#64748b'}}>{new Date(`${item.date}T00:00:00Z`).toLocaleDateString('en-GB',{weekday:'short',day:'2-digit',month:'short'})}</div></div>)}</div>}
      </SuperAdminSectionCard>
      <SuperAdminSectionCard title="Finance workspaces" description="Drill into canonical ledgers and evidence."><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(170px,1fr))',gap:12}}>{links.map(([href,label])=><Link key={href} href={href} data-card="enterprise" style={{padding:14,border:'1px solid #d9e1ea',borderRadius:8,textDecoration:'none',fontWeight:800,color:'#0b2f6b',background:'#fff'}}>{label}</Link>)}</div></SuperAdminSectionCard>
      <SuperAdminNotice tone="info">Top Clients remains unavailable until an authoritative ranked client dataset exists. No ranking is fabricated.</SuperAdminNotice>
    </> : null}
  </SuperAdminPage></ProtectedRoute>;
}
