'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import ProtectedRoute from '@/app/components/ProtectedRoute';
import { getAuthHeader } from '@/app/super-admin/_lib/getAuthHeader';

const T={pageBg:'#F4F6F8',cardBg:'#FFFFFF',cardBorder:'#D9E1EA',text:'#1A1F2B',heading:'#0B2F6B',muted:'#64748B',accent:'#F5A300',green:'#16A34A',red:'#DC2626',blue:'#1D57D8'} as const;
const REQUEST_TIMEOUT_MS=12_000;

type RevenueSummary={totalRevenue:number;totalInvoiced:number;paymentStatusRate:number;paidInvoices:number;totalInvoices:number;unpaidAmount:number;};
type InvoiceSummary={total:number;draft:number;sent:number;overdue:number;paid:number;disputed:number;cancelled:number;totalAmount:number;paidAmount:number;unpaidAmount:number;};
type PaymentsSummary={total:number;totalAmount:number;};
type FeesSummary={totalVatCollected:number;totalNetRevenue:number;paidInvoices:number;totalInvoices:number;};
type FinanceSnapshot={refreshedAt:string;currency:string;revenue:RevenueSummary;invoices:InvoiceSummary;payments:PaymentsSummary;fees:FeesSummary;};

const numeric=(value:unknown)=>typeof value==='number'&&Number.isFinite(value);
const isFinanceSnapshot=(value:unknown):value is FinanceSnapshot=>{
 if(!value||typeof value!=='object')return false;const row=value as Record<string,unknown>;
 if(typeof row.refreshedAt!=='string'||typeof row.currency!=='string')return false;
 const revenue=row.revenue as Record<string,unknown>|undefined;const invoices=row.invoices as Record<string,unknown>|undefined;const payments=row.payments as Record<string,unknown>|undefined;const fees=row.fees as Record<string,unknown>|undefined;
 return Boolean(revenue&&invoices&&payments&&fees
  &&['totalRevenue','totalInvoiced','paymentStatusRate','paidInvoices','totalInvoices','unpaidAmount'].every((key)=>numeric(revenue[key]))
  &&['total','draft','sent','overdue','paid','disputed','cancelled','totalAmount','paidAmount','unpaidAmount'].every((key)=>numeric(invoices[key]))
  &&['total','totalAmount'].every((key)=>numeric(payments[key]))
  &&['totalVatCollected','totalNetRevenue','paidInvoices','totalInvoices'].every((key)=>numeric(fees[key])));
};

