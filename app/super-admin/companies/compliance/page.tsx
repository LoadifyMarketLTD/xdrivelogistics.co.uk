'use client';

import SuperAdminLiveTablePage from '@/app/super-admin/_components/SuperAdminLiveTablePage';
import { StatusChip, formatDate } from '@/app/super-admin/_components/superAdminFormatters';

type Row = {
  id: string;
  entity_type: string;
  entity_name: string;
  company_name: string;
  doc_type: string;
  status: string;
  expiry_date: string | null;
  days_until_expiry: number;
  is_expired: boolean;
  expires_soon: boolean;
};

function ExpiryBadge({ row }: { row: Row }) {
  if (row.is_expired)
    return <span style={{ color: '#ef4444', fontWeight: 700, fontSize: '0.75rem' }}>EXPIRED</span>;
  if (row.expires_soon)
    return (
      <span style={{ color: '#f59e0b', fontWeight: 700, fontSize: '0.75rem' }}>
        {row.days_until_expiry}d
      </span>
    );
  return (
    <span style={{ color: '#22c55e', fontWeight: 700, fontSize: '0.75rem' }}>
      {row.days_until_expiry}d
    </span>
  );
}

export default function Page() {
  return (
    <SuperAdminLiveTablePage<Row>
      icon="📄"
      title="Company Compliance Status"
      sectionLabel="Companies"
      description="Compliance and document expiry monitoring across all companies — insurance, operator licences and vehicle certificates."
      endpoint="/api/super-admin/compliance?section=expiries&limit=250"
      rowsField="rows"
      summaryField="summary"
      emptyMessage="No expiring or expired compliance documents found."
      columns={[
        {
          key: 'company_name',
          label: 'Company',
          render: (row) => <strong style={{ color: '#f1f5f9' }}>{row.company_name}</strong>,
        },
        {
          key: 'entity_type',
          label: 'Entity',
          render: (row) => (
            <span style={{ color: '#94a3b8', fontSize: '0.78rem', textTransform: 'capitalize' }}>
              {row.entity_type}
            </span>
          ),
        },
        {
          key: 'entity_name',
          label: 'Driver / Vehicle',
          render: (row) => <span style={{ color: '#cbd5e1' }}>{row.entity_name}</span>,
        },
        {
          key: 'doc_type',
          label: 'Document type',
          render: (row) => (
            <span style={{ color: '#94a3b8', fontSize: '0.78rem' }}>
              {row.doc_type.replace(/_/g, ' ')}
            </span>
          ),
        },
        {
          key: 'status',
          label: 'Doc status',
          render: (row) => <StatusChip value={row.status} />,
        },
        {
          key: 'expiry_date',
          label: 'Expiry date',
          render: (row) => (
            <span style={{ color: '#94a3b8', fontSize: '0.78rem' }}>
              {row.expiry_date ? formatDate(row.expiry_date) : '—'}
            </span>
          ),
        },
        {
          key: 'days',
          label: 'Days remaining',
          render: (row) => <ExpiryBadge row={row} />,
        },
        {
          key: 'action',
          label: 'Action',
          render: (_row) => (
            <a
              href="/super-admin/compliance/expiry-tracking"
              style={{ color: '#f59e0b', fontWeight: 700, fontSize: '0.75rem', textDecoration: 'none' }}
            >
              View expiry tracking →
            </a>
          ),
        },
      ]}
    />
  );
}

