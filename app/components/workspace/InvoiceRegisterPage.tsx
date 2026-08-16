'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  toCanonicalInvoiceStatusWithDueDate,
  toCanonicalPaymentStatus,
} from '../../../lib/invoiceStatus';
import { isCustomerVisibleWorkspaceInvoice, useCompanyWorkspaceData, type WorkspaceInvoice } from './useCompanyWorkspaceData';
import {
  ActionButton,
  AlertBanner,
  DataTable,
  EmptyState,
  KpiCard,
  KpiGrid,
  PageFrame,
  PageHeader,
  Panel,
  StatusBadge,
} from './WorkspaceUI';

type Mode = 'customer' | 'broker-customer' | 'broker-carrier';
type InvoiceRegisterFilter =
  | 'all'
  | 'invoice:draft'
  | 'invoice:sent'
  | 'invoice:overdue'
  | 'invoice:paid'
  | 'invoice:disputed'
  | 'invoice:cancelled'
  | 'payment:unpaid'
  | 'payment:partially_paid'
  | 'payment:paid'
  | 'payment:overdue'
  | 'payment:disputed'
  | 'payment:refunded';

const money = (value: number | null | undefined) =>
  value == null
    ? 'Not supplied'
    : new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(value);
const date = (value: string | null | undefined) =>
  value ? new Date(value).toLocaleDateString('en-GB') : 'Not set';
const xdriveReference = (jobId: string | null | undefined) => jobId ? `XDL-${jobId.slice(0, 8).toUpperCase()}` : '—';

const invoiceState = (invoice: WorkspaceInvoice) =>
  toCanonicalInvoiceStatusWithDueDate(invoice.status, invoice.due_date);

const paymentState = (invoice: WorkspaceInvoice) => {
  const invoiceFallback = String(invoice.status ?? '').trim().toLowerCase() === 'paid' ? 'paid' : 'unpaid';
  return toCanonicalPaymentStatus(invoice.payment_status, invoiceFallback);
};

const config: Record<Mode, { eyebrow: string; title: string; description: string; detailBase: string }> = {
  customer: {
    eyebrow: 'Customer finance',
    title: 'Invoices',
    description: 'Review invoices addressed to your company, supporting documents, payment records and disputes.',
    detailBase: '/customer/invoices',
  },
  'broker-customer': {
    eyebrow: 'Broker finance',
    title: 'Customer Invoices',
    description: 'Revenue invoices issued by the broker company to managed customers.',
    detailBase: '/broker/customer-invoices',
  },
  'broker-carrier': {
    eyebrow: 'Broker finance',
    title: 'Carrier Costs',
    description: 'Carrier invoices and agreed transport costs payable by the broker company.',
    detailBase: '/broker/carrier-costs',
  },
};

