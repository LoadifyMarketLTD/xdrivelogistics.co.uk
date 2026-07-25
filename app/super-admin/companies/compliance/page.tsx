'use client';

import SuperAdminLiveTablePage from '@/app/super-admin/_components/SuperAdminLiveTablePage';
import { StatusChip, formatDateTime } from '@/app/super-admin/_components/superAdminFormatters';

type Row = {
  id: string;
  entity_type: string;
  entity_name: string | null;
  company_name: string | null;
  doc_type: string;
  status: string;
  expiry_date: string | null;
  issued_date: string | null;
  is_expired: boolean;
  created_at: string;
};

export default function Page() {
  return (
    <SuperAdminLiveTablePage<Row>
      icon="📋"
      title="Company Compliance"
      sectionLabel="Companies"
      description="Compliance document status across all companies — driver and vehicle documents, expiry tracking."
      endpoint="/api/super-admin/compliance?section=documents&limit=250"
      summaryField="summary"
      emptyMessage="No compliance documents found."
      columns={[
        {
          key: 'company',
          label: 'Company',
          render: (row) => <span style={{ fontSize: '0.78rem' }}>{row.company_name ?? '—'}</span>,
        },
        {
          key: 'entity',
          label: 'Entity',
          render: (row) => (
            <span style={{ fontSize: '0.75rem' }}>
              {row.entity_name ?? '—'}
              <span style={{ marginLeft: '0.3rem', fontSize: '0.65rem', color: '#94a3b8', textTransform: 'uppercase' }}>({row.entity_type})</span>
            </span>
          ),
        },
        {
          key: 'doc_type',
          label: 'Document',
          render: (row) => <span style={{ fontSize: '0.75rem', textTransform: 'capitalize' }}>{row.doc_type.replace(/_/g, ' ')}</span>,
        },
        {
          key: 'status',
          label: 'Status',
          render: (row) => <StatusChip value={row.is_expired ? 'expired' : row.status} />,
        },
        {
          key: 'expiry_date',
          label: 'Expiry',
          render: (row) => (
            <span style={{ fontSize: '0.75rem', color: row.is_expired ? '#ef4444' : '#94a3b8' }}>
              {row.expiry_date ? formatDateTime(row.expiry_date) : '—'}
            </span>
          ),
        },
        {
          key: 'created_at',
          label: 'Uploaded',
          render: (row) => <span style={{ fontSize: '0.75rem' }}>{formatDateTime(row.created_at)}</span>,
        },
      ]}
    />
  );
}
