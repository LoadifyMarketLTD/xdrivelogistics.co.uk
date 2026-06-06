'use client';

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

export default function Page() {
  return (
    <SuperAdminLiveTablePage<Row>
      icon="🧾"
      title="Platform Invoices"
      sectionLabel="Finance"
      description="Cross-company invoice ledger with status, amounts, and reconciliation data."
      endpoint="/api/super-admin/finance?section=invoices&limit=250"
      summaryField="summary"
      emptyMessage="No invoices found."
      columns={[
        {
          key: 'invoice_number',
          label: 'Invoice #',
          render: (row) => (
            <span style={{ fontWeight: 700, fontSize: '0.8rem' }}>{row.invoice_number}</span>
          ),
        },
        {
          key: 'company',
          label: 'Company',
          render: (row) => (
            <span style={{ fontSize: '0.78rem' }}>{row.company_name}</span>
          ),
        },
        {
          key: 'client',
          label: 'Client',
          render: (row) => (
            <span style={{ fontSize: '0.78rem' }}>{row.client_name}</span>
          ),
        },
        {
          key: 'status',
          label: 'Status',
          render: (row) => <StatusChip value={row.status} />,
        },
        {
          key: 'amount',
          label: 'Amount',
          render: (row) => (
            <span style={{ fontWeight: 700, fontSize: '0.8rem' }}>
              £{Number(row.amount).toFixed(2)} {row.currency !== 'GBP' ? row.currency : ''}
            </span>
          ),
        },
        {
          key: 'invoice_date',
          label: 'Invoice Date',
          render: (row) => <span style={{ fontSize: '0.75rem' }}>{row.invoice_date ?? '—'}</span>,
        },
        {
          key: 'due_date',
          label: 'Due Date',
          render: (row) => <span style={{ fontSize: '0.75rem' }}>{row.due_date ?? '—'}</span>,
        },
        {
          key: 'created_at',
          label: 'Created',
          render: (row) => <span style={{ fontSize: '0.75rem' }}>{formatDateTime(row.created_at)}</span>,
        },
      ]}
    />
  );
}
