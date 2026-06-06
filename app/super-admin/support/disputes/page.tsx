'use client';

import SuperAdminLiveTablePage from '@/app/super-admin/_components/SuperAdminLiveTablePage';
import { StatusChip, formatDateTime } from '@/app/super-admin/_components/superAdminFormatters';

type Row = {
  id: string;
  company_name: string;
  invoice_id: string | null;
  reason: string;
  details: string | null;
  status: string;
  resolution_note: string | null;
  created_at: string;
  resolved_at: string | null;
};

export default function Page() {
  return (
    <SuperAdminLiveTablePage<Row>
      icon="⚖️"
      title="Disputes"
      sectionLabel="Support"
      description="Invoice dispute investigation and resolution management across all companies."
      endpoint="/api/super-admin/support?section=disputes&limit=250"
      summaryField="summary"
      emptyMessage="No disputes found."
      columns={[
        {
          key: 'company',
          label: 'Company',
          render: (row) => <span style={{ fontSize: '0.78rem' }}>{row.company_name}</span>,
        },
        {
          key: 'status',
          label: 'Status',
          render: (row) => <StatusChip status={row.status} />,
        },
        {
          key: 'reason',
          label: 'Reason',
          render: (row) => (
            <span style={{ fontSize: '0.75rem' }}>{row.reason}</span>
          ),
        },
        {
          key: 'details',
          label: 'Details',
          render: (row) => (
            <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>{row.details ?? '—'}</span>
          ),
        },
        {
          key: 'resolution_note',
          label: 'Resolution',
          render: (row) => (
            <span style={{ fontSize: '0.72rem', color: row.resolution_note ? '#22c55e' : '#94a3b8' }}>
              {row.resolution_note ?? '—'}
            </span>
          ),
        },
        {
          key: 'created_at',
          label: 'Filed',
          render: (row) => <span style={{ fontSize: '0.75rem' }}>{formatDateTime(row.created_at)}</span>,
        },
        {
          key: 'resolved_at',
          label: 'Resolved',
          render: (row) => (
            <span style={{ fontSize: '0.75rem' }}>
              {row.resolved_at ? formatDateTime(row.resolved_at) : '—'}
            </span>
          ),
        },
      ]}
    />
  );
}
