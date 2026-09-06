'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import ProtectedRoute from '@/app/components/ProtectedRoute';
import { getAuthHeader } from '@/app/super-admin/_lib/getAuthHeader';
import { ActionButton, AlertBanner, DataTable, EmptyState, KpiCard, KpiGrid, PageFrame, PageHeader, Panel, StatusBadge } from '@/app/components/workspace/WorkspaceUI';

type Row = {
  id: string; invoice_number: string | null; job_id: string | null; buyer_name: string; supplier_name: string;
  amount: number | null; net_amount: number | null; vat_amount: number | null; currency: string | null;
  paid_amount: number; outstanding_amount: number; due_date: string | null; lifecycle: string;
};
type Payload = { rows: Row[]; summary: { invoices: number; gross: number; net: number; vat: number; paid: number; outstanding: number; overdueCount: number; overdueValue: number; partialPayments: number }; note?: string; error?: string };
const money = (value: number, currency = 'GBP') => new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(Number(value || 0));
const date = (value: string | null) => value ? new Date(value).toLocaleDateString('en-GB') : 'Not set';

export default function PlatformFinanceControlPage() {
  const [payload, setPayload] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const auth = await getAuthHeader();
      if (!auth) throw new Error('No active session.');
      const response = await fetch('/api/super-admin/finance?section=control&limit=500', { headers: { Authorization: auth } });
      const body = await response.json().catch(() => null) as Payload | null;
      if (!response.ok || !body) throw new Error(body?.error ?? 'Platform finance control could not be loaded.');
      setPayload(body);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Platform finance control could not be loaded.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const visible = useMemo(() => filter === 'all' ? payload?.rows ?? [] : (payload?.rows ?? []).filter((row) => row.lifecycle === filter), [filter, payload?.rows]);
  const summary = payload?.summary;
  return <ProtectedRoute allowedRoles={['owner']}><PageFrame>
    <PageHeader eyebrow="Platform finance" title="Trade Control" description="Buyer/supplier invoice flow, net/VAT/gross, recorded settlements, overdue exposure and partial-payment evidence across the platform." actions={<ActionButton tone="secondary" onClick={() => void load()} disabled={loading}>Refresh</ActionButton>} />
    {error ? <AlertBanner tone="danger">{error}</AlertBanner> : null}
    <KpiGrid>
      <KpiCard label="Invoices" value={summary?.invoices ?? (loading ? '…' : 0)} tone="navy" />
      <KpiCard label="Trade gross" value={summary ? money(summary.gross) : '…'} tone="blue" />
      <KpiCard label="Recorded paid" value={summary ? money(summary.paid) : '…'} tone="green" />
      <KpiCard label="Outstanding" value={summary ? money(summary.outstanding) : '…'} tone="orange" />
      <KpiCard label="Overdue" value={summary?.overdueCount ?? (loading ? '…' : 0)} detail={summary ? money(summary.overdueValue) : undefined} tone={summary?.overdueCount ? 'red' : 'green'} />
      <KpiCard label="Partial payments" value={summary?.partialPayments ?? (loading ? '…' : 0)} tone="blue" />
    </KpiGrid>
    <Panel title="Platform trade ledger" description={payload?.note ?? 'Verified invoice and payment-history evidence only.'} actions={<select value={filter} onChange={(event) => setFilter(event.target.value)} style={{ minHeight: 34, border: '1px solid #cbd5e1', borderRadius: 8, padding: '0 10px', background: '#fff' }}><option value="all">All</option><option value="draft">Draft</option><option value="awaiting_payment">Awaiting Payment</option><option value="overdue">Overdue</option><option value="paid">Paid</option><option value="archive">Archive</option></select>}>
      <DataTable columns={['Invoice', 'Buyer', 'Supplier', 'Net', 'VAT', 'Gross', 'Paid', 'Outstanding', 'Due', 'State']} rows={visible.map((row) => [row.invoice_number ?? row.id.slice(0, 8).toUpperCase(), row.buyer_name, row.supplier_name, money(Number(row.net_amount ?? 0), row.currency ?? 'GBP'), money(Number(row.vat_amount ?? 0), row.currency ?? 'GBP'), money(Number(row.amount ?? 0), row.currency ?? 'GBP'), money(row.paid_amount, row.currency ?? 'GBP'), money(row.outstanding_amount, row.currency ?? 'GBP'), date(row.due_date), <StatusBadge key="state" value={row.lifecycle.replace(/_/g, ' ')} tone={row.lifecycle === 'paid' ? 'green' : row.lifecycle === 'overdue' ? 'red' : row.lifecycle === 'archive' ? 'grey' : 'orange'} />])} empty={<EmptyState title={loading ? 'Loading platform trade control…' : 'No invoices in this view'} />} />
    </Panel>
  </PageFrame></ProtectedRoute>;
}
