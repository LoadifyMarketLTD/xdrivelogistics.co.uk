'use client';

import SuperAdminLiveTablePage from '@/app/super-admin/_components/SuperAdminLiveTablePage';
import { StatusChip, formatDateTime } from '@/app/super-admin/_components/superAdminFormatters';

type Row = {
  id: string;
  name: string;
  company_number: string | null;
  email: string | null;
  status: string;
  company_type: string | null;
  created_at: string;
};

export default function Page() {
  return (
    <SuperAdminLiveTablePage<Row>
      icon="🪪"
      title="Company Verification"
      sectionLabel="Companies"
      description="Companies that have submitted onboarding and require identity, document and registration verification before approval."
      endpoint="/api/super-admin/companies?status=pending&limit=250"
      rowsField="companies"
      emptyMessage="No companies awaiting verification."
      columns={[
        {
          key: 'name',
          label: 'Company name',
          render: (row) => <strong style={{ color: '#f1f5f9' }}>{row.name}</strong>,
        },
        {
          key: 'company_number',
          label: 'Reg. number',
          render: (row) => (
            <span style={{ fontFamily: 'monospace', color: '#94a3b8', fontSize: '0.78rem' }}>
              {row.company_number ?? '—'}
            </span>
          ),
        },
        {
          key: 'email',
          label: 'Contact email',
          render: (row) => <span style={{ color: '#94a3b8' }}>{row.email ?? '—'}</span>,
        },
        {
          key: 'company_type',
          label: 'Type',
          render: (row) => (
            <span style={{ color: '#94a3b8', fontSize: '0.78rem' }}>
              {(row.company_type ?? '—').replace(/_/g, ' ')}
            </span>
          ),
        },
        {
          key: 'status',
          label: 'Status',
          render: (row) => <StatusChip value={row.status} />,
        },
        {
          key: 'created_at',
          label: 'Applied',
          render: (row) => (
            <span style={{ color: '#94a3b8', fontSize: '0.78rem' }}>
              {formatDateTime(row.created_at)}
            </span>
          ),
        },
        {
          key: 'action',
          label: 'Action',
          render: (_row) => (
            <a
              href={`/super-admin/companies/approvals`}
              style={{
                color: '#f59e0b',
                fontWeight: 700,
                fontSize: '0.75rem',
                textDecoration: 'none',
              }}
            >
              Review in Approvals →
            </a>
          ),
        },
      ]}
    />
  );
}

