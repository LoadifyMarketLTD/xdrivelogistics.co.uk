import './LiveInvoices.css';
import { useEffect, useState } from 'react';
import { renewSession, type LiveSession } from './liveApi';

type Invoice = { id: string; invoice_number?: string; job_ref?: string; client_name?: string; status?: string; payment_status?: string; amount?: number; currency?: string; due_date?: string };
type Props = { session: LiveSession; onSession: (session: LiveSession) => void };
const base = import.meta.env.PROD ? '/api/driver' : '/xdrive-api/driver';
export default function LiveInvoices({ session, onSession }: Props) {
  const [rows, setRows] = useState<Invoice[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [previewBusy, setPreviewBusy] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const current = await renewSession(session);
        if (!cancelled) onSession(current);
        const response = await fetch(`${base}/finance/invoices?view=receivables`, { headers: { Authorization: `Bearer ${current.token}` } });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || `Invoice request failed (${response.status})`);
        if (!cancelled) setRows(Array.isArray(result.rows) ? result.rows : []);
      } catch (reason) {
        if (!cancelled) setError(reason instanceof Error ? reason.message : 'Could not load invoices');
      } finally { if (!cancelled) setBusy(false); }
    })();
    return () => { cancelled = true; };
  }, []);
  async function previewPdf(invoiceId: string) {
    if (previewBusy) return;
    setPreviewBusy(invoiceId); setError('');
    try {
      const current = await renewSession(session); onSession(current);
      const response = await fetch(base + '/finance/invoices/' + encodeURIComponent(invoiceId) + '/preview', { headers: { Authorization: 'Bearer ' + current.token } });
      if (!response.ok) { const body = await response.json().catch(() => ({})); throw new Error(body.error || 'Invoice PDF request failed (' + response.status + ')'); }
      if (!(response.headers.get('content-type') || '').includes('application/pdf')) throw new Error('Server did not return an invoice PDF.');
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement('a'); link.href = url; link.download = 'xdrive-invoice-' + invoiceId + '.pdf'; document.body.appendChild(link); link.click(); link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Invoice PDF could not be downloaded'); }
    finally { setPreviewBusy(null); }
  }
  const money=(row:Invoice)=>new Intl.NumberFormat('en-GB',{style:'currency',currency:row.currency||'GBP'}).format(Number(row.amount||0));
  const date=(value?:string)=>value?new Date(value+'T12:00:00').toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}):'Not set';
  return <section className="xdi-finance" aria-label="Live invoices">
    <header className="xdi-finance-header"><div><span className="xdi-eyebrow">XDRIVE FINANCE</span><h2>Invoices</h2><p>Invoice history and secure A4 documents</p></div><span className="xdi-count">{rows.length} invoices</span></header>
    <div className="xdi-finance-notice">Existing invoice PDFs are available to download. Issuing and emailing new invoices will be enabled after delivery-flow verification.</div>
    {busy&&<p role="status" className="xdi-message">Loading invoices…</p>}
    {error&&<p role="alert" className="xdi-error">{error}</p>}
    {!busy&&!error&&rows.length===0&&<p className="xdi-message">No invoices found for this account.</p>}
    <div className="xdi-invoice-list">{!busy&&rows.map(row=><article key={row.id} className="xdi-invoice-card">
      <div className="xdi-invoice-top"><div><span className="xdi-card-caption">INVOICE</span><h3>{row.invoice_number||'Draft invoice'}</h3></div><strong className="xdi-amount">{money(row)}</strong></div>
      <div className="xdi-statuses"><span className={'xdi-status '+(row.status?.toLowerCase()==='sent'?'xdi-sent':'')}>{row.status||'Unknown status'}</span><span className={'xdi-status '+(row.payment_status?.toLowerCase()==='paid'?'xdi-paid':'xdi-unpaid')}>{row.payment_status?.toLowerCase()==='paid'?'Paid':row.payment_status||'Payment unknown'}</span></div>
      <div className="xdi-invoice-meta"><div><span>Customer</span><strong>{row.client_name||'Not provided'}</strong></div><div><span>Payment due</span><strong>{date(row.due_date)}</strong></div><div className="xdi-job"><span>Job reference</span><strong>{row.job_ref||'Not linked'}</strong></div></div>
      <button type="button" className="xdi-download" disabled={previewBusy!==null} onClick={()=>void previewPdf(row.id)}><span aria-hidden="true">↓</span> {previewBusy===row.id?'Preparing PDF…':'Download Invoice PDF'} <span aria-hidden="true">↗</span></button>
    </article>)}</div>
  </section>;
}
