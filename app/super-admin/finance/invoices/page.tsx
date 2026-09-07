'use client';

import Link from 'next/link';

import SuperAdminLiveTablePage from '@/app/super-admin/_components/SuperAdminLiveTablePage';
import { StatusChip, formatDateTime } from '@/app/super-admin/_components/superAdminFormatters';

type Row = {
  id: string;
  invoice_number: string;
  company_name: string;
  client_name: string;
  status: string;
  amount: number;
  currency: string;
  invoice_date: string;
  due_date: string;
  created_at: string;
};

const formatMoney = (amount: number, currency: string | null | undefined) => {
  const code = (currency ?? 'GBP').toUpperCase();
  try {
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency: code }).format(Number(amount) || 0);
  } catch {
    return `${code} ${(Number(amount) || 0).toFixed(2)}`;
  }
};

export default function Page() {
  return (
    <SuperAdminLiveTablePage<Row>
      icon="🧾"
      title="Platform Invoices"
      sectionLabel="Finance"
      description="Cross-company invoice ledger with canonical status, currency and audit drill-down. Global monetary summaries remain on Finance Overview so mixed currencies are never silently combined."
      endpoint="/api/super-admin/finance?section=invoices"
      summaryField="summary"
      emptyMessage="No invoices found."
      columns={[
        { key: 'invoice_number', label: 'Invoice #', render: (row) => <span style={{ fontWeight: 700, fontSize: '0.8rem' }}>{row.invoice_number}</span> },
        { key: 'company', label: 'Company', render: (row) => <span style={{ fontSize: '0.78rem' }}>{row.company_name}</span> },
        { key: 'client', label: 'Client', render: (row) => <span style={{ fontSize: '0.78rem' }}>{row.client_name}</span> },
        { key: 'status', label: 'Status', render: (row) => <StatusChip value={row.status} /> },
        { key: 'amount', label: 'Amount', render: (row) => <span style={{ fontWeight: 700, fontSize: '0.8rem' }}>{formatMoney(row.amount, row.currency)}</span> },
        { key: 'invoice_date', label: 'Invoice Date', render: (row) => <span style={{ fontSize: '0.75rem' }}>{row.invoice_date ?? '—'}</span> },
        { key: 'due_date', label: 'Due Date', render: (row) => <span style={{ fontSize: '0.75rem' }}>{row.due_date ?? '—'}</span> },
        { key: 'created_at', label: 'Created', render: (row) => <span style={{ fontSize: '0.75rem' }}>{formatDateTime(row.created_at)}</span> },
        {
          key: 'reconcile', label: 'Platform Review', render: (row) => (
            <Link href={`/super-admin/finance/invoices/${encodeURIComponent(row.id)}`} style={{ color: '#1D57D8', fontWeight: 800, textDecoration: 'none', fontSize: '0.76rem' }}>
              Reconcile →
            </Link>
          ),
        },
      ]}
    />
  );
}
