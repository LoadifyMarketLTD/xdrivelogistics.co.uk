'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import ProtectedRoute from '@/app/components/ProtectedRoute';
import { getAuthHeader } from '@/app/super-admin/_lib/getAuthHeader';
import PlatformEntityLink from '@/app/super-admin/_components/control-plane/PlatformEntityLink';
import {
  SuperAdminDataGrid, SuperAdminEmptyState, SuperAdminMetricCard, SuperAdminMetricGrid,
  SuperAdminNotice, SuperAdminPage, SuperAdminPageHeader, SuperAdminSectionCard,
  SuperAdminStatusBadge, SuperAdminUnavailableState, type SuperAdminDataColumn,
} from '@/app/super-admin/_components/SuperAdminEnterprisePrimitives';

type Row = {
  id: string; invoice_number: string | null; job_id: string | null; buyer_name: string; supplier_name: string;
  amount: number | null; net_amount: number | null; vat_amount: number | null; currency: string | null;
  paid_amount: number; outstanding_amount: number; due_date: string | null; lifecycle: string;
};
type CurrencySummary = { currency: string; invoices: number; gross: number; net: number; vat: number; paid: number; outstanding: number; overdueCount: number; overdueValue: number; partialPayments: number };
type Summary = { invoices: number; overdueCount: number; partialPayments: number; monetaryTotalsAvailable: boolean; currency: string | null; gross: number | null; net: number | null; vat: number | null; paid: number | null; outstanding: number | null; overdueValue: number | null };
type Payload = { rows: Row[]; summary: Summary; currencyBreakdown: CurrencySummary[]; note?: string; error?: string };
const money = (value: number | null, currency: string | null) => {
  if (value === null || !currency || currency === 'UNSPECIFIED') return 'Unavailable';
  try { return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(value); }
  catch { return `${currency} ${value.toFixed(2)}`; }
};
const date = (value: string | null) => value ? new Date(value).toLocaleDateString('en-GB') : 'Not set';
const lifecycleTone = (value: string) => value === 'paid' ? 'success' : value === 'overdue' ? 'danger' : value === 'archive' ? 'neutral' : 'warning';

