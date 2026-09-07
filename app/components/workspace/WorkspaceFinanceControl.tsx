'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabaseClient';
import { ActionButton, AlertBanner, DataTable, EmptyState, KpiCard, KpiGrid, Panel, StatusBadge } from './WorkspaceUI';

type Role = 'carrier' | 'broker' | 'customer';
type View = 'all' | 'ready' | 'awaiting' | 'overdue' | 'paid' | 'counterparties' | 'archive';
type Invoice = {
  id: string;
  invoiceNumber: string;
  jobId: string | null;
  counterpartyName: string;
  direction: 'receivable' | 'payable';
  lifecycle: 'draft' | 'awaiting_payment' | 'overdue' | 'paid' | 'archive';
  invoiceStatus: string;
  paymentStatus: string;
  currency: string;
  net: number;
  vat: number;
  gross: number;
  paidAmount: number;
  outstandingAmount: number;
  vatRate: number;
  invoiceDate: string | null;
  dueDate: string | null;
};
type ReadyJob = { id: string; pickupLocation: string | null; deliveryLocation: string | null; clientName: string | null; updatedAt: string | null };
type Counterparty = { id: string; name: string; receivable: number; payable: number; overdue: number; invoices: number };
type Payload = {
  invoices: Invoice[];
  readyToInvoice: ReadyJob[];
  counterparties: Counterparty[];
  summary: { receivableOutstanding: number; payableOutstanding: number; overdueCount: number; overdueValue: number; paidValue: number; readyToInvoiceCount: number };
  generatedAt?: string;
  note?: string;
  error?: string;
};

const money = (value: number, currency = 'GBP') => new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(Number(value || 0));
const date = (value: string | null) => value ? new Date(value).toLocaleDateString('en-GB') : 'Not set';
const csvCell = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;

function downloadRows(rows: Invoice[]) {
  const columns = ['Direction', 'Invoice', 'Job', 'Counterparty', 'Net', 'VAT', 'Gross', 'Paid', 'Outstanding', 'Currency', 'Due', 'Lifecycle'];
  const body = rows.map((invoice) => [invoice.direction, invoice.invoiceNumber, invoice.jobId ?? '', invoice.counterpartyName, invoice.net, invoice.vat, invoice.gross, invoice.paidAmount, invoice.outstandingAmount, invoice.currency, invoice.dueDate ?? '', invoice.lifecycle]);
  const csv = [columns, ...body].map((row) => row.map(csvCell).join(',')).join('\n');
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = href;
  anchor.download = 'xdrive-finance-control.csv';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(href);
}

const detailHref = (role: Role, invoice: Invoice) => {
  if (role === 'customer') return `/customer/invoices/${invoice.id}`;
  if (role === 'broker') return invoice.direction === 'receivable'
    ? `/broker/customer-invoices/${invoice.id}`
    : `/broker/carrier-costs/${invoice.id}`;
  return `/admin/invoices/${invoice.id}`;
};

