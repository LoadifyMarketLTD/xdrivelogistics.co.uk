'use client';

import SuperAdminLiveTablePage from '@/app/super-admin/_components/SuperAdminLiveTablePage';
import { StatusChip, formatDateTime } from '@/app/super-admin/_components/superAdminFormatters';

type Row = {
  id: string;
  company_name: string;
  subject: string | null;
  description: string | null;
  category: string | null;
  status: string;
  priority: string | null;
  created_at: string | null;
  resolved_at: string | null;
  closed_at: string | null;
};

export default function Page() {
  return (
    <SuperAdminLiveTablePage<Row>
      icon="🎫"
      title="Support Tickets"
      sectionLabel="Support"
      description="Ticket queue and SLA visibility across all companies."
      endpoint="/api/super-admin/support?section=tickets&limit=250"
      summaryField="summary"
      noteField="note"
      emptyMessage="No support tickets found."
      columns={[
        {
          key: 'company',
          label: 'Company',
          render: (row) => <span style={{ fontSize: '0.78rem' }}>{row.company_name ?? 'Unknown'}</span>,
        },
        {
          key: 'subject',
          label: 'Subject',
          render: (row) => <span style={{ fontSize: '0.75rem' }}>{row.subject ?? '—'}</span>,
        },
        {
          key: 'category',
          label: 'Category',
          render: (row) => <span style={{ fontSize: '0.75rem', textTransform: 'capitalize' }}>{row.category ?? '—'}</span>,
        },
        {
          key: 'status',
          label: 'Status',
          render: (row) => <StatusChip value={row.status} />,
        },
        {
          key: 'priority',
          label: 'Priority',
          render: (row) => <span style={{ fontSize: '0.75rem', textTransform: 'capitalize' }}>{row.priority ?? '—'}</span>,
        },
        {
          key: 'created_at',
          label: 'Created',
          render: (row) => (
            <span style={{ fontSize: '0.75rem' }}>
              {row.created_at ? formatDateTime(row.created_at) : '—'}
            </span>
          ),
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