export default function PlatformFinanceControlPage() {
  const [payload, setPayload] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const load = useCallback(async () => {
    setLoading(true); setError(''); setPayload(null);
    try {
      const auth = await getAuthHeader();
      if (!auth) throw new Error('No active Platform Owner session.');
      const response = await fetch('/api/super-admin/finance?section=control&limit=100', { headers: { Authorization: auth }, cache: 'no-store' });
      const body = await response.json().catch(() => null) as Payload | null;
      if (!response.ok || !body) throw new Error(body?.error ?? 'Platform finance control could not be loaded.');
      setPayload(body);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Platform finance control could not be loaded.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const visible = useMemo(() => filter === 'all' ? payload?.rows ?? [] : (payload?.rows ?? []).filter((row) => row.lifecycle === filter), [filter, payload?.rows]);
  const summary = payload?.summary ?? null;
  const columns: SuperAdminDataColumn<Row>[] = [
    { key: 'invoice', label: 'Invoice', render: (row) => <PlatformEntityLink entityType="invoice" entityId={row.id} compact>{row.invoice_number ?? row.id.slice(0, 8).toUpperCase()}</PlatformEntityLink> },
    { key: 'buyer', label: 'Buyer', render: (row) => row.buyer_name },
    { key: 'supplier', label: 'Supplier', render: (row) => row.supplier_name },
    { key: 'net', label: 'Net', render: (row) => money(Number(row.net_amount ?? 0), row.currency?.toUpperCase() ?? null) },
    { key: 'vat', label: 'VAT', render: (row) => money(Number(row.vat_amount ?? 0), row.currency?.toUpperCase() ?? null) },
    { key: 'gross', label: 'Gross', render: (row) => money(Number(row.amount ?? 0), row.currency?.toUpperCase() ?? null) },
    { key: 'paid', label: 'Paid', render: (row) => money(row.paid_amount, row.currency?.toUpperCase() ?? null) },
    { key: 'outstanding', label: 'Outstanding', render: (row) => money(row.outstanding_amount, row.currency?.toUpperCase() ?? null) },
    { key: 'due', label: 'Due', render: (row) => date(row.due_date) },
    { key: 'state', label: 'State', render: (row) => <SuperAdminStatusBadge label={row.lifecycle.replaceAll('_', ' ')} tone={lifecycleTone(row.lifecycle)} /> },
  ];

  return <ProtectedRoute allowedRoles={['owner']}><SuperAdminPage>
    <SuperAdminPageHeader eyebrow="Finance" title="Trade Control" description="Buyer/supplier invoice flow and recorded settlement evidence. Monetary totals are never combined across currencies." actions={<button className="sa-button" type="button" onClick={() => void load()} disabled={loading}>{loading ? 'Loading…' : 'Refresh'}</button>} />
    {error ? <SuperAdminUnavailableState title="Trade Control unavailable" description={error} /> : null}
    {!error && summary ? <SuperAdminMetricGrid>
      <SuperAdminMetricCard label="Invoices" value={summary.invoices.toLocaleString()} tone="info" />
      <SuperAdminMetricCard label="Trade gross" value={money(summary.gross, summary.currency)} note={summary.monetaryTotalsAvailable ? summary.currency : 'Separated by currency below'} tone={summary.monetaryTotalsAvailable ? 'info' : 'unavailable'} />
      <SuperAdminMetricCard label="Recorded paid" value={money(summary.paid, summary.currency)} tone={summary.monetaryTotalsAvailable ? 'success' : 'unavailable'} />
      <SuperAdminMetricCard label="Outstanding" value={money(summary.outstanding, summary.currency)} tone={summary.monetaryTotalsAvailable ? 'warning' : 'unavailable'} />
      <SuperAdminMetricCard label="Overdue invoices" value={summary.overdueCount.toLocaleString()} note={summary.monetaryTotalsAvailable ? money(summary.overdueValue, summary.currency) : 'Value separated by currency'} tone={summary.overdueCount ? 'danger' : 'success'} />
      <SuperAdminMetricCard label="Partial payments" value={summary.partialPayments.toLocaleString()} tone="info" />
    </SuperAdminMetricGrid> : null}
    {!error && payload && !summary?.monetaryTotalsAvailable ? <SuperAdminNotice tone="warning">{payload.note}</SuperAdminNotice> : null}
    {!error && payload && payload.currencyBreakdown.length > 1 ? <SuperAdminSectionCard title="Currency breakdown" description="Each currency is reported independently; no FX conversion is inferred.">
      <SuperAdminMetricGrid>{payload.currencyBreakdown.map((item) => <SuperAdminMetricCard key={item.currency} label={`${item.currency} outstanding`} value={money(item.outstanding, item.currency)} note={`${item.invoices} invoices · ${money(item.paid, item.currency)} paid`} tone={item.currency === 'UNSPECIFIED' ? 'unavailable' : 'info'} />)}</SuperAdminMetricGrid>
    </SuperAdminSectionCard> : null}
    {!error ? <SuperAdminSectionCard title="Platform trade ledger" description={payload?.note ?? 'Verified invoice and payment-history evidence only.'} actions={<select value={filter} onChange={(event) => setFilter(event.target.value)} className="sa-input" aria-label="Trade lifecycle filter"><option value="all">All</option><option value="draft">Draft</option><option value="awaiting_payment">Awaiting Payment</option><option value="overdue">Overdue</option><option value="paid">Paid</option><option value="archive">Archive</option></select>} flush>
      {loading ? <SuperAdminEmptyState title="Loading verified trade control…" /> : visible.length === 0 ? <SuperAdminEmptyState title="No invoices in this view" /> : <SuperAdminDataGrid columns={columns} rows={visible} rowKey={(row) => row.id} minWidth={1180} />}
    </SuperAdminSectionCard> : null}
  </SuperAdminPage></ProtectedRoute>;
}