export function WorkspaceFinanceControl({ role }: { role: Role }) {
  const router = useRouter();
  const [payload, setPayload] = useState<Payload | null>(null);
  const [view, setView] = useState<View>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) { setError('Your session has expired. Please sign in again.'); setLoading(false); return; }
    try {
      const response = await fetch('/api/workspace/finance/control', { headers: { Authorization: `Bearer ${token}` } });
      const body = await response.json().catch(() => null) as Payload | null;
      if (!response.ok || !body) throw new Error(body?.error ?? 'Finance control could not be loaded.');
      setPayload(body);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Finance control could not be loaded.');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const invoices = useMemo(() => payload?.invoices ?? [], [payload?.invoices]);
  const visibleInvoices = useMemo(() => {
    if (view === 'all' || view === 'counterparties' || view === 'ready') return invoices;
    if (view === 'awaiting') return invoices.filter((invoice) => invoice.lifecycle === 'awaiting_payment' || invoice.lifecycle === 'draft');
    return invoices.filter((invoice) => invoice.lifecycle === view);
  }, [invoices, view]);
  const summary = payload?.summary;
  const showReceivables = role !== 'customer';
  const tabs: Array<[View, string]> = [
    ['all', 'All'],
    ...(role === 'customer' ? [] : [['ready', 'Ready to Invoice'] as [View, string]]),
    ['awaiting', 'Awaiting Payment'], ['overdue', 'Overdue'], ['paid', 'Paid'], ['counterparties', 'Counterparties'], ['archive', 'Archive'],
  ];

  return (
    <div data-testid={`workspace-finance-control-${role}`} style={{ display: 'grid', gap: 12 }}>
      {error ? <AlertBanner tone="danger">{error}</AlertBanner> : null}
      <KpiGrid>
        {showReceivables ? <KpiCard label="AR outstanding" value={summary ? money(summary.receivableOutstanding) : loading ? '…' : '£0.00'} tone="blue" /> : null}
        <KpiCard label="AP outstanding" value={summary ? money(summary.payableOutstanding) : loading ? '…' : '£0.00'} tone="orange" />
        <KpiCard label="Overdue" value={summary ? summary.overdueCount : loading ? '…' : 0} detail={summary ? money(summary.overdueValue) : undefined} tone={summary?.overdueCount ? 'red' : 'green'} />
        <KpiCard label="Paid value" value={summary ? money(summary.paidValue) : loading ? '…' : '£0.00'} tone="green" />
        {role !== 'customer' ? <KpiCard label="Ready to Invoice" value={summary ? summary.readyToInvoiceCount : loading ? '…' : 0} tone={summary?.readyToInvoiceCount ? 'orange' : 'green'} /> : null}
      </KpiGrid>

      <Panel
        title="Accounts control"
        description="Canonical AR/AP, invoice lifecycle and verified payment history. Net, VAT and gross remain separate; outstanding values use recorded payments only."
        actions={<><ActionButton tone="secondary" onClick={() => void load()} disabled={loading}>Refresh</ActionButton><ActionButton tone="secondary" onClick={() => downloadRows(visibleInvoices)} disabled={!visibleInvoices.length}>Export CSV</ActionButton></>}
      >
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
          {tabs.map(([id, label]) => <ActionButton key={id} tone={view === id ? 'primary' : 'secondary'} onClick={() => setView(id)}>{label}</ActionButton>)}
        </div>

        {view === 'ready' ? (
          <DataTable
            columns={['Job', 'Customer', 'Route', 'Updated', 'Action']}
            rows={(payload?.readyToInvoice ?? []).map((job) => [
              `XDL-${job.id.slice(0, 8).toUpperCase()}`,
              job.clientName ?? 'Customer',
              `${job.pickupLocation ?? 'Collection'} → ${job.deliveryLocation ?? 'Delivery'}`,
              date(job.updatedAt),
              <ActionButton key="job" tone="secondary" onClick={() => router.push(role === 'broker' ? `/broker/jobs` : `/admin/jobs/${job.id}`)}>Open job</ActionButton>,
            ])}
            empty={<EmptyState title={loading ? 'Loading invoice readiness…' : 'No completed jobs waiting for an invoice'} />}
          />
        ) : view === 'counterparties' ? (
          <DataTable
            columns={['Counterparty', 'Invoices', 'Receivable', 'Payable', 'Overdue']}
            rows={(payload?.counterparties ?? []).map((counterparty) => [counterparty.name, counterparty.invoices, money(counterparty.receivable), money(counterparty.payable), money(counterparty.overdue)])}
            empty={<EmptyState title={loading ? 'Loading counterparties…' : 'No counterparty finance activity'} />}
          />
        ) : (
          <DataTable
            columns={['Direction', 'Invoice', 'Counterparty', 'Net', 'VAT', 'Gross', 'Paid', 'Outstanding', 'Due', 'State', 'Action']}
            rows={visibleInvoices.map((invoice) => [
              <StatusBadge key="direction" value={invoice.direction === 'receivable' ? 'AR' : 'AP'} tone={invoice.direction === 'receivable' ? 'blue' : 'orange'} />,
              invoice.invoiceNumber,
              invoice.counterpartyName,
              money(invoice.net, invoice.currency),
              money(invoice.vat, invoice.currency),
              money(invoice.gross, invoice.currency),
              money(invoice.paidAmount, invoice.currency),
              money(invoice.outstandingAmount, invoice.currency),
              date(invoice.dueDate),
              <StatusBadge key="state" value={invoice.lifecycle.replace(/_/g, ' ')} tone={invoice.lifecycle === 'paid' ? 'green' : invoice.lifecycle === 'overdue' ? 'red' : invoice.lifecycle === 'archive' ? 'grey' : 'orange'} />,
              <ActionButton key="open" tone="secondary" onClick={() => router.push(detailHref(role, invoice))}>Open</ActionButton>,
            ])}
            empty={<EmptyState title={loading ? 'Loading finance control…' : 'No finance records in this view'} />}
          />
        )}
      </Panel>
      {payload?.note ? <div style={{ fontSize: 11, lineHeight: '16px', color: '#64748b' }}>{payload.note}</div> : null}
    </div>
  );
}