export default function FinanceOverviewPage(){
 const[snapshot,setSnapshot]=useState<FinanceSnapshot|null>(null);const[loading,setLoading]=useState(true);const[error,setError]=useState<string|null>(null);const generationRef=useRef(0);
 const load=useCallback(async()=>{const generation=++generationRef.current;setLoading(true);setError(null);setSnapshot(null);const controller=new AbortController();const timeout=window.setTimeout(()=>controller.abort(),REQUEST_TIMEOUT_MS);try{const auth=await getAuthHeader();if(generation!==generationRef.current)return;if(!auth){setError('No active Platform Owner session.');return;}const response=await fetch('/api/super-admin/finance/summary',{headers:{Authorization:auth},signal:controller.signal,cache:'no-store'});const body=await response.json().catch(()=>({}));if(generation!==generationRef.current)return;if(!response.ok){setError((body as {error?:string}).error??`Finance summary unavailable (${response.status}).`);return;}if(!isFinanceSnapshot(body)){setError('Finance service returned an incomplete snapshot. No monetary values were inferred.');return;}setSnapshot(body);}catch(err){if(generation!==generationRef.current)return;setError(err instanceof DOMException&&err.name==='AbortError'?'Finance summary timed out. No stale values are being shown.':'Finance overview could not be loaded.');}finally{window.clearTimeout(timeout);if(generation===generationRef.current)setLoading(false);}},[]);
 useEffect(()=>{void load();return()=>{generationRef.current+=1;};},[load]);
 const money=(value:number)=>new Intl.NumberFormat('en-GB',{style:'currency',currency:snapshot?.currency||'GBP',minimumFractionDigits:2,maximumFractionDigits:2}).format(value);
 const cards=snapshot?[
  {label:'Issued invoice value',value:money(snapshot.revenue.totalInvoiced),note:`${snapshot.revenue.totalInvoices} issued invoices`,color:T.blue},
  {label:'Recorded paid',value:money(snapshot.revenue.totalRevenue),note:`${snapshot.revenue.paidInvoices} fully paid invoices`,color:T.green},
  {label:'Outstanding',value:money(snapshot.revenue.unpaidAmount),note:'Collectible outstanding after recorded settlements',color:T.accent},
  {label:'Payment rate',value:`${snapshot.revenue.paymentStatusRate}%`,note:'Paid value / issued invoice value',color:T.blue},
  {label:'VAT collected',value:money(snapshot.fees.totalVatCollected),note:'Fully paid invoices only',color:T.green},
  {label:'Net revenue',value:money(snapshot.fees.totalNetRevenue),note:'Fully paid invoices only',color:T.heading},
 ]:[];
 const sections=snapshot?[
  {href:'/super-admin/finance/invoices',title:'Invoices',text:'All invoices, lifecycle, payment status and due dates.',meta:`${snapshot.invoices.total} records`,color:T.blue},
  {href:'/super-admin/finance/payments',title:'Payments',text:'Recorded settlement history and external references.',meta:money(snapshot.payments.totalAmount),color:T.green},
  {href:'/super-admin/finance/revenue',title:'Revenue',text:'Issued value, paid value and payment completion rate.',meta:money(snapshot.revenue.totalRevenue),color:T.accent},
  {href:'/super-admin/finance/fees',title:'Financial Breakdown',text:'Net values, VAT and invoice-level financial evidence.',meta:money(snapshot.fees.totalVatCollected),color:T.heading},
 ]:[];
 return <ProtectedRoute allowedRoles={['owner']}><div style={{minHeight:'100vh',backgroundColor:T.pageBg,color:T.text,padding:12}}>
  <header style={{minHeight:52,display:'flex',justifyContent:'space-between',gap:12,alignItems:'center',flexWrap:'wrap',marginBottom:12}}><div><div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}><h1 style={{margin:0,color:T.heading,fontSize:20,fontWeight:800}}>Finance Overview</h1><span style={{color:T.blue,background:'#EEF4FF',borderRadius:4,padding:'3px 6px',fontSize:10,fontWeight:800,textTransform:'uppercase'}}>Platform</span></div><p style={{margin:'4px 0 0',color:T.muted,fontSize:12}}>Verified global financial position. Draft and cancelled invoices are excluded from issued value; multiple currencies are never summed into one total.</p>{snapshot&&<div style={{marginTop:3,color:T.muted,fontSize:10}}>Verified snapshot {new Date(snapshot.refreshedAt).toLocaleString('en-GB')} · {snapshot.currency}</div>}</div><button onClick={()=>void load()} disabled={loading} style={{height:32,padding:'0 10px',border:`1px solid ${T.blue}`,borderRadius:4,background:T.blue,color:'#fff',fontWeight:800,fontSize:11}}>{loading?'Loading…':'Refresh'}</button></header>
  {error&&<div role='alert' data-testid='finance-unavailable' style={{marginBottom:12,border:`1px solid ${T.red}`,borderLeft:`4px solid ${T.red}`,borderRadius:4,background:T.cardBg,padding:'9px 12px',color:T.red,fontSize:11,fontWeight:700}}><strong>Finance unavailable.</strong> {error}</div>}
  {!error&&<><section style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(170px,1fr))',gap:12,marginBottom:12}}>{loading?Array.from({length:6},(_,i)=><div key={i} style={{background:T.cardBg,border:`1px solid ${T.cardBorder}`,borderRadius:4,padding:12,minHeight:82}}><div style={{color:T.muted,fontSize:20,fontWeight:900}}>—</div><div style={{color:T.muted,fontSize:10,marginTop:6}}>Loading verified finance…</div></div>):cards.map((card)=><div key={card.label} style={{background:T.cardBg,border:`1px solid ${T.cardBorder}`,borderTop:`3px solid ${card.color}`,borderRadius:4,padding:12}}><div style={{color:T.muted,fontSize:10,fontWeight:700,textTransform:'uppercase'}}>{card.label}</div><div style={{color:card.color,fontSize:20,fontWeight:900,marginTop:4}}>{card.value}</div><div style={{color:T.muted,fontSize:10,marginTop:3}}>{card.note}</div></div>)}</section>
  {!loading&&snapshot&&<section style={{background:T.cardBg,border:`1px solid ${T.cardBorder}`,borderRadius:4,overflow:'hidden'}}><div style={{padding:'10px 12px',borderBottom:`1px solid ${T.cardBorder}`}}><div style={{color:T.heading,fontSize:13,fontWeight:800}}>Finance workspaces</div><div style={{color:T.muted,fontSize:10,marginTop:2}}>Operational ledgers remain separate from the verified global summary.</div></div><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:12,padding:12}}>{sections.map((section)=><Link key={section.href} href={section.href} style={{display:'block',textDecoration:'none',background:'#fff',border:`1px solid ${T.cardBorder}`,borderLeft:`3px solid ${section.color}`,borderRadius:4,padding:10}}><div style={{display:'flex',justifyContent:'space-between',gap:8,alignItems:'baseline'}}><span style={{color:T.heading,fontWeight:800,fontSize:12}}>{section.title}</span><span style={{color:section.color,fontWeight:800,fontSize:11}}>{section.meta}</span></div><div style={{color:T.muted,fontSize:10,lineHeight:1.4,marginTop:4}}>{section.text}</div></Link>)}</div></section>}</>}
 </div></ProtectedRoute>;
}
