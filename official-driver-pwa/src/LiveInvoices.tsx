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
  }  return <section className="settings" aria-label="Live invoices">
    <h2>Invoices</h2>
    <p>Authenticated XDrive invoices. Download existing A4 invoice PDFs here. To create an eligible invoice, complete the delivery and POD first, then use Create Invoice in the booking. Issuing and emailing are separate operations.</p>
    {busy && <p role="status">Loading invoices...</p>}
    {error && <p role="alert">{error}</p>}
    {!busy && !error && rows.length === 0 && <p>No invoices found for this company.</p>}
    {!busy && !error && rows.map(row => <article key={row.id} className="booking-detail-group">
      <h3>{row.invoice_number || 'Draft invoice'}</h3>
      <p>Job: {row.job_ref || 'Not linked'} · Client: {row.client_name || 'Not provided'}</p>
      <p>Amount: {new Intl.NumberFormat('en-GB', { style: 'currency', currency: row.currency || 'GBP' }).format(Number(row.amount || 0))}</p>
      <p>Invoice status: {row.status || 'Unknown'} · Payment: {row.payment_status || 'Unknown'}</p>
      {row.due_date && <p>Due: {row.due_date}</p>}
      <button type="button" className="primary" disabled={previewBusy !== null} onClick={() => void previewPdf(row.id)}>{previewBusy === row.id ? "Preparing PDF..." : "Download A4 Invoice PDF"}</button>
    </article>)}
  </section>;
}
