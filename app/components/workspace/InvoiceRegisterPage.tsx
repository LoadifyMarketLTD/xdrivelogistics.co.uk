'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  toCanonicalInvoiceStatusWithDueDate,
  toCanonicalPaymentStatus,
} from '../../../lib/invoiceStatus';
import { isCustomerVisibleWorkspaceInvoice, useCompanyWorkspaceData, type WorkspaceInvoice } from './useCompanyWorkspaceData';
import { classifyAccountsDirection } from '../../../lib/finance/accounts';
import { invoiceSignedGrossAmount } from '../../../lib/brokerFinance';
import { classifyWorkspaceJobStage } from '../../../lib/jobs/workspaceJobStage';
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

type Mode = 'customer' | 'broker-customer' | 'broker-carrier' | 'finance-customer' | 'finance-carrier';
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

type AccountsReceivableView = 'all' | 'ready' | 'awaiting' | 'paid' | 'customers' | 'archive';

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

const isOutgoingMode = (mode: Mode) => mode === 'broker-customer' || mode === 'finance-customer';
const isIncomingCarrierMode = (mode: Mode) => mode === 'broker-carrier' || mode === 'finance-carrier';

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
  'finance-customer': {
    eyebrow: 'Finance workspace',
    title: 'Accounts Receivable',
    description: 'Customer or buyer invoices issued by this company. This is the Accounts Receivable register.',
    detailBase: '/admin/invoices',
  },
  'finance-carrier': {
    eyebrow: 'Finance workspace',
    title: 'Accounts Payable',
    description: 'Carrier or supplier invoices payable by this company. This is the Accounts Payable register.',
    detailBase: '/admin/finance/carrier-invoices',
  },
};

