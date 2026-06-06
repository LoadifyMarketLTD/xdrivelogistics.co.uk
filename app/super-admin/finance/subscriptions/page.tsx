'use client';

import SuperAdminLiveTablePage from '@/app/super-admin/_components/SuperAdminLiveTablePage';
import { StatusChip, formatDateTime } from '@/app/super-admin/_components/superAdminFormatters';

type Row = {
  id: string;
  company_name: string;
  provider: string | null;
  provider_ref: string | null;
  status: string;
  current_period_end: string | null;
  created_at: string;
};

export default function Page() {
  return (
    <SuperAdminLiveTablePage<Row>
      icon="📦"
      title="Subscription Plans"
      sectionLabel="Finance"
      description="Platform subscription assignments and renewal status per company."
      endpoint="/api/super-admin/finance?section=subscriptions&limit=250"
      summaryField="summary"
      emptyMessage="No subscription records found."
      columns={[
        {
          key: 'company',
          label: 'Company',
          render: (row) => <span style={{ fontSize: '0.78rem' }}>{row.company_name}</span>,
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
          key: 'current_period_end',
          label: 'Period End',
          render: (row) => (
            <span style={{ fontSize: '0.75rem' }}>
              {row.current_period_end ? formatDateTime(row.current_period_end) : '—'}
            </span>
          ),
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
