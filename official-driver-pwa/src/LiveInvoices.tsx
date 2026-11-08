import { useEffect, useState } from 'react';
import { renewSession, type LiveSession } from './liveApi';

type Invoice = { id: string; invoice_number?: string; job_ref?: string; client_name?: string; status?: string; payment_status?: string; amount?: number; currency?: string; due_date?: string };
type Props = { session: LiveSession; onSession: (session: LiveSession) => void };
const base = import.meta.env.PROD ? '/api/driver' : '/xdrive-api/driver';
export default function LiveInvoices({ session, onSession }: Props) {
  const [rows, setRows] = useState<Invoice[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
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
  return <section className="settings" aria-label="Live invoices">
    <h2>Invoices</h2>
    <p>Authenticated XDrive invoices. Creating, issuing and emailing invoices is unavailable in this PWA until PDF/email delivery is verified.</p>
    {busy && <p role="status">Loading invoices...</p>}
    {error && <p role="alert">{error}</p>}
    {!busy && !error && rows.length === 0 && <p>No invoices found for this company.</p>}
    {!busy && !error && rows.map(row => <article key={row.id} className="booking-detail-group">
      <h3>{row.invoice_number || 'Draft invoice'}</h3>
      <p>Job: {row.job_ref || 'Not linked'} · Client: {row.client_name || 'Not provided'}</p>
      <p>Amount: {new Intl.NumberFormat('en-GB', { style: 'currency', currency: row.currency || 'GBP' }).format(Number(row.amount || 0))}</p>
      <p>Invoice status: {row.status || 'Unknown'} · Payment: {row.payment_status || 'Unknown'}</p>
      {row.due_date && <p>Due: {row.due_date}</p>}
    </article>)}
  </section>;
}