export default function InvoiceRegisterPage({ mode }: { mode: Mode }) {
  const router = useRouter();
  const workspace = useCompanyWorkspaceData();
  const [filter, setFilter] = useState<InvoiceRegisterFilter>('all');
  const [accountsReceivableView, setAccountsReceivableView] = useState<AccountsReceivableView>('all');
  const page = config[mode];

  const invoices = useMemo(() => {
    const scoped = workspace.invoices.filter((invoice) => {
      if (mode === 'customer') {
        return isCustomerVisibleWorkspaceInvoice(invoice, workspace.companyId);
      }
      if (isOutgoingMode(mode)) return classifyAccountsDirection(invoice, workspace.companyId) === 'receivable';
      return classifyAccountsDirection(invoice, workspace.companyId) === 'payable';
    });
    const arScoped = mode !== 'finance-customer'
      ? scoped
      : accountsReceivableView === 'awaiting'
        ? scoped.filter((invoice) => !['paid', 'refunded'].includes(paymentState(invoice)) && !['cancelled', 'void'].includes(String(invoice.status ?? '').toLowerCase()))
        : accountsReceivableView === 'paid'
          ? scoped.filter((invoice) => paymentState(invoice) === 'paid')
          : accountsReceivableView === 'archive'
            ? scoped.filter((invoice) => ['cancelled', 'void'].includes(String(invoice.status ?? '').toLowerCase()) || paymentState(invoice) === 'refunded')
            : scoped;
    if (filter === 'all') return arScoped;
    const [dimension, value] = filter.split(':') as ['invoice' | 'payment', string];
    return arScoped.filter((invoice) => (
      dimension === 'invoice'
        ? invoiceState(invoice).toLowerCase() === value
        : paymentState(invoice) === value
    ));
  }, [accountsReceivableView, filter, mode, workspace.companyId, workspace.invoices]);

  const allScoped = useMemo(() => workspace.invoices.filter((invoice) => {
    if (mode === 'customer') {
      return isCustomerVisibleWorkspaceInvoice(invoice, workspace.companyId);
    }
    if (isOutgoingMode(mode)) return classifyAccountsDirection(invoice, workspace.companyId) === 'receivable';
    return classifyAccountsDirection(invoice, workspace.companyId) === 'payable';
  }), [mode, workspace.companyId, workspace.invoices]);

  const customerRows = useMemo(() => {
    const map = new Map<string, {
      name: string;
      invoices: number;
      invoicedNet: number;
      invoicedGross: number;
      paidInvoices: number;
      paidNet: number;
      paidGross: number;
      outstanding: number;
    }>();
    for (const invoice of allScoped) {
      const name = invoice.client_name?.trim() || 'Customer';
      const current = map.get(name) ?? {
        name,
        invoices: 0,
        invoicedNet: 0,
        invoicedGross: 0,
        paidInvoices: 0,
        paidNet: 0,
        paidGross: 0,
        outstanding: 0,
      };
      const gross = invoiceSignedGrossAmount(invoice);
      const net = Number(invoice.net_amount ?? invoice.amount ?? 0);
      current.invoices += 1;
      current.invoicedNet += net;
      current.invoicedGross += gross;
      if (paymentState(invoice) === 'paid') {
        current.paidInvoices += 1;
        current.paidNet += net;
        current.paidGross += gross;
      } else if (paymentState(invoice) !== 'refunded') {
        current.outstanding += gross;
      }
      map.set(name, current);
    }
    return [...map.values()].sort((a, b) => b.outstanding - a.outstanding || a.name.localeCompare(b.name));
  }, [allScoped]);

  const readyToInvoice = useMemo(() => {
    if (mode !== 'finance-customer') return [];
    const invoicedJobs = new Set(allScoped.map((invoice) => invoice.job_id).filter((jobId): jobId is string => Boolean(jobId)));
    return workspace.jobs
      .filter((job) => classifyWorkspaceJobStage(job) === 'completed' && job.pod_generated === true && !invoicedJobs.has(job.id))
      .sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)));
  }, [allScoped, mode, workspace.jobs]);

  const total = allScoped.reduce((sum, invoice) => sum + invoiceSignedGrossAmount(invoice), 0);
  const unpaid = allScoped.filter((invoice) => invoice.document_type !== 'credit_note' && !['paid', 'cancelled', 'refunded'].includes(String(invoice.payment_status ?? invoice.status).toLowerCase()));
  const overdue = unpaid.filter((invoice) => invoice.due_date && new Date(invoice.due_date).getTime() < Date.now());

  const openInvoice = (invoice: WorkspaceInvoice) => router.push(`${page.detailBase}/${invoice.id}`);

  return (
    <PageFrame>
      <PageHeader
        eyebrow={page.eyebrow}
        title={page.title}
        description={page.description}
      />
      {workspace.error && <AlertBanner tone="danger">{workspace.error}</AlertBanner>}
      {mode === 'finance-customer' ? (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center', borderBottom: '1px solid #dbe3ec', paddingBottom: 6 }}>
          <ActionButton tone="secondary" onClick={() => router.push('/admin/finance')}>Dashboard</ActionButton>
          <ActionButton tone={accountsReceivableView === 'all' ? 'primary' : 'secondary'} onClick={() => { setAccountsReceivableView('all'); setFilter('all'); }}>All</ActionButton>
          <ActionButton tone={accountsReceivableView === 'ready' ? 'primary' : 'secondary'} onClick={() => { setAccountsReceivableView('ready'); setFilter('all'); }}>Ready To Invoice</ActionButton>
          <ActionButton tone={accountsReceivableView === 'awaiting' ? 'primary' : 'secondary'} onClick={() => { setAccountsReceivableView('awaiting'); setFilter('all'); }}>Awaiting Payment</ActionButton>
          <ActionButton tone={accountsReceivableView === 'paid' ? 'primary' : 'secondary'} onClick={() => { setAccountsReceivableView('paid'); setFilter('all'); }}>Paid</ActionButton>
          <ActionButton tone={accountsReceivableView === 'customers' ? 'primary' : 'secondary'} onClick={() => { setAccountsReceivableView('customers'); setFilter('all'); }}>Customers</ActionButton>
          <ActionButton tone={accountsReceivableView === 'archive' ? 'primary' : 'secondary'} onClick={() => { setAccountsReceivableView('archive'); setFilter('all'); }}>Archive</ActionButton>
          <ActionButton tone="secondary" onClick={() => router.push('/admin/finance/statements')}>Statements</ActionButton>
        </div>
      ) : null}
      <KpiGrid>
        <KpiCard label="Invoices" value={allScoped.length} tone="navy" />
        <KpiCard label="Total value" value={money(total)} tone="blue" />
        <KpiCard label="Outstanding" value={unpaid.length} detail={money(unpaid.reduce((sum, invoice) => sum + invoiceSignedGrossAmount(invoice), 0))} tone="orange" />
        <KpiCard label="Overdue" value={overdue.length} tone={overdue.length ? 'red' : 'green'} />
        <KpiCard label="Paid" value={allScoped.filter((invoice) => String(invoice.payment_status ?? invoice.status).toLowerCase() === 'paid').length} tone="green" />
      </KpiGrid>

      <Panel
        title="Invoice register"
        description="Invoice lifecycle and payment state are shown separately. Open a row to view commercial detail, documents, status history, payments and disputes."
        actions={
          <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
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
          <ActionButton tone="secondary" onClick={() => void workspace.refresh()}>Refresh</ActionButton>
          </span>
        }
      >
        {mode === 'finance-customer' && accountsReceivableView === 'ready' ? (
          <DataTable
            columns={['Job', 'Customer', 'Route', 'Completed', 'Action']}
            rows={readyToInvoice.map((job) => [
              xdriveReference(job.id),
              job.client_name ?? 'Customer',
              `${job.pickup_location ?? 'Collection'} → ${job.delivery_location ?? 'Delivery'}`,
              date(job.updated_at),
              <ActionButton key="job" tone="secondary" onClick={() => router.push(`/admin/jobs/${job.id}`)}>Open job</ActionButton>,
            ])}
            empty={<EmptyState title={workspace.loading ? 'Loading invoice readiness…' : 'No completed jobs waiting for an invoice'} />}
          />
        ) : mode === 'finance-customer' && accountsReceivableView === 'customers' ? (
          <DataTable
            columns={['Customer (ID)', 'Invoices', 'Invoiced net', 'Invoiced gross', 'Payments', 'Paid net', 'Paid gross', 'Outstanding']}
            rows={customerRows.map((customer) => [
              customer.name,
              customer.invoices,
              money(customer.invoicedNet),
              money(customer.invoicedGross),
              customer.paidInvoices,
              money(customer.paidNet),
              money(customer.paidGross),
              money(customer.outstanding),
            ])}
            empty={<EmptyState title={workspace.loading ? 'Loading customers…' : 'No customer invoice activity'} />}
          />
        ) : (
          <DataTable
            columns={['Document', 'Invoice', 'XDrive job', 'Counterparty', 'Amount', 'Due', 'Invoice state', 'Payment', 'Action']}
            rows={invoices.map((invoice) => [
              <StatusBadge key="document" value={invoice.document_type === 'credit_note' ? 'Credit note' : invoice.document_type === 'supplementary' ? 'Supplementary' : 'Invoice'} tone={invoice.document_type === 'credit_note' ? 'purple' : invoice.document_type === 'supplementary' ? 'orange' : 'blue'} />,
              <button key="number" type="button" onClick={() => openInvoice(invoice)} style={{ border: 0, background: 'transparent', padding: 0, color: '#1d4ed8', fontWeight: 850, cursor: 'pointer' }}>{invoice.invoice_number ?? invoice.id.slice(0, 8).toUpperCase()}</button>,
              xdriveReference(invoice.job_id),
              invoice.client_name ?? (isIncomingCarrierMode(mode) ? 'Carrier' : 'Customer'),
              money(invoiceSignedGrossAmount(invoice)),
              date(invoice.due_date),
              <StatusBadge key="invoice-state" value={invoiceState(invoice)} />,
              <StatusBadge key="payment-state" value={paymentState(invoice).replace(/_/g, ' ')} />,
              <ActionButton key="action" tone="secondary" onClick={() => openInvoice(invoice)}>Open</ActionButton>,
            ])}
            empty={<EmptyState title={workspace.loading ? 'Loading invoices…' : 'No invoices found'} />}
          />
        )}
      </Panel>
    </PageFrame>
  );
}
