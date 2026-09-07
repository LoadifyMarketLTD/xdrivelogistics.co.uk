'use client';

import SuperAdminLiveTablePage from '@/app/super-admin/_components/SuperAdminLiveTablePage';
import PlatformEntityLink from '@/app/super-admin/_components/control-plane/PlatformEntityLink';
import { formatDateTime } from '@/app/super-admin/_components/superAdminFormatters';

type Row = {
  id: string;
  company_id: string | null;
  company_name: string;
  reviewer_id: string | null;
  rating: number | null;
  comment: string | null;
  created_at: string;
};

export default function Page() {
  return <SuperAdminLiveTablePage<Row>
    icon="support"
    title="Complaints"
    sectionLabel="Support"
    description="Customer and partner complaint triage from canonical review evidence."
    endpoint="/api/super-admin/support?section=complaints"
    summaryField="summary"
    pageSize={50}
    emptyMessage="No complaints found."
    columns={[
      {
        key: 'company', label: 'Company',
        render: (row) => row.company_id
          ? <PlatformEntityLink entityType="company" entityId={row.company_id} compact>{row.company_name}</PlatformEntityLink>
          : row.company_name,
      },
      {
        key: 'rating', label: 'Rating',
        render: (row) => <strong style={{ color: Number(row.rating) <= 2 ? '#B42318' : Number(row.rating) <= 3 ? '#A15A00' : '#168553' }}>
          {row.rating != null ? `${row.rating}/5` : '—'}
        </strong>,
      },
      {
        key: 'comment', label: 'Comment',
        render: (row) => <span style={{ color: '#475569' }}>{row.comment ?? '—'}</span>,
      },
      {
        key: 'created_at', label: 'Date',
        render: (row) => formatDateTime(row.created_at),
      },
    ]}
  />;
}
