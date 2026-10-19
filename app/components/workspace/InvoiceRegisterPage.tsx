'use client';

import { useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  toCanonicalInvoiceStatusWithDueDate,
  toCanonicalPaymentStatus,
} from '../../../lib/invoiceStatus';
import { isCustomerVisibleWorkspaceInvoice, useCompanyWorkspaceData, type WorkspaceInvoice } from './useCompanyWorkspaceData';
import { classifyAccountsDirection } from '../../../lib/finance/accounts';
import { invoiceSignedGrossAmount } from '../../../lib/brokerFinance';
import { classifyWorkspaceJobStage } from '../../../lib/jobs/workspaceJobStage';
import { hasCompletePodEvidence } from '../../../lib/jobs/podCompletion';
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

type AccountsReceivableView = 'dashboard' | 'all' | 'ready' | 'awaiting' | 'paid' | 'customers' | 'archive';

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
  const searchParams = useSearchParams();
  const workspace = useCompanyWorkspaceData();
  const [filter, setFilter] = useState<InvoiceRegisterFilter>('all');
  const [accountsReceivableView, setAccountsReceivableView] = useState<AccountsReceivableView>(() => {
    const requested = searchParams.get('view');
    return ['dashboard', 'all', 'ready', 'awaiting', 'paid', 'customers', 'archive'].includes(String(requested))
      ? requested as AccountsReceivableView
      : 'dashboard';
  });
  const [search, setSearch] = useState('');
  const [groupByCustomer, setGroupByCustomer] = useState(true);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
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
    const statusScoped = filter === 'all'
      ? arScoped
      : arScoped.filter((invoice) => {
          const [dimension, value] = filter.split(':') as ['invoice' | 'payment', string];
          return dimension === 'invoice'
            ? invoiceState(invoice).toLowerCase() === value
            : paymentState(invoice) === value;
        });
    const from = dateFrom ? new Date(`${dateFrom}T00:00:00`).getTime() : Number.NEGATIVE_INFINITY;
    const to = dateTo ? new Date(`${dateTo}T23:59:59.999`).getTime() : Number.POSITIVE_INFINITY;
    const dateScoped = statusScoped.filter((invoice) => {
      const raw = invoice.invoice_date ?? invoice.created_at;
      const timestamp = raw ? new Date(raw).getTime() : Number.NaN;
      return Number.isFinite(timestamp) && timestamp >= from && timestamp <= to;
    });
    const query = search.trim().toLowerCase();
    if (!query) return dateScoped;
    return dateScoped.filter((invoice) => [
      invoice.client_name,
      invoice.invoice_number,
      invoice.job_id,
      xdriveReference(invoice.job_id),
      invoice.status,
      invoice.payment_status,
    ].some((value) => String(value ?? '').toLowerCase().includes(query)));
  }, [accountsReceivableView, dateFrom, dateTo, filter, mode, search, workspace.companyId, workspace.invoices]);

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

  const visibleCustomerRows = useMemo(() => {
    const map = new Map<string, {
      name: string;
      invoices: number;
      invoicedNet: number;
      invoicedGross: number;
      paidInvoices: number;
      paidNet: number;
      paidGross: number;
      outstanding: number;
      vat: number;
    }>();
    for (const invoice of invoices) {
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
        vat: 0,
      };
      const gross = invoiceSignedGrossAmount(invoice);
      const net = Number(invoice.net_amount ?? invoice.amount ?? 0);
      current.invoices += 1;
      current.invoicedNet += net;
      current.invoicedGross += gross;
      current.vat += Number(invoice.vat_amount ?? Math.max(0, gross - net));
      if (paymentState(invoice) === 'paid') {
        current.paidInvoices += 1;
        current.paidNet += net;
        current.paidGross += gross;
      } else if (paymentState(invoice) !== 'refunded') {
        current.outstanding += gross;
      }
      map.set(name, current);
    }
    return [...map.values()].sort((a, b) => b.invoicedGross - a.invoicedGross || a.name.localeCompare(b.name));
  }, [invoices]);

  const visibleTotals = useMemo(() => ({
    net: invoices.reduce((sum, invoice) => sum + Number(invoice.net_amount ?? invoice.amount ?? 0), 0),
    vat: invoices.reduce((sum, invoice) => sum + Number(invoice.vat_amount ?? 0), 0),
    gross: invoices.reduce((sum, invoice) => sum + invoiceSignedGrossAmount(invoice), 0),
  }), [invoices]);

  const readyToInvoice = useMemo(() => {
    if (mode !== 'finance-customer') return [];
    const invoicedJobs = new Set(allScoped.map((invoice) => invoice.job_id).filter((jobId): jobId is string => Boolean(jobId)));
    return workspace.jobs
      .filter((job) => classifyWorkspaceJobStage(job) === 'completed' && hasCompletePodEvidence(job) && !invoicedJobs.has(job.id))
      .sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)));
  }, [allScoped, mode, workspace.jobs]);

  const visibleReadyToInvoice = useMemo(() => {
    const query = search.trim().toLowerCase();
    const from = dateFrom ? new Date(`${dateFrom}T00:00:00`).getTime() : Number.NEGATIVE_INFINITY;
    const to = dateTo ? new Date(`${dateTo}T23:59:59.999`).getTime() : Number.POSITIVE_INFINITY;
    return readyToInvoice.filter((job) => {
      const timestamp = new Date(job.updated_at).getTime();
      const matchesDate = Number.isFinite(timestamp) && timestamp >= from && timestamp <= to;
      const matchesSearch = !query || [
        job.id,
        xdriveReference(job.id),
        job.client_name,
        job.pickup_location,
        job.delivery_location,
      ].some((value) => String(value ?? '').toLowerCase().includes(query));
      return matchesDate && matchesSearch;
    });
  }, [dateFrom, dateTo, readyToInvoice, search]);

  const readyCustomerRows = useMemo(() => {
    const map = new Map<string, { name: string; jobs: typeof visibleReadyToInvoice; latest: string }>();
    for (const job of visibleReadyToInvoice) {
      const name = job.client_name?.trim() || 'Customer';
      const current = map.get(name) ?? { name, jobs: [], latest: job.updated_at };
      current.jobs.push(job);
      if (String(job.updated_at) > String(current.latest)) current.latest = job.updated_at;
      map.set(name, current);
    }
    return [...map.values()].sort((a, b) => b.jobs.length - a.jobs.length || a.name.localeCompare(b.name));
  }, [visibleReadyToInvoice]);

  const total = allScoped.reduce((sum, invoice) => sum + invoiceSignedGrossAmount(invoice), 0);
  const unpaid = allScoped.filter((invoice) => invoice.document_type !== 'credit_note' && !['paid', 'cancelled', 'refunded'].includes(String(invoice.payment_status ?? invoice.status).toLowerCase()));
  const overdue = unpaid.filter((invoice) => invoice.due_date && new Date(invoice.due_date).getTime() < Date.now());

  const openInvoice = (invoice: WorkspaceInvoice) => router.push(`${page.detailBase}/${invoice.id}`);
  const selectArView = (view: AccountsReceivableView) => {
    setAccountsReceivableView(view);
    setFilter('all');
    setSearch('');
    setGroupByCustomer(!['dashboard', 'all', 'customers'].includes(view));
    if (mode === 'finance-customer') router.replace(`/admin/finance/customer-invoices?view=${view}`, { scroll: false });
  };

  return (
    <PageFrame>
      <PageHeader
        eyebrow={page.eyebrow}
        title={page.title}
        description={page.description}
      />
      {workspace.error && <AlertBanner tone="danger">{workspace.error}</AlertBanner>}
      {mode === 'finance-customer' ? (
        <div role="tablist" aria-label="Accounts Receivable" style={{ display: 'flex', gap: 0, alignItems: 'stretch', borderBottom: '1px solid #d1d5db', marginBottom: 12, overflowX: 'auto' }}>
          {([
            ['dashboard', 'Dashboard'],
            ['all', 'All'],
            ['ready', 'Ready To Invoice'],
            ['awaiting', 'Awaiting Payment'],
            ['paid', 'Paid'],
            ['customers', 'Customers'],
            ['archive', 'Archive'],
          ] as Array<[AccountsReceivableView, string]>).map(([view, label]) => (
            <button key={view} type="button" role="tab" aria-selected={accountsReceivableView === view} onClick={() => selectArView(view)} style={{
              border: 0,
              borderBottom: accountsReceivableView === view ? '2px solid #111827' : '2px solid transparent',
              background: 'transparent',
              color: accountsReceivableView === view ? '#111827' : '#4b5563',
              padding: '10px 16px 9px',
              fontSize: 12,
              fontWeight: accountsReceivableView === view ? 750 : 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}>{label}</button>
          ))}
          <button type="button" role="tab" aria-selected={false} onClick={() => router.push('/admin/finance/statements')} style={{
            border: 0, borderBottom: '2px solid transparent', background: 'transparent', color: '#4b5563',
            padding: '10px 16px 9px', fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
          }}>Statements</button>
        </div>
      ) : null}
      {mode !== 'finance-customer' ? (
        <KpiGrid>
          <KpiCard label="Invoices" value={allScoped.length} tone="navy" />
          <KpiCard label="Total value" value={money(total)} tone="blue" />
          <KpiCard label="Outstanding" value={unpaid.length} detail={money(unpaid.reduce((sum, invoice) => sum + invoiceSignedGrossAmount(invoice), 0))} tone="orange" />
          <KpiCard label="Overdue" value={overdue.length} tone={overdue.length ? 'red' : 'green'} />
          <KpiCard label="Paid" value={allScoped.filter((invoice) => paymentState(invoice) === 'paid').length} tone="green" />
        </KpiGrid>
      ) : accountsReceivableView === 'dashboard' ? (
        <div style={{ display: 'grid', gap: 14, maxWidth: 860 }}>
          <Panel title="Summary" description="GBP only · current Accounts Receivable position">
            <KpiGrid>
              <KpiCard label="Ready to invoice" value={readyToInvoice.length} tone={readyToInvoice.length ? 'orange' : 'green'} />
              <KpiCard label="Awaiting payment" value={unpaid.length} detail={money(unpaid.reduce((sum, invoice) => sum + invoiceSignedGrossAmount(invoice), 0))} tone="blue" />
              <KpiCard label="Paid" value={allScoped.filter((invoice) => paymentState(invoice) === 'paid').length} detail={money(allScoped.filter((invoice) => paymentState(invoice) === 'paid').reduce((sum, invoice) => sum + invoiceSignedGrossAmount(invoice), 0))} tone="green" />
            </KpiGrid>
          </Panel>
          <Panel title="Requiring attention" description={overdue.length + ' item' + (overdue.length === 1 ? '' : 's')}>
            {overdue.length ? (
              <DataTable
                columns={['Customer', 'Invoice', 'Due date', 'Gross', 'Action']}
                rows={overdue.slice(0, 8).map((invoice) => [
                  invoice.client_name ?? 'Customer',
                  invoice.invoice_number ?? invoice.id.slice(0, 8).toUpperCase(),
                  date(invoice.due_date),
                  money(invoiceSignedGrossAmount(invoice)),
                  <ActionButton key={invoice.id} tone="secondary" onClick={() => openInvoice(invoice)}>Open</ActionButton>,
                ])}
              />
            ) : <EmptyState title="All set!" description="There are no overdue receivables requiring attention." />}
          </Panel>
          <Panel title="Shortcuts">
            <DataTable
              columns={['Check', 'Count', 'Action']}
              rows={[
                ['Invoices without Job ID', allScoped.filter((invoice) => !invoice.job_id).length, <ActionButton key="missing-job" tone="secondary" onClick={() => selectArView('all')}>View invoices</ActionButton>],
                ['Ready to invoice', readyToInvoice.length, <ActionButton key="ready" tone="secondary" onClick={() => selectArView('ready')}>Open queue</ActionButton>],
                ['Customers', customerRows.length, <ActionButton key="customers" tone="secondary" onClick={() => selectArView('customers')}>View customers</ActionButton>],
              ]}
            />
          </Panel>
        </div>
      ) : null}

      {mode === 'finance-customer' && accountsReceivableView === 'dashboard' ? null : (
      <>
      {mode === 'finance-customer' ? (
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'end', flexWrap: 'wrap', marginBottom: 8 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'end', flexWrap: 'wrap' }}>
            {accountsReceivableView !== 'customers' ? (
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 34, fontSize: 12, fontWeight: 650 }}>
                <input type="checkbox" checked={groupByCustomer} onChange={(event) => setGroupByCustomer(event.target.checked)} />
                Group by customer
              </label>
            ) : null}
            <label style={{ display: 'grid', gap: 2, fontSize: 10, fontWeight: 750, color: '#64748b' }}>
              FROM
              <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} style={{ minHeight: 34, border: '1px solid #cbd5e1', borderRadius: 4, padding: '0 8px' }} />
            </label>
            <label style={{ display: 'grid', gap: 2, fontSize: 10, fontWeight: 750, color: '#64748b' }}>
              TO
              <input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} style={{ minHeight: 34, border: '1px solid #cbd5e1', borderRadius: 4, padding: '0 8px' }} />
            </label>
            <ActionButton tone="secondary" onClick={() => { setDateFrom(''); setDateTo(''); setFilter('all'); setSearch(''); }}>Clear filters</ActionButton>
          </div>
          <input aria-label="Search Accounts Receivable" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search customer, invoice or job" style={{ minWidth: 250, minHeight: 34, border: '1px solid #94a3b8', borderRadius: 4, padding: '0 10px' }} />
        </div>
      ) : null}
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
          groupByCustomer ? (
            <DataTable
              columns={['Customer (ID)', 'No. of Records', 'Latest completion', 'Action']}
              rows={readyCustomerRows.map((customer) => [
                customer.name,
                customer.jobs.length,
                date(customer.latest),
                <ActionButton key={customer.name} tone="secondary" onClick={() => router.push('/admin/jobs/' + customer.jobs[0].id)}>View</ActionButton>,
              ])}
              empty={<EmptyState title={workspace.loading ? 'Loading invoice readiness…' : 'No results found'} />}
            />
          ) : (
            <DataTable
              columns={['Customer', 'Job / Load ID', 'Route', 'Completed', 'Action']}
              rows={visibleReadyToInvoice.map((job) => [
                job.client_name ?? 'Customer',
                xdriveReference(job.id),
                (job.pickup_location ?? 'Collection') + ' → ' + (job.delivery_location ?? 'Delivery'),
                date(job.updated_at),
                <ActionButton key={job.id} tone="secondary" onClick={() => router.push('/admin/jobs/' + job.id)}>Open job</ActionButton>,
              ])}
              empty={<EmptyState title={workspace.loading ? 'Loading invoice readiness…' : 'No results found'} />}
            />
          )
        ) : mode === 'finance-customer' && accountsReceivableView === 'customers' ? (
          <DataTable
            columns={['Customer (ID)', 'Invoiced · Number', 'Invoiced · Net', 'Invoiced · Gross', 'Payment received · Number', 'Payment received · Net', 'Payment received · Gross']}
            rows={visibleCustomerRows.map((customer) => [
              customer.name,
              customer.invoices,
              money(customer.invoicedNet),
              money(customer.invoicedGross),
              customer.paidInvoices,
              money(customer.paidNet),
              money(customer.paidGross),
            ])}
            empty={<EmptyState title={workspace.loading ? 'Loading customers…' : 'No customer invoice activity'} />}
          />
        ) : mode === 'finance-customer' && groupByCustomer && ['awaiting', 'paid', 'archive'].includes(accountsReceivableView) ? (
          <DataTable
            columns={[
              'Customer (ID) (' + visibleCustomerRows.length + ')',
              'No. of Records (' + invoices.length + ')',
              'Net total (' + money(visibleTotals.net) + ')',
              'VAT (' + money(visibleTotals.vat) + ')',
              'Gross total (' + money(visibleTotals.gross) + ')',
              'Action',
            ]}
            rows={visibleCustomerRows.map((customer) => {
              const first = invoices.find((invoice) => (invoice.client_name?.trim() || 'Customer') === customer.name);
              return [
                customer.name,
                customer.invoices,
                money(customer.invoicedNet),
                money(customer.vat),
                money(customer.invoicedGross),
                first ? <ActionButton key={customer.name} tone="secondary" onClick={() => openInvoice(first)}>View</ActionButton> : '—',
              ];
            })}
            empty={<EmptyState title={workspace.loading ? 'Loading invoices…' : 'No results found'} />}
          />
        ) : (
          <DataTable
            columns={mode === 'finance-customer'
              ? ['Customer', 'Invoice no.', 'Invoice date', 'XDrive job', 'Due date', 'Net total', 'VAT', 'Gross total', 'Status', 'Payment', 'Action']
              : ['Document', 'Invoice', 'XDrive job', 'Counterparty', 'Amount', 'Due', 'Invoice state', 'Payment', 'Action']}
            rows={invoices.map((invoice) => mode === 'finance-customer' ? [
              invoice.client_name ?? 'Customer',
              <button key="number" type="button" onClick={() => openInvoice(invoice)} style={{ border: 0, background: 'transparent', padding: 0, color: '#1d4ed8', fontWeight: 850, cursor: 'pointer' }}>{invoice.invoice_number ?? invoice.id.slice(0, 8).toUpperCase()}</button>,
              date(invoice.invoice_date ?? invoice.created_at),
              xdriveReference(invoice.job_id),
              date(invoice.due_date),
              money(Number(invoice.net_amount ?? invoice.amount ?? 0)),
              money(Number(invoice.vat_amount ?? 0)),
              money(invoiceSignedGrossAmount(invoice)),
              <StatusBadge key="invoice-state" value={invoiceState(invoice)} />,
              <StatusBadge key="payment-state" value={paymentState(invoice).replace(/_/g, ' ')} />,
              <ActionButton key="action" tone="secondary" onClick={() => openInvoice(invoice)}>Open</ActionButton>,
            ] : [
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
      </>
      )}
    </PageFrame>
  );
}