export default function InvoiceRegisterPage({ mode }: { mode: Mode }) {
  const router = useRouter();
  const workspace = useCompanyWorkspaceData();
  const [filter, setFilter] = useState<InvoiceRegisterFilter>('all');
  const page = config[mode];

  const invoices = useMemo(() => {
    const scoped = workspace.invoices.filter((invoice) => {
      if (mode === 'customer') {
        return isCustomerVisibleWorkspaceInvoice(invoice, workspace.companyId);
      }
      if (mode === 'broker-customer') return invoice.company_id === workspace.companyId;
      return invoice.buyer_company_id === workspace.companyId;
    });
    if (filter === 'all') return scoped;
    const [dimension, value] = filter.split(':') as ['invoice' | 'payment', string];
    return scoped.filter((invoice) => (
      dimension === 'invoice'
        ? invoiceState(invoice).toLowerCase() === value
        : paymentState(invoice) === value
    ));
  }, [filter, mode, workspace.companyId, workspace.invoices]);

  const allScoped = useMemo(() => workspace.invoices.filter((invoice) => {
    if (mode === 'customer') {
      return isCustomerVisibleWorkspaceInvoice(invoice, workspace.companyId);
    }
    if (mode === 'broker-customer') return invoice.company_id === workspace.companyId;
    return invoice.buyer_company_id === workspace.companyId;
  }), [mode, workspace.companyId, workspace.invoices]);

  const total = allScoped.reduce((sum, invoice) => sum + Number(invoice.amount ?? 0), 0);
  const unpaid = allScoped.filter((invoice) => !['paid', 'cancelled'].includes(String(invoice.payment_status ?? invoice.status).toLowerCase()));
  const overdue = unpaid.filter((invoice) => invoice.due_date && new Date(invoice.due_date).getTime() < Date.now());

  const openInvoice = (invoice: WorkspaceInvoice) => router.push(`${page.detailBase}/${invoice.id}`);

  return (
    <PageFrame>
      <PageHeader
        eyebrow={page.eyebrow}
        title={page.title}
        description={page.description}
        actions={<ActionButton tone="secondary" onClick={() => void workspace.refresh()}>Refresh</ActionButton>}
      />
      {workspace.error && <AlertBanner tone="danger">{workspace.error}</AlertBanner>}
      <KpiGrid>
        <KpiCard label="Invoices" value={allScoped.length} tone="navy" />
        <KpiCard label="Total value" value={money(total)} tone="blue" />
        <KpiCard label="Outstanding" value={unpaid.length} detail={money(unpaid.reduce((sum, invoice) => sum + Number(invoice.amount ?? 0), 0))} tone="orange" />
        <KpiCard label="Overdue" value={overdue.length} tone={overdue.length ? 'red' : 'green'} />
        <KpiCard label="Paid" value={allScoped.filter((invoice) => String(invoice.payment_status ?? invoice.status).toLowerCase() === 'paid').length} tone="green" />
      </KpiGrid>

      <Panel
        title="Invoice register"
        description="Invoice lifecycle and payment state are shown separately. Open a row to view commercial detail, documents, status history, payments and disputes."
        actions={
          <select value={filter} onChange={(event) => setFilter(event.target.value as InvoiceRegisterFilter)} style={{ border: '1px solid #d7e0ea', borderRadius: 8, padding: '0.5rem 0.65rem', background: '#fff', fontSize: '0.76rem' }}>
            <option value="all">All invoice records</option>
            <optgroup label="Invoice state">
              <option value="invoice:draft">Draft</option>
              <option value="invoice:sent">Sent</option>
              <option value="invoice:overdue">Overdue</option>
              <option value="invoice:paid">Paid</option>
              <option value="invoice:disputed">Disputed</option>
              <option value="invoice:cancelled">Cancelled</option>
            </optgroup>
            <optgroup label="Payment state">
              <option value="payment:unpaid">Unpaid</option>
              <option value="payment:partially_paid">Partially paid</option>
              <option value="payment:paid">Paid</option>
              <option value="payment:overdue">Overdue</option>
              <option value="payment:disputed">Disputed</option>
              <option value="payment:refunded">Refunded</option>
            </optgroup>
          </select>
        }
      >
        <DataTable
          columns={['Invoice', 'XDrive job', 'Counterparty', 'Amount', 'Due', 'Invoice state', 'Payment', 'Action']}
          rows={invoices.map((invoice) => [
            <button key="number" type="button" onClick={() => openInvoice(invoice)} style={{ border: 0, background: 'transparent', padding: 0, color: '#1d4ed8', fontWeight: 850, cursor: 'pointer' }}>{invoice.invoice_number ?? invoice.id.slice(0, 8).toUpperCase()}</button>,
            xdriveReference(invoice.job_id),
            invoice.client_name ?? (mode === 'broker-carrier' ? 'Carrier' : 'Customer'),
            money(invoice.amount),
            date(invoice.due_date),
            <StatusBadge key="invoice-state" value={invoiceState(invoice)} />,
            <StatusBadge key="payment-state" value={paymentState(invoice).replace(/_/g, ' ')} />,
            <ActionButton key="action" tone="secondary" onClick={() => openInvoice(invoice)}>Open</ActionButton>,
          ])}
          empty={<EmptyState title={workspace.loading ? 'Loading invoices…' : 'No invoices found'} />}
        />
      </Panel>
    </PageFrame>
  );
}
