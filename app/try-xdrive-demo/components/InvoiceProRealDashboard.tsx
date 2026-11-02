'use client';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../components/AuthContext';
import { supabase, isSupabaseConfigured } from '../../../lib/supabaseClient';
import { loadInvoicesWithSchemaCompat } from '../../../lib/supabaseSchemaCompat';
import { toInvoiceProPresentation, type InvoiceProPresentationRecord } from '../../../lib/invoiceProPresentationAdapter';
import './invoice-pro-real.css';

export default function InvoiceProRealDashboard() {
 const { user } = useAuth();
 const companyId = user?.companyId ?? null;
 const [invoices, setInvoices] = useState<InvoiceProPresentationRecord[]>([]);
 const [error, setError] = useState('');
 const [loading, setLoading] = useState(true);
 const [filter, setFilter] = useState('All');
 const [query, setQuery] = useState('');
 useEffect(() => {
  let active = true;
  async function load() {
   setLoading(true); setError(''); setInvoices([]);
   if (!companyId || !isSupabaseConfigured) {setLoading(false);setError(companyId ? 'Invoice service is not configured.' : 'Sign in to access company invoices.');return;}
   const { rows, error: failure } = await loadInvoicesWithSchemaCompat(supabase, companyId, ['id','invoice_number','job_ref','invoice_date','client_name','client_email','amount','net_amount','vat_rate','vat_amount','due_date','status','pickup_location','delivery_location']);
   if (!active) return;
   if (failure) {setError('Unable to load your company invoices.');setLoading(false);return;}
   try {setInvoices(rows.map(row => toInvoiceProPresentation(row as unknown as Parameters<typeof toInvoiceProPresentation>[0])));}
   catch {setError('Some invoice records are incomplete; no data was changed.');}
   setLoading(false);
  }
  void load();
  return () => {active=false;};
 }, [companyId]);
 const filtered = useMemo(() => invoices.filter(i => (filter==='All' || i.status.toLowerCase()===filter.toLowerCase()) && [i.invoiceNo,i.jobRef,i.clientName].join(' ').toLowerCase().includes(query.toLowerCase())),[invoices,filter,query]);
 const money = (n:number) => new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP'}).format(n);
 return <section className="xip-workspace">
  <div className="xip-appbar"><strong>XDrive <span>Invoice Pro</span></strong><small>Company finance · live records</small></div>
  <div className="xip-wrap"><h1>Finance Dashboard</h1><p>Real invoices from your company account</p>
   <div className="xip-metrics"><article><small>Invoices</small><strong>{invoices.length}</strong></article><article><small>Invoiced</small><strong>{money(invoices.reduce((sum,i)=>sum+i.total,0))}</strong></article><article><small>Paid</small><strong>{money(invoices.filter(i=>i.status.toLowerCase()==='paid').reduce((sum,i)=>sum+i.total,0))}</strong></article><article><small>Outstanding</small><strong>{money(invoices.filter(i=>['sent','issued','overdue'].includes(i.status.toLowerCase())).reduce((sum,i)=>sum+i.total,0))}</strong></article></div>
   <div className="xip-panel"><h2>My Documents</h2><div className="xip-tabs">{['All','Draft','Sent','Paid','Overdue','Disputed','Cancelled'].map(t=><button key={t} className={filter===t?'active':''} onClick={()=>setFilter(t)}>{t}</button>)}</div><input aria-label="Search invoices" placeholder="Search by customer, job ref or invoice number" value={query} onChange={e=>setQuery(e.target.value)}/>
   {loading?<p>Loading company invoices…</p>:error?<p role="alert">{error}</p>:filtered.length===0?<p>No matching invoices in your account.</p>:<div className="xip-table-wrap"><table><thead><tr><th>Invoice</th><th>Customer</th><th>Job ref</th><th>Issued</th><th>Due</th><th>Net</th><th>VAT</th><th>Total</th><th>Status</th></tr></thead><tbody>{filtered.map((i,index)=><tr key={`${i.invoiceNo}-${index}`}><td>{i.invoiceNo}</td><td>{i.clientName}</td><td>{i.jobRef}</td><td>{i.invoiceDate}</td><td>{i.dueDate||'—'}</td><td>{money(i.amount)}</td><td>{money(i.vat)}</td><td><strong>{money(i.total)}</strong></td><td>{i.status}</td></tr>)}</tbody></table></div>}</div>
   <p className="xip-note">Read-only real invoice register. Issue, send and payment actions will be enabled after authenticated workflow verification.</p>
  </div>
 </section>;
}
