'use client';
import { useCompany3150Live } from './Company3150LiveData';

export default function Company3150LiveInvoices() {
  const live = useCompany3150Live();
  const invoices = live?.data.invoices || [];
  const unavailable = live?.data.datasets.invoices.availability === 'unavailable';
  return (
    <div className="panel">
      <div className="panel-title">
        <h2>Invoices & Earnings</h2>
        <span>DIRECT SETTLEMENT — NO ESCROW</span>
      </div>
      {unavailable && <p role="alert">{live?.data.error || 'Invoice records are currently unavailable.'}</p>}
      {!unavailable && invoices.length === 0 && <p className="muted">No invoices available for this company.</p>}
      {invoices.map(invoice => (
        <div className="ops-invoice" key={invoice.id}>
          <div><strong>{invoice.invoice_number || invoice.id}</strong>
            <small>{invoice.client_name || 'Customer not recorded'} — {invoice.job_id || 'No linked job'}</small>
          </div>
          <strong>{invoice.currency || 'GBP'} {Number(invoice.net_amount ?? invoice.amount ?? 0).toFixed(2)}</strong>
          <span>{invoice.payment_status || invoice.status}</span>
        </div>
      ))}
      <p className="muted">Invoice amounts and payment statuses come from the authenticated company records.</p>
    </div>
  );
}
