'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabaseClient';
import { AGING_BUCKET_LABELS, type AgingBucket } from '../../../lib/finance/accounts';
import { ActionButton, AlertBanner, DataTable, EmptyState, KpiCard, KpiGrid, Panel, StatusBadge } from './WorkspaceUI';

type Role = 'carrier' | 'broker' | 'customer';
type View = 'dashboard' | 'all' | 'receivable' | 'payable' | 'ready' | 'awaiting' | 'overdue' | 'paid' | 'customers' | 'counterparties' | 'aging' | 'archive' | 'statements';
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
  agingBucket: AgingBucket;
};
type ReadyJob = { id: string; pickupLocation: string | null; deliveryLocation: string | null; clientName: string | null; updatedAt: string | null };
type Counterparty = {
  id: string;
  name: string;
  customerId: string;
  receivable: number;
  payable: number;
  overdue: number;
  invoices: number;
  totalInvoicedCount: number;
  totalInvoicedNet: number;
  totalInvoicedGross: number;
  paymentsReceivedCount: number;
  paymentsReceivedNet: number;
  paymentsReceivedGross: number;
};
type Payload = {
  invoices: Invoice[];
  readyToInvoice: ReadyJob[];
  counterparties: Counterparty[];
  summary: { receivableOutstanding: number; payableOutstanding: number; overdueCount: number; overdueValue: number; paidValue: number; readyToInvoiceCount: number; receivableAging: Record<AgingBucket, number>; payableAging: Record<AgingBucket, number> };
  generatedAt?: string;
  note?: string;
  error?: string;
};

const money = (value: number, currency = 'GBP') => new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(Number(value || 0));
const date = (value: string | null) => value ? new Date(value).toLocaleDateString('en-GB') : 'Not set';
const csvCell = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;

function downloadCsv(filename: string, columns: unknown[], body: unknown[][]) {
  const csv = [columns, ...body].map((row) => row.map(csvCell).join(',')).join('\n');
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = href;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(href);
}

function downloadRows(rows: Invoice[]) {
  downloadCsv(
    'xdrive-finance-control.csv',
    ['Direction', 'Invoice', 'Job', 'Counterparty', 'Net', 'VAT', 'Gross', 'Paid', 'Outstanding', 'Currency', 'Due', 'Aging', 'Lifecycle'],
    rows.map((invoice) => [invoice.direction, invoice.invoiceNumber, invoice.jobId ?? '', invoice.counterpartyName, invoice.net, invoice.vat, invoice.gross, invoice.paidAmount, invoice.outstandingAmount, invoice.currency, invoice.dueDate ?? '', AGING_BUCKET_LABELS[invoice.agingBucket], invoice.lifecycle]),
  );
}

