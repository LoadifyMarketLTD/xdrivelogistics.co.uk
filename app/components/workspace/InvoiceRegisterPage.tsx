'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCompanyWorkspaceData, type WorkspaceInvoice } from './useCompanyWorkspaceData';
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

const money = (value: number | null | undefined) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(Number(value ?? 0));
const date = (value: string | null | undefined) =>
  value ? new Date(value).toLocaleDateString('en-GB') : 'Not set';

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
  const [status, setStatus] = useState('all');
  const page = config[mode];

  const invoices = useMemo(() => {
    const scoped = workspace.invoices.filter((invoice) => {
      if (mode === 'customer') {
        return invoice.buyer_company_id === workspace.companyId || workspace.jobs.some((job) => job.id === invoice.job_id);
      }
      if (mode === 'broker-customer') return invoice.company_id === workspace.companyId;
      return invoice.buyer_company_id === workspace.companyId;
    });
    if (status === 'all') return scoped;
    return scoped.filter((invoice) => String(invoice.payment_status ?? invoice.status).toLowerCase() === status);
  }, [mode, status, workspace.companyId, workspace.invoices, workspace.jobs]);

  const allScoped = useMemo(() => workspace.invoices.filter((invoice) => {
    if (mode === 'customer') return invoice.buyer_company_id === workspace.companyId || workspace.jobs.some((job) => job.id === invoice.job_id);
    if (mode === 'broker-customer') return invoice.company_id === workspace.companyId;
    return invoice.buyer_company_id === workspace.companyId;
  }), [mode, workspace.companyId, workspace.invoices, workspace.jobs]);

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
        description="Open a row to view commercial detail, documents, status history, payments and disputes."
        actions={
          <select value={status} onChange={(event) => setStatus(event.target.value)} style={{ border: '1px solid #d7e0ea', borderRadius: 8, padding: '0.5rem 0.65rem', background: '#fff', fontSize: '0.76rem' }}>
            <option value="all">All statuses</option>
            <option value="draft">Draft</option>
            <option value="sent">Sent</option>
            <option value="unpaid">Unpaid</option>
            <option value="paid">Paid</option>
            <option value="disputed">Disputed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        }
      >
        <DataTable
          columns={['Invoice', 'Job', 'Counterparty', 'Amount', 'Due', 'Status', 'Action']}
          rows={invoices.map((invoice) => [
            <button key="number" type="button" onClick={() => openInvoice(invoice)} style={{ border: 0, background: 'transparent', padding: 0, color: '#1d4ed8', fontWeight: 850, cursor: 'pointer' }}>{invoice.invoice_number ?? invoice.id.slice(0, 8).toUpperCase()}</button>,
            invoice.job_id?.slice(0, 8).toUpperCase() ?? '—',
            invoice.client_name ?? (mode === 'broker-carrier' ? 'Carrier' : 'Customer'),
            money(invoice.amount),
            date(invoice.due_date),
            <StatusBadge key="status" value={invoice.payment_status ?? invoice.status} />,
            <ActionButton key="action" tone="secondary" onClick={() => openInvoice(invoice)}>Open</ActionButton>,
          ])}
          empty={<EmptyState title={workspace.loading ? 'Loading invoices…' : 'No invoices found'} />}
        />
      </Panel>
    </PageFrame>
  );
}
