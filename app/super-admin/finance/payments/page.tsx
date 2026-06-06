'use client';

import SuperAdminLiveTablePage from '@/app/super-admin/_components/SuperAdminLiveTablePage';
import { StatusChip, formatDateTime } from '@/app/super-admin/_components/superAdminFormatters';

type Row = {
  id: string;
  company_name: string;
  invoice_id: string | null;
  amount: number;
  currency: string;
  status: string;
  provider: string | null;
  provider_ref: string | null;
  created_at: string;
};

export default function Page() {
  return (
    <SuperAdminLiveTablePage<Row>
      icon="💳"
      title="Payment History"
      sectionLabel="Finance"
      description="Cross-platform payment events with provider, reference, and failure tracking."
      endpoint="/api/super-admin/finance?section=payments&limit=250"
      summaryField="summary"
      emptyMessage="No payment records found."
      columns={[
        {
          key: 'company',
          label: 'Company',
          render: (row) => <span style={{ fontSize: '0.78rem' }}>{row.company_name}</span>,
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
          key: 'status',
          label: 'Status',
          render: (row) => <StatusChip value={row.status} />,
        },
        {
          key: 'provider',
          label: 'Provider',
          render: (row) => (
            <span style={{ fontSize: '0.75rem' }}>{row.provider ?? 'manual'}</span>
          ),
        },
        {
          key: 'provider_ref',
          label: 'Reference',
          render: (row) => (
            <span style={{ fontSize: '0.72rem', fontFamily: 'monospace' }}>
              {row.provider_ref ?? '—'}
            </span>
          ),
        },
        {
          key: 'created_at',
          label: 'Date',
          render: (row) => <span style={{ fontSize: '0.75rem' }}>{formatDateTime(row.created_at)}</span>,
        },
      ]}
    />
  );
}