function downloadCustomers(rows: Counterparty[]) {
  downloadCsv(
    'xdrive-accounts-receivable-customers.csv',
    ['Customer ID', 'Customer', 'Total invoiced Number', 'Total invoiced Net', 'Total invoiced Gross', 'Payment received Number', 'Payment received Net', 'Payment received Gross'],
    rows.map((customer) => [
      customer.customerId,
      customer.name,
      customer.totalInvoicedCount,
      customer.totalInvoicedNet,
      customer.totalInvoicedGross,
      customer.paymentsReceivedCount,
      customer.paymentsReceivedNet,
      customer.paymentsReceivedGross,
    ]),
  );
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
  const [view, setView] = useState<View>(role === 'carrier' ? 'dashboard' : 'all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [customerQuery, setCustomerQuery] = useState('');

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
    const scoped = role === 'carrier'
      ? invoices.filter((invoice) => invoice.direction === 'receivable')
      : invoices;
    if (view === 'dashboard' || view === 'all' || view === 'customers' || view === 'counterparties' || view === 'ready' || view === 'aging' || view === 'statements') return scoped;
    if (view === 'receivable') return invoices.filter((invoice) => invoice.direction === 'receivable');
    if (view === 'payable') return invoices.filter((invoice) => invoice.direction === 'payable');
    if (view === 'awaiting') return scoped.filter((invoice) => invoice.lifecycle === 'awaiting_payment' || invoice.lifecycle === 'overdue');
    return scoped.filter((invoice) => invoice.lifecycle === view);
  }, [invoices, role, view]);
  const summary = payload?.summary;
  const customers = useMemo(() => {
    const query = customerQuery.trim().toLowerCase();
    return (payload?.counterparties ?? [])
      .filter((counterparty) => counterparty.totalInvoicedCount > 0)
      .filter((counterparty) => !query
        || counterparty.name.toLowerCase().includes(query)
        || counterparty.customerId.toLowerCase().includes(query));
  }, [customerQuery, payload?.counterparties]);
  const showReceivables = role !== 'customer';
  const tabs: Array<[View, string]> = role === 'carrier'
    ? [
      ['dashboard', 'Dashboard'],
      ['all', 'All'],
      ['ready', 'Ready To Invoice'],
      ['awaiting', 'Awaiting Payment'],
      ['paid', 'Paid'],
      ['customers', 'Customers'],
      ['archive', 'Archive'],
      ['statements', 'Statements'],
    ]
    : [
      ['all', 'All'],
      ...(role === 'customer' ? [] : [['receivable', 'Accounts Receivable'] as [View, string]]),
      ['payable', 'Accounts Payable'],
      ...(role === 'customer' ? [] : [['ready', 'Ready to Invoice'] as [View, string]]),
      ['awaiting', 'Awaiting Payment'], ['overdue', 'Overdue'], ['paid', 'Paid'], ['aging', 'Aging'], ['counterparties', 'Counterparties'], ['archive', 'Archive'],
    ];

  return (
    <div data-testid={`workspace-finance-control-${role}`} style={{ display: 'grid', gap: 12 }}>
      {error ? <AlertBanner tone="danger">{error}</AlertBanner> : null}
      <KpiGrid>
        {showReceivables ? <KpiCard label="AR outstanding" value={summary ? money(summary.receivableOutstanding) : loading ? '…' : '£0.00'} tone="blue" /> : null}
        {role !== 'carrier' ? <KpiCard label="AP outstanding" value={summary ? money(summary.payableOutstanding) : loading ? '…' : '£0.00'} tone="orange" /> : null}
        <KpiCard label="Overdue" value={summary ? summary.overdueCount : loading ? '…' : 0} detail={summary ? money(summary.overdueValue) : undefined} tone={summary?.overdueCount ? 'red' : 'green'} />
        <KpiCard label="Paid value" value={summary ? money(summary.paidValue) : loading ? '…' : '£0.00'} tone="green" />
        {role !== 'customer' ? <KpiCard label="Ready To Invoice" value={summary ? summary.readyToInvoiceCount : loading ? '…' : 0} tone={summary?.readyToInvoiceCount ? 'orange' : 'green'} /> : null}
      </KpiGrid>

      <Panel
        title={role === 'carrier' ? 'Accounts Receivable' : 'Accounts control'}
        description={role === 'carrier'
          ? 'Invoice readiness, receivables, customer balances and statements for the active company.'
          : 'Canonical AR/AP, invoice lifecycle and verified payment history. Net, VAT and gross remain separate; outstanding values use recorded payments only.'}
        actions={<>
          <ActionButton tone="secondary" onClick={() => void load()} disabled={loading}>Refresh</ActionButton>
          <ActionButton
            tone="secondary"
            onClick={() => view === 'customers' ? downloadCustomers(customers) : downloadRows(visibleInvoices)}
            disabled={view === 'customers' ? !customers.length : (!visibleInvoices.length || view === 'ready' || view === 'statements')}
          >
            Export CSV
          </ActionButton>
        </>}
      >
        <div role="tablist" aria-label={role === 'carrier' ? 'Accounts Receivable' : 'Finance views'} style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
          {tabs.map(([id, label]) => <ActionButton key={id} tone={view === id ? 'primary' : 'secondary'} onClick={() => {
            if (id === 'statements' && role === 'carrier') {
              router.push('/admin/finance/statements');
              return;
            }
            setView(id);
          }}>{label}</ActionButton>)}
        </div>

        {view === 'dashboard' && role === 'carrier' ? (
          <DataTable
            columns={['Invoice', 'Customer', 'Gross', 'Received', 'Outstanding', 'Due', 'State']}
            rows={visibleInvoices.slice(0, 8).map((invoice) => [
              invoice.invoiceNumber,
              invoice.counterpartyName,
              money(invoice.gross, invoice.currency),
              money(invoice.paidAmount, invoice.currency),
              money(invoice.outstandingAmount, invoice.currency),
              date(invoice.dueDate),
              <StatusBadge key="state" value={invoice.lifecycle.replace(/_/g, ' ')} tone={invoice.lifecycle === 'paid' ? 'green' : invoice.lifecycle === 'overdue' ? 'red' : invoice.lifecycle === 'archive' ? 'grey' : 'orange'} />,
            ])}
            empty={<EmptyState title={loading ? 'Loading Accounts Receivable…' : 'No Accounts Receivable activity'} />}
          />
        ) : view === 'ready' ? (
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
        ) : view === 'aging' ? (
          <DataTable
            columns={['Aging bucket', ...(showReceivables ? ['Accounts Receivable'] : []), 'Accounts Payable']}
            rows={(Object.keys(AGING_BUCKET_LABELS) as AgingBucket[]).map((bucket) => [
              AGING_BUCKET_LABELS[bucket],
              ...(showReceivables ? [money(summary?.receivableAging?.[bucket] ?? 0)] : []),
              money(summary?.payableAging?.[bucket] ?? 0),
            ])}
            empty={<EmptyState title={loading ? 'Loading aging analysis…' : 'No aging data'} />}
          />
        ) : view === 'customers' && role === 'carrier' ? (
          <div style={{ display: 'grid', gap: 10 }}>
            <label style={{ display: 'grid', gap: 4, maxWidth: 360, fontSize: 11, fontWeight: 700, color: '#475569' }}>
              FILTER CUSTOMERS
              <input
                value={customerQuery}
                onChange={(event) => setCustomerQuery(event.target.value)}
                placeholder="Customer name or ID"
                style={{ minHeight: 34, border: '1px solid #cbd5e1', borderRadius: 4, padding: '0 10px' }}
              />
            </label>
            <DataTable
              columns={['Customer ID', 'Customer', 'Total invoiced · Number', 'Net', 'Gross', 'Payment received · Number', 'Net', 'Gross']}
              rows={customers.map((counterparty) => [
                counterparty.customerId || '—',
                counterparty.name,
                counterparty.totalInvoicedCount,
                money(counterparty.totalInvoicedNet),
                money(counterparty.totalInvoicedGross),
                counterparty.paymentsReceivedCount,
                money(counterparty.paymentsReceivedNet),
                money(counterparty.paymentsReceivedGross),
              ])}
              empty={<EmptyState title={loading ? 'Loading customers…' : 'No customer invoice activity matches this filter'} />}
            />
          </div>
        ) : view === 'counterparties' ? (
          <DataTable
            columns={['Counterparty', 'Invoices', 'Receivable', 'Payable', 'Overdue']}
            rows={(payload?.counterparties ?? []).map((counterparty) => [counterparty.name, counterparty.invoices, money(counterparty.receivable), money(counterparty.payable), money(counterparty.overdue)])}
            empty={<EmptyState title={loading ? 'Loading counterparties…' : 'No counterparty finance activity'} />}
          />
        ) : (
          <DataTable
            columns={['Direction', 'Invoice', 'Counterparty', 'Net', 'VAT', 'Gross', 'Paid', 'Outstanding', 'Due', 'Aging', 'State', 'Action']}
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
              AGING_BUCKET_LABELS[invoice.agingBucket],
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
