'use client';

import SuperAdminLiveTablePage from '@/app/super-admin/_components/SuperAdminLiveTablePage';
import { formatDateTime } from '@/app/super-admin/_components/superAdminFormatters';

type Row = {
  id: string;
  company_name: string;
  invoice_id: string | null;
  reviewer_id: string | null;
  rating: number | null;
  comment: string | null;
  created_at: string;
};

export default function Page() {
  return (
    <SuperAdminLiveTablePage<Row>
      icon="⚠️"
      title="Complaints"
      sectionLabel="Support"
      description="Customer and partner complaint triage — low-rated reviews and reported issues."
      endpoint="/api/super-admin/support?section=complaints&limit=250"
      summaryField="summary"
      noteField="note"
      emptyMessage="No complaints found."
      columns={[
        {
          key: 'company',
          label: 'Company',
          render: (row) => <span style={{ fontSize: '0.78rem' }}>{row.company_name}</span>,
        },
        {
          key: 'rating',
          label: 'Rating',
          render: (row) => (
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: Number(row.rating) <= 2 ? '#F5A300' : Number(row.rating) <= 3 ? '#F5A300' : '#1D57D8' }}>
              {row.rating != null ? `${row.rating}/5 ${'★'.repeat(Math.min(Number(row.rating), 5))}` : '—'}
            </span>
          ),
        },
        {
          key: 'comment',
          label: 'Comment',
          render: (row) => (
            <span style={{ fontSize: '0.75rem', color: '#0B2F6B' }}>{row.comment ?? '—'}</span>
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
