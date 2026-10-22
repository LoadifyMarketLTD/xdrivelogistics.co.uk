'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { readRouteAuthAccessToken } from '../../../../lib/routeAuthCookie';

type Invoice = {
  id: string; invoice_number?: string | null; job_ref?: string | null;
  status?: string | null; payment_status?: string | null;
  total?: number | string | null; amount?: number | string | null;
  currency?: string | null; created_at?: string | null; due_date?: string | null;
};
type Resources = {
  driver?: { driver_type?: string | null; can_commercial_bid?: boolean } | null;
  invoices?: Invoice[]; partial?: string[];
};
function dateLabel(value?: string | null) {
  return value && !Number.isNaN(Date.parse(value))
    ? new Date(value).toLocaleDateString('en-GB', { dateStyle: 'medium' }) : 'Not specified';
}
function money(invoice: Invoice) {
  const raw = invoice.total ?? invoice.amount;
  const value = raw === null || raw === undefined || raw === '' ? NaN : Number(raw);
  return Number.isFinite(value)
    ? new Intl.NumberFormat('en-GB', { style: 'currency', currency: invoice.currency || 'GBP' }).format(value)
    : 'Amount unavailable';
}
export default function MobileOwnerDriverFinance() {
  const [resources, setResources] = useState<Resources | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const refresh = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const token = readRouteAuthAccessToken();
      if (!token) throw new Error('Please sign in to view your invoices.');
      const response = await fetch('/api/driver/web/resources', {
        headers: { Authorization: `Bearer ${token}` }, cache: 'no-store',
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Finance records are unavailable.');
      setResources(result.resources ?? null);
    } catch (reason) {
      setResources(null);
      setError(reason instanceof Error ? reason.message : 'Unable to load finance records.');
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  const isOwner = resources?.driver?.driver_type?.toLowerCase() === 'owner_driver';
  const canView = isOwner && resources?.driver?.can_commercial_bid === true;
  const invoices = Array.isArray(resources?.invoices) ? resources.invoices : [];

  return <section className="xd-mobile-list">
    <header><Link className="xd-mobile-back" href="/m/driver/more">← More</Link>
      <h1>My finance</h1><p>Owner Driver invoices and payment status</p></header>
    {loading ? <p role="status">Loading invoices...</p> : null}
    {error ? <div role="alert" className="xd-mobile-error"><p>{error}</p>
      <button type="button" onClick={() => void refresh()}>Retry</button></div> : null}
    {!loading && resources && !canView ? <div className="xd-mobile-card" role="status">
      Finance is available to eligible Owner Drivers only. Company Drivers cannot issue invoices.
    </div> : null}
    {!loading && canView ? <>
      {resources?.partial?.includes('invoices')
        ? <p role="alert" className="xd-mobile-error">Invoice records are temporarily unavailable. Please retry.</p>
        : invoices.length === 0 ? <p>No invoices issued yet.</p>
          : invoices.map(invoice => <article className="xd-mobile-card" key={invoice.id}>
            <div className="xd-mobile-card__top"><strong>{invoice.invoice_number || 'Invoice'}</strong>
              <span className="xd-mobile-pill">{invoice.payment_status || invoice.status || 'Pending'}</span></div>
            {invoice.job_ref ? <p>Job: {invoice.job_ref}</p> : null}
            <p><strong>{money(invoice)}</strong></p>
            <p>Issued: {dateLabel(invoice.created_at)}</p>
            <p>Due: {dateLabel(invoice.due_date)}</p>
          </article>)}
      <article className="xd-mobile-card">
        <p>Invoice creation and amendments remain in the secure Owner Driver workspace, after POD.</p>
        <Link href="/driver/finance">Open full finance workspace</Link>
      </article>
    </> : null}
  </section>;
}
